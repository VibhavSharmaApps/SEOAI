export type {
  AIProvider,
  AIProviderName,
  AICompletionOptions,
  AICompletionResult,
  CreateProviderOptions,
} from "./types";
export { NoAIProviderConfiguredError } from "./types";

export {
  createAIProvider,
  tryCreateAIProvider,
  withFallback,
} from "./providers/factory";
export { createAnthropicProvider } from "./providers/anthropic";
export { createOpenAIProvider } from "./providers/openai";

export { generateMetaTitleWithAI } from "./agents/meta-title";
export type { MetaTitleResult } from "./agents/meta-title";
export { generateMetaDescriptionWithAI } from "./agents/meta-description";
export type { MetaDescriptionResult } from "./agents/meta-description";
export { generateH1WithAI } from "./agents/h1";
export type { H1Result } from "./agents/h1";
export { generateFocusKeywordWithAI } from "./agents/focus-keyword";
export type { FocusKeywordResult } from "./agents/focus-keyword";
export { generateSchemaDescriptionWithAI } from "./agents/schema-description";
export type { SchemaDescriptionResult } from "./agents/schema-description";
export { generateFAQContentWithAI } from "./agents/faq-content";
export type { FAQContentResult, FAQPair } from "./agents/faq-content";
export type { PageInput } from "./agents/prompts";
