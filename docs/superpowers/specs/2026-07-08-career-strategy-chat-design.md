# CV Screener → Career Strategy Assistant — Design Spec

**Date:** 2026-07-08
**Status:** Approved design, pending implementation plan

## Goal

Refactor the one-shot CV screener into a hybrid context + chat career strategy assistant
implementing all 10 workflows from `career-strategy-assistant-tech-roles.skill`, and switch
the LLM from Groq `openai/gpt-oss-120b` to Tencent Hy3 via an OpenAI-compatible API.

## Decisions (agreed with user)

1. **App shape: hybrid.** Left panel keeps CV / JD / portfolio inputs as persistent context.
   Right panel becomes a chat thread with workflow quick-launch buttons and a free-text
   composer.
2. **Workflow scope: all 10** skill workflows (CV diagnosis, job matching, CV tailoring,
   bullet rewrites, cover letters/outreach, interview prep, portfolio review, skill gaps,
   application strategy, market research).
3. **No routing layer.** Hy3 has a 256K context and the entire skill is ~7K tokens, so the
   full skill (core rules + output style + all 10 reference files) is baked into the system
   prompt on every call. Workflow buttons send canned user messages; free-typed messages
   route themselves.
4. **Provider-agnostic model config** (assumption — provider of the user's key is
   unconfirmed): endpoint and model come from env vars, defaulting to OpenRouter.

## Model configuration

| Variable | Purpose | Default |
|---|---|---|
| `LLM_API_KEY` | Bearer token (already in `.env`) | — (required) |
| `LLM_BASE_URL` | OpenAI-compatible base URL | `https://openrouter.ai/api/v1` |
| `LLM_MODEL` | Model ID | `tencent/hy3:free` |
| `APP_PASSPHRASE` | Proxy auth (unchanged) | — |

- Deployed (Vercel): all four are read server-side by `api/chat.js`. They must be set in the
  Vercel project settings; `.env` is only read locally by `vercel dev`.
- Local `file://` mode: `js/config.js` (gitignored) declares `LLM_API_KEY`, `LLM_BASE_URL`,
  `LLM_MODEL`; the client calls the provider directly, same pattern as today. The old
  `GROQ_*` constants are replaced; the stale Groq key should be deleted from `config.js`.

Request parameters: `temperature: 0.5`, `max_tokens: 8000`, `stream: true`.

## Architecture

### Files

| File | Status | Responsibility |
|---|---|---|
| `js/skill-content.js` | **new** | Skill markdown as JS string constants: core rules + output style (from `SKILL.md`) and each of the 10 reference files. Also the 10 workflow definitions (id, label, canned user message). |
| `js/prompt.js` | rewrite | `buildSystemPrompt(cv, jd, portfolio)` — pure function joining skill content + a Session Context block. Old scoring-rubric/JSON-schema builders deleted. |
| `js/chat.js` | **new** | Chat state (in-memory message array), send handler, workflow-button handler, retry-on-error. Sends full history each turn. |
| `js/api.js` | rewrite | `streamChat(messages, onDelta)` — OpenAI-compatible streaming call. SSE parsing: ignore comment lines (`: ...`), accumulate `choices[0].delta.content`, stop at `data: [DONE]`. Ignore `delta.reasoning`. Keeps the local-vs-proxy endpoint split, 429 backoff, and error mapping from today. |
| `js/render.js` | rewrite | Renders chat messages. Assistant markdown → HTML via marked.js, sanitized with DOMPurify (both via cdnjs, matching existing CDN usage). Streaming re-render throttled (~100 ms). Old scorecard renderer deleted. |
| `js/download.js` | repurpose | Export the full conversation as a `.md` file. |
| `js/ui.js` | update | Pills, tabs, composer wiring, auth gate (unchanged logic). Old `runEvaluation` two-call flow deleted. |
| `js/reader.js` | unchanged | File upload → text extraction (.txt/.md/.docx/.pdf). |
| `api/chat.js` | update | Same passphrase check. Forwards to `${LLM_BASE_URL}/chat/completions` with `LLM_API_KEY`; injects `LLM_MODEL` if the body has no model. Streams the upstream body through unchanged (edge runtime `return new Response(upstream.body, ...)`). |
| `index.html` | update | Right panel: chat thread + workflow buttons + composer. Settings tab: STEM/non-STEM selector removed; shows model info. Remove duplicate mammoth `<script>` tag; add marked.js + DOMPurify. |
| `css/style.css` | update | Chat thread, message bubbles, workflow buttons, composer styles. Existing left-panel/auth styles kept. |

### System prompt composition

```
[SKILL.md — persona, core operating rules, output style]

[## Workflow: CV Diagnosis        — cv-diagnosis.md]
[## Workflow: Bullet Points        — bullet-points.md]
[... all 10 reference files ...]

## Session Context
### Candidate CV
{cv text | "Not provided."}
### Target Job Description
{jd text | "Not provided."}
### Portfolio / GitHub
{portfolio text | "Not provided."}
```

The Session Context block is rebuilt from the left panel on every request, so panel edits
apply to the next message. The skill's routing table section is omitted (no files to route
to); its rule "ask for the 1-2 most load-bearing pieces of information" is kept so the model
asks when CV/JD are missing for a workflow that needs them.

### Workflow quick-launch buttons

Always enabled (the skill's rules make the model ask for missing inputs). Clicking one sends
its canned message as a normal user chat turn.

Primary row: Diagnose CV · Match Job · Tailor CV · Rewrite Bullets · Cover Letter ·
Interview Prep. "More…" menu: Portfolio Review · Skill Gaps · Application Strategy ·
Market Research.

### Chat behavior

- History is in-memory only; page refresh clears it (download button preserves it). No
  persistence in this iteration.
- Each turn sends: system prompt (rebuilt) + full prior user/assistant messages + new
  user message.
- Streaming deltas append to the in-progress assistant bubble; markdown re-rendered
  throttled.

## Error handling

- 429: exponential backoff retry (as today), status shown in the pending bubble.
- 401: "Unauthorized — check your passphrase or API key."
- Stream abort / network / non-OK status: error state rendered *in the chat thread* on the
  failed turn with a Retry button (re-sends the same user message).
- Empty completion: treated as an error with retry.

## Removed

- Scoring rubric / JSON schema prompts and the strict-JSON parsing path.
- Two-call evaluate → rewrite sequence.
- Custom scorecard renderer.
- STEM / non-STEM role-type selector.
- All Groq references (endpoint, `GROQ_API_KEY`, `GROQ_MODEL`).

Match scoring is not lost — it's the job-matching workflow, rendered as the skill's markdown
score table.

## Out of scope (future)

- Live web search for the market-research workflow (runs on model knowledge; the skill
  already instructs it to flag uncertainty).
- GitHub auto-fetch (existing placeholder stays manual).
- Chat persistence across refreshes.
- Hy3 `reasoning_effort` tuning.

## Verification

- `js/prompt.js` and the SSE line-parser stay pure (no DOM) for direct testing.
- Manual end-to-end: local `file://` mode with `config.js`, and `vercel dev` proxy mode —
  run each of the 10 workflow buttons plus a free-form follow-up; confirm streaming render,
  markdown tables, error + retry path (bad passphrase, bad key).
