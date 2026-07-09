// ui.js — tabs, pills, workflow bar, composer, auth gate, resizable divider

// ── Tab switching ────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-panel').forEach(function (panel) {
    panel.classList.toggle('active', panel.id === 'panel-' + tabName);
  });
}

// ── Pill state ───────────────────────────────────────────────
function setPill(id, isReady, label) {
  var el = document.getElementById(id);
  el.textContent = label + (isReady ? ' ✓' : ' ✗');
  el.classList.toggle('ready', isReady);
}

function updatePills() {
  var hasCV     = document.getElementById('cv-text').value.trim().length > 0;
  var hasJD     = document.getElementById('jd-text').value.trim().length > 0;
  var hasGitHub = document.getElementById('github-username').value.trim().length > 0
               || document.getElementById('portfolio-text').value.trim().length > 0;

  setPill('pill-cv', hasCV, 'CV');
  setPill('pill-jd', hasJD, 'JD');

  var ghPill = document.getElementById('pill-github');
  if (hasGitHub) {
    ghPill.classList.remove('pill-hidden');
    setPill('pill-github', true, 'GitHub');
  } else {
    ghPill.classList.add('pill-hidden');
  }
}

// ── Composer busy state ──────────────────────────────────────
function setComposerBusy(busy) {
  var send = document.getElementById('send-btn');
  send.disabled = busy;
  send.textContent = busy ? '…' : 'Send';
  document.querySelectorAll('.wf-btn').forEach(function (b) { b.disabled = busy; });
}

// ── Workflow bar ─────────────────────────────────────────────
function setupWorkflowBar() {
  var bar = document.getElementById('workflow-bar');
  var moreBtn = document.getElementById('wf-more-btn');

  SKILL_CONTENT.workflows.forEach(function (wf) {
    var btn = document.createElement('button');
    btn.className = 'wf-btn' + (wf.primary ? '' : ' wf-secondary wf-hidden');
    btn.textContent = wf.label;
    btn.title = wf.message;
    btn.addEventListener('click', function () { sendChatMessage(wf.message); });
    bar.insertBefore(btn, moreBtn);
  });

  var expanded = false;
  moreBtn.addEventListener('click', function () {
    expanded = !expanded;
    document.querySelectorAll('.wf-secondary').forEach(function (b) {
      b.classList.toggle('wf-hidden', !expanded);
    });
    moreBtn.textContent = expanded ? 'Less −' : 'More +';
  });
}

// ── Composer ─────────────────────────────────────────────────
function setupComposer() {
  var input = document.getElementById('composer-input');
  var send  = document.getElementById('send-btn');

  function submit() {
    var text = input.value;
    if (!text.trim() || chatBusy) return;
    input.value = '';
    sendChatMessage(text);
  }

  send.addEventListener('click', submit);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  setupAuth();

  // Tab clicks
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchTab(tab.dataset.tab);
    });
  });

  // Live pill updates as user types
  ['cv-text', 'jd-text', 'github-username', 'portfolio-text'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', updatePills);
  });

  setupWorkflowBar();
  setupComposer();

  document.getElementById('download-chat-btn').addEventListener('click', downloadChat);

  // Model label (local mode knows the model; deployed mode uses the server's)
  var modelName = (typeof LLM_MODEL !== 'undefined' && LLM_MODEL) ? LLM_MODEL : 'server default';
  document.getElementById('results-meta').textContent = modelName;
  document.getElementById('model-info').textContent = modelName;

  // Resizable divider
  var divider    = document.getElementById('divider');
  var main       = document.querySelector('.main');
  var dragging   = false;
  var startX     = 0;
  var startWidth = 0;

  divider.addEventListener('mousedown', function (e) {
    dragging   = true;
    startX     = e.clientX;
    startWidth = main.querySelector('.panel-left').getBoundingClientRect().width;
    divider.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var delta    = e.clientX - startX;
    var newWidth = Math.max(280, Math.min(700, startWidth + delta));
    main.style.gridTemplateColumns = newWidth + 'px 6px 1fr';
  });

  document.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.cursor    = '';
    document.body.style.userSelect = '';
  });

  updatePills();
});

// ── Auth gate ─────────────────────────────────────────────────
function setupAuth() {
  var gate  = document.getElementById('auth-gate');
  var input = document.getElementById('auth-input');
  var btn   = document.getElementById('auth-btn');
  var error = document.getElementById('auth-error');

  // Already authenticated this session
  if (sessionStorage.getItem('cv_screen_auth') === '1') {
    var stored = sessionStorage.getItem('cv_screen_pass') || '';
    window.userPassphrase = stored;
    gate.classList.add('hidden');
    return;
  }

  // Show gate
  gate.classList.remove('hidden');

  function admit(val) {
    window.userPassphrase = val;
    sessionStorage.setItem('cv_screen_auth', '1');
    sessionStorage.setItem('cv_screen_pass', val);
    gate.classList.add('hidden');
    error.textContent = '';
  }

  function reject(msg) {
    error.textContent = msg;
    input.value = '';
    input.focus();
  }

  function attempt() {
    var val = input.value.trim();
    if (!val) return;

    if (isLocalMode()) {
      // Local dev: compare against the passphrase declared in config.js.
      var expected = typeof APP_PASSPHRASE !== 'undefined' ? APP_PASSPHRASE : '';
      if (!expected || val === expected) admit(val);
      else reject('Incorrect passphrase.');
      return;
    }

    // Deployed: the passphrase lives server-side, so verify against the proxy
    // before admitting instead of accepting whatever was typed.
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Checking…';
    error.textContent = '';
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-passphrase': val },
      body: JSON.stringify({ verify: true })
    }).then(function (r) {
      if (r.ok) admit(val);
      else if (r.status === 401) reject('Incorrect passphrase.');
      else reject('Auth check failed (' + r.status + '). Try again.');
    }).catch(function () {
      reject('Network error — try again.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = original;
    });
  }

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') attempt();
  });
}
