import type { AIProvider } from "../types";
import {
  SCHEMA_DESCRIPTION_SYSTEM,
  buildSchemaDescriptionUser,
  buildRetryUser,
  type PageInput,
} from "./prompts";
import { cleanModelOutput, isInRange } from "./post-process";

// Schema description length target. The range is wider than meta description
// (150-160) because JSON-LD has no hard SERP truncation — knowledge graphs and
// AI engines can ingest more context. 100 chars is the minimum for it to read
// as a real summary; 250 is generous enough to cover multi-faceted pages
// without becoming an article.
const TARGET_MIN = 100;
const TARGET_MAX = 250;

export interface SchemaDescriptionResult {
  text: string;
  inRange: boolean;
  provider: string;
  model: string;
}

/**
 * Generate a schema.org `description` field for the given page using the
 * provided AI provider.
 *
 * This is intentionally different from the meta description: schema descriptions
 * are consumed by machines (search engine knowledge graphs, AI chatbots parsing
 * structured data) rather than humans clicking SERP results, so the prompt asks
 * for factual / CTA-free copy rather than marketing-tuned language.
 *
 * Retries once with a corrective prompt if the first response is outside the
 * 100-250 character target.
 */
export async function generateSchemaDescriptionWithAI(
  provider: AIProvider,
  page: PageInput
): Promise<SchemaDescriptionResult> {
  const user = buildSchemaDescriptionUser(page);

  const first = await provider.complete({
    system: SCHEMA_DESCRIPTION_SYSTEM,
    user,
    maxTokens: 300,
    temperature: 0.4,
  });

  let text = cleanModelOutput(first.text);

  if (!isInRange(text, TARGET_MIN, TARGET_MAX)) {
    const retry = await provider.complete({
      system: SCHEMA_DESCRIPTION_SYSTEM,
      user: buildRetryUser(user, text, TARGET_MIN, TARGET_MAX),
      maxTokens: 300,
      temperature: 0.2,
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
