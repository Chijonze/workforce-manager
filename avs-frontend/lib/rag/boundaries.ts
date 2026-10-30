/**
 * Scope boundaries for the AVS website assistant.
 *
 * AVS provides business operations support only. It is not a law firm, it does
 * not offer legal services or legal advice, and it has no lawyers, solicitors,
 * attorneys, barristers, or paralegals on staff, on standby, or available to
 * clients. This module holds everything needed to keep that boundary intact:
 *
 * - `classifyLegalInquiry` — intent detection used by `/api/chat` to answer
 *   clear legal requests deterministically, so a model can never drift into
 *   promising legal help.
 * - `legalServiceReply` / `lawFirmAdminReply` — curated, brand-safe answers
 *   used verbatim for legal requests and by the offline fallback.
 * - `hasLegalSignal` — a wider net that pins the policy chunks into the RAG
 *   context even when a question is only tangentially legal.
 *
 * Keep the regexes below boring and explicit: false positives here cost a
 * slightly over-cautious answer, while false negatives risk an invented
 * promise of legal help.
 */

import { knowledgeBase, type KnowledgeChunk } from "./knowledge-base";

export type LegalInquiryKind = "legal-service" | "legal-adjacent" | null;

/**
 * Every knowledge-base chunk that states the legal-scope policy. They are
 * pinned into the prompt for legal questions and kept out of retrieval for
 * everything else, so a question about geography ("which jurisdictions do you
 * cover?") never picks up a legal disclaimer.
 */
export const legalChunkIds = ["legal-scope-policy", "legal-adjacent-support", "legal-referral"] as const;

/** A legal professional — or an offer to act as one. */
const LEGAL_PROFESSIONAL =
  /\b(lawyers?|attorneys?(?:\s+at\s+law)?|solicitors?|barristers?|paralegals?|legal\s+counsel|in[- ]?house\s+counsel|legal\s+(?:professionals?|experts?|representatives?|advis[eo]rs?))\b/i;

/** Named legal services, matters, and forums. */
const LEGAL_MATTER =
  /\b(legal\s+(?:advice|advise|opinion|services?|support|help|assistance|representation|proceedings?|documents?|drafting|review|research|work)|law\s+practice|law\s+degree|legal\s+firms?|litigation|lawsuits?|suing|sue\b|in\s+court|go\s+to\s+court|represent\w*\s+(?:me|us|our\s+(?:company|business)|a\s+client)|enforceable|cease[- ]and[- ]desist|demand\s+letter|settlement\s+agreement|injunction|summons|subpoena|affidavit|witness\s+statements?|arbitration|mediation|power\s+of\s+attorney|conveyancing|probate|notaris\w+|notary|trademark|patent\s+(?:application|registration|filing)|immigration\s+(?:advice|case|lawyer|solicitor)|divorce|employment\s+tribunal|tribunal\s+(?:claim|case|hearing)|(?:admitted|called)\s+to\s+the\s+bar|court\s+(?:case|claim|hearing|order|filing))\b/i;

/** A bare "legal" only counts when it is paired with one of these. */
const LEGAL_WORD = /\blegal(?:ly)?\b/i;
const LEGAL_CONTEXT =
  /\b(advice|advis\w*|services?|support|help|assistance|assist\w*|consult\w*|represent\w*|review|opinion|documents?|draft\w*|matter|case|cases|team|professionals?|experts?|expertise|contracts?|agreements?|terms|clauses?|polic(?:y|ies)|compliance|regulat\w*|binding|enforce\w*|disputes?|rights|obligations?|liabilit\w*|claims?|research|protection|custody|visa)\b/i;

/** Drafting or negotiating paperwork is legal drafting, not admin support. */
const CONTRACT_TARGET =
  /\b(contracts?|agreements?|t&cs?|terms\s+and\s+conditions|ndas?|non[- ]disclosure\s+agreements?|leases?|tenancy\s+agreements?|licen[cs]e\s+agreements?|clauses?)\b/i;
