import { describe, it, expect } from "vitest";
import { generateFAQContentWithAI } from "../faq-content";
import { mockProvider, SAMPLE_PAGE } from "./test-helpers";

// Valid in-range response (4 FAQ pairs). Used as the canonical happy-path
// fixture across multiple tests.
const VALID_4 = JSON.stringify([
  { question: "What is cold brew coffee?", answer: "Cold brew is coffee steeped in cold water for 12-24 hours." },
  { question: "How long does cold brew last?", answer: "Refrigerated cold brew stays fresh for up to two weeks." },
  { question: "What's the ideal coffee-to-water ratio?", answer: "Use 1 cup of coarse grounds per 4 cups of cold water." },
  { question: "Is cold brew less acidic?", answer: "Yes — cold brewing extracts about 65% less acid than hot brewing." },
]);

// Wrapping the same valid response in a markdown code fence — the parser
// must strip the fence before JSON.parse runs.
const VALID_4_WITH_FENCE = "```json\n" + VALID_4 + "\n```";

// Too few — only 1 valid pair, should trigger a retry.
const ONLY_1 = JSON.stringify([
  { question: "What is cold brew coffee?", answer: "Cold brew is coffee steeped in cold water." },
]);

// Too many — 7 pairs, should be trimmed to MAX_FAQS=5 without a retry.
const SEVEN_PAIRS = JSON.stringify(
  Array.from({ length: 7 }, (_, i) => ({
    question: `Question ${i + 1}?`,
    answer: `Answer ${i + 1}.`,
  }))
);

// Garbage that fails JSON.parse — should be treated as 0 pairs and
// trigger a retry.
const GARBAGE = "I don't think I can answer that — let me know if you have other questions.";

describe("generateFAQContentWithAI", () => {
  it("happy path: parses valid JSON array of 4 FAQ pairs, no retry", async () => {
    const mock = mockProvider([VALID_4]);

    const result = await generateFAQContentWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.count).toBe(4);
    expect(result.faqs).toHaveLength(4);
    expect(result.inRange).toBe(true);
    expect(result.faqs[0].question).toBe("What is cold brew coffee?");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("mock-model");
    expect(mock.callCount()).toBe(1);
  });

  it("strips markdown code fences before JSON parsing", async () => {
    // Many models wrap JSON output in ```json ... ``` despite the prompt
    // telling them not to. We tolerate this rather than burning a retry.
    const mock = mockProvider([VALID_4_WITH_FENCE]);

    const result = await generateFAQContentWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.count).toBe(4);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(1);
  });

  it("retries when first response has too few FAQ pairs", async () => {
    const mock = mockProvider([ONLY_1, VALID_4]);

    const result = await generateFAQContentWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.count).toBe(4);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(2);
  });

  it("retries when first response is unparseable", async () => {
    const mock = mockProvider([GARBAGE, VALID_4]);

    const result = await generateFAQContentWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.count).toBe(4);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(2);
  });

  it("trims to MAX_FAQS=5 when model returns too many — no retry needed", async () => {
    // 7 pairs is "too many" but we don't burn a retry on it — extras are
    // harmless, just trimmed to the cap. The provider gets called once.
    const mock = mockProvider([SEVEN_PAIRS]);

    const result = await generateFAQContentWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.count).toBe(5);
    expect(result.faqs).toHaveLength(5);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(1);
  });

  it("retry exhausted: returns whatever the retry produced with inRange=false", async () => {
    // Both calls return unparseable garbage → count=0 → inRange=false.
    // We surface the empty result rather than throwing so the caller can
    // fall back to a placeholder (e.g. the WP plugin's extract_potential_faq).
    const mock = mockProvider([GARBAGE, GARBAGE]);

    const result = await generateFAQContentWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.count).toBe(0);
    expect(result.faqs).toEqual([]);
    expect(result.inRange).toBe(false);
    expect(mock.callCount()).toBe(2);
  });

  it("filters out malformed items inside an otherwise valid array", async () => {
    // Mix of valid and malformed entries. Parser should drop the bad ones
    // and keep the good ones. With 4 valid items remaining we're in range
    // and no retry fires.
    const mixed = JSON.stringify([
      { question: "Q1?", answer: "A1." },
      { question: "Q2?" }, // missing answer
      { question: "Q3?", answer: "A3." },
      { answer: "A4." }, // missing question
      { question: "", answer: "A5." }, // empty question
      { question: "Q6?", answer: "A6." },
      { question: "Q7?", answer: "A7." },
      "not an object",
    ]);
    const mock = mockProvider([mixed]);

    const result = await generateFAQContentWithAI(mock.provider, SAMPLE_PAGE);

    expect(result.count).toBe(4); // Q1, Q3, Q6, Q7 survive
    expect(result.faqs.map((f) => f.question)).toEqual(["Q1?", "Q3?", "Q6?", "Q7?"]);
    expect(result.inRange).toBe(true);
    expect(mock.callCount()).toBe(1);
  });

  it("retry prompt tells the model how many pairs it actually returned", async () => {
    // The retry prompt has to give the model enough signal to correct
    // itself — otherwise the retry is no better than the first call.
    const mock = mockProvider([ONLY_1, VALID_4]);
    await generateFAQContentWithAI(mock.provider, SAMPLE_PAGE);

    const [, retryCall] = mock.receivedOptions();
    expect(retryCall.user).toContain("1 valid FAQ pair"); // singular "pair"
    expect(retryCall.user).toContain("3-5");
  });
});
