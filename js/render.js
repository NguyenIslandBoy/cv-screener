// render.js — chat thread rendering: bubbles, streaming markdown, errors.
// Markdown via marked (CDN), sanitized with DOMPurify (CDN).

function chatThreadEl() {
  return document.getElementById('chat-thread');
}

function renderMarkdown(md) {
  return DOMPurify.sanitize(marked.parse(md));
}

function hideChatEmptyState() {
  var empty = document.getElementById('chat-empty');
  if (empty) empty.classList.add('hidden');
}

function scrollThreadToBottom() {
  var thread = chatThreadEl();
  thread.scrollTop = thread.scrollHeight;
}

function appendUserBubble(text) {
  var row = document.createElement('div');
  row.className = 'msg msg-user';
  var bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  hideChatEmptyState();
  chatThreadEl().appendChild(row);
  scrollThreadToBottom();
  return row;
}

function appendAssistantBubble() {
  var row = document.createElement('div');
  row.className = 'msg msg-assistant';
  var bubble = document.createElement('div');
  bubble.className = 'msg-bubble msg-md';
  bubble.innerHTML = '<span class="msg-pending">▍</span>';
  row.appendChild(bubble);
  hideChatEmptyState();
  chatThreadEl().appendChild(row);
  scrollThreadToBottom();
  return row;
}

function setPendingStatus(row, note) {
  var bubble = row.querySelector('.msg-bubble');
  bubble.innerHTML = '<span class="msg-pending">▍</span> ';
  var span = document.createElement('span');
  span.className = 'msg-status';
  span.textContent = note;
  bubble.appendChild(span);
}

// Throttle streaming re-renders so markdown parsing doesn't run per token.
var renderThrottleTimer = null;
var renderThrottleLatest = '';

function updateAssistantBubble(row, markdownSoFar) {
  renderThrottleLatest = markdownSoFar;
  if (renderThrottleTimer) return;
  renderThrottleTimer = setTimeout(function () {
    renderThrottleTimer = null;
    row.querySelector('.msg-bubble').innerHTML = renderMarkdown(renderThrottleLatest);
    scrollThreadToBottom();
  }, 100);
}

function clearRenderThrottle() {
  if (renderThrottleTimer) {
    clearTimeout(renderThrottleTimer);
    renderThrottleTimer = null;
  }
}

function finalizeAssistantBubble(row, markdown) {
  clearRenderThrottle();
  row.querySelector('.msg-bubble').innerHTML = renderMarkdown(markdown);
  scrollThreadToBottom();
}

function renderChatError(row, message) {
  clearRenderThrottle();
  var bubble = row.querySelector('.msg-bubble');
  bubble.innerHTML = '';

  var box = document.createElement('div');
  box.className = 'chat-error';

  var strong = document.createElement('strong');
  strong.textContent = 'Error';
  var span = document.createElement('span');
  span.textContent = message;
  var retry = document.createElement('button');
  retry.className = 'btn-secondary';
  retry.textContent = 'Retry';
  retry.addEventListener('click', function () { retryTurn(row); });

  box.appendChild(strong);
  box.appendChild(span);
  box.appendChild(retry);
  bubble.appendChild(box);
  scrollThreadToBottom();
}
