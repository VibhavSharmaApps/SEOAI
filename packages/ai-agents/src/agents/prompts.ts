export interface PageInput {
  title: string;
  url: string;
  contentPreview: string;
  focusKeyword?: string;
  currentMetaTitle?: string;
  currentMetaDescription?: string;
}

export const META_TITLE_SYSTEM = `You are an SEO copywriter. Write meta titles that:
- Are 50-60 characters long (count characters, including spaces).
- Include the focus keyword near the front when provided.
- Are clear and descriptive — no clickbait, no ALL CAPS, no emojis.
- Do not wrap the title in quotes.
- Return ONLY the title text, nothing else. No "Meta title:" prefix, no commentary.`;

export const META_DESCRIPTION_SYSTEM = `You are an SEO copywriter. Write meta descriptions that:
- Are 150-160 characters long (count characters, including spaces).
- Include the focus keyword naturally when provided.
- Summarize the page value and end with a soft call-to-action.
- Are written in active voice, no clickbait, no emojis.
- Do not wrap the description in quotes.
- Return ONLY the description text, nothing else. No "Meta description:" prefix, no commentary.`;

export function buildMetaTitleUser(page: PageInput): string {
  return [
    `Page title: ${page.title}`,
    `URL: ${page.url}`,
    page.focusKeyword ? `Focus keyword: ${page.focusKeyword}` : null,
    page.currentMetaTitle ? `Current meta title (improve it): ${page.currentMetaTitle}` : null,
    "",
    "Page content preview:",
    page.contentPreview.slice(0, 800),
    "",
    "Write a single meta title, 50-60 characters.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildMetaDescriptionUser(page: PageInput): string {
  return [
    `Page title: ${page.title}`,
    `URL: ${page.url}`,
    page.focusKeyword ? `Focus keyword: ${page.focusKeyword}` : null,
    page.currentMetaDescription
      ? `Current meta description (improve it): ${page.currentMetaDescription}`
      : null,
    "",
    "Page content preview:",
    page.contentPreview.slice(0, 1200),
    "",
    "Write a single meta description, 150-160 characters.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const H1_SYSTEM = `You are an SEO copywriter. Write page H1 headings that:
- Are 20-70 characters long (count characters, including spaces).
- Include the focus keyword near the front when provided.
- Are clear and descriptive — describe what the page is about, not clickbait.
- Are written as plain text. Do NOT include <h1> tags, markdown (#), or surrounding quotes.
- Avoid ALL CAPS and emojis.
- Return ONLY the H1 text, nothing else. No "H1:" prefix, no commentary.`;

export function buildH1User(page: PageInput): string {
  // The current H1 is not on PageInput yet, so we use the page title and meta title
  // as the strongest signals for what the existing headline should communicate.
  return [
    `Page title: ${page.title}`,
    `URL: ${page.url}`,
    page.focusKeyword ? `Focus keyword: ${page.focusKeyword}` : null,
    page.currentMetaTitle ? `Current meta title (for context): ${page.currentMetaTitle}` : null,
    "",
    "Page content preview:",
    page.contentPreview.slice(0, 800),
    "",
    "Write a single H1 heading, 20-70 characters.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const FOCUS_KEYWORD_SYSTEM = `You are an SEO strategist. Pick ONE focus keyword (the primary search query the page should rank for) that:
- Is a short phrase, typically 2-5 words.
- Is 3-50 characters long (count characters, including spaces).
- Is lowercase. Use spaces between words; hyphens are allowed only if they appear in the actual target term.
- Contains no punctuation, no quotes, no special characters, no emojis.
- Reflects real search intent — what someone would actually type into Google to find this page.
- Is NOT just a slug of the page title. Pick the underlying topic, not the headline.
- Return ONLY the keyword phrase, nothing else. No "Focus keyword:" prefix, no commentary, no list.`;

export function buildFocusKeywordUser(page: PageInput): string {
  return [
    `Page title: ${page.title}`,
    `URL: ${page.url}`,
    page.focusKeyword ? `Current focus keyword (improve it): ${page.focusKeyword}` : null,
    page.currentMetaTitle ? `Current meta title (for context): ${page.currentMetaTitle}` : null,
    "",
    "Page content preview:",
    page.contentPreview.slice(0, 1000),
    "",
    "Choose a single focus keyword, 2-5 words, lowercase.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const SCHEMA_DESCRIPTION_SYSTEM = `You are an SEO and structured-data specialist. Write a schema.org "description" field that:
- Is 100-250 characters long (count characters, including spaces).
- Is factual and informative. Describe what the page IS about and what value it delivers. No marketing fluff.
- Includes the focus keyword naturally when provided.
- Is written for machine consumers: search engine knowledge graphs, AI engines parsing JSON-LD, voice assistants.
- Has NO call-to-action, NO sales language, NO superlatives ("the best", "amazing"). This is metadata, not ad copy.
- Is plain text. Do NOT include HTML tags, markdown, surrounding quotes, or emojis.
- Return ONLY the description text, nothing else. No "Description:" prefix, no commentary.`;

export function buildSchemaDescriptionUser(page: PageInput): string {
  return [
    `Page title: ${page.title}`,
    `URL: ${page.url}`,
    page.focusKeyword ? `Focus keyword: ${page.focusKeyword}` : null,
    page.currentMetaDescription
      ? `Existing meta description (for reference, may be marketing-focused): ${page.currentMetaDescription}`
      : null,
    "",
    "Page content preview:",
    page.contentPreview.slice(0, 1200),
    "",
    "Write a single schema.org description, 100-250 characters, factual and CTA-free.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRetryUser(originalUser: string, lastResponse: string, targetMin: number, targetMax: number): string {
  return `${originalUser}\n\nYour previous response was ${lastResponse.length} characters: "${lastResponse}"\nTarget is ${targetMin}-${targetMax} characters. Try again and return ONLY the corrected text.`;
}

// ============================================================
// GEO: FAQ content generator
// ============================================================
// FAQ content is the first structured-output agent. Output is a JSON array
// of {question, answer} pairs, not a single string. Retry semantics differ
// from length-based agents — we retry when the item COUNT is out of range,
// not when the text length is.

export const FAQ_CONTENT_SYSTEM = `You are an SEO and Generative Engine Optimization (GEO) specialist. Generate FAQ content that helps the page be cited by AI search engines (ChatGPT, Perplexity, Google AI Overviews). Rules:
- Generate 3-5 question-and-answer pairs (no more, no less).
- Questions reflect real search intent — what someone would actually ask in a search engine or AI chatbot about this topic.
- Questions are direct and conversational, end with a question mark.
- Answers are factual, concise (1-3 sentences), and self-contained — do NOT refer to "this article", "the page above", "as mentioned", etc. Each answer must stand alone if extracted by an AI engine.
- Include the focus keyword naturally in at least 2 questions or answers when one is provided. Do not force it.
- No clickbait, no hype, no superlatives like "best" or "amazing".
- Output a valid JSON array of objects with "question" and "answer" string fields. No markdown code fences. No commentary. No preamble. No trailing notes.
- Format: [{"question": "...", "answer": "..."}, ...]`;

export function buildFAQContentUser(page: PageInput): string {
  return [
    `Page title: ${page.title}`,
    `URL: ${page.url}`,
    page.focusKeyword ? `Focus keyword: ${page.focusKeyword}` : null,
    "",
    "Page content:",
    page.contentPreview.slice(0, 2000),
    "",
    "Generate 3-5 FAQ pairs as a JSON array.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Retry prompt used when the previous response had the wrong NUMBER of FAQ
 * pairs (parser returned 0/1/2 or 6+). Different from buildRetryUser above
 * which targets character length — for FAQ we care about item count.
 */
export function buildFAQRetryUser(originalUser: string, gotCount: number, min: number, max: number): string {
  const reason =
    gotCount === 0
      ? "Your previous response could not be parsed as a JSON array of FAQ objects."
      : `Your previous response had ${gotCount} valid FAQ pair${gotCount === 1 ? "" : "s"}.`;
  return `${originalUser}\n\n${reason} We need ${min}-${max}. Try again and return ONLY a JSON array of ${min}-${max} objects with "question" and "answer" string fields. No code fences, no commentary.`;
}
