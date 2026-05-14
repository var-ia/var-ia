import { describe, it, expect } from "vitest";
import { revertDetector } from "../revert-detector.js";
import type { Revision } from "@var-ia/evidence-graph";

function makeRev(revId: number, comment: string, content = ""): Revision {
  return {
    revId,
    pageId: 1,
    pageTitle: "Test",
    timestamp: new Date(Date.UTC(2026, 0, revId)).toISOString(),
    comment,
    content,
    size: 100,
    minor: false,
  };
}

describe("isRevert", () => {
  it("detects 'revert' in comment", () => {
    expect(revertDetector.isRevert("reverted vandalism")).toBe(true);
  });

  it("detects 'undid revision' in comment", () => {
    expect(revertDetector.isRevert("Undid revision 12345 by User")).toBe(true);
  });

  it("detects 'rvv' in comment", () => {
    expect(revertDetector.isRevert("rvv nonsense")).toBe(true);
  });

  it("detects 'rollback' in comment", () => {
    expect(revertDetector.isRevert("Rollback vandalism")).toBe(true);
  });

  it("detects 'restore' in comment", () => {
    expect(revertDetector.isRevert("Restore previous version")).toBe(true);
  });

  it("detects '[[WP:ROLLBACK]]' in comment", () => {
    expect(revertDetector.isRevert("[[WP:ROLLBACK]] vandalism")).toBe(true);
  });

  it("returns false for non-revert comments", () => {
    expect(revertDetector.isRevert("added citation")).toBe(false);
    expect(revertDetector.isRevert("fixed typo")).toBe(false);
    expect(revertDetector.isRevert("expanded section")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(revertDetector.isRevert("REVERT")).toBe(true);
    expect(revertDetector.isRevert("Reverted")).toBe(true);
  });
});

describe("detectRevertChain", () => {
  it("detects a single revert edit", () => {
    const revs = [
      makeRev(1, "added content"),
      makeRev(2, "reverted"),
    ];
    const chains = revertDetector.detectRevertChain(revs);
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for no reverts", () => {
    const revs = [
      makeRev(1, "added content"),
      makeRev(2, "fixed typo"),
      makeRev(3, "expanded"),
    ];
    expect(revertDetector.detectRevertChain(revs)).toEqual([]);
  });

  it("detects a multi-edit revert chain", () => {
    const revs = [
      makeRev(1, "good edit"),
      makeRev(2, "revert"),
      makeRev(3, "re-revert"),
    ];
    const chains = revertDetector.detectRevertChain(revs);
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for empty revision list", () => {
    expect(revertDetector.detectRevertChain([])).toEqual([]);
  });
});