const CONTRACT_ACTION =
  /\b(draft\w*|redlin\w*|negotiat\w*|enforce\w*|breach\w*|litigat\w*|legally\s+binding|validity)\b/i;

/** "Can you look over this NDA for me?" — a request for legal review. */
const PAPERWORK_REVIEW =
  /\b(look(?:ing)?\s+(?:over|at)|check(?:ing)?\s+(?:over|through)|go(?:ing)?\s+over|review\w*|advise\w*)\b[\s\S]{0,30}\b(?:ndas?|non[- ]disclosure|leases?|tenancy\s+agreements?|clauses?)\b|\b(review\w*|look(?:ing)?\s+over|check(?:ing)?\s+over)\b[\s\S]{0,20}\b(?:my|our)\s+contracts?\b/i;

/** "Can your assistant review my contract?" — asked of AVS directly. */
const CONTRACT_REVIEW_ASK =
  /\b(can|could|would|will)\s+(you|your\s+(?:team|va|assistant|assistants))\b[\s\S]{0,60}\b(review|look\s+over|check|advise\s+on|give\s+(?:me\s+)?(?:advice|an\s+opinion)\s+on)\b[\s\S]{0,40}\b(contracts?|agreements?|ndas?|non[- ]disclosure|leases?|clauses?|terms)\b/i;

