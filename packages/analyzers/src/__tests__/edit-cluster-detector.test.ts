import type { Revision } from "@var-ia/evidence-graph";
import { describe, expect, it } from "vitest";
import { detectEditClusters } from "../edit-cluster-detector.js";

function makeRev(revId: number, timestamp: string, user?: string): Revision {
  return {
    revId,
    title: "Test Page",
    timestamp,
    user: user ?? "Editor",
    comment: "",
    content: "",
  };
}

describe("detectEditClusters", () => {
  it("returns empty for fewer than min cluster size revisions", () => {
    const revs = [makeRev(1, "2024-01-01T00:00:00Z")];
    const events = detectEditClusters(revs);
    expect(events).toHaveLength(0);
  });

  it("detects a cluster of 3 rapid edits within 1 hour", () => {
    const revs = [
      makeRev(1, "2024-01-01T00:00:00Z"),
      makeRev(2, "2024-01-01T00:10:00Z"),
      makeRev(3, "2024-01-01T00:20:00Z"),
    ];
    const events = detectEditClusters(revs, { windowMs: 60 * 60 * 1000 });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("edit_cluster_detected");
    expect(events[0].fromRevisionId).toBe(1);
    expect(events[0].toRevisionId).toBe(3);
  });

  it("does not cluster edits outside the window", () => {
    const revs = [
      makeRev(1, "2024-01-01T00:00:00Z"),
      makeRev(2, "2024-01-01T02:00:00Z"),
      makeRev(3, "2024-01-01T04:00:00Z"),
    ];
    const events = detectEditClusters(revs, { windowMs: 60 * 60 * 1000 });
    expect(events).toHaveLength(0);
  });

  it("detects single-editor cluster", () => {
    const revs = [
      makeRev(1, "2024-01-01T00:00:00Z", "Alice"),
      makeRev(2, "2024-01-01T00:05:00Z", "Alice"),
      makeRev(3, "2024-01-01T00:10:00Z", "Alice"),
    ];
    const events = detectEditClusters(revs, { windowMs: 60 * 60 * 1000 });
    expect(events).toHaveLength(1);
    expect(events[0].deterministicFacts[0].detail).toContain("single_editor=true");
  });

  it("detects multi-editor cluster", () => {
    const revs = [
      makeRev(1, "2024-01-01T00:00:00Z", "Alice"),
      makeRev(2, "2024-01-01T00:05:00Z", "Bob"),
      makeRev(3, "2024-01-01T00:10:00Z", "Charlie"),
    ];
    const events = detectEditClusters(revs, { windowMs: 60 * 60 * 1000 });
    expect(events).toHaveLength(1);
    expect(events[0].deterministicFacts[0].detail).toContain("single_editor=false");
  });

  it("respects custom min cluster size", () => {
    const revs = [
      makeRev(1, "2024-01-01T00:00:00Z"),
      makeRev(2, "2024-01-01T00:01:00Z"),
      makeRev(3, "2024-01-01T00:02:00Z"),
      makeRev(4, "2024-01-01T00:03:00Z"),
      makeRev(5, "2024-01-01T00:04:00Z"),
    ];
    const events = detectEditClusters(revs, { minClusterSize: 5, windowMs: 60 * 60 * 1000 });
    expect(events).toHaveLength(1);
  });
});
