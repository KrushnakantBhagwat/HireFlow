/* ===========================================================
   HireFlow — frontend prototype logic
   No backend: everything lives in memory for this session.
   =========================================================== */

(function(){

  /* ---------------- seed data ---------------- */

  const SKILL_POOL = ['JavaScript','React','Node.js','Python','SQL','Communication',
    'Project Management','UI/UX Design','Data Analysis','AWS','Java','CSS',
    'Leadership','Agile','TypeScript','Figma'];

  const STAGE_ORDER = ['applied','screened','shortlisted','interview','hired'];
  const STAGE_LABEL = {applied:'Applied', screened:'Screened', shortlisted:'Shortlisted',
    interview:'Interview', hired:'Hired'};

  let jobs = [
    { id:'j1', title:'Frontend Developer', requiredSkills:['JavaScript','React','CSS','TypeScript'] },
    { id:'j2', title:'Backend Engineer', requiredSkills:['Node.js','SQL','Python','AWS'] },
    { id:'j3', title:'Product Designer', requiredSkills:['UI/UX Design','Figma','Communication','CSS'] },
    { id:'j4', title:'Data Analyst', requiredSkills:['SQL','Python','Data Analysis','Communication'] },
  ];

  let candidates = [
    mk('Priya Nair','priya.nair@mail.com','j1','applied',false,72),
    mk('Rohan Mehta','rohan.mehta@mail.com','j1','screened',false,65),
    mk('Ananya Iyer','ananya.iyer@mail.com','j2','shortlisted',false,81),
    mk('Karan Shah','karan.shah@mail.com','j2','interview',false,77),
    mk('Fatima Sheikh','fatima.sheikh@mail.com','j3','hired',false,88,true),
    mk('Vikram Rao','vikram.rao@mail.com','j4','applied',true,40),
    mk('Neha Kulkarni','neha.kulkarni@mail.com','j3','interview',false,70),
    mk('Arjun Desai','arjun.desai@mail.com','j4','screened',false,60),
  ];

  function mk(name,email,jobId,stage,rejected,score,emailSent){
    return {
      id: 'c'+Math.random().toString(36).slice(2,9),
      name, email, contact:'', education:'', experience:'',
      appliedJobId: jobId, stage, rejected: !!rejected,
      matchScore: score, skillsDetected: [], emailSent: !!emailSent,
      resumeFileName: 'resume.pdf'
    };
  }

  const MONTHLY = [
    {m:'Apr', n:14}, {m:'May', n:22}, {m:'Jun', n:19},
    {m:'Jul', n:31}, {m:'Aug', n:27}, {m:'Sep', n:36},
  ];

  let currentCandidate = null;

  /* ---------------- helpers ---------------- */

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function showScreen(id){
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#'+id).classList.add('active');
  }

  function toast(msg){
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(()=> t.classList.remove('show'), 2400);
  }

  function jobById(id){ return jobs.find(j => j.id === id); }

  function openModal(id){ $('#'+id).classList.add('open'); }
  function closeModal(id){ $('#'+id).classList.remove('open'); }

  /* ---------------- auth screen: tabs ---------------- */

  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      const group = btn.closest('.gate-panel');
      group.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      group.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      group.querySelector(`[data-pane="${tab}"]`).classList.add('active');
    });
  });

  /* ---------------- candidate auth ---------------- */

  $('#form-cand-login').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    let found = candidates.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (!found){
      found = mk(email.split('@')[0] || 'Candidate', email, '', 'applied', false, 0);
      found.stage = null; // not yet applied to anything
    }
    enterCandidate(found);
  });

  $('#form-cand-register').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#reg-name').value.trim();
    const email = $('#reg-email').value.trim();
    const c = mk(name, email, '', null, false, 0);
    candidates.push(c);
    toast('Account created — welcome, ' + name.split(' ')[0]);
    enterCandidate(c);
  });

  $('#btn-demo-candidate').addEventListener('click', () => {
    enterCandidate(mk('Demo Candidate', 'demo.candidate@mail.com', '', null, false, 0));
  });

  function enterCandidate(candidate){
    currentCandidate = candidate;
    if (!candidates.includes(candidate)) candidates.push(candidate);
    $('#cand-name-display').textContent = candidate.name;
    $('#p-name').value = candidate.name || '';
    $('#p-email').value = candidate.email || '';
    $('#p-contact').value = candidate.contact || '';
    $('#p-education').value = candidate.education || '';
    $('#p-experience').value = candidate.experience || '';
    $('#resume-filename').textContent = 'No file selected';
    $('#analyzer-result').classList.add('hidden');
    renderJobSelect();
    renderCandidateJobsList();
    renderCandidateStatus();
    showScreen('screen-candidate');
  }

  $('#btn-cand-logout').addEventListener('click', () => {
    currentCandidate = null;
    showScreen('screen-auth');
  });

  /* ---------------- HR auth ---------------- */

  $('#form-hr-login').addEventListener('submit', e => {
    e.preventDefault();
    renderHR();
    showScreen('screen-hr');
  });

  $('#btn-hr-logout').addEventListener('click', () => showScreen('screen-auth'));

  /* ================= CANDIDATE SIDE ================= */

  $('#form-profile').addEventListener('submit', e => {
    e.preventDefault();
    if (!currentCandidate) return;
    currentCandidate.name = $('#p-name').value.trim() || currentCandidate.name;
    currentCandidate.email = $('#p-email').value.trim() || currentCandidate.email;
    currentCandidate.contact = $('#p-contact').value.trim();
    currentCandidate.education = $('#p-education').value.trim();
    currentCandidate.experience = $('#p-experience').value.trim();
    $('#cand-name-display').textContent = currentCandidate.name;
    const flag = $('#profile-saved');
    flag.classList.add('show');
    setTimeout(()=> flag.classList.remove('show'), 1600);
  });

  $('#btn-choose-file').addEventListener('click', () => $('#resume-file').click());
  $('#resume-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f){
      $('#resume-filename').textContent = f.name;
      if (currentCandidate) currentCandidate.resumeFileName = f.name;
    }
  });

  function renderJobSelect(){
    const sel = $('#job-select');
    sel.innerHTML = jobs.map(j => `<option value="${j.id}">${j.title}</option>`).join('');
  }

  $('#btn-analyze').addEventListener('click', () => {
    const jobId = $('#job-select').value;
    const job = jobById(jobId);
    if (!job){ toast('Choose a role to compare against'); return; }
    if (!$('#resume-filename').textContent || $('#resume-filename').textContent === 'No file selected'){
      toast('Choose a resume file first');
      return;
    }

    // simulate skill extraction: guaranteed overlap with 2-3 of the job's skills,
    // plus a couple of unrelated skills, to feel like a real (imperfect) parse.
    const shuffledRequired = [...job.requiredSkills].sort(()=>Math.random()-0.5);
    const overlapCount = 2 + Math.floor(Math.random()*2); // 2 or 3
    const overlap = shuffledRequired.slice(0, Math.min(overlapCount, job.requiredSkills.length));
    const extras = SKILL_POOL.filter(s => !job.requiredSkills.includes(s))
      .sort(()=>Math.random()-0.5).slice(0,2);
    const detected = [...overlap, ...extras];

    const score = Math.round((overlap.length / job.requiredSkills.length) * 100);

    if (currentCandidate){
      currentCandidate.skillsDetected = detected;
      currentCandidate.matchScore = score;
    }

    renderAnalyzerResult(detected, job, score);
  });

  function renderAnalyzerResult(detected, job, score){
    $('#analyzer-result').classList.remove('hidden');
    $('#skills-detected').innerHTML = detected.map(s =>
      `<span class="chip ${job.requiredSkills.includes(s) ? 'match' : ''}">${s}</span>`).join('');
    $('#skills-required').innerHTML = job.requiredSkills.map(s =>
      `<span class="chip ${detected.includes(s) ? 'match' : ''}">${s}</span>`).join('');
    animateScore(score);
  }

  function animateScore(target){
    const el = $('#match-score');
    let cur = 0;
    const step = Math.max(1, Math.round(target/16));
    clearInterval(animateScore._t);
    animateScore._t = setInterval(()=>{
      cur = Math.min(target, cur+step);
      el.textContent = String(cur).padStart(2,'0');
      if (cur >= target) clearInterval(animateScore._t);
    }, 25);
  }

  function renderCandidateJobsList(){
    const wrap = $('#candidate-jobs-list');
    wrap.innerHTML = jobs.map(j => `
      <div class="manifest-row">
        <div>
          <div class="manifest-row-title">${j.title}</div>
          <div class="manifest-row-sub">${j.requiredSkills.join(' · ')}</div>
        </div>
        <button class="btn btn-outline btn-sm" data-apply="${j.id}">
          ${currentCandidate && currentCandidate.appliedJobId === j.id ? 'Applied' : 'Apply'}
        </button>
      </div>
    `).join('');

    wrap.querySelectorAll('[data-apply]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentCandidate) return;
        if (!currentCandidate.name || !currentCandidate.email){
          toast('Save your profile with a name and email first');
          return;
        }
        currentCandidate.appliedJobId = btn.dataset.apply;
        currentCandidate.stage = 'applied';
        currentCandidate.rejected = false;
        toast('Applied to ' + jobById(btn.dataset.apply).title);
        renderCandidateJobsList();
        renderCandidateStatus();
      });
    });
  }

  function renderCandidateStatus(){
    const block = $('#candidate-status-block');
    if (!currentCandidate || !currentCandidate.appliedJobId || !currentCandidate.stage){
      block.innerHTML = '<p class="muted">Apply to a role above to track its status here.</p>';
      return;
    }
    const job = jobById(currentCandidate.appliedJobId);
    const label = currentCandidate.rejected ? 'Not selected' : STAGE_LABEL[currentCandidate.stage];
    const dotClass = currentCandidate.rejected ? 'rejected' : (currentCandidate.stage === 'hired' ? 'hired' : '');
    block.innerHTML = `
      <p class="manifest-row-title">${job.title}</p>
      <div class="status-line">
        <span class="status-dot ${dotClass}"></span>
        <span>${label}${currentCandidate.matchScore ? ' — match score ' + currentCandidate.matchScore + '%' : ''}</span>
      </div>
    `;
  }

  /* ================= HR SIDE ================= */

  function stageIndex(stage){ return STAGE_ORDER.indexOf(stage); }

  function renderHR(){
    renderKPIs();
    renderFunnel();
    renderAnalyticsChart();
    renderJobsManifest();
    populateFilterSelects();
    renderCandidateTable();
  }

  function renderKPIs(){
    const total = candidates.filter(c=>c.appliedJobId).length;
    const hired = candidates.filter(c=>c.stage==='hired').length;
    const inPipeline = candidates.filter(c=>c.appliedJobId && !c.rejected && c.stage!=='hired').length;
    const scored = candidates.filter(c=>c.matchScore>0);
    const avgScore = scored.length ? Math.round(scored.reduce((a,c)=>a+c.matchScore,0)/scored.length) : 0;

    $('#kpi-row').innerHTML = `
      <div class="kpi-card"><div class="kpi-num">${total}</div><div class="kpi-label">Total applicants</div></div>
      <div class="kpi-card"><div class="kpi-num">${inPipeline}</div><div class="kpi-label">In active pipeline</div></div>
      <div class="kpi-card"><div class="kpi-num">${hired}</div><div class="kpi-label">Hired this cycle</div></div>
      <div class="kpi-card"><div class="kpi-num">${avgScore}%</div><div class="kpi-label">Average AI match score</div></div>
    `;
  }

  function renderFunnel(){
    const applied = candidates.filter(c=>c.appliedJobId);
    const max = applied.length || 1;
    const rows = STAGE_ORDER.map(stage => {
      const count = applied.filter(c => stageIndex(c.stage) >= stageIndex(stage)).length;
      const pct = Math.round((count/max)*100);
      return `
        <div class="funnel-row">
          <span class="funnel-name">${STAGE_LABEL[stage]}</span>
          <div class="funnel-bar-track"><div class="funnel-bar-fill" style="width:${pct}%"></div></div>
          <span class="funnel-count">${count}</span>
        </div>
      `;
    }).join('');
    $('#funnel-board').innerHTML = rows;
  }

  function renderAnalyticsChart(){
    const max = Math.max(...MONTHLY.map(m=>m.n));
    $('#analytics-chart').innerHTML = MONTHLY.map(m => `
      <div class="bar-col">
        <div class="bar-fill" style="height:${Math.round((m.n/max)*100)}%"></div>
        <span class="bar-month">${m.m}</span>
      </div>
    `).join('');
  }

  function renderJobsManifest(){
    const wrap = $('#jobs-manifest');
    wrap.innerHTML = `
      <div class="job-add-form">
        <input type="text" id="new-job-title" placeholder="Role title">
        <input type="text" id="new-job-skills" placeholder="Required skills, comma separated">
      </div>
    ` + jobs.map(j => {
      const count = candidates.filter(c=>c.appliedJobId===j.id).length;
      return `
        <div class="manifest-row">
          <div>
            <div class="manifest-row-title">${j.title}</div>
            <div class="manifest-row-sub">${j.requiredSkills.join(' · ')}</div>
          </div>
          <span class="manifest-row-meta">${count} applicant${count===1?'':'s'}</span>
        </div>
      `;
    }).join('');
  }

  $('#btn-add-job').addEventListener('click', () => {
    const title = $('#new-job-title') && $('#new-job-title').value.trim();
    const skillsRaw = $('#new-job-skills') && $('#new-job-skills').value.trim();
    if (!title || !skillsRaw){ toast('Enter a title and required skills'); return; }
    const skills = skillsRaw.split(',').map(s=>s.trim()).filter(Boolean);
    jobs.push({ id:'j'+Math.random().toString(36).slice(2,7), title, requiredSkills: skills });
    toast('Added opening: ' + title);
    renderJobsManifest();
    populateFilterSelects();
    if (currentCandidate) { renderJobSelect(); renderCandidateJobsList(); }
  });

  function populateFilterSelects(){
    const sel = $('#filter-job');
    const current = sel.value;
    sel.innerHTML = '<option value="">All roles</option>' +
      jobs.map(j => `<option value="${j.id}">${j.title}</option>`).join('');
    sel.value = current;
  }

  function renderCandidateTable(){
    const search = $('#filter-search').value.trim().toLowerCase();
    const jobFilter = $('#filter-job').value;
    const statusFilter = $('#filter-status').value;

    const rows = candidates.filter(c => c.appliedJobId).filter(c => {
      if (search && !c.name.toLowerCase().includes(search)) return false;
      if (jobFilter && c.appliedJobId !== jobFilter) return false;
      const effectiveStatus = c.rejected ? 'rejected' : c.stage;
      if (statusFilter && effectiveStatus !== statusFilter) return false;
      return true;
    });

    if (!rows.length){
      $('#candidate-table-body').innerHTML = `<tr><td colspan="5" class="muted" style="padding:18px 10px;">No candidates match these filters.</td></tr>`;
      return;
    }

    $('#candidate-table-body').innerHTML = rows.map(c => {
      const job = jobById(c.appliedJobId);
      const effectiveStatus = c.rejected ? 'rejected' : c.stage;
      return `
        <tr>
          <td>
            <div class="candidate-name">${c.name}</div>
            <div class="candidate-email">${c.email}</div>
          </td>
          <td>${job ? job.title : '—'}</td>
          <td class="score-pill">${c.matchScore || 0}%</td>
          <td><span class="status-tag ${effectiveStatus}">${c.rejected ? 'Rejected' : STAGE_LABEL[c.stage]}</span></td>
          <td class="row-actions">${actionButtons(c)}</td>
        </tr>
      `;
    }).join('');

    // wire up action buttons
    $$('#candidate-table-body [data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
    });
  }

  function actionButtons(c){
    if (c.rejected) return `<span class="muted">Closed</span>`;
    switch(c.stage){
      case 'applied':
        return btn('screen','Screen',c.id) + btn('reject','Reject',c.id,'danger');
      case 'screened':
        return btn('shortlist','Shortlist',c.id) + btn('reject','Reject',c.id,'danger');
      case 'shortlisted':
        return btn('interview','Interview',c.id) + btn('reject','Reject',c.id,'danger');
      case 'interview':
        return btn('hire','Select / Hire',c.id,'positive') + btn('reject','Reject',c.id,'danger');
      case 'hired':
        return `<span class="muted">${c.emailSent ? 'Offer sent' : 'Hired'}</span>`;
      default:
        return '';
    }
  }
  function btn(action,label,id,cls){
    return `<button data-action="${action}" data-id="${id}" class="${cls||''}">${label}</button>`;
  }

  function handleAction(action, id){
    const c = candidates.find(x=>x.id===id);
    if (!c) return;
    if (action === 'screen'){ c.stage='screened'; toast(c.name+' moved to Screened'); }
    if (action === 'shortlist'){ c.stage='shortlisted'; toast(c.name+' shortlisted'); }
    if (action === 'interview'){ c.stage='interview'; toast(c.name+' scheduled for interview'); }
    if (action === 'reject'){ c.rejected = true; toast(c.name+' marked as rejected'); }
    if (action === 'hire'){ openEmailModal(c); return; }
    renderCandidateTable();
    renderKPIs();
    renderFunnel();
  }

  function openEmailModal(c){
    const job = jobById(c.appliedJobId);
    $('#email-to').textContent = c.email;
    $('#email-subject').textContent = `Your offer: ${job.title} at HireFlow`;
    $('#email-body').textContent =
`Hi ${c.name.split(' ')[0]},

Congratulations — we'd like to offer you the ${job.title} role at HireFlow.

Your application stood out through screening and interviews, and the team is excited to have you on board. We'll follow up shortly with next steps and paperwork.

Welcome aboard,
The HireFlow Hiring Team`;
    $('#modal-email').dataset.candidateId = c.id;
    openModal('modal-email');
  }

  $('#btn-send-email').addEventListener('click', () => {
    const id = $('#modal-email').dataset.candidateId;
    const c = candidates.find(x=>x.id===id);
    if (c){
      c.stage = 'hired';
      c.emailSent = true;
      toast('Offer email sent to ' + c.name);
    }
    closeModal('modal-email');
    renderCandidateTable();
    renderKPIs();
    renderFunnel();
  });

  $$('.modal-close').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
  $$('.modal-overlay').forEach(o => o.addEventListener('click', e => {
    if (e.target === o) closeModal(o.id);
  }));

  ['filter-search','filter-job','filter-status'].forEach(id => {
    $('#'+id).addEventListener('input', renderCandidateTable);
    $('#'+id).addEventListener('change', renderCandidateTable);
  });

  /* ---------------- final report ---------------- */

  $('#btn-final-report').addEventListener('click', () => {
    renderReport();
    openModal('modal-report');
  });

  function renderReport(){
    const applied = candidates.filter(c=>c.appliedJobId);
    const hired = applied.filter(c=>c.stage==='hired');
    const rejected = applied.filter(c=>c.rejected);
    const active = applied.filter(c=>!c.rejected && c.stage!=='hired');
    const scored = applied.filter(c=>c.matchScore>0);
    const avgScore = scored.length ? Math.round(scored.reduce((a,c)=>a+c.matchScore,0)/scored.length) : 0;

    const byJob = jobs.map(j => {
      const jc = applied.filter(c=>c.appliedJobId===j.id);
      return { job:j, total: jc.length, hired: jc.filter(c=>c.stage==='hired').length };
    });

    $('#report-body').innerHTML = `
      <div class="report-section">
        <h4>Overview</h4>
        <div class="report-line"><span>Total applicants</span><span>${applied.length}</span></div>
        <div class="report-line"><span>Currently in pipeline</span><span>${active.length}</span></div>
        <div class="report-line"><span>Hired</span><span>${hired.length}</span></div>
        <div class="report-line"><span>Rejected</span><span>${rejected.length}</span></div>
        <div class="report-line"><span>Average AI match score</span><span>${avgScore}%</span></div>
      </div>
      <div class="report-section">
        <h4>By role</h4>
        ${byJob.map(r => `<div class="report-line"><span>${r.job.title}</span><span>${r.total} applicants · ${r.hired} hired</span></div>`).join('')}
      </div>
      <div class="report-section">
        <h4>Hired candidates</h4>
        ${hired.length ? hired.map(c => `<div class="report-line"><span>${c.name}</span><span>${jobById(c.appliedJobId).title}</span></div>`).join('')
          : '<p class="muted">No candidates hired yet.</p>'}
      </div>
    `;
  }

  $('#btn-download-report').addEventListener('click', () => {
    const applied = candidates.filter(c=>c.appliedJobId);
    const hired = applied.filter(c=>c.stage==='hired');
    const lines = [
      'HIREFLOW — FINAL RECRUITMENT REPORT',
      '='.repeat(40),
      `Total applicants: ${applied.length}`,
      `Hired: ${hired.length}`,
      `Rejected: ${applied.filter(c=>c.rejected).length}`,
      '',
      'BY ROLE',
      ...jobs.map(j => {
        const jc = applied.filter(c=>c.appliedJobId===j.id);
        return `- ${j.title}: ${jc.length} applicants, ${jc.filter(c=>c.stage==='hired').length} hired`;
      }),
      '',
      'HIRED CANDIDATES',
      ...(hired.length ? hired.map(c => `- ${c.name} — ${jobById(c.appliedJobId).title}`) : ['(none yet)']),
    ];
    const blob = new Blob([lines.join('\n')], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hireflow-final-report.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

})();
