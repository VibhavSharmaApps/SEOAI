import { describe, it, expect } from "vitest";
import { generateSchemaDescriptionWithAI } from "../schema-description";
import { mockProvider, SAMPLE_PAGE } from "./test-helpers";

// Target range is 100-250 chars (wider than meta description because schema
// has no SERP truncation).
const IN_RANGE_175 = "Cold brew coffee is steeped in cold water for 24 hours.".padEnd(
  175,
  "."
);
const TOO_SHORT = "x".repeat(50);
const TOO_LONG = "x".repeat(300);

describe("generateSchemaDescriptionWithAI", () => {
  it("happy path: returns first response when length is in range, no retry", async () => {
    expect(IN_RANGE_175.length).toBe(175);
    const mock = mockProvider([IN_RANGE_175]);

    const result = await generateSchemaDescriptionWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_175);
    expect(result.inRange).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("mock-model");
    expect(mock.callCount()).toBe(1);
  });

  it("retry path: retries when first response is too short", async () => {
    const mock = mockProvider([TOO_SHORT, IN_RANGE_175]);

    const result = await generateSchemaDescriptionWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_175);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(2);
  });

  it("retry exhausted: surfaces out-of-range result with inRange=false", async () => {
    const mock = mockProvider([TOO_LONG, TOO_LONG]);

    const result = await generateSchemaDescriptionWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(TOO_LONG);
    expect(result.inRange).toBe(false);
    expect(mock.callCount()).toBe(2);
  });

  it("cleans model output (strips surrounding quotes)", async () => {
    const wrapped = `"${IN_RANGE_175}"`;
    const mock = mockProvider([wrapped]);

    const result = await generateSchemaDescriptionWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_175);
    expect(result.inRange).toBe(true);
  });
});
