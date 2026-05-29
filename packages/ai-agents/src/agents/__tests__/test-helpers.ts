import type {
  AIProvider,
  AICompletionOptions,
  AICompletionResult,
} from "../../types";
import type { PageInput } from "../prompts";

/**
 * Build a mock AIProvider that returns a queued list of responses in order.
 * Each call to complete() consumes the next response. If the queue is
 * exhausted, an empty string is returned.
 *
 * Tests use this to drive the agent's call → check length → maybe retry →
 * return loop without making real API calls. The helper also exposes
 * `callCount` and `receivedOptions` so tests can assert that the agent made
 * the expected number of calls and that the retry prompt was correctly
 * formed.
 *
 * NOTE: This file is intentionally NOT named *.test.ts so vitest doesn't try
 * to collect it as a test file — it's a shared test utility.
 */
export function mockProvider(responses: string[]): {
  provider: AIProvider;
  callCount: () => number;
  receivedOptions: () => AICompletionOptions[];
} {
  let i = 0;
  const received: AICompletionOptions[] = [];

  const provider: AIProvider = {
    name: "anthropic",
    async complete(opts: AICompletionOptions): Promise<AICompletionResult> {
      received.push(opts);
      const text = responses[i++] ?? "";
      return {
        text,
        provider: "anthropic",
        model: "mock-model",
      };
    },
  };

  return {
    provider,
    callCount: () => i,
    receivedOptions: () => received,
  };
}

/**
 * Default PageInput used across agent tests. Realistic-shaped data so each
 * agent's prompt-building functions see sensible inputs, but the actual
 * content doesn't drive any test assertions — tests assert on the agent's
 * control flow, not the prompt body.
 */
export const SAMPLE_PAGE: PageInput = {
  title: "How to Brew the Perfect Cup of Cold Brew Coffee",
  url: "https://example.com/cold-brew-guide",
  contentPreview:
    "Cold brew is a smooth, low-acid coffee brewed by steeping coarse grounds in cold water for 12-24 hours.",
  focusKeyword: "cold brew coffee guide",
};
