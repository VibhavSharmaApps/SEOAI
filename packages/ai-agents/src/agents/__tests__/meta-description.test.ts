import { describe, it, expect } from "vitest";
import { generateMetaDescriptionWithAI } from "../meta-description";
import { mockProvider, SAMPLE_PAGE } from "./test-helpers";

// Target range is 150-160 chars. We build fixtures with `.padEnd()` so the
// length is exact and not dependent on counting characters by hand.
const IN_RANGE_155 = "Discover smooth, low-acid cold brew coffee.".padEnd(155, ".");
// Out-of-range fixtures don't need to look realistic — they only need lengths
// outside the target window so the retry path fires.
const TOO_SHORT = "x".repeat(100);
const TOO_LONG = "x".repeat(200);

describe("generateMetaDescriptionWithAI", () => {
  it("happy path: returns first response when length is in range, no retry", async () => {
    expect(IN_RANGE_155.length).toBe(155); // sanity check the fixture
    const mock = mockProvider([IN_RANGE_155]);

    const result = await generateMetaDescriptionWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_155);
    expect(result.inRange).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("mock-model");
    expect(mock.callCount()).toBe(1);
  });

  it("retry path: retries when first response is too short", async () => {
    const mock = mockProvider([TOO_SHORT, IN_RANGE_155]);

    const result = await generateMetaDescriptionWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_155);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(2);
  });

  it("retry exhausted: surfaces out-of-range result with inRange=false", async () => {
    const mock = mockProvider([TOO_LONG, TOO_LONG]);

    const result = await generateMetaDescriptionWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(TOO_LONG);
    expect(result.inRange).toBe(false);
    expect(mock.callCount()).toBe(2);
  });

  it("cleans model output (strips surrounding quotes before length check)", async () => {
    // Wrap the in-range value in quotes. After cleanModelOutput strips them,
    // the length is back to 155 and lands in the 150-160 target.
    const wrapped = `"${IN_RANGE_155}"`;
    const mock = mockProvider([wrapped]);

    const result = await generateMetaDescriptionWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_155);
    expect(result.inRange).toBe(true);
  });
});
