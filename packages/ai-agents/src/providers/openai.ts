import OpenAI from "openai";
import type { AICompletionOptions, AICompletionResult, AIProvider } from "../types";

const DEFAULT_MODEL = "gpt-4o-mini";

export function createOpenAIProvider(apiKey: string, model?: string): AIProvider {
  const client = new OpenAI({ apiKey });
  const resolvedModel = model ?? process.env.WORKFORCE_AI_OPENAI_MODEL ?? DEFAULT_MODEL;

  return {
    name: "openai",
    async complete(opts: AICompletionOptions): Promise<AICompletionResult> {
      const response = await client.chat.completions.create({
        model: resolvedModel,
        max_tokens: opts.maxTokens ?? 256,
        temperature: opts.temperature ?? 0.4,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";

      return {
        text,
        provider: "openai",
        model: resolvedModel,
        tokensUsed: response.usage
          ? { input: response.usage.prompt_tokens, output: response.usage.completion_tokens }
          : undefined,
      };
    },
  };
}
