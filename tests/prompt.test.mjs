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
