import type { AIProvider } from "../types";
import {
  FOCUS_KEYWORD_SYSTEM,
  buildFocusKeywordUser,
  buildRetryUser,
  type PageInput,
} from "./prompts";
import { cleanModelOutput, isInRange } from "./post-process";

// Focus keyword length target. 3 chars handles legitimate short keywords like
// "seo" or "cms"; 50 chars is generous for long-tail phrases ("best cold brew
// coffee beans for beginners" = 44 chars). Word count isn't validated in code —
// the prompt asks for 2-5 words and we trust the model.
const TARGET_MIN = 3;
const TARGET_MAX = 50;

export interface FocusKeywordResult {
  text: string;
  inRange: boolean;
  provider: string;
  model: string;
}

/**
 * Generate an SEO focus keyword for the given page using the provided AI provider.
 *
 * A focus keyword is the single primary search query the page targets — it
 * feeds into downstream agents (meta title, meta description, H1) as the
 * `focusKeyword` field on PageInput, so quality here compounds.
 *
 * Retries once with a corrective prompt if the first response is outside the
 * 3-50 character target. Always lowercases the final output as a safety net
 * in case the model ignores the lowercase instruction.
 */
export async function generateFocusKeywordWithAI(
  provider: AIProvider,
  page: PageInput
): Promise<FocusKeywordResult> {
  const user = buildFocusKeywordUser(page);

  const first = await provider.complete({
    system: FOCUS_KEYWORD_SYSTEM,
    user,
    maxTokens: 40,
    temperature: 0.4,
  });

  let text = cleanModelOutput(first.text);

  if (!isInRange(text, TARGET_MIN, TARGET_MAX)) {
    const retry = await provider.complete({
      system: FOCUS_KEYWORD_SYSTEM,
      user: buildRetryUser(user, text, TARGET_MIN, TARGET_MAX),
      maxTokens: 40,
      temperature: 0.2,
    });
    text = cleanModelOutput(retry.text);
  }

  // Belt-and-suspenders: focus keywords are conventionally lowercase. The
  // system prompt asks for it but we normalize here too so callers never have
  // to think about case when comparing or storing the value.
  text = text.toLowerCase();

  return {
    text,
    inRange: isInRange(text, TARGET_MIN, TARGET_MAX),
    provider: first.provider,
    model: first.model,
  };
}
