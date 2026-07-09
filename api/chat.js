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

  let body;
  try { body = await req.json(); } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }

  // Passphrase-only check for the auth gate — the passphrase is valid if we
  // got here, so acknowledge without touching the LLM.
  if (body.verify) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server.' }), { status: 500 });
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
