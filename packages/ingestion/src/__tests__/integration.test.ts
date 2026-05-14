import { describe, expect, it } from "vitest";
import { MediaWikiClient } from "../mediawiki-client.js";

const STABLE_PAGE = "Earth";

describe("Integration: ingestion + analyzers", () => {
  it("fetches revisions for a stable page and produces valid shape", { timeout: 60000 }, async () => {
    const client = new MediaWikiClient({ minDelayMs: 100 });
    const revisions = await client.fetchRevisions(STABLE_PAGE, {
      limit: 5,
      direction: "newer",
    });

    expect(revisions.length).toBeGreaterThanOrEqual(2);

    for (const rev of revisions) {
      expect(rev).toHaveProperty("revId");
      expect(rev).toHaveProperty("pageId");
      expect(rev).toHaveProperty("pageTitle");
      expect(rev).toHaveProperty("timestamp");
      expect(rev).toHaveProperty("comment");
      expect(rev).toHaveProperty("content");
      expect(rev).toHaveProperty("size");
      expect(rev).toHaveProperty("minor");

      expect(typeof rev.revId).toBe("number");
      expect(rev.revId).toBeGreaterThan(0);
      expect(typeof rev.pageId).toBe("number");
      expect(rev.pageId).toBeGreaterThan(0);
      expect(rev.pageTitle).toContain(STABLE_PAGE);
      expect(typeof rev.timestamp).toBe("string");
      expect(typeof rev.size).toBe("number");
      expect(typeof rev.minor).toBe("boolean");

      expect(rev.content.length).toBeGreaterThan(0);
    }

    const sorted = [...revisions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (let i = 1; i < sorted.length; i++) {
      const before = sorted[i - 1];
      const after = sorted[i];

      const diff = await client.fetchDiff(before.revId, after.revId);
      expect(diff).toHaveProperty("fromRevId", before.revId);
      expect(diff).toHaveProperty("toRevId", after.revId);
      expect(diff).toHaveProperty("lines");
      expect(diff).toHaveProperty("sections");
      expect(diff).toHaveProperty("sizeDelta");
      expect(typeof diff.sizeDelta).toBe("number");
      expect(Array.isArray(diff.lines)).toBe(true);

      for (const line of diff.lines) {
        expect(line).toHaveProperty("type");
        expect(line).toHaveProperty("content");
        expect(line).toHaveProperty("lineNumber");
        expect(["added", "removed", "unchanged"]).toContain(line.type);
        expect(typeof line.lineNumber).toBe("number");
      }
    }
  });

  it("section differ extracts sections from revision content", { timeout: 30000 }, async () => {
    const client = new MediaWikiClient();
    const revisions = await client.fetchRevisions(STABLE_PAGE, {
      limit: 1,
      direction: "newer",
    });
    expect(revisions.length).toBeGreaterThan(0);

    const { sectionDiffer } = await import("../../../analyzers/dist/src/index.js");
    const sections = sectionDiffer.extractSections(revisions[0].content);
    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      expect(section).toHaveProperty("title");
      expect(section).toHaveProperty("level");
      expect(section).toHaveProperty("content");
      expect(section).toHaveProperty("byteOffset");
      expect(typeof section.title).toBe("string");
      expect(typeof section.level).toBe("number");
      expect(typeof section.byteOffset).toBe("number");
    }
  });

  it("revert detector identifies reverts in edit comments", { timeout: 5000 }, async () => {
    const { revertDetector } = await import("../../../analyzers/dist/src/index.js");

    expect(revertDetector.isRevert("Reverted to previous version")).toBe(true);
    expect(revertDetector.isRevert("Undid revision 12345 by User (talk)")).toBe(true);
    expect(revertDetector.isRevert("rvv")).toBe(true);
    expect(revertDetector.isRevert("Fixed typo in introduction")).toBe(false);
    expect(revertDetector.isRevert("Added new section on climate")).toBe(false);
  });
});
