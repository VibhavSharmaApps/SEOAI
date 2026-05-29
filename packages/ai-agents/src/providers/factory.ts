import type { AIProvider, CreateProviderOptions } from "../types";
import { NoAIProviderConfiguredError } from "../types";
import { createAnthropicProvider } from "./anthropic";
import { createOpenAIProvider } from "./openai";

export function createAIProvider(opts: CreateProviderOptions): AIProvider {
  const { anthropicKey, openaiKey, prefer, anthropicModel, openaiModel } = opts;

  if (prefer === "openai" && openaiKey) {
    return createOpenAIProvider(openaiKey, openaiModel);
  }
  if (prefer === "anthropic" && anthropicKey) {
    return createAnthropicProvider(anthropicKey, anthropicModel);
  }

  if (anthropicKey) {
    return createAnthropicProvider(anthropicKey, anthropicModel);
  }
  if (openaiKey) {
    return createOpenAIProvider(openaiKey, openaiModel);
  }

  throw new NoAIProviderConfiguredError();
}

export function tryCreateAIProvider(opts: CreateProviderOptions): AIProvider | null {
  try {
    return createAIProvider(opts);
  } catch {
    return null;
  }
}

export async function withFallback<T>(
  primary: AIProvider | null,
  fallback: AIProvider | null,
  fn: (provider: AIProvider) => Promise<T>,
  onPrimaryError?: (err: unknown) => void
): Promise<T | null> {
  if (primary) {
    try {
      return await fn(primary);
    } catch (err) {
      onPrimaryError?.(err);
      if (!fallback) return null;
    }
  }
  if (fallback) {
    return await fn(fallback);
  }
  return null;
}
