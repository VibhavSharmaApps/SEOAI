import type { AIProvider } from "../types";
import {
  META_DESCRIPTION_SYSTEM,
  buildMetaDescriptionUser,
  buildRetryUser,
  type PageInput,
} from "./prompts";
import { cleanModelOutput, isInRange } from "./post-process";

const TARGET_MIN = 150;
const TARGET_MAX = 160;

export interface MetaDescriptionResult {
  text: string;
  inRange: boolean;
  provider: string;
  model: string;
}

export async function generateMetaDescriptionWithAI(
  provider: AIProvider,
  page: PageInput
): Promise<MetaDescriptionResult> {
  const user = buildMetaDescriptionUser(page);

  const first = await provider.complete({
    system: META_DESCRIPTION_SYSTEM,
    user,
    maxTokens: 200,
    temperature: 0.5,
  });

  let text = cleanModelOutput(first.text);

  if (!isInRange(text, TARGET_MIN, TARGET_MAX)) {
    const retry = await provider.complete({
      system: META_DESCRIPTION_SYSTEM,
      user: buildRetryUser(user, text, TARGET_MIN, TARGET_MAX),
      maxTokens: 200,
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
