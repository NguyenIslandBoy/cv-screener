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
