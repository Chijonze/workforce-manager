import { knowledgeBase, type KnowledgeChunk } from "./knowledge-base";
import { hasLegalSignal, legalChunkIds } from "./boundaries";

/**
 * Lightweight BM25 retrieval over the AVS knowledge base.
 * Runs fully offline so the chat widget keeps working even when
 * the Gemini key is missing or the API is unreachable.
 */

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","but","by","can","do","does","for","from",
  "had","has","have","how","i","if","in","is","it","its","me","my","of","on",
  "or","our","so","tell","that","the","their","them","they","this","to","up",
  "us","want","was","we","what","when","where","which","who","why","will","with",
  "would","you","your","yours","about","get","got","there","am",
]);

/** Query terms that should also search for these synonyms. */
const SYNONYMS: Record<string, string[]> = {
  cost: ["price", "pricing", "rate", "fees"],
  price: ["cost", "rate", "pricing"],
  pricing: ["cost", "rate", "price"],
  rate: ["cost", "price", "pricing"],
  cheap: ["affordable", "cost", "price"],
  hire: ["start", "onboarding", "match"],
  hiring: ["start", "onboarding", "match"],
  fast: ["quickly", "speed", "quick"],
  quickly: ["fast", "speed", "quick"],
  quick: ["fast", "quickly"],
  safe: ["security", "secure", "confidential"],
  safety: ["security", "secure", "confidential"],
  security: ["secure", "confidential", "nda"],
  nda: ["confidential", "confidentiality"],
  tools: ["software", "stack", "apps"],
  software: ["tools", "stack", "apps"],
  timezone: ["time", "zone", "hours", "coverage"],
  cancel: ["pause", "contract", "commitment"],
  cancelation: ["pause", "contract", "commitment"],
  cancellation: ["pause", "contract", "commitment"],
  fire: ["replacement", "replace", "switch"],
  replace: ["replacement", "switch"],
  va: ["assistant", "virtual"],
  vas: ["assistants", "virtual"],
  assistant: ["va", "virtual"],
  assistants: ["vas", "virtual"],
  report: ["reporting", "tracking"],
  reports: ["reporting", "tracking"],
  track: ["tracking", "reporting"],
  guarantee: ["guaranteed", "promise"],
  interview: ["meet", "matching", "choose"],
  team: ["multiple", "several"],
  communicate: ["communication", "contact", "channels"],
  human: ["contact", "speak", "talk"],
  // Legal enquiries — route to the scope-of-service chunks so the assistant
  // never treats legal work as one of AVS's services. ("legal" deliberately
  // does not expand to "law", which otherwise matches unrelated phrases such
  // as "law firms" in the industries chunk.)
  legal: ["lawyer", "attorney", "solicitor", "paralegal"],
  law: ["legal", "lawyer", "attorney", "solicitor"],
  lawyer: ["attorney", "solicitor", "legal", "paralegal"],
  attorney: ["lawyer", "solicitor", "legal"],
  solicitor: ["lawyer", "attorney", "legal"],
  barrister: ["lawyer", "attorney", "legal"],
  paralegal: ["legal", "lawyer", "attorney"],
  litigation: ["legal", "lawyer", "lawsuit"],
  lawsuit: ["litigation", "legal", "lawyer"],
  sue: ["litigation", "legal", "lawyer"],
  court: ["legal", "litigation"],
};

function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9£\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

function expandQuery(terms: string[]): string[] {
  const expanded = [...terms];
  for (const term of terms) {
    for (const syn of SYNONYMS[term] ?? []) {
      for (const t of tokenize(syn)) {
        if (!expanded.includes(t)) expanded.push(t);
      }
    }
  }
  return expanded;
}

interface IndexedChunk {
  chunk: KnowledgeChunk;
  tokens: string[];
  termFreq: Map<string, number>;
  length: number;
}

// BM25 parameters
const K1 = 1.4;
const B = 0.75;
const KEYWORD_BOOST = 2.5;

const index: IndexedChunk[] = knowledgeBase.map((chunk) => {
  const tokens = [
    ...tokenize(`${chunk.title} ${chunk.text}`),
    ...tokenize(chunk.keywords?.join(" ") ?? ""),
  ];
  const termFreq = new Map<string, number>();
  for (const t of tokens) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
  return { chunk, tokens, termFreq, length: tokens.length };
});

const avgLength = index.reduce((sum, c) => sum + c.length, 0) / index.length;

function idf(term: string): number {
  const docFreq = index.filter((c) => c.termFreq.has(term)).length;
  return Math.log(1 + (index.length - docFreq + 0.5) / (docFreq + 0.5));
}

export interface RetrievalResult {
  chunk: KnowledgeChunk;
  score: number;
}

export function retrieve(query: string, topK = 5): RetrievalResult[] {
  // The legal-scope chunks are only served to legal questions; otherwise a
  // stray match ("which jurisdictions do you cover?") drags a legal disclaimer
  // into an unrelated answer.
  const legalQuery = hasLegalSignal(query);
  const legalIds = new Set<string>(legalChunkIds);
  const serve = (entry: IndexedChunk) => legalQuery || !legalIds.has(entry.chunk.id);

  const queryTerms = expandQuery(tokenize(query));
  if (queryTerms.length === 0) {
    return index
      .filter(serve)
      .slice(0, topK)
      .map((c) => ({ chunk: c.chunk, score: 0 }));
  }

  const results: RetrievalResult[] = index.map((entry) => {
    let score = 0;
    for (const term of queryTerms) {
      const tf = entry.termFreq.get(term) ?? 0;
      if (tf === 0) continue;
      score +=
        idf(term) *
        (tf * (K1 + 1)) /
        (tf + K1 * (1 - B + B * (entry.length / avgLength)));
    }
    // Boost chunks whose curated keywords appear in the raw query
    const rawQuery = query.toLowerCase();
    for (const keyword of entry.chunk.keywords ?? []) {
      if (rawQuery.includes(keyword)) score += KEYWORD_BOOST;
    }
    if (!serve(entry)) score = 0;
    return { chunk: entry.chunk, score };
  });

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Context block for the LLM prompt, with the company overview always grounded. */
export function buildContext(query: string, topK = 5): { context: string; sources: { title: string; category: string }[] } {
  const results = retrieve(query, topK);
  const seen = new Set<string>();
  const selected: RetrievalResult[] = [];

  const overview = index.find((c) => c.chunk.id === "company-overview");
  if (overview) {
    selected.push({ chunk: overview.chunk, score: 0 });
    seen.add(overview.chunk.id);
  }

  // Any mention of law, lawyers, or legal work must be answered against the
  // scope boundary, not against whatever chunk happens to score highest.
  if (hasLegalSignal(query)) {
    for (const id of legalChunkIds) {
      const pinned = index.find((c) => c.chunk.id === id);
      if (pinned && !seen.has(pinned.chunk.id)) {
        selected.push({ chunk: pinned.chunk, score: 0 });
        seen.add(pinned.chunk.id);
      }
    }
  }

  for (const r of results) {
    if (!seen.has(r.chunk.id)) {
      selected.push(r);
      seen.add(r.chunk.id);
    }
  }

  const context = selected
    .map((r, i) => `[${i + 1}] ${r.chunk.title}\n${r.chunk.text}`)
    .join("\n\n");

  return {
    context,
    sources: selected.map((r) => ({ title: r.chunk.title, category: r.chunk.category })),
  };
}
