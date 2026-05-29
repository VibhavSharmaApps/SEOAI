import { describe, it, expect } from "vitest";
import { generateH1WithAI } from "../h1";
import { mockProvider, SAMPLE_PAGE } from "./test-helpers";

// Target range is 20-70 chars.
const IN_RANGE_45 = "The Best Cold Brew Coffee Guide".padEnd(45, "!");
const TOO_SHORT = "x".repeat(10);
const TOO_LONG = "x".repeat(100);

describe("generateH1WithAI", () => {
  it("happy path: returns first response when length is in range, no retry", async () => {
    expect(IN_RANGE_45.length).toBe(45);
    const mock = mockProvider([IN_RANGE_45]);

    const result = await generateH1WithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_45);
    expect(result.inRange).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("mock-model");
    expect(mock.callCount()).toBe(1);
  });

  it("retry path: retries when first response is too short", async () => {
    const mock = mockProvider([TOO_SHORT, IN_RANGE_45]);

    const result = await generateH1WithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_45);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(2);
  });

  it("retry exhausted: surfaces out-of-range result with inRange=false", async () => {
    const mock = mockProvider([TOO_LONG, TOO_LONG]);

    const result = await generateH1WithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(TOO_LONG);
    expect(result.inRange).toBe(false);
    expect(mock.callCount()).toBe(2);
  });

  it("cleans model output (strips surrounding quotes)", async () => {
    const wrapped = `"${IN_RANGE_45}"`;
    const mock = mockProvider([wrapped]);

    const result = await generateH1WithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_45);
    expect(result.inRange).toBe(true);
  });
});
