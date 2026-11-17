# NIAT Enrollment Companion (demo)

**Live demo:** https://enrollment-companion.vercel.app · **Code:** https://github.com/nityameh/niat-enrollment-companion

An AI companion that keeps families engaged **after** NIAT's one-on-one counselling, from "should we join?" through the separate university application to "enrolled", and tells counsellors which families need a person and why. Built for the NxtWave Jr. Growth Manager Growth Hack Challenge. All families, documents and university rules are synthetic; this is not an official NIAT product.

## What it does

| Part | What happens | AI work |
|---|---|---|
| Companion chat (`/lead/[id]`) | Parent or student asks anything on a simulated WhatsApp, in Telugu, Hindi, Tamil, Kannada, Malayalam or English | Tool-calling agent (7 tools) that answers only from NIAT-approved knowledge, with citations |
| Seven agent modes | Decision support, college choice, fees, programme, university application, NIAT enrolment, respectful close | Mode picked from the family's stage and what they ask; each mode has its own playbook and quick replies |
| Document checker | Family sends a photo of a marksheet or transfer certificate | Vision model reads it; the app flags a name mismatch, the wrong document, a cut-off page, or a missing signature or seal |
| Reminders | A family quiet for 3 days gets one useful message about their exact next step; a "no" stops everything | Message written in the family's language; runs daily on Vercel Cron |
| Counsellor dashboard (`/counsellor`) | Families by risk, stage, worry and language, with filters and charts | Explainable risk score and an AI "prep my call" brief per family |
| Knowledge control (`/admin`) | NIAT's team decides what the bot may say | Second-model grounding check blocks unapproved claims |

## Pages

| Page | What it is |
|---|---|
| `/` | What was built, a 60-second tour, and all 19 demo families |
| `/lead/[id]?as=parent` | Tablet-sized WhatsApp simulation (switch parent / student), journey bar, document track, and a log of what the AI did |
| `/counsellor` | Who needs a human today, why, live metrics and a growth impact calculator |
| `/admin` | Knowledge base: test a question, pick the answer mode, edit company answers, check public facts against NIAT's live site |
| `/about` | The problem, the approach and the limits |

## NIAT controls what the bot says

The bot never browses the internet. It answers only from the knowledge base at `/admin`:

- **Company answers** (C1, C2...): written by NIAT's team, with the different ways families ask each question. Add one at a time or paste many as `Q:` / `A:` pairs.
- **Public facts** (F1...F29): taken from niatindia.com (including `/llm-info`, terms, placements and campus pages) with their URLs. "Check against live site" asks a model to compare each fact with the current `/llm-info` page.
- **Answer mode:** "Company answers only" or "Company answers + public facts".

In "company answers only" mode every reply goes through a second AI check (`src/lib/grounding.ts`). If a reply contains a claim not backed by an approved answer, the family gets "your counsellor will answer this" in their language, and a counsellor is alerted. Set `GROUNDING_CHECK=always` to run the check in both modes.

## Architecture

```
Browser (family / counsellor / NIAT admin)
  -> Next.js 16 API routes (Vercel)
       -> Groq: gpt-oss-120b agent with tools, qwen vision for documents,
                gpt-oss-20b for reminders, call briefs and grounding checks
                (falls back to smaller models on rate limits)
       -> Upstash Redis (whole demo state as one JSON document; local file in dev)
  <- Vercel Cron, daily -> /api/nudges/run (reminders)
  -> WhatsApp Cloud API webhook (optional, untested end to end)
```

Key files: `src/lib/agent.ts` (agent loop, rules, language handling), `src/lib/modes.ts` (agent modes and routing), `src/lib/tools.ts`, `src/lib/knowledge.ts` (the only facts the agent may state), `src/lib/grounding.ts`, `src/lib/risk.ts` (explainable risk score), `src/lib/docs.ts`, `src/lib/nudges.ts`, `src/lib/store.ts`.

## Run locally

```bash
npm install
cp .env.example .env.local   # then add GROQ_API_KEY (free) and/or ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. Without a key the app runs in **mock mode** (keyword rules, labelled on screen). Without Redis variables it stores data in `.data/db.json`.

## AI providers (`AI_PROVIDER`)

| Provider | Cost | Models | Notes |
|---|---|---|---|
| `groq` (default) | Free tier | `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b` | Free daily limits are low; on a 429 the app falls back to `gpt-oss-20b`, then `llama-3.3-70b-versatile` |
| `anthropic` | Paid | `claude-opus-5-5` | Same tools and rules; not used in the live demo |
| `mock` | Free | none | For building without any key |

## Try it (3 minutes)

1. Open **Ravi** as the parent and tap "ఈ డిగ్రీ నిజమైనదేనా?" (Is this degree real?): a cited Telugu answer, worry logged.
2. Tap 📎 → Class 12 → "sample: name typo": the mismatch is flagged in Telugu.
3. Click **Send automatic reminder now**: the reminder a quiet family would get.
4. Open **Counsellor**: filter "High risk", open a family, click **Prep my call**.
5. Open **Knowledge**: test a question, switch to "Company answers only", ask something unapproved and watch it get handed to a counsellor.

## Real WhatsApp (optional)

The phone in the app is a simulation so every reviewer can try it. To run the same agent on real WhatsApp, create a Meta developer app with the WhatsApp product, set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (and `WHATSAPP_APP_SECRET`), and point the webhook at `https://<host>/api/whatsapp/webhook`. Outside the 24-hour window WhatsApp allows only approved template messages, so production reminders need templates. This connector follows Meta's documented API but has not been tested end to end. An n8n webhook (`N8N_WEBHOOK_URL`) can also receive reminders for email or Telegram.

## Safety rules built in

- Facts only from the knowledge base, cited as [F1] / [C1]; exact fees, scholarships, refunds and university rules go to a counsellor.
- No pressure, no fake urgency, no criticising other options; "not joining" stops all reminders.
- Never asks for Aadhaar, bank details, passwords or OTPs. Demo documents are synthetic.
- Rate limit and daily cap on AI calls (`MAX_AI_CALLS_PER_DAY`); the cron route needs `CRON_SECRET` or Vercel's cron agent.

## Known limits

- The `/admin` page has no login, so anyone with the link can edit the demo knowledge. Production needs NIAT staff sign-in.
- Families, universities and document rules are invented; company answers are placeholders until NIAT writes the real ones.
- Real WhatsApp is not connected; the chat is a simulation.
- Replies in all six languages need a native-speaker review before launch.
- The free Groq tier can rate-limit under heavy use.
- The churn numbers in the write-up are assumptions to be tested, not NIAT data.
