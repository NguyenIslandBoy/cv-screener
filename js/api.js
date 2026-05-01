// api.js — calls Groq API, returns parsed result object
// Throws descriptive errors so ui.js can display them cleanly.

async function callGroq(apiKey, model, prompt, retries) {
  retries = retries || 0;

  var response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.2
      })
    });
  } catch (err) {
    throw new Error('Network error — check your internet connection. (' + err.message + ')');
  }

  if (response.status === 429) {
    if (retries >= 4) throw new Error('Rate limit hit repeatedly. Wait a minute and try again.');
    var wait = Math.pow(2, retries) * 3000;
    document.getElementById('loading-label').textContent =
      'Rate limit hit — retrying in ' + (wait / 1000) + 's...';
    await new Promise(function (r) { setTimeout(r, wait); });
    return callGroq(apiKey, model, prompt, retries + 1);
  }

  if (!response.ok) {
    var errorBody;
    try { errorBody = await response.json(); } catch (_) { errorBody = {}; }
    var detail = (errorBody.error && errorBody.error.message) ? errorBody.error.message : response.statusText;
    if (response.status === 401) throw new Error('Invalid API key. Check js/config.js.');
    throw new Error('Groq API error ' + response.status + ': ' + detail);
  }

  var data;
  try { data = await response.json(); } catch (_) {
    throw new Error('Could not parse Groq response as JSON.');
  }

  var raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!raw) throw new Error('Empty response from model. Try again.');

  var cleaned = raw.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  var result;
  try { result = JSON.parse(cleaned); } catch (_) {
    throw new Error('Model returned invalid JSON. Try again.\n\nRaw output:\n' + cleaned.slice(0, 300));
  }

  return result;
}