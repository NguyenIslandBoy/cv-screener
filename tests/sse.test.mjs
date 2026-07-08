import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './helpers/load-script.mjs';

function load() {
  const sandbox = loadScript('js/api.js', { window: { location: { protocol: 'file:' } } });
  const originalParse = sandbox.parseSSELine;
  // Bridge vm context objects to test context
  sandbox.parseSSELine = (line) => {
    const result = originalParse(line);
    return result === null ? null : Object.assign({}, result);
  };
  return sandbox;
}

test('parses a content delta line', () => {
  const g = load();
  assert.deepStrictEqual(
    g.parseSSELine('data: {"choices":[{"delta":{"content":"Hel"}}]}'),
    { type: 'delta', text: 'Hel' }
  );
});

test('recognizes the [DONE] marker', () => {
  const g = load();
  assert.deepStrictEqual(g.parseSSELine('data: [DONE]'), { type: 'done' });
});

test('ignores comments, blanks, non-data lines, and bad JSON', () => {
  const g = load();
  assert.equal(g.parseSSELine(': OPENROUTER PROCESSING'), null);
  assert.equal(g.parseSSELine(''), null);
  assert.equal(g.parseSSELine('event: ping'), null);
  assert.equal(g.parseSSELine('data: {broken'), null);
});

test('classifies reasoning deltas, ignores empty deltas', () => {
  const g = load();
  assert.deepStrictEqual(g.parseSSELine('data: {"choices":[{"delta":{"reasoning":"hmm"}}]}'), { type: 'reasoning' });
  assert.deepStrictEqual(g.parseSSELine('data: {"choices":[{"delta":{"reasoning_content":"The user"}}]}'), { type: 'reasoning' });
  assert.equal(g.parseSSELine('data: {"choices":[{"delta":{"content":""}}]}'), null);
  assert.equal(g.parseSSELine('data: {"choices":[{"delta":{}}]}'), null);
});

test('reports finish_reason chunks', () => {
  const g = load();
  assert.deepStrictEqual(g.parseSSELine('data: {"choices":[{"delta":{},"finish_reason":"length"}]}'), { type: 'finish', reason: 'length' });
  assert.deepStrictEqual(g.parseSSELine('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}'), { type: 'finish', reason: 'stop' });
});

test('content takes priority over finish_reason in the same chunk', () => {
  const g = load();
  assert.deepStrictEqual(g.parseSSELine('data: {"choices":[{"delta":{"content":"hi"},"finish_reason":"stop"}]}'), { type: 'delta', text: 'hi' });
});
