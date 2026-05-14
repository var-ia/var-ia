import { describe, it, expect } from "vitest";
import { extractCategories, diffCategories, buildCategoryEvents } from "../category-tracker.js";

describe("extractCategories", () => {
  it("extracts multiple categories", () => {
    const wikitext = "Content\n\n[[Category:Fan fiction]]\n[[Category:Transformative works]]";
    const cats = extractCategories(wikitext);
    expect(cats).toEqual(["fan fiction", "transformative works"]);
  });

  it("strips sort keys", () => {
    const wikitext = "[[Category:Doctor Who|Doctor]]";
    const cats = extractCategories(wikitext);
    expect(cats).toEqual(["doctor who"]);
  });

  it("normalizes underscores to spaces", () => {
    const wikitext = "[[Category:Fan_fiction]]";
    const cats = extractCategories(wikitext);
    expect(cats).toEqual(["fan fiction"]);
  });

  it("returns empty for no categories", () => {
    const wikitext = "This page has no categories.";
    const cats = extractCategories(wikitext);
    expect(cats).toEqual([]);
  });

  it("deduplicates categories", () => {
    const wikitext = "[[Category:Foo]]\n[[Category:Foo|Bar]]";
    const cats = extractCategories(wikitext);
    expect(cats).toEqual(["foo"]);
  });
});

describe("diffCategories", () => {
  it("detects added categories", () => {
    const { added, removed } = diffCategories(["foo"], ["foo", "bar"]);
    expect(added).toEqual(["bar"]);
    expect(removed).toEqual([]);
  });

  it("detects removed categories", () => {
    const { added, removed } = diffCategories(["foo", "bar"], ["foo"]);
    expect(added).toEqual([]);
    expect(removed).toEqual(["bar"]);
  });

  it("detects both added and removed", () => {
    const { added, removed } = diffCategories(["foo", "bar"], ["bar", "baz"]);
    expect(added).toEqual(["baz"]);
    expect(removed).toEqual(["foo"]);
  });
});

describe("buildCategoryEvents", () => {
  it("produces events for added categories", () => {
    const before = "Content.";
    const after = "Content.\n\n[[Category:Foo]]";
    const events = buildCategoryEvents(before, after, 1, 2, "2024-01-01T00:00:00Z");

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("category_added");
    expect(events[0].fromRevisionId).toBe(1);
    expect(events[0].toRevisionId).toBe(2);
    expect(events[0].after).toBe("foo");
    expect(events[0].layer).toBe("observed");
  });

  it("produces events for removed categories", () => {
    const before = "Content.\n\n[[Category:Bar]]";
    const after = "Content.";
    const events = buildCategoryEvents(before, after, 1, 2, "2024-01-01T00:00:00Z");

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("category_removed");
    expect(events[0].before).toBe("bar");
  });
});
