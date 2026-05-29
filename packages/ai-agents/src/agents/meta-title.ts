import type { AIProvider } from "../types";
import {
  META_TITLE_SYSTEM,
  buildMetaTitleUser,
  buildRetryUser,
  type PageInput,
} from "./prompts";
import { cleanModelOutput, isInRange } from "./post-process";

const TARGET_MIN = 50;
const TARGET_MAX = 60;

export interface MetaTitleResult {
  text: string;
  inRange: boolean;
  provider: string;
  model: string;
}

export async function generateMetaTitleWithAI(
  provider: AIProvider,
  page: PageInput
): Promise<MetaTitleResult> {
  const user = buildMetaTitleUser(page);

  const first = await provider.complete({
    system: META_TITLE_SYSTEM,
    user,
    maxTokens: 80,
    temperature: 0.5,
  });

  let text = cleanModelOutput(first.text);

  if (!isInRange(text, TARGET_MIN, TARGET_MAX)) {
    const retry = await provider.complete({
      system: META_TITLE_SYSTEM,
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
