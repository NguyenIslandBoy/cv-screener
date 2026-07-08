# CV.Screen — Career Strategy Assistant

A chat-based career strategy assistant for Data / Software / ML / AI / Analytics roles.
Keep your CV, a job description, and a portfolio summary in a side panel; the chat uses
them as live context for ten career workflows powered by Tencent **Hy3** through any
OpenAI-compatible LLM provider.

## Workflows

Quick-launch buttons above the chat (or just type a request):

| Button | What it does |
|---|---|
| Diagnose CV | Full CV review: strengths, weaknesses, ATS risk, recruiter risk, priority fixes |
| Match Job | Scores your CV against the job description, honest apply/skip recommendation |
| Tailor CV | Rewrites your CV content for the specific JD (truthful reframing only) |
| Rewrite Bullets | Finds weak bullet points and rewrites them (Action + Task + Tool + Result) |
| Cover Letter | Drafts a role- and company-specific cover letter |
| Interview Prep | HR + technical questions weighted to what the JD emphasizes |
| More + → Portfolio Review | Honest project-by-project portfolio evaluation |
| More + → Skill Gaps | Gap analysis ranked by employability impact |
| More + → Application Strategy | Company targeting, weekly volume, quality tiers, tracking table |
| More + → Market Research | Role overview, demand, entry barrier, salary, search keywords |

Answers stream in as markdown. **Export .md** downloads the whole conversation.

## How it works

Static vanilla-JS frontend + one Vercel edge function:

- `js/skill-content.js` — the full coaching playbook (generated, see Development below)
- `js/prompt.js` — builds the system prompt: playbook + your CV/JD/portfolio, every turn
- `js/api.js` — streaming OpenAI-compatible client (SSE)
- `js/chat.js`, `js/render.js`, `js/ui.js`, `js/download.js` — chat state, markdown rendering (marked + DOMPurify), UI wiring, export
- `js/reader.js` — CV file upload (.txt / .md / .docx / .pdf)
- `api/chat.js` — edge proxy: checks the passphrase, attaches the API key server-side, streams the provider response through

There is no build step for the app itself and no npm dependencies — browser libraries load from cdnjs.

## Configuration

Four values, one per concern:

| Variable | Meaning | Current value |
|---|---|---|
| `LLM_API_KEY` | Provider API key | *(secret)* |
| `LLM_BASE_URL` | OpenAI-compatible base URL | `https://api.novita.ai/openai` |
| `LLM_MODEL` | Model ID | `tencent/hy3` |
| `APP_PASSPHRASE` | Gate for the deployed proxy | *(secret)* |

Any OpenAI-compatible provider works — change the base URL and model ID.

### Deployed (Vercel)

Set all four as environment variables in the Vercel project settings
(the old `GROQ_API_KEY` variable from v0.1 can be deleted). The frontend never
sees the key; requests go through `/api/chat` with the passphrase header.

### Local (no server)

Open `index.html` directly in a browser (`file://`). Secrets come from `js/config.js`
(gitignored — never commit it):

```js
// js/config.js
var LLM_API_KEY    = '...';
var LLM_BASE_URL   = 'https://api.novita.ai/openai';
var LLM_MODEL      = 'tencent/hy3';
var APP_PASSPHRASE = '...';
```

Use `var`, not `const` — the inline fallback in `index.html` declares the same globals.
In local mode the browser calls the provider directly.

## Development

Requires Node 18+ (for tests and the content build only).

```bash
npm test              # unit tests for the prompt builder, SSE parser, skill content
npm run build:skill   # regenerate js/skill-content.js from skill-src/
```

The coaching content lives as markdown in `skill-src/` (`core.md` + one file per
workflow under `references/`). Edit those, rerun `npm run build:skill`, and commit both
the source and the regenerated `js/skill-content.js`.

## Notes

- Hy3 is a reasoning model: the chat shows *Thinking…* while it reasons before the
  answer streams. Reasoning shares the `max_tokens` budget (8000); if a reply ever dies
  with a token-budget error, shorten the request.
- Conversation history is in-memory only — refreshing the page clears it. Export first.
