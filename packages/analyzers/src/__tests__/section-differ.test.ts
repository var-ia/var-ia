import { buildSectionLineage } from "../section-differ.js";
import { describe, it, expect } from "vitest";

describe("buildSectionLineage", () => {
  it("tracks section creation and modification across revisions", () => {
    const revisions = [
      { revId: 1, timestamp: "2024-01-01T00:00:00Z", content: "Lead content" },
      { revId: 2, timestamp: "2024-01-02T00:00:00Z", content: "Lead content\n\n== History ==\nOld history" },
      { revId: 3, timestamp: "2024-01-03T00:00:00Z", content: "Lead content\n\n== History ==\nNew history text" },
    ];

    const lineage = buildSectionLineage(revisions);
    expect(lineage.length).toBeGreaterThan(0);

    const history = lineage.find(l => l.sectionName === "History");
    expect(history).toBeDefined();
    expect(history!.firstSeenRevisionId).toBe(2);
    expect(history!.events.length).toBeGreaterThanOrEqual(2);
    expect(history!.isActive).toBe(true);
  });

  it("detects section removal", () => {
    const revisions = [
      { revId: 1, timestamp: "2024-01-01T00:00:00Z", content: "Lead\n\n== A ==\nContent A\n\n== B ==\nContent B" },
      { revId: 2, timestamp: "2024-01-02T00:00:00Z", content: "Lead\n\n== A ==\nContent A" },
    ];

    const lineage = buildSectionLineage(revisions);
    const removedB = lineage.find(l => l.sectionName === "B");
    expect(removedB).toBeDefined();
    expect(removedB!.isActive).toBe(false);
    expect(removedB!.events.some(e => e.eventType === "removed")).toBe(true);
  });

  it("returns empty array for no revisions", () => {
    expect(buildSectionLineage([])).toEqual([]);
  });

  it("detects renamed sections", () => {
    const revisions = [
      { revId: 1, timestamp: "2024-01-01T00:00:00Z", content: "Lead\n\n== History ==\nSame content" },
      { revId: 2, timestamp: "2024-01-02T00:00:00Z", content: "Lead\n\n== Background ==\nSame content" },
    ];

    const lineage = buildSectionLineage(revisions);
    const renamed = lineage.find(l => l.sectionName === "Background");
    expect(renamed).toBeDefined();
    expect(renamed!.events.some(e => e.eventType === "renamed")).toBe(true);
    expect(renamed!.firstSeenRevisionId).toBe(1);
  });

  it("sorts lineages by section name", () => {
    const revisions = [
      { revId: 1, timestamp: "2024-01-01T00:00:00Z", content: "Lead\n\n== Z ==\nZ content\n\n== A ==\nA content" },
    ];

    const lineage = buildSectionLineage(revisions);
    expect(lineage[0].sectionName).toBe("(lead)");
    expect(lineage[1].sectionName).toBe("A");
    expect(lineage[2].sectionName).toBe("Z");
  });
});
