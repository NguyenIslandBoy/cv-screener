import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.js';

function makeReq(headers, bodyObj) {
  return new Request('https://example.com/api/chat', {
    method: 'POST',
    headers,
    body: bodyObj === undefined ? undefined : JSON.stringify(bodyObj)
  });
}

test('verify request with the correct passphrase returns 200 without calling the LLM', async () => {
  process.env.APP_PASSPHRASE = 'secret-123';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('upstream fetch must not run on the verify path'); };
  try {
    const res = await handler(makeReq({ 'x-app-passphrase': 'secret-123' }, { verify: true }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('verify request with a wrong passphrase returns 401', async () => {
  process.env.APP_PASSPHRASE = 'secret-123';
  const res = await handler(makeReq({ 'x-app-passphrase': 'wrong' }, { verify: true }));
  assert.equal(res.status, 401);
});

test('verify request with no passphrase returns 401', async () => {
  process.env.APP_PASSPHRASE = 'secret-123';
  const res = await handler(makeReq({}, { verify: true }));
  assert.equal(res.status, 401);
});

test('non-POST requests are rejected', async () => {
  const res = await handler(new Request('https://example.com/api/chat', { method: 'GET' }));
  assert.equal(res.status, 405);
});
