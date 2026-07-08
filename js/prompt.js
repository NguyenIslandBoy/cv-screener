// prompt.js — builds the system prompt from skill content + session context.
// Pure function: no DOM access, no API calls. Depends on global SKILL_CONTENT.

function buildSystemPrompt(cv, jd, portfolio) {
  function orNotProvided(text) {
    return text && String(text).trim() ? String(text).trim() : 'Not provided.';
  }

  var parts = [SKILL_CONTENT.core];

  SKILL_CONTENT.workflows.forEach(function (wf) {
    parts.push('## Workflow: ' + wf.title + '\n\n' + wf.reference);
  });

  parts.push([
    '## Session Context',
    '',
    'The user maintains these inputs in a side panel next to this chat. Treat them as the',
    'current CV, target job description, and portfolio for all workflows. If one is missing',
    'and a workflow needs it, ask the user to fill it in on the left panel or paste it here.',
    '',
    '### Candidate CV',
    orNotProvided(cv),
    '',
    '### Target Job Description',
    orNotProvided(jd),
    '',
    '### Portfolio / GitHub',
    orNotProvided(portfolio),
  ].join('\n'));

  return parts.join('\n\n---\n\n');
}
