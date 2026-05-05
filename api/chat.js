export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const passphrase = req.headers.get('x-app-passphrase');
  if (!passphrase || passphrase !== process.env.APP_PASSPHRASE) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server.' }), { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), { status: 500 });
  }
}