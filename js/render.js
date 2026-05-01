// render.js — builds two-tab results UI

// ── Helpers ──────────────────────────────────────────────────
function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text)      node.textContent = text;
  return node;
}

function scoreLabel(score) {
  if (score >= 85) return { text: 'Strong fit',  cls: 'badge badge-green'  };
  if (score >= 70) return { text: 'Good fit',    cls: 'badge badge-blue'   };
  if (score >= 55) return { text: 'Partial fit', cls: 'badge badge-yellow' };
  if (score >= 40) return { text: 'Weak fit',    cls: 'badge badge-orange' };
  return                  { text: 'Poor fit',    cls: 'badge badge-red'    };
}

// ── Score ring ────────────────────────────────────────────────
function buildScoreRing(score) {
  var label = scoreLabel(score);
  var circumference = 2 * Math.PI * 36;
  var offset = circumference - (score / 100) * circumference;

  var wrap = el('div', 'score-ring-wrap');
  wrap.innerHTML =
    '<svg class="score-ring" viewBox="0 0 88 88" width="88" height="88">' +
      '<circle class="score-ring-track" cx="44" cy="44" r="36"/>' +
      '<circle class="score-ring-fill" cx="44" cy="44" r="36"' +
        ' stroke-dasharray="' + circumference.toFixed(1) + '"' +
        ' stroke-dashoffset="' + offset.toFixed(1) + '"/>' +
    '</svg>' +
    '<div class="score-ring-label">' +
      '<span class="score-number">' + score + '</span>' +
      '<span class="score-pct">/ 100</span>' +
    '</div>';

  var badge = el('span', label.cls, label.text);
  var col   = el('div', 'score-ring-col');
  col.appendChild(wrap);
  col.appendChild(badge);
  return col;
}

// ── Sub-score bars ────────────────────────────────────────────
function buildSubScores(subScores) {
  var section = el('div', 'subscore-list');
  var items = [
    { key: 'skills',     label: 'Skills match'    },
    { key: 'experience', label: 'Experience match' },
    { key: 'portfolio',  label: 'Portfolio match'  },
  ];

  items.forEach(function (item) {
    var val = subScores[item.key];
    if (val === null || val === undefined) return;

    var row = el('div', 'subscore-row');
    var top = el('div', 'subscore-top');
    top.appendChild(el('span', 'subscore-label', item.label));
    top.appendChild(el('span', 'subscore-value', val + ' / 10'));

    var track = el('div', 'subscore-track');
    var fill  = el('div', 'subscore-fill');
    fill.style.width = ((val / 10) * 100) + '%';
    track.appendChild(fill);

    row.appendChild(top);
    row.appendChild(track);
    section.appendChild(row);
  });

  return section;
}

// ── Text list section ─────────────────────────────────────────
function buildList(title, items, modifier) {
  var section = el('div', 'result-section');
  section.appendChild(el('h3', 'section-title', title));
  var list = el('ul', 'result-list result-list--' + modifier);
  items.forEach(function (text) {
    list.appendChild(el('li', 'result-item', text));
  });
  section.appendChild(list);
  return section;
}

// ── Plan section ──────────────────────────────────────────────
function buildPlan(plan, cvMarkdown) {
  var section = el('div', 'result-section result-section--plan');
  section.appendChild(el('h3', 'section-title', 'Improvement plan'));
  section.appendChild(el('p', 'plan-goal', plan.goal));

  var grid = el('div', 'plan-grid');

  function planBlock(heading, arr) {
    var block = el('div', 'plan-block');
    block.appendChild(el('p', 'plan-block-title', heading));
    var ul = el('ul', 'plan-block-list');
    arr.forEach(function (t) { ul.appendChild(el('li', null, t)); });
    block.appendChild(ul);
    return block;
  }

  grid.appendChild(planBlock('Skills to learn',    plan.skills));
  grid.appendChild(planBlock('Projects to build',  plan.projects));
  grid.appendChild(planBlock('Resources',          plan.resources));
  section.appendChild(grid);

  var footer = el('div', 'plan-footer');
  footer.appendChild(el('span', 'plan-timeline', '⏱ ' + plan.timeline));

  if (cvMarkdown) {
    var dlBtn = el('button', 'btn-secondary', 'Download plan.md');
    dlBtn.addEventListener('click', function () { downloadPlan(plan); });
    footer.appendChild(dlBtn);
  }

  section.appendChild(footer);
  return section;
}

