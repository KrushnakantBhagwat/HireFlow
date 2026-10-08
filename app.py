import os, re, smtplib
from email.message import EmailMessage
from functools import wraps
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, flash, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import mysql.connector
from mysql.connector import Error
from PyPDF2 import PdfReader
from docx import Document
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-change-me")
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}

def db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "hr_resume_analyzer")
    )

def query(sql, params=(), fetch=False, many=False):
    conn = db()
    cur = conn.cursor(dictionary=True)
    try:
        if many:
            cur.executemany(sql, params)
        else:
            cur.execute(sql, params)
        if fetch:
            return cur.fetchall()
        conn.commit()
        return cur.lastrowid
    finally:
        cur.close()
        conn.close()
def allowed_file(name):
    return "." in name and name.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text(path):
    ext = path.rsplit(".", 1)[1].lower()
    if ext == "pdf":
        reader = PdfReader(path)
        return "\n".join((p.extract_text() or "") for p in reader.pages)
    if ext == "docx":
        doc = Document(path)
        return "\n".join(p.text for p in doc.paragraphs)
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

def tokenize(text):
    return set(re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{1,30}", (text or "").lower()))
def match_score(resume_text, job):
    resume = tokenize(resume_text)
    skills = tokenize(job.get("skills", ""))
    description = tokenize(job.get("description", ""))
    target = skills or description
    if not target:
        return 0.0
    matched = resume.intersection(target)
    # Skills are weighted more strongly than ordinary description words.
    skill_hits = len(resume.intersection(skills))
    desc_hits = len(resume.intersection(description - skills))
    denom = max(len(skills) + 0.5 * len(description - skills), 1)
    score = ((skill_hits + 0.5 * desc_hits) / denom) * 100
    return round(min(score, 100), 2)

def login_required(role=None):
    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if "user_id" not in session:
                return redirect(url_for("login"))
            if role and session.get("role") != role:
                flash("Access denied.", "danger")
                return redirect(url_for("index"))
            return fn(*args, **kwargs)
        return wrapper
    return deco

def send_selection_email(to_email, candidate_name, job_title):
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    port = int(os.getenv("SMTP_PORT", "587"))
    if not host or not user or not password:
        return False
    try:
        msg = EmailMessage()
        msg["Subject"] = f"Selected for {job_title}"
        msg["From"] = user
        msg["To"] = to_email
        msg.set_content(
            f"Hello {candidate_name},\n\n"
            f"Congratulations! You have been selected for the position of {job_title}.\n"
            "The HR team will contact you with the next steps.\n\n"
            "Regards,\nHR Team"
        )
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        print("Email error:", exc)
        return False

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form["name"].strip()
        email = request.form["email"].strip().lower()
        password = request.form["password"]
        if not name or not email or len(password) < 6:
            flash("Enter valid details. Password must be at least 6 characters.", "danger")
            return redirect(url_for("register"))
        try:
            query("INSERT INTO users(name,email,password_hash,role) VALUES(%s,%s,%s,'candidate')",
                  (name, email, generate_password_hash(password)))
            flash("Registration successful. Please log in.", "success")
            return redirect(url_for("login"))
        except Error as e:
            flash("Email already registered or database error.", "danger")
            print(e)
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        password = request.form["password"]
        users = query("SELECT * FROM users WHERE email=%s", (email,), True)
        user = users[0] if users else None
        if user and check_password_hash(user["password_hash"], password):
            session["user_id"] = user["id"]
            session["name"] = user["name"]
            session["role"] = user["role"]
            return redirect(url_for("hr_dashboard" if user["role"] == "hr" else "candidate_dashboard"))
        flash("Invalid email or password.", "danger")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))

@app.route("/candidate")
@login_required("candidate")
def candidate_dashboard():
    jobs = query("SELECT * FROM jobs ORDER BY created_at DESC", fetch=True)
    apps = query("""SELECT a.*, j.title FROM applications a
                    JOIN jobs j ON j.id=a.job_id
                    WHERE a.candidate_id=%s ORDER BY a.applied_at DESC""",
                 (session["user_id"],), True)
    return render_template("candidate.html", jobs=jobs, applications=apps)

