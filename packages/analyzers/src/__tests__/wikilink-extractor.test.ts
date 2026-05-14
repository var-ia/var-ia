import { describe, it, expect } from "vitest";
import { extractWikilinks, diffWikilinks, buildWikilinkEvents } from "../wikilink-extractor.js";

describe("extractWikilinks", () => {
  it("extracts standard wikilinks", () => {
    const wikitext = "According to [[Fan fiction]] and [[Transformative work]].";
    const links = extractWikilinks(wikitext);
    expect(links).toEqual(["fan fiction", "transformative work"]);
  });

  it("extracts piped wikilinks", () => {
    const wikitext = "See [[Doctor Who|the Doctor]] for details.";
    const links = extractWikilinks(wikitext);
    expect(links).toContain("doctor who");
  });

  it("returns empty array for no links", () => {
    const wikitext = "This is plain text without any wikilinks.";
    const links = extractWikilinks(wikitext);
    expect(links).toEqual([]);
  });

  it("skips File: and Image: links", () => {
    const wikitext = "[[File:photo.jpg]] and [[Image:icon.png]] with [[Foo]].";
    const links = extractWikilinks(wikitext);
    expect(links).toEqual(["foo"]);
  });

  it("skips interwiki links", () => {
    const wikitext = "See [[wikipedia:Fandom]] for more.";
    const links = extractWikilinks(wikitext);
    expect(links).toEqual([]);
  });

  it("deduplicates identical links", () => {
    const wikitext = "[[Foo]] and [[foo|bar]] and [[FOO]].";
    const links = extractWikilinks(wikitext);
    expect(links).toEqual(["foo"]);
  });

  it("normalizes underscores to spaces", () => {
    const wikitext = "[[Fan_fiction]] is a genre.";
    const links = extractWikilinks(wikitext);
    expect(links).toContain("fan fiction");
  });
});

describe("diffWikilinks", () => {
  it("detects added links", () => {
    const { added, removed } = diffWikilinks(["foo", "bar"], ["foo", "bar", "baz"]);
    expect(added).toEqual(["baz"]);
    expect(removed).toEqual([]);
  });

  it("detects removed links", () => {
    const { added, removed } = diffWikilinks(["foo", "bar", "baz"], ["foo"]);
    expect(added).toEqual([]);
    expect(removed).toEqual(["bar", "baz"]);
  });

  it("detects both added and removed", () => {
    const { added, removed } = diffWikilinks(["foo", "bar"], ["bar", "baz"]);
    expect(added).toEqual(["baz"]);
    expect(removed).toEqual(["foo"]);
  });

  it("returns empty for no changes", () => {
    const { added, removed } = diffWikilinks(["foo", "bar"], ["foo", "bar"]);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });
});

describe("buildWikilinkEvents", () => {
  it("produces correctly shaped events for added links", () => {
    const before = "[[Foo]].";
    const after = "[[Foo]] and [[Bar]].";
    const events = buildWikilinkEvents(before, after, 1, 2, "body", "2024-01-01T00:00:00Z");

    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("wikilink_added");
    expect(events[0].fromRevisionId).toBe(1);
    expect(events[0].toRevisionId).toBe(2);
    expect(events[0].section).toBe("body");
    expect(events[0].after).toBe("bar");
    expect(events[0].layer).toBe("observed");
    expect(events[0].timestamp).toBe("2024-01-01T00:00:00Z");
  });

  it("produces correctly shaped events for removed links", () => {
    const before = "[[Foo]] and [[Bar]].";
    const after = "[[Foo]].";
    const events = buildWikilinkEvents(before, after, 1, 2, "body", "2024-01-01T00:00:00Z");

    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("wikilink_removed");
    expect(events[0].fromRevisionId).toBe(1);
    expect(events[0].toRevisionId).toBe(2);
    expect(events[0].before).toBe("bar");
  });
});
