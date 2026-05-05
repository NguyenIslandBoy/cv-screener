// api/chat.js — Vercel serverless proxy
// Keeps the Groq API key server-side, never exposed to the browser.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check — validate passphrase from request header
  var passphrase = req.headers['x-app-passphrase'];
  if (!passphrase || passphrase !== process.env.APP_PASSPHRASE) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Forward to Groq
  var apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(req.body)
    });

    var data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
}