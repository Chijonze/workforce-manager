import { NextResponse } from "next/server";
import { buildContext, retrieve } from "@/lib/rag/retrieval";
import { buildSystemPrompt } from "@/lib/rag/prompt";
import {
  classifyLegalInquiry,
  lawFirmAdminReply,
  legalAnswerSources,
  legalChunkIds,
  legalServiceReply,
} from "@/lib/rag/boundaries";

export const runtime = "nodejs";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_TURNS = 8;
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// Simple in-memory rate limiter to protect the free Gemini tier.
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

interface GeminiPart {
  text: string;
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  error?: { message?: string };
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  history: ChatTurn[],
  message: string
): Promise<string> {
  const contents = [
    ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const res = await fetch(`${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 700,
      },
    }),
  });

  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    const detail = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Gemini API error: ${detail}`);
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

/** Deterministic answer from the top knowledge chunk when Gemini is unavailable. */
function fallbackReply(message: string): { reply: string; sources: { title: string; category: string }[] } {
  // Legal questions always get the curated scope answer, never a generic chunk.
  const legalInquiry = classifyLegalInquiry(message);
  if (legalInquiry === "legal-service") {
    return { reply: legalServiceReply, sources: legalAnswerSources };
  }
  if (legalInquiry === "legal-adjacent") {
    return { reply: lawFirmAdminReply, sources: legalAnswerSources };
  }

  // Prefer a normal answer chunk over the legal policy: "do you support law
  // firms?" should return the industries answer, not the scope disclaimer.
  const legalIds = new Set<string>(legalChunkIds);
  const results = retrieve(message, 5);
  const best = results.find((r) => !legalIds.has(r.chunk.id));

  if (!best) {
    return {
      reply:
        "AVS provides dedicated virtual assistants for founders, agencies, coaches, and growing teams, with flexible hourly billing at £4.50 per hour.\n\nFor anything more specific, book a free consultation at advancedvirtualsolutions.com/contact or email admin@advancedvirtualsolutions.com.",
      sources: [],
    };
  }

  return {
    reply: `${best.chunk.text}\n\nFor anything more specific, book a free consultation at advancedvirtualsolutions.com/contact or email admin@advancedvirtualsolutions.com.`,
    sources: [{ title: best.chunk.title, category: best.chunk.category }],
  };
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many messages — please wait a moment and try again." },
      { status: 429 }
    );
  }

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters).` },
      { status: 400 }
    );
  }

  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is ChatTurn =>
            typeof t === "object" &&
            t !== null &&
            (t as ChatTurn).role !== undefined &&
            ((t as ChatTurn).role === "user" || (t as ChatTurn).role === "assistant") &&
            typeof (t as ChatTurn).content === "string"
        )
        .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_LENGTH) }))
        .slice(-MAX_HISTORY_TURNS)
    : [];

  // Requests for legal advice, legal work, or a lawyer are answered from the
  // curated scope answer instead of the model: the "no" must be identical every
  // time, and must never be negotiated into a maybe.
  if (classifyLegalInquiry(message) === "legal-service") {
    return NextResponse.json({
      reply: legalServiceReply,
      sources: legalAnswerSources,
      fallback: false,
      deterministic: true,
    });
  }

  const { context, sources } = buildContext(message, 5);
  const systemPrompt = buildSystemPrompt(context);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[rag-chat] GEMINI_API_KEY not set — serving knowledge-base fallback.");
    const { reply, sources } = fallbackReply(message);
    return NextResponse.json({ reply, sources, fallback: true });
  }

  try {
    const reply = await callGemini(apiKey, systemPrompt, history, message);
    return NextResponse.json({ reply, sources, fallback: false });
  } catch (err) {
    console.error("[rag-chat] Gemini call failed:", err instanceof Error ? err.message : err);
    const { reply, sources } = fallbackReply(message);
    return NextResponse.json({ reply, sources, fallback: true });
  }
}
