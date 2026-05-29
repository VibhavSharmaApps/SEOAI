import { describe, it, expect } from "vitest";
import { generateFocusKeywordWithAI } from "../focus-keyword";
import { mockProvider, SAMPLE_PAGE } from "./test-helpers";

// Target range is 3-50 chars.
// Already-lowercase value used to test the happy path without lowercasing
// being a confound.
const IN_RANGE_LOWER = "cold brew coffee guide"; // 22 chars
// Same value but mixed case — used to assert the .toLowerCase() normalization.
const IN_RANGE_MIXED = "Cold Brew Coffee Guide"; // 22 chars
const TOO_SHORT = "ab"; // 2 chars, below 3
const TOO_LONG = "x".repeat(60); // above 50

describe("generateFocusKeywordWithAI", () => {
  it("happy path: returns first response when length is in range, no retry", async () => {
    expect(IN_RANGE_LOWER.length).toBe(22);
    const mock = mockProvider([IN_RANGE_LOWER]);

    const result = await generateFocusKeywordWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_LOWER);
    expect(result.inRange).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("mock-model");
    expect(mock.callCount()).toBe(1);
  });

  it("lowercases model output even when the model returns mixed case", async () => {
    // The focus-keyword agent has an extra step the others don't:
    // it always lowercases the final output as a belt-and-suspenders measure
    // because SEO focus keywords are conventionally lowercase.
    const mock = mockProvider([IN_RANGE_MIXED]);

    const result = await generateFocusKeywordWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe("cold brew coffee guide");
    expect(result.text).toBe(IN_RANGE_MIXED.toLowerCase());
    expect(result.inRange).toBe(true);
  });

  it("retry path: retries when first response is too short", async () => {
    const mock = mockProvider([TOO_SHORT, IN_RANGE_LOWER]);

    const result = await generateFocusKeywordWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_LOWER);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(2);
  });

  it("retry exhausted: surfaces lowercased out-of-range result with inRange=false", async () => {
    const mock = mockProvider([TOO_LONG, TOO_LONG]);

    const result = await generateFocusKeywordWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(TOO_LONG.toLowerCase());
    expect(result.inRange).toBe(false);
    expect(mock.callCount()).toBe(2);
  });

  it("cleans model output (strips surrounding quotes before lowercasing)", async () => {
    const wrapped = `"${IN_RANGE_MIXED}"`;
    const mock = mockProvider([wrapped]);

    const result = await generateFocusKeywordWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe("cold brew coffee guide"); // unquoted + lowercased
    expect(result.inRange).toBe(true);
  });
});
