import type { AIProvider } from "../types";
import {
  FAQ_CONTENT_SYSTEM,
  buildFAQContentUser,
  buildFAQRetryUser,
  type PageInput,
} from "./prompts";

// FAQPage JSON-LD typically contains 3-5 question-answer pairs. Fewer
// than 3 doesn't read as a real FAQ; more than 5 dilutes the SERP/AI
// citation effect and bloats payload.
const MIN_FAQS = 3;
const MAX_FAQS = 5;

export interface FAQPair {
  question: string;
  answer: string;
}

export interface FAQContentResult {
  faqs: FAQPair[];
  // Count of items that passed validation (length === faqs.length, but
  // exposed separately so callers can tell "we successfully generated N"
  // from "the array was trimmed to a cap" once cap logic exists).
  count: number;
  inRange: boolean;
  provider: string;
  model: string;
}

/**
 * Strip markdown code fences and surrounding whitespace from a model
 * response. Some models reflexively wrap JSON output in ```json ... ```
 * even when the prompt explicitly tells them not to. We tolerate this
 * here rather than spending a retry on it.
 */
function stripCodeFence(raw: string): string {
  let text = raw.trim();
  // Match opening fence: ``` or ```json or ```JSON, optionally followed
  // by a newline.
  text = text.replace(/^```(?:json)?\s*\n?/i, "");
  // Match closing fence at end of string.
  text = text.replace(/\n?\s*```\s*$/i, "");
  return text.trim();
}

/**
 * Parse a model response into a list of valid FAQ pairs. Returns an empty
 * array on any parse error (rather than throwing) so the agent loop can
 * decide whether to retry. Silently drops malformed entries inside an
 * otherwise-valid array — better to surface a shorter list than reject the
 * whole batch.
 */
function parseFAQs(raw: string): FAQPair[] {
  const cleaned = stripCodeFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const valid: FAQPair[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as FAQPair).question === "string" &&
      typeof (item as FAQPair).answer === "string"
    ) {
      const question = (item as FAQPair).question.trim();
      const answer = (item as FAQPair).answer.trim();
      if (question.length > 0 && answer.length > 0) {
        valid.push({ question, answer });
      }
    }
  }
  return valid;
}

/**
 * Generate FAQ content (3-5 question/answer pairs) for the given page using
 * the provided AI provider.
 *
 * Differs from the other length-bound agents in two ways:
 *   1. Output is structured (FAQPair[]) not a single string.
 *   2. Retry triggers on COUNT being out of [3, 5], not character length.
 *
 * If the first response parses cleanly into 3-5 valid pairs, we return it.
 * Otherwise we retry once with a corrective prompt. Anything more than 5
 * pairs is trimmed to 5 (we don't bother retrying — the extras are usually
 * fine, just unnecessary). Anything less than 3 after retry is surfaced
 * with inRange=false so callers can decide what to do.
 */
export async function generateFAQContentWithAI(
  provider: AIProvider,
  page: PageInput
): Promise<FAQContentResult> {
  const user = buildFAQContentUser(page);

  const first = await provider.complete({
    system: FAQ_CONTENT_SYSTEM,
    user,
    // FAQ payload is bigger than a single meta title. 1200 tokens covers
    // 5 thorough Q&A pairs without truncation.
    maxTokens: 1200,
    temperature: 0.5,
  });

  let faqs = parseFAQs(first.text);

  // Retry only if too few or zero pairs. Too many is fine — we just trim
  // below. This keeps the API call cost down.
  if (faqs.length < MIN_FAQS) {
    const retry = await provider.complete({
      system: FAQ_CONTENT_SYSTEM,
      user: buildFAQRetryUser(user, faqs.length, MIN_FAQS, MAX_FAQS),
      maxTokens: 1200,
      temperature: 0.3,
    });
    faqs = parseFAQs(retry.text);
  }

  // Trim to MAX_FAQS regardless of how many came back. Models sometimes
  // return 6-10 even when told 3-5.
  if (faqs.length > MAX_FAQS) {
    faqs = faqs.slice(0, MAX_FAQS);
  }

  return {
    faqs,
    count: faqs.length,
    inRange: faqs.length >= MIN_FAQS && faqs.length <= MAX_FAQS,
    provider: first.provider,
    model: first.model,
  };
}
