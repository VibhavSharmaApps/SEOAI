import { describe, it, expect } from "vitest";
import { cleanModelOutput, isInRange } from "../post-process";

describe("cleanModelOutput", () => {
  it("returns plain text unchanged (no quotes, no prefix)", () => {
    expect(cleanModelOutput("Best Coffee Beans for Cold Brew")).toBe(
      "Best Coffee Beans for Cold Brew"
    );
  });

  it("trims leading and trailing whitespace", () => {
    expect(cleanModelOutput("   Hello world   ")).toBe("Hello world");
    expect(cleanModelOutput("\n\nHello world\n\n")).toBe("Hello world");
  });

  it("strips surrounding double quotes", () => {
    expect(cleanModelOutput(`"Foo"`)).toBe("Foo");
  });

  it("strips surrounding single quotes", () => {
    expect(cleanModelOutput(`'Foo'`)).toBe("Foo");
  });

  it("strips surrounding backticks", () => {
    expect(cleanModelOutput("`Foo`")).toBe("Foo");
  });

  it("strips multiple stacked quote characters at edges", () => {
    expect(cleanModelOutput(`""Foo""`)).toBe("Foo");
    expect(cleanModelOutput(`'"Foo"'`)).toBe("Foo");
  });

  it("preserves quotes that are INSIDE the string (not at the edges)", () => {
    // We don't want to mangle legitimate inner punctuation.
    expect(cleanModelOutput("It's the best")).toBe("It's the best");
    expect(cleanModelOutput(`Say "hello"`)).toBe(`Say "hello"`);
  });

  it("strips a `Meta title:` prefix (case-insensitive)", () => {
    expect(cleanModelOutput("Meta title: Foo")).toBe("Foo");
    expect(cleanModelOutput("META TITLE: Foo")).toBe("Foo");
    expect(cleanModelOutput("meta title : Foo")).toBe("Foo");
  });

  it("strips a `Meta description:` prefix", () => {
    expect(cleanModelOutput("Meta description: A great article")).toBe(
      "A great article"
    );
  });

  it("strips bare `Title:` and `Description:` prefixes", () => {
    expect(cleanModelOutput("Title: Foo")).toBe("Foo");
    expect(cleanModelOutput("Description: Foo")).toBe("Foo");
  });

  it("strips both surrounding quotes AND the prefix", () => {
    // Model wraps the whole labelled line in quotes.
    expect(cleanModelOutput(`"Meta title: Foo"`)).toBe("Foo");
  });

  it("strips quotes that wrap just the value after a prefix (regression for the order-of-ops bug)", () => {
    // Before the fix, this returned `"Foo"` with the quotes intact because the
    // first quote strip ran on the outer string (no edge quotes there) and the
    // prefix strip then exposed the inner quotes that nothing cleaned up.
    expect(cleanModelOutput(`Meta title: "Foo"`)).toBe("Foo");
    expect(cleanModelOutput(`Title: 'Foo'`)).toBe("Foo");
  });

  it("returns empty string when input is empty or just whitespace", () => {
    expect(cleanModelOutput("")).toBe("");
    expect(cleanModelOutput("   ")).toBe("");
  });
});

describe("isInRange", () => {
  it("returns true when length is exactly min", () => {
    expect(isInRange("abc", 3, 5)).toBe(true);
  });

  it("returns true when length is exactly max", () => {
    expect(isInRange("abcde", 3, 5)).toBe(true);
  });

  it("returns true when length is between min and max", () => {
    expect(isInRange("abcd", 3, 5)).toBe(true);
  });

  it("returns false when length is one below min", () => {
    expect(isInRange("ab", 3, 5)).toBe(false);
  });

  it("returns false when length is one above max", () => {
    expect(isInRange("abcdef", 3, 5)).toBe(false);
  });

  it("returns true for empty string when min is 0", () => {
    expect(isInRange("", 0, 5)).toBe(true);
  });

  it("returns false for empty string when min is greater than 0", () => {
    expect(isInRange("", 1, 5)).toBe(false);
  });

  it("returns true when min equals max and length matches exactly", () => {
    expect(isInRange("abc", 3, 3)).toBe(true);
  });

  it("returns false when min equals max and length differs", () => {
    expect(isInRange("ab", 3, 3)).toBe(false);
    expect(isInRange("abcd", 3, 3)).toBe(false);
  });
});
