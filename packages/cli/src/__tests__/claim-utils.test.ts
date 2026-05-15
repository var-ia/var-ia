import { describe, expect, it, vi } from "vitest";

vi.mock("bun:sqlite", () => {
  class MockDB {
    run() {}
    query() {
      return { all: () => [], get: () => null };
    }
    prepare() {
      return { run: () => {} };
    }
    transaction(fn: () => void) {
      fn();
    }
    close() {}
  }
  return { Database: MockDB };
});

import { findSectionForText, fuzzyFindClaim } from "../commands/claim.js";
import { stripWikitext } from "@var-ia/analyzers";

describe("stripWikitext", () => {
  it("strips HTML comments", () => {
    const result = stripWikitext("text <!-- comment --> more");
    expect(result).not.toContain("comment");
  });

  it("strips ref tags", () => {
    expect(stripWikitext("text<ref>citation</ref>more")).toBe("textmore");
  });

  it("strips templates", () => {
    expect(stripWikitext("{{citation needed}}")).toBe("");
  });

  it("strips wikilinks keeping display text", () => {
    expect(stripWikitext("[[Foo]] and [[Bar|baz]]")).toBe("Foo and baz");
  });

  it("strips bold and italic markers", () => {
    expect(stripWikitext("'''bold''' and ''italic''")).toBe("bold and italic");
  });

  it("collapses multiple newlines", () => {
    expect(stripWikitext("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("removes HTML tags", () => {
    expect(stripWikitext("hello<br/>world")).toBe("helloworld");
  });
});

describe("fuzzyFindClaim", () => {
  it("finds exact match", () => {
    const result = fuzzyFindClaim("Earth is the third planet", "Earth is the third planet from the Sun.");
    expect(result).toBeTruthy();
    expect(result?.length).toBeGreaterThan(0);
  });

  it("finds case-insensitive match", () => {
    const result = fuzzyFindClaim("earth is the third", "Earth is the third planet.");
    expect(result).toBeTruthy();
  });

  it("finds partial matches with sufficient word overlap", () => {
    const result = fuzzyFindClaim("Earth third planet Sun", "Earth is the third planet from the Sun.");
    expect(result).toBeTruthy();
  });

  it("returns empty string for no match", () => {
    const result = fuzzyFindClaim("completely unrelated", "Earth is a planet.");
    expect(result).toBe("");
  });

  it("handles empty claim text (returns source text since empty is always found)", () => {
    const result = fuzzyFindClaim("", "Some text.");
    expect(result).toBeTruthy();
    expect(result?.length).toBeGreaterThan(0);
  });
});

describe("findSectionForText", () => {
  const wikitext = `Lead text about the topic.

== History ==
Historical content about the subject.

== References ==
{{reflist}}`;

  it("finds section for text in lead", () => {
    const section = findSectionForText(wikitext, "Lead text about the topic.");
    expect(section).toBe("(lead)");
  });

  it("finds section for text in a named section", () => {
    const section = findSectionForText(wikitext, "Historical content about the subject.");
    expect(section).toBe("History");
  });

  it("returns lead for text that doesn't appear", () => {
    const section = findSectionForText(wikitext, "Text that does not appear anywhere.");
    expect(section).toBe("(lead)");
  });
});