// ── Tab 1: Fit analysis ───────────────────────────────────────
function buildFitTab(evalResult, roleType) {
  var wrap = el('div', 'tab-content');

  var topRow = el('div', 'results-top-row');
  topRow.appendChild(buildScoreRing(evalResult.overall_score));
  topRow.appendChild(buildSubScores(evalResult.sub_scores));
  wrap.appendChild(topRow);

  if (evalResult.strengths && evalResult.strengths.length)
    wrap.appendChild(buildList('Strengths', evalResult.strengths, 'strengths'));

  if (evalResult.gaps && evalResult.gaps.length)
    wrap.appendChild(buildList('Gaps', evalResult.gaps, 'gaps'));

  if (evalResult.suggestions && evalResult.suggestions.length)
    wrap.appendChild(buildList('Suggestions to strengthen your CV', evalResult.suggestions, 'suggestions'));

  return wrap;
}

// ── Tab 2: Polished CV ────────────────────────────────────────
function buildPolishTab(rewriteResult) {
  var wrap = el('div', 'tab-content');

  // Edit cards
  var editsSection = el('div', 'result-section');
  editsSection.appendChild(el('h3', 'section-title', 'Suggested edits'));

  var edits = rewriteResult.edits || [];
  edits.forEach(function (edit) {
    var card = el('div', 'edit-card');

    // Section label
    card.appendChild(el('span', 'edit-section-label', edit.section));

    // Original
    var origRow = el('div', 'edit-row');
    origRow.appendChild(el('span', 'edit-row-tag edit-tag-original', 'Before'));
    origRow.appendChild(el('p', 'edit-original', edit.original));
    card.appendChild(origRow);

    // Polished
    var polRow = el('div', 'edit-row');
    polRow.appendChild(el('span', 'edit-row-tag edit-tag-polished', 'After'));

    var polText = el('p', 'edit-polished', edit.polished);
    polRow.appendChild(polText);

    var copyBtn = el('button', 'btn-copy', 'Copy');
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(edit.polished).then(function () {
        copyBtn.textContent = '✓';
        setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
    polRow.appendChild(copyBtn);
    card.appendChild(polRow);

    // Reason
    card.appendChild(el('p', 'edit-reason', edit.reason));

    editsSection.appendChild(card);
  });

  wrap.appendChild(editsSection);

  // Plan
  if (rewriteResult.plan)
    wrap.appendChild(buildPlan(rewriteResult.plan, null));

  return wrap;
}

// ── Results tab switcher ──────────────────────────────────────
function buildResultsTabs(evalResult, rewriteResult, roleType) {
  var container = el('div', 'results-tabs-wrap');

  // Tab bar
  var tabBar = el('div', 'results-tab-bar');
  var tab1   = el('button', 'results-tab active', 'Fit Analysis');
  var tab2   = el('button', 'results-tab', 'Polished CV');
  tabBar.appendChild(tab1);
  tabBar.appendChild(tab2);

  // Panels
  var panel1 = buildFitTab(evalResult, roleType);
  var panel2 = buildPolishTab(rewriteResult);
  panel2.style.display = 'none';

  tab1.addEventListener('click', function () {
    tab1.classList.add('active');
    tab2.classList.remove('active');
    panel1.style.display = '';
    panel2.style.display = 'none';
  });

  tab2.addEventListener('click', function () {
    tab2.classList.add('active');
    tab1.classList.remove('active');
    panel1.style.display = 'none';
    panel2.style.display = '';
  });

  container.appendChild(tabBar);
  container.appendChild(panel1);
  container.appendChild(panel2);
  return container;
}

// ── Main render function ──────────────────────────────────────
function renderResults(evalResult, rewriteResult, roleType) {
  var container = document.getElementById('state-results');
  container.innerHTML = '';
  container.appendChild(buildResultsTabs(evalResult, rewriteResult, roleType));
}