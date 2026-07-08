# Career Strategy Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the one-shot CV screener into a hybrid context + chat career strategy assistant implementing all 10 workflows from the career-strategy skill, powered by Tencent Hy3 through any OpenAI-compatible provider.

**Architecture:** Static vanilla-JS frontend (left panel: CV/JD/portfolio context inputs; right panel: streaming chat with workflow quick-launch buttons) plus one Vercel edge proxy. The entire skill (core rules + all 10 workflow playbooks) is baked into the system prompt on every call — no routing layer. Workflow buttons send canned user messages.

**Tech Stack:** Vanilla JS (classic scripts, globals — matches existing code), Vercel edge function, marked.js + DOMPurify via cdnjs, Node 18+ built-in test runner (`node --test`) for pure functions.

**Spec:** `docs/superpowers/specs/2026-07-08-career-strategy-chat-design.md`

## Global Constraints

- Work on branch `career-chat-refactor` (created in Task 1).
- Browser JS files in `js/` are **classic scripts** — no `import`/`export`, use `var` + global `function` declarations, matching existing style. `js/config.js` and the inline fallback block must both use `var` (a `const` after `var` of the same global name is a SyntaxError).
- No new npm dependencies. Browser libraries via cdnjs only. Node scripts/tests use only `node:` built-ins.
- Env var names (exact): `LLM_API_KEY`, `LLM_BASE_URL` (default `https://openrouter.ai/api/v1`), `LLM_MODEL` (default `tencent/hy3:free`), `APP_PASSPHRASE`.
- LLM request params: `temperature: 0.5`, `max_tokens: 8000`, `stream: true`.
- Never commit `js/config.js` or `.env` (both gitignored). Never log secret values (the old proxy's `console.log` of the passphrase gets removed in Task 4).
- Tests run with `npm test` (= `node --test tests/`), Node 18+.
- All shell commands below are for the Bash tool (Git Bash on Windows). Repo root: `C:\Users\nguye\Downloads\DS_projects\cv-screener`.

---

### Task 1: Branch, skill source, build script, generated skill content, test infra

**Files:**
- Create: `skill-src/core.md`
- Create: `skill-src/references/*.md` (10 files, extracted from the `.skill` zip)
- Create: `scripts/build-skill-content.mjs`
- Create: `js/skill-content.js` (generated — never edited by hand)
- Create: `tests/helpers/load-script.mjs`
- Test: `tests/skill-content.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: global `SKILL_CONTENT` (from `js/skill-content.js`): `{ core: string, workflows: Array<{ id, title, label, primary: boolean, message, reference: string }> }` — 10 workflows, 6 with `primary: true`. Test helper `loadScript(relPaths: string|string[], extraContext?: object) → sandbox` that evaluates classic browser scripts in a Node `vm` and returns their globals.

- [ ] **Step 1: Create the branch and extract the skill's reference files**

```bash
cd "C:\Users\nguye\Downloads\DS_projects\cv-screener"
git checkout -b career-chat-refactor
mkdir -p skill-src/references scripts tests/helpers
unzip -o career-strategy-assistant-tech-roles.skill -d .skill-tmp
cp .skill-tmp/career-strategy-assistant-tech-roles/references/*.md skill-src/references/
rm -rf .skill-tmp
ls skill-src/references
```

Expected: 10 files listed — `application-strategy.md`, `bullet-points.md`, `cover-letters-outreach.md`, `cv-diagnosis.md`, `cv-tailoring.md`, `interview-prep.md`, `job-matching.md`, `market-research.md`, `portfolio-review.md`, `skill-gaps.md`.

- [ ] **Step 2: Write the test helper**

Create `tests/helpers/load-script.mjs`:

```js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

// Evaluates classic (non-module) browser scripts in a vm sandbox and returns
// the sandbox, so tests can call the globals the scripts defined.
export function loadScript(relPaths, extraContext) {
  const sandbox = Object.assign({ console }, extraContext || {});
  vm.createContext(sandbox);
  const paths = Array.isArray(relPaths) ? relPaths : [relPaths];
  for (const p of paths) {
    const code = readFileSync(path.resolve(p), 'utf8');
    vm.runInContext(code, sandbox, { filename: p });
  }
  return sandbox;
}
```

- [ ] **Step 3: Write the failing test**

Create `tests/skill-content.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers/load-script.mjs';

test('skill content has core rules and 10 complete workflows', () => {
  const g = loadScript('js/skill-content.js');
  const c = g.SKILL_CONTENT;
  assert.ok(c.core.includes('Core Operating Rules'));
  assert.equal(c.workflows.length, 10);
  const ids = new Set();
  for (const wf of c.workflows) {
    for (const key of ['id', 'title', 'label', 'message', 'reference']) {
      assert.ok(typeof wf[key] === 'string' && wf[key].length > 0,
        wf.id + ' missing ' + key);
    }
    assert.equal(typeof wf.primary, 'boolean');
    ids.add(wf.id);
  }
  assert.equal(ids.size, 10, 'workflow ids must be unique');
});

test('exactly six primary workflows', () => {
  const g = loadScript('js/skill-content.js');
  assert.equal(g.SKILL_CONTENT.workflows.filter((w) => w.primary).length, 6);
});
```

- [ ] **Step 4: Add the test script and run the test to verify it fails**

Replace `package.json` content with:

```json
{
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "build:skill": "node scripts/build-skill-content.mjs"
  }
}
```

Run: `npm test`
Expected: FAIL — `ENOENT ... js/skill-content.js` (file doesn't exist yet).

- [ ] **Step 5: Write `skill-src/core.md`**

This is `SKILL.md` from the zip with: frontmatter removed, the routing table replaced by a short "Workflows" intro (all playbooks are inline now), the broad-first-message guidance kept, and a note neutralizing references to unavailable skills (`xlsx`, `latex-cv`). Exact content:

```markdown
# Career Strategy Assistant — Tech Roles

You are acting as a senior career coach, technical recruiter, CV editor, job market analyst,
and hiring advisor combined — for Data, Software Engineering, ML, AI, and Analytics roles.

## Core Operating Rules (always apply, regardless of which workflow below is active)

1. **Be direct, not agreeable.** If a CV is weak, a role is unrealistic, a project is too
   basic, or a bullet point is generic — say so plainly and explain why. Do not soften this
   into vague positivity. The user has explicitly asked not to be flattered.
2. **Never fabricate.** Do not invent experience, metrics, achievements, or skills the user
   doesn't have. Reframe real experience in stronger, truthful language — never manufacture
   new substance.
3. **Don't rate everything as a good fit.** Match scores, fit levels, and recommendations
   should vary honestly based on actual evidence. If most of what you're evaluating is
   mediocre, your output should reflect that.
4. **State assumptions, don't interrogate.** If information is missing, make a clearly-labeled
   reasonable assumption and proceed, rather than blocking with a long list of questions. Only
   ask when the task genuinely cannot proceed without the answer (e.g., tailoring a CV with no
   CV provided).
5. **UK-style CV format by default** — concise, ATS-friendly, no photo — unless the user's
   existing CV or stated preference indicates otherwise. If the user has shared a CV in a
   different style, match their existing format rather than overriding it.

## Workflows

The workflow playbooks follow below, one section per workflow. Identify which workflow(s) the
user's request maps to and follow those instructions. Multiple workflows may apply to a single
request (e.g. "tailor my CV for this job and draft a cover letter" uses both the CV Tailoring
and Cover Letters playbooks).

If the user's request is broad ("help me with my job search") and no CV, target role, or job
description has been provided, don't fire off a long intake form. Instead: ask for the 1-2
most load-bearing pieces of information (typically: their CV, and their target role/location),
and offer to proceed with reasonable assumptions on the rest if they'd rather move fast.

Note: if a playbook mentions other "skills" (e.g. an `xlsx` skill or `latex-cv` skill), those
tools are not available here — produce the equivalent content inline instead (e.g. a markdown
table the user can copy into a spreadsheet).

## Output Style

- Structured: clear headings, tables for comparisons, bullets for action items.
- Direct recommendations, ranked by priority when multiple actions are suggested.
- Copy-ready rewritten content (CV sections, cover letters, messages) — not just advice about
  what to write.
- No vague advice, generic motivational language, or unsupported claims.
- When something is uncertain or missing, state it plainly rather than guessing silently.
```

- [ ] **Step 6: Write the build script**

Create `scripts/build-skill-content.mjs`:

```js
// Generates js/skill-content.js from skill-src/. Run: npm run build:skill
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('skill-src');
const OUT = path.resolve('js/skill-content.js');

const WORKFLOWS = [
  { id: 'cv-diagnosis', title: 'CV Diagnosis', label: 'Diagnose CV', primary: true,
    file: 'cv-diagnosis.md',
    message: 'Run a full CV diagnosis on my CV.' },
  { id: 'job-matching', title: 'Job Description Matching', label: 'Match Job', primary: true,
    file: 'job-matching.md',
    message: 'Analyze the target job description and score how well my CV matches it. Give me your honest recommendation.' },
  { id: 'cv-tailoring', title: 'CV Tailoring', label: 'Tailor CV', primary: true,
    file: 'cv-tailoring.md',
    message: 'Tailor my CV to the target job description.' },
  { id: 'bullet-points', title: 'CV Bullet Point Rewriting', label: 'Rewrite Bullets', primary: true,
    file: 'bullet-points.md',
    message: 'Find the weakest bullet points in my CV and rewrite them.' },
  { id: 'cover-letters', title: 'Cover Letters & Outreach', label: 'Cover Letter', primary: true,
    file: 'cover-letters-outreach.md',
    message: 'Draft a cover letter for the target job description.' },
  { id: 'interview-prep', title: 'Interview Preparation', label: 'Interview Prep', primary: true,
    file: 'interview-prep.md',
    message: 'Prepare me for interviews for the target role: likely HR and technical questions based on the job description.' },
  { id: 'portfolio-review', title: 'Portfolio & Project Review', label: 'Portfolio Review', primary: false,
    file: 'portfolio-review.md',
    message: 'Review my portfolio/projects and tell me honestly how strong they are for my target role.' },
  { id: 'skill-gaps', title: 'Skill Gap Analysis', label: 'Skill Gaps', primary: false,
    file: 'skill-gaps.md',
    message: 'Run a skill gap analysis of my profile against the target role.' },
  { id: 'application-strategy', title: 'Application Strategy', label: 'Application Strategy', primary: false,
    file: 'application-strategy.md',
    message: 'Build me a practical application strategy.' },
  { id: 'market-research', title: 'Job Market Research', label: 'Market Research', primary: false,
    file: 'market-research.md',
    message: 'Research the job market for my target role and location. Flag any data you are uncertain about.' },
];

const content = {
  core: readFileSync(path.join(SRC, 'core.md'), 'utf8').trim(),
  workflows: WORKFLOWS.map((w) => ({
    id: w.id,
    title: w.title,
    label: w.label,
    primary: w.primary,
    message: w.message,
    reference: readFileSync(path.join(SRC, 'references', w.file), 'utf8').trim(),
  })),
};

writeFileSync(OUT,
  '// skill-content.js — GENERATED by scripts/build-skill-content.mjs. Do not edit by hand.\n'
  + 'var SKILL_CONTENT = ' + JSON.stringify(content, null, 2) + ';\n');
console.log('Wrote ' + OUT);
```

- [ ] **Step 7: Generate and run tests to verify they pass**

Run: `npm run build:skill && npm test`
Expected: `Wrote ...js/skill-content.js`, then both tests PASS.

- [ ] **Step 8: Commit**

```bash
git add skill-src scripts/build-skill-content.mjs js/skill-content.js tests package.json
git commit -m "feat: add skill content source, build script, and test infra"
```

---

### Task 2: System prompt builder (`js/prompt.js` rewrite)

**Files:**
- Modify: `js/prompt.js` (full replacement — old `buildPrompt`/`buildRewritePrompt` deleted)
- Test: `tests/prompt.test.mjs`

**Interfaces:**
- Consumes: global `SKILL_CONTENT` (Task 1).
- Produces: global `buildSystemPrompt(cv, jd, portfolio) → string`. All params are strings (may be empty/null); blank values render as `Not provided.`.

- [ ] **Step 1: Write the failing test**

Create `tests/prompt.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers/load-script.mjs';

function load() {
  return loadScript(['js/skill-content.js', 'js/prompt.js']);
}

test('system prompt includes core rules, all workflows, then session context', () => {
  const g = load();
  const p = g.buildSystemPrompt('MY CV TEXT', 'MY JD TEXT', 'MY PORTFOLIO');
  assert.ok(p.includes('Core Operating Rules'));
  for (const wf of g.SKILL_CONTENT.workflows) {
    assert.ok(p.includes('## Workflow: ' + wf.title), 'missing ' + wf.title);
  }
  assert.ok(p.indexOf('## Session Context') > p.lastIndexOf('## Workflow:'));
  assert.ok(p.includes('MY CV TEXT'));
  assert.ok(p.includes('MY JD TEXT'));
  assert.ok(p.includes('MY PORTFOLIO'));
});

test('missing context values become "Not provided."', () => {
  const g = load();
  const p = g.buildSystemPrompt('', '   ', null);
  assert.equal(p.match(/Not provided\./g).length, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: prompt tests FAIL — `buildSystemPrompt is not a function`. (Task 1 tests still pass.)

- [ ] **Step 3: Replace `js/prompt.js`**

Full new content:

```js
// prompt.js — builds the system prompt from skill content + session context.
// Pure function: no DOM access, no API calls. Depends on global SKILL_CONTENT.

function buildSystemPrompt(cv, jd, portfolio) {
  function orNotProvided(text) {
    return text && String(text).trim() ? String(text).trim() : 'Not provided.';
  }

  var parts = [SKILL_CONTENT.core];

  SKILL_CONTENT.workflows.forEach(function (wf) {
    parts.push('## Workflow: ' + wf.title + '\n\n' + wf.reference);
  });

  parts.push([
    '## Session Context',
    '',
    'The user maintains these inputs in a side panel next to this chat. Treat them as the',
    'current CV, target job description, and portfolio for all workflows. If one is missing',
    'and a workflow needs it, ask the user to fill it in on the left panel or paste it here.',
    '',
    '### Candidate CV',
    orNotProvided(cv),
    '',
    '### Target Job Description',
    orNotProvided(jd),
    '',
    '### Portfolio / GitHub',
    orNotProvided(portfolio),
  ].join('\n'));

  return parts.join('\n\n---\n\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/prompt.js tests/prompt.test.mjs
git commit -m "feat: system prompt builder from skill content and session context"
```

---

### Task 3: Streaming API client (`js/api.js` rewrite)

**Files:**
- Modify: `js/api.js` (full replacement — old `callGroq` deleted)
- Test: `tests/sse.test.mjs`

**Interfaces:**
- Consumes: globals `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` (may be empty strings — declared in `index.html` / `js/config.js`), `window.userPassphrase`.
- Produces:
  - `parseSSELine(line: string) → { type: 'delta', text: string } | { type: 'done' } | null` (pure).
  - `streamChat(messages: Array<{role, content}>, onDelta: (delta: string, fullSoFar: string) => void, onStatus?: (note: string) => void) → Promise<string>` — resolves with the full assistant text; throws `Error` with user-facing message on failure. `onStatus` reports rate-limit backoff waits. DOM-free.

- [ ] **Step 1: Write the failing test**

Create `tests/sse.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers/load-script.mjs';

function load() {
  return loadScript('js/api.js', { window: { location: { protocol: 'file:' } } });
}

test('parses a content delta line', () => {
  const g = load();
  assert.deepEqual(
    g.parseSSELine('data: {"choices":[{"delta":{"content":"Hel"}}]}'),
    { type: 'delta', text: 'Hel' }
  );
});

test('recognizes the [DONE] marker', () => {
  const g = load();
  assert.deepEqual(g.parseSSELine('data: [DONE]'), { type: 'done' });
});

test('ignores comments, blanks, non-data lines, and bad JSON', () => {
  const g = load();
  assert.equal(g.parseSSELine(': OPENROUTER PROCESSING'), null);
  assert.equal(g.parseSSELine(''), null);
  assert.equal(g.parseSSELine('event: ping'), null);
  assert.equal(g.parseSSELine('data: {broken'), null);
});

test('ignores reasoning-only and empty deltas', () => {
  const g = load();
  assert.equal(g.parseSSELine('data: {"choices":[{"delta":{"reasoning":"hmm"}}]}'), null);
  assert.equal(g.parseSSELine('data: {"choices":[{"delta":{"content":""}}]}'), null);
  assert.equal(g.parseSSELine('data: {"choices":[{"delta":{}}]}'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: sse tests FAIL — `parseSSELine is not a function`.

- [ ] **Step 3: Replace `js/api.js`**

Full new content:

```js
// api.js — streaming chat calls: /api/chat proxy (Vercel) or provider directly (local file://)

function getEndpoint() {
  if (window.location.protocol === 'file:') {
    var base = (typeof LLM_BASE_URL !== 'undefined' && LLM_BASE_URL)
      ? LLM_BASE_URL
      : 'https://openrouter.ai/api/v1';
    return base.replace(/\/$/, '') + '/chat/completions';
  }
  return '/api/chat';
}

function getHeaders() {
  if (window.location.protocol === 'file:') {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (typeof LLM_API_KEY !== 'undefined' ? LLM_API_KEY : '')
    };
  }
  return {
    'Content-Type': 'application/json',
    'x-app-passphrase': window.userPassphrase || ''
  };
}

// ── SSE line parser ───────────────────────────────────────────
// Pure. Returns {type:'delta',text} | {type:'done'} | null (line carries nothing useful).
function parseSSELine(line) {
  if (!line || line.charAt(0) === ':') return null;
  if (line.indexOf('data:') !== 0) return null;

  var payload = line.slice(5).trim();
  if (payload === '[DONE]') return { type: 'done' };

  var obj;
  try { obj = JSON.parse(payload); } catch (_) { return null; }

  var delta = obj.choices && obj.choices[0] && obj.choices[0].delta;
  var text = delta && delta.content;
  if (typeof text === 'string' && text.length) return { type: 'delta', text: text };
  return null;
}

// ── Streaming chat call ───────────────────────────────────────
async function streamChat(messages, onDelta, onStatus, retries) {
  retries = retries || 0;

  if (window.location.protocol === 'file:') {
    var key = typeof LLM_API_KEY !== 'undefined' ? LLM_API_KEY : '';
    if (!key || key === 'PASTE_YOUR_KEY_HERE') {
      throw new Error('No API key found. Open js/config.js and paste your provider key into LLM_API_KEY.');
    }
  }

  var body = {
    messages: messages,
    max_tokens: 8000,
    temperature: 0.5,
    stream: true
  };
  if (typeof LLM_MODEL !== 'undefined' && LLM_MODEL) body.model = LLM_MODEL;

  var response;
  try {
    response = await fetch(getEndpoint(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error('Network error — check your connection. (' + err.message + ')');
  }

  if (response.status === 429) {
    if (retries >= 4) throw new Error('Rate limit hit repeatedly. Wait a minute and try again.');
    var wait = Math.pow(2, retries) * 3000;
    if (onStatus) onStatus('Rate limited — retrying in ' + Math.round(wait / 1000) + 's…');
    await new Promise(function (r) { setTimeout(r, wait); });
    return streamChat(messages, onDelta, onStatus, retries + 1);
  }

  if (response.status === 401) throw new Error('Unauthorized. Check your passphrase or API key.');

  if (!response.ok) {
    var errorBody;
    try { errorBody = await response.json(); } catch (_) { errorBody = {}; }
    var detail = (errorBody.error && errorBody.error.message) ? errorBody.error.message : response.statusText;
    throw new Error('API error ' + response.status + ': ' + detail);
  }

  var reader = response.body.getReader();
  var decoder = new TextDecoder();
  var buffer = '';
  var full = '';

  function handleLine(rawLine) {
    var parsed = parseSSELine(rawLine.replace(/\r$/, ''));
    if (parsed && parsed.type === 'delta') {
      full += parsed.text;
      onDelta(parsed.text, full);
    }
  }

  while (true) {
    var chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    var lines = buffer.split('\n');
    buffer = lines.pop();
    for (var i = 0; i < lines.length; i++) handleLine(lines[i]);
  }
  buffer += decoder.decode();
  if (buffer) handleLine(buffer);

  if (!full.trim()) throw new Error('Empty response from model. Try again.');
  return full;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/api.js tests/sse.test.mjs
git commit -m "feat: streaming OpenAI-compatible chat client with SSE parser"
```

---

### Task 4: Provider-agnostic edge proxy (`api/chat.js`)

**Files:**
- Modify: `api/chat.js` (full replacement)

**Interfaces:**
- Consumes: env vars `APP_PASSPHRASE`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`; request header `x-app-passphrase`; JSON body from `streamChat` (Task 3).
- Produces: streamed pass-through of the upstream `/chat/completions` response (SSE or JSON error), preserving status and content type.

- [ ] **Step 1: Replace `api/chat.js`**

Full new content (note: the passphrase debug `console.log` is deliberately removed — it leaked the secret into logs):

```js
export const config = { runtime: 'edge' };

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'tencent/hy3:free';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const passphrase = req.headers.get('x-app-passphrase');
  if (!passphrase || passphrase !== process.env.APP_PASSPHRASE) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server.' }), { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }

  if (!body.model) {
    body.model = process.env.LLM_MODEL || DEFAULT_MODEL;
  }

  const baseUrl = (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

  try {
    const upstream = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(body)
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check api/chat.js`
Expected: no output (exit 0). (`package.json` has `"type": "module"`, so `export` parses.)

- [ ] **Step 3: Commit**

```bash
git add api/chat.js
git commit -m "feat: provider-agnostic streaming proxy via LLM_* env vars"
```

---

### Task 5: Page structure and styles (`index.html`, `css/style.css`)

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: DOM ids used by Tasks 6–8: `chat-thread`, `chat-empty`, `workflow-bar`, `wf-more-btn`, `composer-input`, `send-btn`, `download-chat-btn`, `model-info`, `results-meta`. CSS classes: `msg`, `msg-user`, `msg-assistant`, `msg-bubble`, `msg-md`, `msg-pending`, `chat-error`, `wf-btn`, `wf-secondary`, `wf-hidden`, `wf-more`, `composer`, `workflow-bar`, `chat-thread`, `results-header-actions`.

**Note:** After this task the page will show the new layout but the console WILL have errors (old `js/ui.js` still references the removed `run-btn` etc.). That is expected; Tasks 6–8 replace the JS. Verification here is layout-only.

- [ ] **Step 1: Update `index.html`**

Apply these changes (rest of the file — auth gate, header, left-panel tabs 1–3, pills — stays as-is):

1. `<title>` → `CV.Screen — Career Strategy Assistant`.
2. Header badge text → `v0.2 · career chat`.
3. Replace the whole Settings tab panel (`<div class="tab-panel" id="panel-settings">…</div>`) with:

```html
          <!-- Tab 4: Settings -->
          <div class="tab-panel" id="panel-settings">
            <div class="notice notice-info">
              <strong>Model</strong><br/>
              <span id="model-info">—</span><br/><br/>
              Endpoint and model come from <code>LLM_BASE_URL</code> / <code>LLM_MODEL</code>
              (Vercel env vars, or <code>js/config.js</code> when opened locally).
            </div>
          </div>
```

4. In the action bar, delete the Run Evaluation button (`<button class="btn-primary" id="run-btn" …>…</button>`). Keep the pills div.
5. Replace the entire right panel (`<div class="panel-right">…</div>`) with:

```html
      <!-- Right panel: chat -->
      <div class="panel-right">

        <div class="results-header">
          <span class="results-title">Career Strategy Chat</span>
          <div class="results-header-actions">
            <span class="results-meta" id="results-meta"></span>
            <button class="btn-secondary" id="download-chat-btn">Export .md</button>
          </div>
        </div>

        <div class="workflow-bar" id="workflow-bar">
          <button class="wf-btn wf-more" id="wf-more-btn">More +</button>
        </div>

        <div class="chat-thread" id="chat-thread">
          <div class="state-empty" id="chat-empty">
            <div class="empty-icon">◎</div>
            <h2>Career Strategy Assistant</h2>
            <p>Add your CV and a job description on the left, then launch a workflow above — or just ask a question below.</p>
          </div>
        </div>

        <div class="composer">
          <textarea id="composer-input" rows="2"
            placeholder="Ask anything about your job search… (Enter to send, Shift+Enter for a new line)"></textarea>
          <button class="btn-primary" id="send-btn">Send</button>
        </div>

      </div><!-- /panel-right -->
```

6. Replace everything from the first CDN `<script>` tag to the last `<script src="js/…">` tag with (fixes the duplicated mammoth include; adds marked + DOMPurify; renames fallback globals; adds new files in dependency order):

```html
  <!-- JS modules — loaded in dependency order -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"></script>
  <script>
    // Local dev only — config.js is never deployed.
    // On Vercel, LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / APP_PASSPHRASE live in
    // environment variables and are used server-side by api/chat.js.
    var LLM_API_KEY    = '';
    var LLM_BASE_URL   = '';
    var LLM_MODEL      = '';
    var APP_PASSPHRASE = '';
  </script>
  <script src="js/config.js" onerror="void(0)"></script>
  <script src="js/skill-content.js"></script>
  <script src="js/prompt.js"></script>
  <script src="js/reader.js"></script>
  <script src="js/api.js"></script>
  <script src="js/render.js"></script>
  <script src="js/chat.js"></script>
  <script src="js/download.js"></script>
  <script src="js/ui.js"></script>
```

- [ ] **Step 2: Update `css/style.css`**

**Delete** these now-dead sections (each is a labeled block in the file): `.state-loading`, `.spinner`, `@keyframes spin`, `.loading-label`, `.loading-model`, `.state-error`, `.error-box` (both rules), `.state-results` (both rules), the entire `/* ── Results UI ── */` region (`.results-top-row` through `.subscore-fill`, including all `.score-ring*` and `.badge*` rules), `.result-section`, `.section-title`, `.result-list*`, `.result-item*`, all `.plan-*` rules and `.result-section--plan`, the `/* ── Results tabs ── */` region (`.results-tabs-wrap`, `.results-tab-bar`, `.results-tab`, `.tab-content`), `.cv-actions`, `.cv-preview`, the `/* ── Edit cards ── */` region (`.edit-card` through `.edit-reason`, including `.btn-copy`).

**Keep**: `.btn-secondary`, `.state-empty` block, `.results-header*`, `.results-title`, `.results-meta`, everything for the left panel and auth gate.

**Add** at the end of the file:

```css
/* ── Chat: header actions ───────────────────────────────────── */
.results-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ── Chat: workflow bar ─────────────────────────────────────── */
.workflow-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 28px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.wf-btn {
  font-size: 11px;
  font-family: var(--mono);
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--border2);
  background: var(--surface2);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.wf-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.wf-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wf-hidden {
  display: none;
}

/* ── Chat: thread ───────────────────────────────────────────── */
.chat-thread {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border2) transparent;
  padding: 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-thread .state-empty {
  flex: 1;
  height: auto;
}

.msg {
  display: flex;
}

.msg-user {
  justify-content: flex-end;
}

.msg-bubble {
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.7;
}

.msg-user .msg-bubble {
  background: var(--accent-bg);
  border: 1px solid var(--info-bdr);
  max-width: 75%;
  white-space: pre-wrap;
}

.msg-assistant .msg-bubble {
  background: var(--surface);
  border: 1px solid var(--border);
  width: 100%;
  overflow-x: auto;
}

.msg-pending {
  color: var(--accent);
  animation: blink 1s step-end infinite;
}

.msg-status {
  color: var(--text-faint);
  font-size: 12px;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* ── Chat: markdown content ─────────────────────────────────── */
.msg-md h1, .msg-md h2, .msg-md h3, .msg-md h4 {
  font-family: var(--sans);
  line-height: 1.35;
  margin: 14px 0 6px;
  color: var(--text);
}

.msg-md h1 { font-size: 16px; }
.msg-md h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; }
.msg-md h3 { font-size: 13px; }
.msg-md h4 { font-size: 12.5px; }

.msg-md > :first-child { margin-top: 0; }
.msg-md p { margin: 6px 0; }
.msg-md ul, .msg-md ol { margin: 6px 0; padding-left: 22px; }
.msg-md li { margin: 3px 0; }

.msg-md table {
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 12px;
  display: block;
  overflow-x: auto;
  max-width: 100%;
}

.msg-md th, .msg-md td {
  border: 1px solid var(--border2);
  padding: 6px 10px;
  text-align: left;
  vertical-align: top;
}

.msg-md th {
  background: var(--surface2);
  font-family: var(--sans);
  font-weight: 700;
  font-size: 11px;
}

.msg-md pre {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  overflow-x: auto;
  margin: 8px 0;
}

.msg-md pre code {
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
}

.msg-md blockquote {
  border-left: 3px solid var(--border2);
  padding-left: 12px;
  color: var(--text-muted);
  margin: 8px 0;
}

.msg-md hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 14px 0;
}

