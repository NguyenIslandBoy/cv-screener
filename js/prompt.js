// prompt.js — builds the evaluation prompt from user inputs
// Pure function: no DOM access, no API calls.

function buildPrompt(cv, jd, githubSummary, roleType) {
  var isStem = roleType === 'stem';

  var portfolioInstruction = isStem
    ? 'Sub-scores must include "portfolio" (1–10). If no portfolio is provided, set it to null and exclude it from the overall score calculation.'
    : 'Do not include a portfolio sub-score. Set "portfolio" to null.';

  var planInstruction = isStem
    ? 'Include a "plan" object with goal, skills (array), projects (array), timeline, and resources (array).'
    : 'Set "plan" to null.';

  var rubric = [
    'SCORING RUBRIC — follow exactly, do not deviate:',
    '',
    'Overall score (0–100):',
    '  85–100  Strong fit. Meets almost all requirements; gaps are minor.',
    '  70–84   Good fit. Meets core requirements with some gaps.',
    '  55–69   Partial fit. Meaningful gaps in skills or experience.',
    '  40–54   Weak fit. Significant retraining required.',
    '  0–39    Poor fit. Missing most core requirements.',
    '',
    'Skills sub-score (1–10):',
    '  Score against explicitly listed job requirements only.',
    '  9–10  Meets 90%+ of listed skills with evidence in the CV.',
    '  7–8   Meets 70–89% of listed skills.',
    '  5–6   Meets 50–69% of listed skills.',
    '  3–4   Meets 30–49% of listed skills.',
    '  1–2   Meets fewer than 30% of listed skills.',
    '',
    'Experience sub-score (1–10):',
    '  Score against seniority level, domain, and years required.',
    '  9–10  Directly relevant experience at the right level and domain.',
    '  7–8   Relevant experience; minor level or domain mismatch.',
    '  5–6   Adjacent experience; clear transferability but not direct.',
    '  3–4   Some relevant experience; substantial gaps.',
    '  1–2   Little to no relevant experience.',
    '',
    portfolioInstruction,
    '',
    'Be honest, not flattering. A score above 75 means genuinely strong fit.',
    'Do not infer skills not mentioned in the CV.',
    'Before scoring skills, explicitly scan the CV for every tool mentioned in the job description by name.',
    'If a tool is found anywhere in the CV — in experience, projects, or skills section — mark it as present.',
    'Do not mark a skill as missing if it appears anywhere in the CV.',
  ].join('\n');

  var schema = JSON.stringify({
    overall_score: 72,
    sub_scores: {
      skills: 7,
      experience: 6,
      portfolio: 8
    },
    strengths: [
      'Example strength tied to a specific job requirement'
    ],
    gaps: [
      'Example gap — something required that is missing or weak'
    ],
    suggestions: [
      'Specific action: name a technology, project, or certification'
    ],
    plan: {
      goal: 'One sentence goal',
      skills: ['skill one', 'skill two'],
      projects: ['Project idea with specific tech stack'],
      timeline: '8 weeks',
      resources: ['Book or course name and where to find it']
    }
  }, null, 2);

  return [
    '## Job Description',
    jd,
    '',
    '## Candidate CV',
    cv,
    '',
    githubSummary ? '## GitHub / Portfolio Summary\n' + githubSummary : '## GitHub / Portfolio Summary\nNot provided.',
    '',
    '## Instructions',
    'You are a senior technical recruiter evaluating a candidate for the role above.',
    'Read the CV carefully before scoring. Every strength and gap must cite specific evidence from the CV — job title, company, metric, or project name. Do not write generic statements that could apply to any candidate.',
    'If a skill appears in the CV with concrete usage (e.g. named tool + context), count it as present. Do not mark it as missing.',
    rubric,
    '',
    planInstruction,
    '',
    '## Output Format',
    'Return ONLY valid JSON. No explanation. No markdown. No code fences. No preamble.',
    'Use exactly this schema (replace example values with real ones):',
    schema,
  ].join('\n');
}

// ── Rewrite prompt ────────────────────────────────────────────
function buildRewritePrompt(cv, jd, suggestions) {
  return [
    '## Original CV',
    cv,
    '',
    '## Target Job Description',
    jd,
    '',
    '## Identified Suggestions',
    suggestions.join('\n'),
    '',
    '## Instructions',
    'You are an expert CV editor. Do NOT rewrite the whole CV.',
    'Instead, identify 5–10 specific bullet points or phrases in the CV that should be improved to better match the job description.',
    'For each one:',
    '  - Quote the original text exactly as it appears in the CV',
    '  - Write a polished version: stronger verb, JD keywords woven in naturally, outcome made explicit',
    '  - State which section of the CV it comes from',
    '  - Give a one-sentence reason for the change',
    '  - Do not invent facts, tools, or metrics not present in the original',
    '',
    '## Output Format',
    'Return ONLY valid JSON. No explanation. No markdown fences. No preamble.',
    'Schema:',
    JSON.stringify({
      edits: [
        {
          section: 'Experience — Company Name',
          original: 'Exact original text from CV',
          polished: 'Improved version with stronger framing',
          reason: 'One sentence explaining the change'
        }
      ],
      plan: {
        goal: 'One sentence goal addressing gaps that cannot be reframed',
        skills: ['Specific skill to learn'],
        projects: ['Project idea with named tech stack'],
        timeline: '6 weeks',
        resources: ['Named course or certification']
      }
    }, null, 2),
  ].join('\n');
}