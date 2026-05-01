// ui.js — tab switching, pill state, button enable/disable, run handler

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

  document.getElementById('run-btn').disabled = !(hasCV && hasJD);
}

// ── Results panel state ──────────────────────────────────────
// Accepted values: 'empty' | 'loading' | 'error' | 'results'
function showState(state) {
  document.getElementById('state-empty').classList.toggle('hidden',    state !== 'empty');
  document.getElementById('state-loading').classList.toggle('visible', state === 'loading');
  document.getElementById('state-error').classList.toggle('visible',   state === 'error');
  document.getElementById('state-results').classList.toggle('visible', state === 'results');

  if (state !== 'loading') {
    document.getElementById('loading-label').textContent = 'Evaluating...';
  }
}

function showError(message) {
  document.getElementById('error-message').textContent = message;
  showState('error');
}

async function runEvaluation() {
  var cv        = document.getElementById('cv-text').value.trim();
  var jd        = document.getElementById('jd-text').value.trim();
  var github    = document.getElementById('github-username').value.trim();
  var portfolio = document.getElementById('portfolio-text').value.trim();
  var model = typeof GROQ_MODEL !== 'undefined' ? GROQ_MODEL : 'openai/gpt-oss-120b';
  var roleType  = document.getElementById('role-type').value;

  if (!cv || !jd) return;

  var apiKey = typeof GROQ_API_KEY !== 'undefined' ? GROQ_API_KEY : '';
  if (!apiKey || apiKey === 'gsk_YOUR_KEY_HERE') {
    showError('No API key found. Open js/config.js and paste your Groq key into GROQ_API_KEY.');
    return;
  }

  var btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.textContent = 'Evaluating...';

  document.getElementById('loading-model').textContent = model;
  showState('loading');

  try {
    // ── Call 1: evaluation ───────────────────────────────────
    document.getElementById('loading-label').textContent = 'Analysing fit...';
    var githubSummary = portfolio || github || '';
    var evalPrompt = buildPrompt(cv, jd, githubSummary, roleType);
    var evalResult = await callGroq(apiKey, model, evalPrompt);

    // ── Small delay to avoid rate limit between two heavy calls
    // await new Promise(function (r) { setTimeout(r, 4000); });

    // ── Call 2: rewrite ──────────────────────────────────────
    document.getElementById('loading-label').textContent = 'Polishing CV...';
    var rewritePrompt = buildRewritePrompt(cv, jd, evalResult.suggestions || []);
    var rewriteResult = await callGroq(apiKey, model, rewritePrompt);

    document.getElementById('results-meta').textContent = model;
    renderResults(evalResult, rewriteResult, roleType);
    showState('results');

  } catch (err) {
    showError(err.message || 'Something went wrong. Check your API key and try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Evaluation →';
    updatePills();
  }
}

document.addEventListener('DOMContentLoaded', function () {

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

  // Run button
  document.getElementById('run-btn').addEventListener('click', runEvaluation);

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

  // Initial state
  showState('empty');
  updatePills();
});