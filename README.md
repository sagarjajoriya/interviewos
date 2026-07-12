# InterviewOS — AI Interviewer

A realistic, adaptive AI interviewer. It conducts a live text interview one
question at a time, listens to each answer, asks intelligent follow-ups, and
produces a detailed, rubric-based evaluation report at the end. Built to feel
like talking to a real interviewer — not a chatbot.

## Quick start

```bash
npm install
cp .env.example .env.local     # then add your GEMINI_API_KEY
npm run dev                     # http://localhost:3000
```

Get a Gemini API key at https://aistudio.google.com/apikey and put it in
`.env.local`:

```
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash
GEMINI_API_KEY=xxxxxxxx
```

## How it works

1. **Setup** (`/`) — pick the role, level, interview type, interviewer style,
   and length.
2. **Interview** (`/interview/:id`) — a streaming, one-question-at-a-time
   conversation. A private "director" note steers pacing and follow-ups behind
   the scenes; the model naturally wraps up when enough ground is covered.
3. **Report** (`/report/:id`) — a structured evaluation: recommendation, an
   overall score, a 5-dimension rubric breakdown, strengths, concerns, notable
   moments, and next-round suggestions.

## Architecture

```
app/
  page.js                       Setup form (landing)
  interview/[id]/               Interview room (streaming chat UI)
  report/[id]/                  Evaluation report
  api/interviews/               REST + NDJSON streaming endpoints
lib/
  llm/                          LLM abstraction — provider-agnostic
    provider.js                 The contract every provider implements
    gemini.js                   Gemini Flash adapter
    index.js                    Provider registry / factory
  interview/                    Domain logic
    personas.js                 Types, levels, personas, config normalization
    prompts.js                  Interviewer + report prompt engineering
    engine.js                   Turn orchestration, pacing, report generation
  db/store.js                   Repository (in-memory, swappable)
  client/ndjson.js              Browser NDJSON stream reader
```

### Swapping the LLM provider

The app depends only on the `LLMProvider` contract in
[`lib/llm/provider.js`](lib/llm/provider.js) — never on a vendor SDK. To move
from Gemini to Groq (or OpenAI, Ollama, ...):

1. Add `lib/llm/<vendor>.js` extending `BaseLLMProvider` (`streamChat` +
   `generateJSON`).
2. Register a factory in [`lib/llm/index.js`](lib/llm/index.js).
3. Set `LLM_PROVIDER=<vendor>` (and its API key) in `.env.local`.

No changes to routes, engine, or UI.

### Swapping storage

Sessions live behind the repository in [`lib/db/store.js`](lib/db/store.js)
(in-memory today). Implement the same methods against Postgres/SQLite/Redis and
return it from `getRepo()` — no other code changes.

## Roadmap

- Voice mode (speech-to-text in, text-to-speech interviewer out)
- Persistent database + auth so reports survive restarts
- Resume-aware questioning and coding-exercise interviews
- PDF export of reports
