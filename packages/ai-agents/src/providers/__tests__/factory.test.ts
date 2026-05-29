import { describe, it, expect, vi } from "vitest";
import {
  createAIProvider,
  tryCreateAIProvider,
  withFallback,
} from "../factory";
import { NoAIProviderConfiguredError } from "../../types";
import type {
  AIProvider,
  AICompletionOptions,
  AICompletionResult,
} from "../../types";

// Real Anthropic/OpenAI SDK constructors don't validate keys at construction
// time — they only fail on the first network call. So we can use dummy keys
// here and still get back a real provider instance whose .name we can assert.
const DUMMY_ANTHROPIC = "sk-ant-dummy";
const DUMMY_OPENAI = "sk-dummy";

describe("createAIProvider", () => {
  it("returns an anthropic provider when only anthropicKey is set", () => {
    const provider = createAIProvider({ anthropicKey: DUMMY_ANTHROPIC });
    expect(provider.name).toBe("anthropic");
  });

  it("returns an openai provider when only openaiKey is set", () => {
    const provider = createAIProvider({ openaiKey: DUMMY_OPENAI });
    expect(provider.name).toBe("openai");
  });

  it("defaults to anthropic when both keys are set and no `prefer` is given", () => {
    // The factory's default-when-both rule is anthropic-first. This is the
    // behaviour the rest of the codebase depends on (Claude is the primary
    // provider per CLAUDE.md).
    const provider = createAIProvider({
      anthropicKey: DUMMY_ANTHROPIC,
      openaiKey: DUMMY_OPENAI,
    });
    expect(provider.name).toBe("anthropic");
  });

  it("respects prefer='openai' when both keys are set", () => {
    const provider = createAIProvider({
      anthropicKey: DUMMY_ANTHROPIC,
      openaiKey: DUMMY_OPENAI,
      prefer: "openai",
    });
    expect(provider.name).toBe("openai");
  });

  it("respects prefer='anthropic' when both keys are set", () => {
    const provider = createAIProvider({
      anthropicKey: DUMMY_ANTHROPIC,
      openaiKey: DUMMY_OPENAI,
      prefer: "anthropic",
    });
    expect(provider.name).toBe("anthropic");
  });

  it("falls back to anthropic when prefer='openai' but only anthropicKey is set", () => {
    // `prefer` is a preference, not a requirement. If the preferred key is
    // missing, we fall through to whichever key IS available.
    const provider = createAIProvider({
      anthropicKey: DUMMY_ANTHROPIC,
      prefer: "openai",
    });
    expect(provider.name).toBe("anthropic");
  });

  it("falls back to openai when prefer='anthropic' but only openaiKey is set", () => {
    const provider = createAIProvider({
      openaiKey: DUMMY_OPENAI,
      prefer: "anthropic",
    });
    expect(provider.name).toBe("openai");
  });

  it("throws NoAIProviderConfiguredError when neither key is set", () => {
    expect(() => createAIProvider({})).toThrow(NoAIProviderConfiguredError);
  });

  it("throws NoAIProviderConfiguredError when keys are empty strings", () => {
    // Empty strings are falsy and treated as "not set". This matches what
    // server-side env-var lookups produce when the var is missing.
    expect(() =>
      createAIProvider({ anthropicKey: "", openaiKey: "" })
    ).toThrow(NoAIProviderConfiguredError);
  });
});

describe("tryCreateAIProvider", () => {
  it("returns a provider when at least one key is set", () => {
    const provider = tryCreateAIProvider({ anthropicKey: DUMMY_ANTHROPIC });
    expect(provider).not.toBeNull();
    expect(provider?.name).toBe("anthropic");
  });

  it("returns null instead of throwing when no key is set", () => {
    // This is the no-key dev/demo path that seo-gaps.ts relies on — it lets
    // callers handle the missing-provider case without try/catch.
    const provider = tryCreateAIProvider({});
    expect(provider).toBeNull();
  });
});

/**
 * Build a minimal AIProvider whose complete() always returns the same canned
 * text. Different from the queue-based mockProvider in __tests__/test-helpers
 * because withFallback tests don't care about call order — they care about
 * WHICH provider got called.
 */
