import { describe, it, expect } from "vitest";
import { classifyHeuristic } from "../heuristic-classifier.js";

describe("classifyHeuristic", () => {
  it("classifies revert patterns in comment", () => {
    expect(classifyHeuristic("reverted edit", 100)).toBe("revert");
    expect(classifyHeuristic("Undid revision 12345", 50)).toBe("revert");
    expect(classifyHeuristic("Rollback vandalism", -300)).toBe("revert");
    expect(classifyHeuristic("rvv nonsense", 0)).toBe("revert");
  });

  it("prioritizes revert over vandalism when both match", () => {
    expect(classifyHeuristic("Revert vandalism", -500)).toBe("revert");
  });

  it("classifies vandalism patterns in comment", () => {
    expect(classifyHeuristic("vandal", 100)).toBe("vandalism");
    expect(classifyHeuristic("spam removal", -200)).toBe("vandalism");
    expect(classifyHeuristic("blanking section", -1000)).toBe("vandalism");
    expect(classifyHeuristic("test edit", 10)).toBe("vandalism");
  });

  it("classifies sourcing patterns in comment", () => {
    expect(classifyHeuristic("added citation", 500)).toBe("sourcing");
    expect(classifyHeuristic("add ref", 100)).toBe("sourcing");
    expect(classifyHeuristic("rm bad source", -200)).toBe("sourcing");
    expect(classifyHeuristic("cite web", 0)).toBe("sourcing");
  });

  it("classifies major additions by size", () => {
    expect(classifyHeuristic("update", 2500)).toBe("major_addition");
    expect(classifyHeuristic("expanded section", 5000)).toBe("major_addition");
  });

  it("classifies major removals by size", () => {
    expect(classifyHeuristic("trim", -2500)).toBe("major_removal");
    expect(classifyHeuristic("cleanup", -10000)).toBe("major_removal");
  });

  it("classifies cosmetic edits (small delta, empty comment)", () => {
    expect(classifyHeuristic("", 10)).toBe("cosmetic");
    expect(classifyHeuristic("", 0)).toBe("cosmetic");
    expect(classifyHeuristic("", 19)).toBe("cosmetic");
  });

  it("classifies minor edits by size delta", () => {
    expect(classifyHeuristic("fix typo", 50)).toBe("minor");
    expect(classifyHeuristic("tweak", 99)).toBe("minor");
  });

  it("returns unknown for unmatched edits", () => {
    expect(classifyHeuristic("meaningful edit", 500)).toBe("unknown");
    expect(classifyHeuristic("", 1000)).toBe("unknown");
  });

  it("respects custom thresholds", () => {
    expect(classifyHeuristic("big edit", 1500, { majorAdditionThreshold: 1000 })).toBe("major_addition");
    expect(classifyHeuristic("", 50, { cosmeticThreshold: 100 })).toBe("cosmetic");
    expect(classifyHeuristic("tweak", 200, { minorThreshold: 300 })).toBe("minor");
  });


  it("is case-insensitive for comment matching", () => {
    expect(classifyHeuristic("REVERT", 0)).toBe("revert");
    expect(classifyHeuristic("CITATION ADDED", 100)).toBe("sourcing");
    expect(classifyHeuristic("VANDAL", 0)).toBe("vandalism");
  });
});
