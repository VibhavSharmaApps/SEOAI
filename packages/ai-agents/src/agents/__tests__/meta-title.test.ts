import { describe, it, expect } from "vitest";
import { generateMetaTitleWithAI } from "../meta-title";
import { mockProvider, SAMPLE_PAGE } from "./test-helpers";

// A 55-character meta title — sits squarely inside the 50-60 target range.
const IN_RANGE_55 = "Cold Brew Coffee Guide: How to Make It at Home (2024)..";
// A 30-character response — too short, should trigger a retry.
const TOO_SHORT_30 = "Cold Brew Coffee Guide (Home)!";
// An 81-character response — too long, should trigger a retry.
const TOO_LONG_81 =
  "The Ultimate Cold Brew Coffee Guide for Beginners: Equipment, Steps, and Recipes!";

describe("generateMetaTitleWithAI", () => {
  it("happy path: returns first response when length is in range, no retry", async () => {
    expect(IN_RANGE_55.length).toBe(55); // sanity check the fixture

    const mock = mockProvider([IN_RANGE_55]);
    const result = await generateMetaTitleWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_55);
    expect(result.inRange).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("mock-model");
    expect(mock.callCount()).toBe(1); // no retry fired
  });

  it("retry path: retries when first response is too short, returns retry text", async () => {
    expect(TOO_SHORT_30.length).toBe(30); // below 50
    expect(IN_RANGE_55.length).toBe(55);

    const mock = mockProvider([TOO_SHORT_30, IN_RANGE_55]);
    const result = await generateMetaTitleWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_55);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(2); // exactly one retry
  });

  it("retry path: retries when first response is too long", async () => {
    expect(TOO_LONG_81.length).toBe(81); // above 60
    expect(IN_RANGE_55.length).toBe(55);

    const mock = mockProvider([TOO_LONG_81, IN_RANGE_55]);
    const result = await generateMetaTitleWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_55);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(2);
  });

  it("retry exhausted: when retry is also out of range, returns retry text with inRange=false", async () => {
    // We only retry once. If the retry is also bad, we surface it with the
    // inRange flag set to false so callers can decide what to do (log, fall
    // back to a placeholder, etc.).
    const mock = mockProvider([TOO_SHORT_30, TOO_SHORT_30]);
    const result = await generateMetaTitleWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(TOO_SHORT_30);
    expect(result.inRange).toBe(false);
    expect(mock.callCount()).toBe(2); // exactly one retry, no third call
  });

  it("retry prompt references the previous out-of-range response", async () => {
    // We don't want to over-specify the exact retry prompt text, but we DO
    // want to assert that the model gets told what went wrong, otherwise the
    // retry is no better than the first call.
    const mock = mockProvider([TOO_SHORT_30, IN_RANGE_55]);
    await generateMetaTitleWithAI(mock.provider, SAMPLE_PAGE);

    const [firstCall, retryCall] = mock.receivedOptions();
    expect(retryCall.user).toContain(firstCall.user); // retry includes the original prompt
    expect(retryCall.user).toContain(String(TOO_SHORT_30.length)); // and the previous length
  });

  it("cleans model output (strips surrounding quotes)", async () => {
    // 55-char value inside surrounding quotes — total length 57 but the
    // cleaned text is 55 and lands in range.
    const wrapped = `"${IN_RANGE_55}"`;
    expect(wrapped.length).toBe(57);

    const mock = mockProvider([wrapped]);
    const result = await generateMetaTitleWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.text).toBe(IN_RANGE_55); // quotes stripped
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(1); // no retry needed once cleaned
  });
});