function constantProvider(name: "anthropic" | "openai", text: string): AIProvider {
  return {
    name,
    async complete(_opts: AICompletionOptions): Promise<AICompletionResult> {
      return { text, provider: name, model: "mock-model" };
    },
  };
}

/**
 * Build an AIProvider whose complete() always throws. Used to drive the
 * fallback path in withFallback tests.
 */
function failingProvider(name: "anthropic" | "openai", error: Error): AIProvider {
  return {
    name,
    async complete(): Promise<AICompletionResult> {
      throw error;
    },
  };
}

describe("withFallback", () => {
  it("returns primary's result when primary succeeds (fallback untouched)", async () => {
    const primary = constantProvider("anthropic", "primary-output");
    const fallback = constantProvider("openai", "fallback-output");

    const result = await withFallback(primary, fallback, (p) => p.complete({ system: "", user: "" }));

    expect(result).not.toBeNull();
    expect(result?.text).toBe("primary-output");
    expect(result?.provider).toBe("anthropic");
  });

  it("falls back to secondary when primary throws", async () => {
    const primary = failingProvider("anthropic", new Error("primary boom"));
    const fallback = constantProvider("openai", "fallback-output");

    const result = await withFallback(primary, fallback, (p) => p.complete({ system: "", user: "" }));

    expect(result?.text).toBe("fallback-output");
    expect(result?.provider).toBe("openai");
  });

  it("calls onPrimaryError when primary throws", async () => {
    const onPrimaryError = vi.fn();
    const err = new Error("primary boom");
    const primary = failingProvider("anthropic", err);
    const fallback = constantProvider("openai", "fallback-output");

    await withFallback(
      primary,
      fallback,
      (p) => p.complete({ system: "", user: "" }),
      onPrimaryError
    );

    expect(onPrimaryError).toHaveBeenCalledTimes(1);
    expect(onPrimaryError).toHaveBeenCalledWith(err);
  });

  it("does NOT call onPrimaryError when primary succeeds", async () => {
    const onPrimaryError = vi.fn();
    const primary = constantProvider("anthropic", "primary-output");
    const fallback = constantProvider("openai", "fallback-output");

    await withFallback(
      primary,
      fallback,
      (p) => p.complete({ system: "", user: "" }),
      onPrimaryError
    );

    expect(onPrimaryError).not.toHaveBeenCalled();
  });

  it("returns null when primary throws and fallback is null", async () => {
    const primary = failingProvider("anthropic", new Error("primary boom"));

    const result = await withFallback(primary, null, (p) => p.complete({ system: "", user: "" }));

    expect(result).toBeNull();
  });

  it("calls fallback when primary is null", async () => {
    // Real-world case: only one of the two env keys is configured. The
    // helper buildPrimaryAndFallback in seo-gaps.ts handles the
    // "both prefer-paths land on the same provider" case by returning
    // primary + null fallback, but the inverse (null primary + real
    // fallback) is also legitimate.
    const fallback = constantProvider("openai", "fallback-output");

    const result = await withFallback(null, fallback, (p) => p.complete({ system: "", user: "" }));

    expect(result?.text).toBe("fallback-output");
    expect(result?.provider).toBe("openai");
  });

  it("returns null when both primary and fallback are null", async () => {
    // The no-key dev/demo path. Callers (e.g. generateMetaTitle in seo-gaps.ts)
    // check for null and fall back to a placeholder.
    const result = await withFallback(null, null, (p) => p.complete({ system: "", user: "" }));
    expect(result).toBeNull();
  });

  it("propagates fallback's error if both primary and fallback throw", async () => {
    // withFallback only catches the PRIMARY error. If the fallback also
    // throws, that error bubbles to the caller — they need to know nothing
    // worked, not get a silent null.
    const primary = failingProvider("anthropic", new Error("primary boom"));
    const fallback = failingProvider("openai", new Error("fallback boom"));

    await expect(
      withFallback(primary, fallback, (p) => p.complete({ system: "", user: "" }))
    ).rejects.toThrow("fallback boom");
  });
});
