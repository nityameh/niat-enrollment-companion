# NIAT Enrollment Companion (demo)

**Live demo:** https://enrollment-companion.vercel.app · **Code:** https://github.com/nityameh/niat-enrollment-companion

An AI agent that supports families **after** the NIAT one-on-one counselling, from "should we join?" to "enrolled", and tells counsellors who needs a human and why. Built for the NxtWave Jr. Growth Manager Growth Hack Challenge. All people, documents and university rules are synthetic.

## What it does

| Part | What happens | AI work |
|---|---|---|
| Companion chat (`/lead/[id]`) | Student or parent asks in English, Telugu or Hindi | Claude agent with 8 tools; answers only from cited public NIAT facts |
| Document checker | Upload a marksheet or transfer certificate photo | Claude vision extracts fields; app flags name mismatch, cut-off page, wrong document |
| Decision Brief (`/brief/[id]`) | One-page balanced summary for the family | Structured output in the family's language, with sources |
| Reminder engine | Quiet families get one helpful nudge about their exact next step; never after a "no" | Message written in the family's language |
| Counsellor dashboard (`/counsellor`) | Families sorted by churn risk, with reasons, worries and escalations | AI call brief per family |

## Pages

| Page | What it is |
|---|---|
| `/` | Overview and the demo families |
| `/lead/[id]?as=parent` | WhatsApp-style phone (chat as parent or student, send document photos with 📎) next to "Behind the scenes": journey, documents, live feed of what the AI did |
| `/counsellor` | Who needs a human today, why, and an AI "prep my call" brief |
| `/admin` | **Knowledge base: what the bot is allowed to say** |
| `/brief/[id]` | The family's Decision Brief |

## The company controls what the bot says

The bot never searches the internet. It answers only from the knowledge base at `/admin`:

- **Company-approved answers** (C1, C2...): written by NIAT's team; add, edit, disable or delete.
- **Public facts** (F1, F2...): verified facts from niatindia.com with their URLs; can be disabled one by one.
- **Answer mode:** "Company answers only" or "Company answers + public facts".

In "company answers only" mode every reply goes through a second AI check (`src/lib/grounding.ts`). If a reply contains a claim not backed by an approved answer, the family gets "your counsellor will answer this" in their language instead, and a counsellor is alerted. Set `GROUNDING_CHECK=always` to run the check in both modes.

## Real WhatsApp (optional)

The phone in the app is a simulation so every reviewer can try it. To run the same agent on real WhatsApp:

1. Create a Meta developer app with the WhatsApp product (Meta gives a free **test number** that can message up to 5 phone numbers you verify).
2. Put `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (and ideally `WHATSAPP_APP_SECRET`) in `.env.local`.
3. Expose the app publicly (deployed URL, or `ngrok http 3000` locally) and set the webhook URL to `https://<host>/api/whatsapp/webhook` with your verify token; subscribe to `messages`.
4. Message the test number from your phone: you play the parent of `WHATSAPP_DEMO_LEAD`. Text messages go to the agent; photos are checked as documents (caption "12", "10" or "TC" picks the document).

Limits: outside 24 hours of the family's last message WhatsApp allows only approved **template** messages, so production reminders need templates. This connector is written to Meta's documented API but has not been tested end to end.

## Architecture

```
Browser (family / counsellor)
  -> Next.js API routes
       -> Claude API (agent loop with tools, vision, structured outputs)
       -> JSON store (.data/ locally, /tmp on Vercel)   <- n8n schedule calls /api/nudges/run
       -> n8n webhook (optional) -> email / Telegram
```

Key files: `src/lib/agent.ts` (agent loop and rules), `src/lib/tools.ts` (tools), `src/lib/knowledge.ts` (the only facts the agent may state, with sources), `src/lib/risk.ts` (explainable risk score), `src/lib/docs.ts`, `src/lib/nudges.ts`, `src/lib/brief.ts`.

## Run locally

```bash
npm install
cp .env.example .env.local   # then add GROQ_API_KEY and/or ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. Without a key the app runs in **mock mode** (keyword rules, labelled on screen) so the flow can be explored.

## AI providers (one setting: `AI_PROVIDER`)

| Provider | Cost | Models used | Notes |
|---|---|---|---|
| `groq` | Free tier | `openai/gpt-oss-120b` (agent with tools), `qwen/qwen3.8-27b` (document photos), `openai/gpt-oss-20b` (reminders, call briefs) | Free limits are per model and low (roughly 1,000 requests and 200K tokens a day for gpt-oss-120b, per third-party reports); the agent sends only the last 14 turns to save tokens |
| `anthropic` | Paid | `claude-opus-5-5` (or `claude-haiku-5-5`) | Refusal fallback on for models that support it |
| `mock` | Free | none | Keyword rules, for building without any key |

The tools, NIAT facts, rules and risk logic are shared; only the model call changes (`src/lib/llm.ts`, `src/lib/agent.ts`). Switching provider starts each family's AI history fresh (the visible chat stays).

Regenerate the synthetic sample documents: `node scripts/make-samples.mjs`.

## Demo script (3 minutes)

1. Open **Ravi**. As the student, ask "Is this degree actually valid?" (cited answer, worry logged).
2. Switch to **parent**, ask about total cost and loans (honest "confirm in writing", escalation).
3. Click **Generate Decision Brief**.
4. Upload **Sample: Name typo** for the Class 12 marksheet (flagged), then **Sample: Correct**.
5. Click **Skip 3 days**: a reminder lands on the parent's phone.
6. Open the **Counsellor dashboard**: risk reasons, worries, AI call brief.

## n8n (optional)

1. **Schedule Trigger** (every 15 min) -> **HTTP Request** `POST {APP_URL}/api/nudges/run` with header `x-cron-secret: {CRON_SECRET}`.
2. **Webhook** (POST, path `enrollment-nudge`) -> **Send Email** or **Telegram** node using `{{$json.body.text}}`. Put the webhook URL in `N8N_WEBHOOK_URL`.

## Safety rules built in

- Facts only from `knowledge.ts`, cited as [F1]...; exact fees, scholarships, refunds and university rules go to a counsellor.
- No pressure, no fake urgency, no criticising other options; a "not joining" stops all reminders.
- Never asks for Aadhaar, bank details, passwords or OTPs. Demo uploads are synthetic.
- Rate limit and daily cap on AI calls (`MAX_AI_CALLS_PER_DAY`).
- Refusal fallback enabled (`server-side-fallback-2026-07-01`, `fallbacks: "default"`).

## Known limits

- The JSON store is for a demo. On Vercel, `/tmp` is per instance and resets, so use a single small server (or swap in Supabase) for a reliable public link.
- University configs, the scholarship payment and all families are invented.
- Telugu and Hindi output should be checked by a native speaker.
