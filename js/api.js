// api.js — streaming chat calls: /api/chat proxy (Vercel) or provider directly (local file:// / localhost)

// Local mode: file:// or a static localhost server (no /api/chat proxy) — talk to
// the provider directly and gate against config.js. Deployed mode: everything else.
function isLocalMode() {
  var host = window.location.hostname;
  return window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
}

// Local-mode auth-gate decision. A configured passphrase must match exactly; an
// empty/unset passphrase fails closed (no bypass) with a setup hint.
function localAuthResult(val, expected) {
  if (!expected) return { ok: false, message: 'No passphrase set. Add APP_PASSPHRASE to js/config.js.' };
  if (val === expected) return { ok: true, message: '' };
  return { ok: false, message: 'Incorrect passphrase.' };
}

function getEndpoint() {
  if (isLocalMode()) {
    var base = (typeof LLM_BASE_URL !== 'undefined' && LLM_BASE_URL)
      ? LLM_BASE_URL
      : 'https://openrouter.ai/api/v1';
    return base.replace(/\/$/, '') + '/chat/completions';
  }
  return '/api/chat';
}

function getHeaders() {
  if (isLocalMode()) {
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
// parseSSELine — pure. Returns {type:'delta',text} | {type:'reasoning'} |
// {type:'finish',reason} | {type:'done'} | null (line carries nothing useful).
function parseSSELine(line) {
  if (!line || line.charAt(0) === ':') return null;
  if (line.indexOf('data:') !== 0) return null;

  var payload = line.slice(5).trim();
  if (payload === '[DONE]') return { type: 'done' };

  var obj;
  try { obj = JSON.parse(payload); } catch (_) { return null; }

  var choice = obj.choices && obj.choices[0];
  if (!choice) return null;

  var delta = choice.delta;
  var text = delta && delta.content;
  if (typeof text === 'string' && text.length) return { type: 'delta', text: text };

  if (choice.finish_reason) return { type: 'finish', reason: choice.finish_reason };

  if (delta && (typeof delta.reasoning_content === 'string' || typeof delta.reasoning === 'string')) {
    return { type: 'reasoning' };
  }

  return null;
}

// ── Streaming chat call ───────────────────────────────────────
async function streamChat(messages, onDelta, onStatus, retries) {
  retries = retries || 0;

  if (isLocalMode()) {
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
  var sawReasoning = false;
  var finishReason = null;

  function handleLine(rawLine) {
    var parsed = parseSSELine(rawLine.replace(/\r$/, ''));
    if (!parsed) return;
    if (parsed.type === 'delta') {
      full += parsed.text;
      onDelta(parsed.text, full);
    } else if (parsed.type === 'finish') {
      finishReason = parsed.reason;
    } else if (parsed.type === 'reasoning' && !sawReasoning) {
      sawReasoning = true;
      if (onStatus) onStatus('Thinking…');
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

  if (!full.trim()) {
    if (finishReason === 'length') {
      throw new Error('The model used the whole token budget on internal reasoning and returned no answer. Try a shorter request.');
    }
    throw new Error('Empty response from model. Try again.');
  }
  return full;
}
