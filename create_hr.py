from app import query
from werkzeug.security import generate_password_hash

name = input("HR name: ").strip()
email = input("HR email: ").strip().lower()
password = input("HR password (min 6 chars): ")

if len(password) < 6:
    raise SystemExit("Password must be at least 6 characters.")

try:
    query(
        "INSERT INTO users(name,email,password_hash,role) VALUES(%s,%s,%s,'hr')",
        (name, email, generate_password_hash(password))
    )
    print("HR account created successfully.")
except Exception as e:
    print("Could not create HR account:", e)