@app.route("/apply/<int:job_id>", methods=["POST"])
@login_required("candidate")
def apply(job_id):
    phone = request.form["phone"].strip()
    file = request.files.get("resume")
    if not phone or not file or not file.filename:
        flash("Phone number and resume are required.", "danger")
        return redirect(url_for("candidate_dashboard"))
    if not allowed_file(file.filename):
        flash("Only PDF, DOCX and TXT resumes are allowed.", "danger")
        return redirect(url_for("candidate_dashboard"))
    job_rows = query("SELECT * FROM jobs WHERE id=%s", (job_id,), True)
    if not job_rows:
        flash("Job not found.", "danger")
        return redirect(url_for("candidate_dashboard"))
    if query("SELECT id FROM applications WHERE candidate_id=%s AND job_id=%s",
             (session["user_id"], job_id), True):
        flash("You already applied for this job.", "warning")
        return redirect(url_for("candidate_dashboard"))
    filename = secure_filename(file.filename)
    filename = f"{session['user_id']}_{int(datetime.now().timestamp())}_{filename}"
    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(path)
    text = extract_text(path)
    score = match_score(text, job_rows[0])
    query("""INSERT INTO applications(candidate_id,job_id,phone,resume_filename,resume_text,match_score)
             VALUES(%s,%s,%s,%s,%s,%s)""",
          (session["user_id"], job_id, phone, filename, text, score))
    flash(f"Application submitted. Match score: {score}%", "success")
    return redirect(url_for("candidate_dashboard"))

@app.route("/hr")
@login_required("hr")
def hr_dashboard():
    apps = query("""SELECT a.*, u.name, u.email, j.title
                    FROM applications a
                    JOIN users u ON u.id=a.candidate_id
                    JOIN jobs j ON j.id=a.job_id
                    ORDER BY a.match_score DESC, a.applied_at DESC""", fetch=True)
    jobs = query("SELECT * FROM jobs ORDER BY created_at DESC", fetch=True)
    stats = query("""SELECT DATE_FORMAT(applied_at,'%Y-%m') month,
                            COUNT(*) total,
                            SUM(status='Selected') selected,
                            SUM(status='Shortlisted') shortlisted
                     FROM applications
                     GROUP BY DATE_FORMAT(applied_at,'%Y-%m')
                     ORDER BY month DESC LIMIT 12""", fetch=True)
    return render_template("hr.html", applications=apps, jobs=jobs, stats=stats)

@app.route("/hr/status/<int:application_id>/<status>", methods=["POST"])
@login_required("hr")
def update_status(application_id, status):
    valid = {"Applied", "Shortlisted", "Interview", "Selected", "Rejected"}
    if status not in valid:
        flash("Invalid status.", "danger")
        return redirect(url_for("hr_dashboard"))
    rows = query("""SELECT a.*, u.name, u.email, j.title
                    FROM applications a
                    JOIN users u ON u.id=a.candidate_id
                    JOIN jobs j ON j.id=a.job_id
                    WHERE a.id=%s""", (application_id,), True)
    if not rows:
        flash("Application not found.", "danger")
        return redirect(url_for("hr_dashboard"))
    app_row = rows[0]
    query("UPDATE applications SET status=%s WHERE id=%s", (status, application_id))
    if status == "Selected":
        sent = send_selection_email(app_row["email"], app_row["name"], app_row["title"])
        flash("Candidate selected. Email sent." if sent else
              "Candidate selected. Email was not sent; check SMTP settings.", "success" if sent else "warning")
    else:
        flash(f"Status changed to {status}.", "success")
    return redirect(url_for("hr_dashboard"))

@app.route("/hr/job", methods=["POST"])
@login_required("hr")
def add_job():
    title = request.form["title"].strip()
    description = request.form["description"].strip()
    skills = request.form["skills"].strip()
    if not title or not description:
        flash("Job title and description are required.", "danger")
    else:
        query("INSERT INTO jobs(title,description,skills) VALUES(%s,%s,%s)",
              (title, description, skills))
        flash("Job created.", "success")
    return redirect(url_for("hr_dashboard"))

@app.route("/uploads/<filename>")
@login_required("hr")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
