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
