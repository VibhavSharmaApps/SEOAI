import type { AIProvider } from "../types";
import {
  H1_SYSTEM,
  buildH1User,
  buildRetryUser,
  type PageInput,
} from "./prompts";
import { cleanModelOutput, isInRange } from "./post-process";

// H1 length target. 20 chars min keeps headlines descriptive (not "Home"),
// 70 chars max keeps them scannable. There's no strict SEO max for H1s the
// way there is for meta titles, but anything past ~70 chars reads as a sentence.
const TARGET_MIN = 20;
const TARGET_MAX = 70;

export interface H1Result {
  text: string;
  inRange: boolean;
  provider: string;
  model: string;
}

/**
 * Generate an SEO-optimized H1 for the given page using the provided AI provider.
 * Retries once with a corrective prompt if the first response is outside the
 * 20-70 character target — same pattern as `generateMetaTitleWithAI`.
 */
export async function generateH1WithAI(
  provider: AIProvider,
  page: PageInput
): Promise<H1Result> {
  const user = buildH1User(page);

  const first = await provider.complete({
    system: H1_SYSTEM,
    user,
    maxTokens: 80,
    temperature: 0.5,
  });

  let text = cleanModelOutput(first.text);

  if (!isInRange(text, TARGET_MIN, TARGET_MAX)) {
    const retry = await provider.complete({
      system: H1_SYSTEM,
      user: buildRetryUser(user, text, TARGET_MIN, TARGET_MAX),
      maxTokens: 80,
      temperature: 0.3,
    });
    text = cleanModelOutput(retry.text);
  }

  return {
    text,
    inRange: isInRange(text, TARGET_MIN, TARGET_MAX),
    provider: first.provider,
    model: first.model,
  };
}
