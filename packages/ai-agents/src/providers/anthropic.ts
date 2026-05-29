import Anthropic from "@anthropic-ai/sdk";
import type { AICompletionOptions, AICompletionResult, AIProvider } from "../types";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function createAnthropicProvider(apiKey: string, model?: string): AIProvider {
  const client = new Anthropic({ apiKey });
  const resolvedModel = model ?? process.env.WORKFORCE_AI_ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  return {
    name: "anthropic",
    async complete(opts: AICompletionOptions): Promise<AICompletionResult> {
      const response = await client.messages.create({
        model: resolvedModel,
        max_tokens: opts.maxTokens ?? 256,
        temperature: opts.temperature ?? 0.4,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

      return {
        text,
        provider: "anthropic",
        model: resolvedModel,
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };
    },
  };
}