/** "Yes we support law firms" — admin/ops work around a legal practice. */
const LAW_ORGANISATION =
  /\b(law\s+firms?|legal\s+(?:team|department|practice|firm)|solicitors?'?\s+(?:office|firm)|chambers|in[- ]?house\s+legal)\b/i;
const LEGAL_AUDIENCE =
  /\b(?:for|with|to|at|across)\s+(?:a|an|the|our|my|their|your)?\s*(?:solicitors?|lawyers?|attorneys?|barristers?|paralegals?|legal\s+teams?|legal\s+departments?|law\s+firms?|in[- ]?house\s+legal)\b|\b(?:our|my)\s+(?:solicitors?|lawyers?|attorneys?|legal\s+teams?|legal\s+department|law\s+firm)\b/i;
const ADMIN_WORK =
  /\b(admin\w*|operations?|intake|onboarding|schedul\w*|diary|emails?|inbox|calendar|billing|timekeeping|time\s+recording|transcri\w*|typesetting|typ(?:e|ing)|format\w*|proofread\w*|bundl\w*|exhibits?|document\s+management|dms|crm|delegat\w*|back[- ]office|data\s+entry|reception|secretarial)\b/i;

/** Asking for advice, drafting, or representation is never admin work. */
const LEGAL_ADVICE_VERB =
  /\b(advice|advise|opinion|represent\w*|enforce\w*|draft\w*|redlin\w*|litigat\w*|sue\b|suing)\b/i;

/**
 * Company-information phrasings that happen to use the word "legal" ("legal
 * name", "legal entity"). They only opt out when no strong legal signal is
 * present, so "Do you offer legal services for a new legal entity?" still
 * counts as a legal request.
 */
const NON_LEGAL_PHRASE =
  /\b(legal\s+(?:name|entity|structure|form|status|company\s+name|business\s+name)|legally\s+(?:registered|incorporated)|legit\b)/i;

function normalise(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

/** Signals specific enough to treat the message as a legal request on their own. */
function hasStrongLegalSignal(text: string): boolean {
  return (
    LEGAL_PROFESSIONAL.test(text) ||
    LEGAL_MATTER.test(text) ||
    CONTRACT_REVIEW_ASK.test(text) ||
    PAPERWORK_REVIEW.test(text) ||
    (CONTRACT_TARGET.test(text) && CONTRACT_ACTION.test(text))
  );
}

/**
 * Classifies what a visitor is actually asking for:
 *
 * - `legal-service` — they want legal advice, legal work, or a lawyer. Answer
 *   deterministically with `legalServiceReply`.
 * - `legal-adjacent` — a law firm / legal team asking about admin support.
 *   Answer with `lawFirmAdminReply` (or let the model phrase it from the pinned
 *   context, which carries the same boundary).
 * - `null` — no legal intent.
 */
export function classifyLegalInquiry(message: string): LegalInquiryKind {
  const text = normalise(message);
  if (!text) return null;

  const strong = hasStrongLegalSignal(text);
  if (!strong && NON_LEGAL_PHRASE.test(text)) return null;

  // Admin support for a legal practice is allowed — say yes to the admin, no to
  // the law. A request for advice, drafting, or representation falls through.
  const legalPractice = LAW_ORGANISATION.test(text) || LEGAL_AUDIENCE.test(text);
  if (legalPractice && ADMIN_WORK.test(text) && !LEGAL_ADVICE_VERB.test(text)) {
    return "legal-adjacent";
  }

  if (strong) return "legal-service";
  if (LEGAL_WORD.test(text) && LEGAL_CONTEXT.test(text)) return "legal-service";

  return null;
}

/**
 * Wider than `classifyLegalInquiry`: any mention of law, lawyers, legal work, or
 * paperwork review. Used to pin the policy chunks into the RAG context so even a
 * vague question gets a grounded, consistent answer.
 */
export function hasLegalSignal(message: string): boolean {
  const text = normalise(message);
  if (!text) return false;

  const strong = hasStrongLegalSignal(text);
  if (!strong && NON_LEGAL_PHRASE.test(text)) return false;

  return (
    strong ||
    LAW_ORGANISATION.test(text) ||
    LEGAL_AUDIENCE.test(text) ||
    (LEGAL_WORD.test(text) && LEGAL_CONTEXT.test(text))
  );
}

/**
 * Curated answer for requests that seek legal advice, legal work, or a lawyer.
 * Written to be clear, warm, and useful: an honest no, the reason, where to go
 * instead, and what AVS can still do.
 */
export const legalServiceReply = `Thanks for asking — worth being completely straight with you.

AVS is not a law firm, and we don't provide legal services or legal advice. That means no legal opinions, contract review or drafting, legal research, representation, or attorney work of any kind — and we don't have lawyers, solicitors, attorneys, barristers, or paralegals on staff or on standby. Law and attorney services sit firmly outside our expertise.

If you need legal advice, please speak to a qualified lawyer licensed in the relevant jurisdiction (in England & Wales, a solicitor or barrister regulated by the SRA or Bar Standards Board). We're not able to recommend or refer firms.

Where we can help is the admin around a legal matter — inbox and diary management, client intake, document formatting, bundle assembly and transcription, filing, scheduling, and reporting — always working to your own legal adviser's instructions, with them signing off the substance.

Would you like to scope that side on a free consultation?`;

/**
 * Curated answer for law firms and legal teams that ask about operational
 * support. Leads with the yes, keeps the boundary explicit.
 */
export const lawFirmAdminReply = `Happy to help with that — with one clear boundary: we support the administrative and operations side of a law firm or legal team, not the legal work itself.

What our assistants handle: inbox and diary management, client intake and onboarding data entry, document formatting and typesetting, bundle and exhibit assembly from documents you supply, transcription of dictation and meetings, filing into your document management system, time-recording and billing support, CRM hygiene, and scheduling the deadlines you set.

What they don't do: give legal advice, interpret the law, draft or review documents for legal risk, or sign anything off. Every task runs under the direction and supervision of your own qualified legal professional, and communications with AVS aren't covered by legal professional privilege.

Want to talk through a scope on a free consultation?`;

/** Knowledge-base chunk that backs `legalServiceReply` and `lawFirmAdminReply`. */
function sourceFor(id: string): { title: string; category: string } | null {
  const chunk: KnowledgeChunk | undefined = knowledgeBase.find((entry) => entry.id === id);
  return chunk ? { title: chunk.title, category: chunk.category } : null;
}

/** Source shown under the deterministic legal reply in the chat widget. */
export const legalAnswerSources: { title: string; category: string }[] = (() => {
  const source = sourceFor(legalChunkIds[0]);
  return source ? [source] : [];
})();