/* ── Chat: error bubble ─────────────────────────────────────── */
.chat-error {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--danger-bg);
  border: 1px solid var(--danger-bdr);
  border-radius: var(--radius);
  padding: 12px 14px;
  font-size: 12px;
  color: var(--danger);
  line-height: 1.6;
}

.chat-error .btn-secondary {
  align-self: flex-start;
}

/* ── Chat: composer ─────────────────────────────────────────── */
.composer {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 14px 28px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.composer textarea {
  flex: 1;
  min-height: 44px;
  max-height: 160px;
  resize: none;
}

.composer .btn-primary {
  width: auto;
  padding: 10px 18px;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verify layout renders**

Open `index.html` in a browser (`start index.html` from PowerShell, or double-click). After entering the passphrase:
Expected: header, left panel with 4 tabs (Settings shows the model notice, no role dropdown), right panel with "Career Strategy Chat" header + "Export .md" button, a workflow bar containing only the "More +" button, the empty state, and the composer. Console errors from the old `ui.js` (`run-btn` null) are EXPECTED at this stage.

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: chat panel layout, workflow bar, composer, markdown styles"
```

---

### Task 6: Chat message rendering (`js/render.js` rewrite)

**Files:**
- Modify: `js/render.js` (full replacement — old scorecard/edit-card renderer deleted)

**Interfaces:**
- Consumes: DOM ids from Task 5 (`chat-thread`, `chat-empty`); globals `marked`, `DOMPurify` (CDN); `retryTurn(row)` from Task 7 (referenced only inside a click handler, so load order is safe).
- Produces globals used by Task 7:
  - `appendUserBubble(text: string) → HTMLElement`
  - `appendAssistantBubble() → HTMLElement` (row with blinking pending cursor)
  - `setPendingStatus(row: HTMLElement, note: string)` (pending cursor + muted status note, e.g. rate-limit backoff)
  - `updateAssistantBubble(row: HTMLElement, markdownSoFar: string)` (throttled ~100 ms)
  - `finalizeAssistantBubble(row: HTMLElement, markdown: string)`
  - `renderChatError(row: HTMLElement, message: string)` (error box + Retry button calling `retryTurn(row)`)

- [ ] **Step 1: Replace `js/render.js`**

Full new content:

```js
// render.js — chat thread rendering: bubbles, streaming markdown, errors.
// Markdown via marked (CDN), sanitized with DOMPurify (CDN).

function chatThreadEl() {
  return document.getElementById('chat-thread');
}

function renderMarkdown(md) {
  return DOMPurify.sanitize(marked.parse(md));
}

function hideChatEmptyState() {
  var empty = document.getElementById('chat-empty');
  if (empty) empty.classList.add('hidden');
}

function scrollThreadToBottom() {
  var thread = chatThreadEl();
  thread.scrollTop = thread.scrollHeight;
}

function appendUserBubble(text) {
  var row = document.createElement('div');
  row.className = 'msg msg-user';
  var bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  hideChatEmptyState();
  chatThreadEl().appendChild(row);
  scrollThreadToBottom();
  return row;
}

function appendAssistantBubble() {
  var row = document.createElement('div');
  row.className = 'msg msg-assistant';
  var bubble = document.createElement('div');
  bubble.className = 'msg-bubble msg-md';
  bubble.innerHTML = '<span class="msg-pending">▍</span>';
  row.appendChild(bubble);
  hideChatEmptyState();
  chatThreadEl().appendChild(row);
  scrollThreadToBottom();
  return row;
}

function setPendingStatus(row, note) {
  var bubble = row.querySelector('.msg-bubble');
  bubble.innerHTML = '<span class="msg-pending">▍</span> ';
  var span = document.createElement('span');
  span.className = 'msg-status';
  span.textContent = note;
  bubble.appendChild(span);
}

// Throttle streaming re-renders so markdown parsing doesn't run per token.
var renderThrottleTimer = null;
var renderThrottleLatest = '';

function updateAssistantBubble(row, markdownSoFar) {
  renderThrottleLatest = markdownSoFar;
  if (renderThrottleTimer) return;
  renderThrottleTimer = setTimeout(function () {
    renderThrottleTimer = null;
    row.querySelector('.msg-bubble').innerHTML = renderMarkdown(renderThrottleLatest);
    scrollThreadToBottom();
  }, 100);
}

function clearRenderThrottle() {
  if (renderThrottleTimer) {
    clearTimeout(renderThrottleTimer);
    renderThrottleTimer = null;
  }
}

function finalizeAssistantBubble(row, markdown) {
  clearRenderThrottle();
  row.querySelector('.msg-bubble').innerHTML = renderMarkdown(markdown);
  scrollThreadToBottom();
}

function renderChatError(row, message) {
  clearRenderThrottle();
  var bubble = row.querySelector('.msg-bubble');
  bubble.innerHTML = '';

  var box = document.createElement('div');
  box.className = 'chat-error';

  var strong = document.createElement('strong');
  strong.textContent = 'Error';
  var span = document.createElement('span');
  span.textContent = message;
  var retry = document.createElement('button');
  retry.className = 'btn-secondary';
  retry.textContent = 'Retry';
  retry.addEventListener('click', function () { retryTurn(row); });

  box.appendChild(strong);
  box.appendChild(span);
  box.appendChild(retry);
  bubble.appendChild(box);
  scrollThreadToBottom();
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check js/render.js`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "feat: chat bubble rendering with streaming markdown"
```

---

### Task 7: Chat state and send flow (`js/chat.js` new)

**Files:**
- Create: `js/chat.js`

**Interfaces:**
- Consumes: `buildSystemPrompt` (Task 2), `streamChat` (Task 3), render functions (Task 6), `setComposerBusy` (Task 8 — called only at runtime, load order safe), DOM ids `cv-text`, `jd-text`, `portfolio-text`, `github-username`.
- Produces globals:
  - `chatHistory: Array<{role: 'user'|'assistant', content: string}>` (used by `downloadChat`, Task 8)
  - `chatBusy: boolean`
  - `sendChatMessage(text: string)` (used by composer + workflow buttons, Task 8)
  - `retryTurn(failedRow: HTMLElement)` (used by Task 6's Retry button)

- [ ] **Step 1: Create `js/chat.js`**

Full content:

```js
// chat.js — chat state, send flow, retry. History is in-memory only.

var chatHistory = [];
var chatBusy = false;

function collectContext() {
  return {
    cv: document.getElementById('cv-text').value,
    jd: document.getElementById('jd-text').value,
    portfolio: document.getElementById('portfolio-text').value.trim()
      || document.getElementById('github-username').value.trim()
  };
}

function sendChatMessage(text) {
  text = (text || '').trim();
  if (chatBusy || !text) return;
  chatHistory.push({ role: 'user', content: text });
  appendUserBubble(text);
  startAssistantTurn();
}

// Runs one assistant turn against the current history (last entry must be a
// user message). Failed turns are NOT added to history, so retry just runs
// the turn again.
async function startAssistantTurn() {
  chatBusy = true;
  setComposerBusy(true);

  var row = appendAssistantBubble();
  var ctx = collectContext();
  var messages = [
    { role: 'system', content: buildSystemPrompt(ctx.cv, ctx.jd, ctx.portfolio) }
  ].concat(chatHistory);

  try {
    var full = await streamChat(messages, function (_delta, soFar) {
      updateAssistantBubble(row, soFar);
    }, function (note) {
      setPendingStatus(row, note);
    });
    chatHistory.push({ role: 'assistant', content: full });
    finalizeAssistantBubble(row, full);
  } catch (err) {
    renderChatError(row, err.message || 'Something went wrong.');
  } finally {
    chatBusy = false;
    setComposerBusy(false);
  }
}

function retryTurn(failedRow) {
  if (chatBusy) return;
  failedRow.remove();
  startAssistantTurn();
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check js/chat.js`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add js/chat.js
git commit -m "feat: chat state and streaming send flow with retry"
```

---

### Task 8: UI wiring and export (`js/ui.js` rewrite, `js/download.js` repurpose)

**Files:**
- Modify: `js/ui.js` (full replacement)
- Modify: `js/download.js` (full replacement)

**Interfaces:**
- Consumes: `SKILL_CONTENT` (Task 1), `sendChatMessage`/`chatBusy`/`chatHistory` (Task 7), DOM from Task 5.
- Produces: `setComposerBusy(busy: boolean)` (used by Task 7), `downloadChat()`, plus all event wiring. Auth gate (`setupAuth`) and divider-drag behavior preserved from the old file.

- [ ] **Step 1: Replace `js/download.js`**

Full new content:

```js
// download.js — exports the chat conversation as a .md file

function generateChatMarkdown(history) {
  var lines = ['# Career Strategy Chat', ''];
  history.forEach(function (m) {
    lines.push(m.role === 'user' ? '## You' : '## Assistant');
    lines.push('');
    lines.push(m.content);
    lines.push('');
  });
  lines.push('---');
  lines.push('_Generated by CV.Screen_');
  return lines.join('\n');
}

function triggerDownload(filename, content) {
  var blob = new Blob([content], { type: 'text/markdown' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadChat() {
  if (!chatHistory.length) return;
  triggerDownload('career-chat.md', generateChatMarkdown(chatHistory));
}
```

- [ ] **Step 2: Replace `js/ui.js`**

Full new content:

```js
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

  function attempt() {
    var val = input.value.trim();
    if (!val) return;

    var isLocal = window.location.protocol === 'file:';

    if (isLocal) {
      var expected = typeof APP_PASSPHRASE !== 'undefined' ? APP_PASSPHRASE : '';
      if (!expected || val === expected) {
        window.userPassphrase = val;
        sessionStorage.setItem('cv_screen_auth', '1');
        sessionStorage.setItem('cv_screen_pass', val);
        gate.classList.add('hidden');
        error.textContent = '';
      } else {
        error.textContent = 'Incorrect passphrase.';
        input.value = '';
        input.focus();
      }
    } else {
      window.userPassphrase = val;
      sessionStorage.setItem('cv_screen_auth', '1');
      sessionStorage.setItem('cv_screen_pass', val);
      gate.classList.add('hidden');
      error.textContent = '';
    }
  }

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') attempt();
  });
}
```

- [ ] **Step 3: Run all checks**

Run: `node --check js/ui.js && node --check js/download.js && npm test`
Expected: both checks silent, all tests PASS.

- [ ] **Step 4: Browser smoke test (no API key needed yet)**

Open `index.html` via `file://`, enter the passphrase, then verify:
1. No console errors on load.
2. Workflow bar shows: Diagnose CV, Match Job, Tailor CV, Rewrite Bullets, Cover Letter, Interview Prep, More +. Clicking "More +" reveals the other 4 and toggles to "Less −".
3. Typing in the CV textarea flips the CV pill to ✓.
4. Clicking "Diagnose CV" adds a user bubble, then an error bubble ("No API key found…" — expected, config.js still has old Groq vars) with a Retry button. Composer and buttons re-enable after the error.
5. Enter in the composer sends; Shift+Enter adds a newline.
6. "Export .md" downloads `career-chat.md` containing the user message.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js js/download.js
git commit -m "feat: wire workflow bar, composer, and chat export"
```

---

### Task 9: Local config migration and end-to-end verification

**Files:**
- Modify: `js/config.js` (LOCAL ONLY — gitignored, never committed)

**Interfaces:**
- Consumes: everything.
- Produces: a working app in both local and proxy modes.

- [ ] **Step 1: Rewrite `js/config.js`**

Replace its content with the template below. **Preserve the existing `APP_PASSPHRASE` value from the current file** (copy it across); the old `GROQ_API_KEY`/`GROQ_MODEL` lines are deleted. Must use `var`, not `const` (the inline fallback in `index.html` already declares these names with `var`).

```js
// config.js — local-only secrets for file:// use. NEVER commit (gitignored).
var LLM_API_KEY    = 'PASTE_YOUR_KEY_HERE'; // same key as LLM_API_KEY in .env
var LLM_BASE_URL   = 'https://openrouter.ai/api/v1';
var LLM_MODEL      = 'tencent/hy3:free';
var APP_PASSPHRASE = '<copy existing value from the old config.js>';
```

Then the USER pastes their real key into `LLM_API_KEY` (and adjusts `LLM_BASE_URL`/`LLM_MODEL` if their key is not from OpenRouter). Flag this to the user — the executor cannot read `.env`.

- [ ] **Step 2: Verify config stays untracked**

Run: `git status --short js/config.js`
Expected: no output (still gitignored).

- [ ] **Step 3: Full local end-to-end test (needs the real key in config.js)**

Open `index.html` via `file://`, enter passphrase, paste a real CV and JD into the left panel, then:
1. Click **Match Job** → assistant reply streams in progressively, ends with a markdown score table (rendered as an HTML table) and one recommendation line. Settings tab + header meta show `tencent/hy3:free`.
2. Ask a free-form follow-up ("why did domain fit score low?") → coherent answer referencing the previous turn.
3. Click **Diagnose CV** → diagnosis with Overall Assessment / Strengths / Weaknesses / Priority Fixes sections.
4. **Export .md** → file contains the whole conversation.
5. Error path: temporarily set `LLM_API_KEY = ''` in config.js, reload, send → "No API key found…" error bubble with working Retry (after restoring the key and reloading).

- [ ] **Step 4: Proxy mode end-to-end (`vercel dev`)**

`.env` must contain `LLM_API_KEY` (already does), plus `APP_PASSPHRASE`, and optionally `LLM_BASE_URL`/`LLM_MODEL` (defaults kick in otherwise — add them if the key is not an OpenRouter key).

Run: `vercel dev`
Then open the served localhost URL and repeat checks 1–2 from Step 3 (requests now go through `/api/chat`; streaming must still be progressive, not all-at-once).
Also verify a wrong passphrase at the gate → first send returns the Unauthorized error bubble.

- [ ] **Step 5: Deployment note (user action)**

Before deploying: set `LLM_API_KEY`, `APP_PASSPHRASE` — and `LLM_BASE_URL` + `LLM_MODEL` if not using the OpenRouter defaults — in the Vercel project's environment variables. The old `GROQ_API_KEY` env var can be removed.

- [ ] **Step 6: Final review and merge decision**

Run: `npm test` one last time (all PASS), then review the branch diff (`git diff main --stat`) and use the superpowers:finishing-a-development-branch skill to decide merge/PR.
