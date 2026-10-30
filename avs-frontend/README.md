# AVS Frontend — RAG Question Bot

The AVS website ships with an AI assistant powered by Retrieval-Augmented Generation (RAG) and Google's free-tier Gemini API. Visitors click the ✨ button in the floating action stack (bottom-right, above the call and human-chat buttons) to open a chat that answers questions about Advanced Virtual Solutions — services, pricing, onboarding, security, reporting, and guarantees.

## How it works

```
Visitor question
      │
      ▼
POST /api/chat  (app/api/chat/route.ts)
      │
      ├─► BM25 retrieval over the knowledge base   (lib/rag/retrieval.ts)
      │        lib/rag/knowledge-base.ts — ~35 curated chunks of AVS facts
      │        Top 5 chunks + company overview become the CONTEXT block
      │
      ├─► Gemini generateContent (free tier)
      │        Strict system prompt: answer ONLY from context,
      │        never invent prices (only £4.50/hr), admit unknowns
      │        and point to the free consultation / contact details
      │
      └─► Fallback: if GEMINI_API_KEY is missing or Gemini fails,
               the top-scored knowledge chunk is returned verbatim,
               so the widget keeps working offline
```

- **Retrieval is lexical (BM25), not embedding-based** — no extra API calls at query time, deterministic, and free. Chunks carry curated `keywords` that boost them for common client phrasings (cost, cancel, NDA, time zone, replace…).
- **The question angles** in the knowledge base follow what VA-seeking clients ask most often — benchmarked against goldieva.com's customer-facing FAQ topics (hourly pricing, minimum contracts, hidden fees, matching speed, time zones, NDAs, replacements, work tracking, tools, part-time vs full-time).
- **Rate limiting**: 15 messages per 5 minutes per IP (in-memory) protects the free quota.
- **Conversation history** (last 8 turns) is passed to Gemini so follow-up questions work.
- **Scope guardrail (no legal services)**: AVS is not a law firm and has no legal professionals on staff or on standby. `lib/rag/boundaries.ts` detects legal requests, `lib/rag/knowledge-base.ts` carries the policy chunks (`legal-scope-policy`, `legal-adjacent-support`, `legal-referral`), and `lib/rag/retrieval.ts` pins those chunks into the prompt for legal questions while keeping them out of every other answer. Clear legal requests get the curated `legalServiceReply` verbatim instead of a model answer, so the boundary can never be softened into a "maybe"; law-firm admin questions are answered from the policy chunks (and from `lawFirmAdminReply` if the model is unavailable). Keep those replies in sync with the site FAQ when policy changes.

## Setup

1. Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey) (free tier, no card required).
2. Add it to `avs-frontend/.env.local` (copy from `.env.example`):

   ```
   GEMINI_API_KEY=your-key-here
   GEMINI_MODEL=gemini-2.5-flash   # optional, this is the default
   ```

3. `npm run dev` and click the ✨ floating button.

Without a key the widget still works — answers come straight from the knowledge base chunks.

## API contract

`POST /api/chat`

```jsonc
// Request
{ "message": "How much does a VA cost?", "history": [{ "role": "user" | "assistant", "content": "..." }] }

// Response
{
  "reply": "AVS charges one flexible hourly rate of £4.50 per hour…",
  "sources": [{ "title": "Pricing and hourly rates", "category": "Pricing" }],
  "fallback": false,     // true when Gemini was unavailable
  "deterministic": true  // present on curated scope answers (e.g. legal requests)
}
```

Errors: `400` invalid/missing message, `429` rate-limited, `500` unexpected.

## Extending the knowledge base

Edit `lib/rag/knowledge-base.ts`. Each chunk is `{ id, title, category, keywords?, text }` — keep chunks focused on one topic (retrieval scores per-chunk), add `keywords` for the phrasings clients actually use, and only state facts that are true of AVS (the system prompt forbids the model from going beyond the context). Restart the dev server after editing (the index is built at module load).
