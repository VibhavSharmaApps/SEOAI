const QUOTE_CHARS = new Set(['"', "'", "`"]);

/**
 * Strip "wrapping" quotes from a string — only when BOTH ends are quote
 * characters. This avoids mangling content with legitimate internal quotes,
 * e.g. `Say "hello"` (where the trailing quote is part of the value, not a
 * wrapper) is left as-is. Stacked wrappers like `""Foo""` are peeled
 * recursively.
 */
function stripWrappingQuotes(text: string): string {
  if (text.length < 2) return text;
  const first = text[0];
  const last = text[text.length - 1];
  if (QUOTE_CHARS.has(first) && QUOTE_CHARS.has(last)) {
    return stripWrappingQuotes(text.slice(1, -1).trim());
  }
  return text;
}

export function cleanModelOutput(raw: string): string {
  // Three passes, in this order:
  //   1. Strip outer wrapping quotes — handles `"Meta title: Foo"` by
  //      exposing the prefix so it can be matched in step 2.
  //   2. Strip a labelled prefix — handles `Meta title: ...` (case-insensitive).
  //   3. Strip wrapping quotes again — handles the case where the model
  //      wraps just the VALUE in quotes after the prefix, e.g.
  //      `Meta title: "Foo"`.
  let text = raw.trim();
  text = stripWrappingQuotes(text);
  text = text.replace(/^(meta title|meta description|title|description)\s*:\s*/i, "");
  text = stripWrappingQuotes(text);
  return text.trim();
}

export function isInRange(text: string, min: number, max: number): boolean {
  return text.length >= min && text.length <= max;
}
