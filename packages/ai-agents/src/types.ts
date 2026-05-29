export type AIProviderName = "anthropic" | "openai";

export interface AICompletionOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResult {
  text: string;
  provider: AIProviderName;
  model: string;
  tokensUsed?: { input: number; output: number };
}

export interface AIProvider {
  name: AIProviderName;
  complete(opts: AICompletionOptions): Promise<AICompletionResult>;
}

export interface CreateProviderOptions {
  anthropicKey?: string;
  openaiKey?: string;
  prefer?: AIProviderName;
  anthropicModel?: string;
  openaiModel?: string;
}

export class NoAIProviderConfiguredError extends Error {
  constructor() {
    super("No AI provider configured: set ANTHROPIC_API_KEY or OPENAI_API_KEY");
    this.name = "NoAIProviderConfiguredError";
  }
}
