// chat.js — chat state, send flow, retry. History is in-memory only.

var chatHistory = [];
var chatBusy = false;

function collectContext() {
  return {
    cv: document.getElementById('cv-text').value,
    jd: document.getElementById('jd-text').value,
    portfolio: document.getElementById('portfolio-text').value.trim()
      || document.getElementById('github-username').value.trim()
  };
}

function sendChatMessage(text) {
  text = (text || '').trim();
  if (chatBusy || !text) return;
  chatHistory.push({ role: 'user', content: text });
  appendUserBubble(text);
  startAssistantTurn();
}

// Runs one assistant turn against the current history (last entry must be a
// user message). Failed turns are NOT added to history, so retry just runs
// the turn again.
async function startAssistantTurn() {
  chatBusy = true;
  setComposerBusy(true);

  var row = appendAssistantBubble();
  var ctx = collectContext();
  var messages = [
    { role: 'system', content: buildSystemPrompt(ctx.cv, ctx.jd, ctx.portfolio) }
  ].concat(chatHistory);

  try {
    var full = await streamChat(messages, function (_delta, soFar) {
      updateAssistantBubble(row, soFar);
    }, function (note) {
      setPendingStatus(row, note);
    });
    chatHistory.push({ role: 'assistant', content: full });
    finalizeAssistantBubble(row, full);
  } catch (err) {
    renderChatError(row, err.message || 'Something went wrong.');
  } finally {
    chatBusy = false;
    setComposerBusy(false);
  }
}

function retryTurn(failedRow) {
  if (chatBusy) return;
  failedRow.remove();
  startAssistantTurn();
}
