import { describe, expect, it } from "vitest";
import { classifyClaimChange } from "../claim-differ.js";

describe("classifyClaimChange", () => {
  it("softened: hedging language added", () => {
    const result = classifyClaimChange("X was found to be Y", "X may be Y");
    expect(result).toBe("softened");
  });

  it("strengthened: certainty language added", () => {
    const result = classifyClaimChange("X may be Y", "X is confirmed to be Y");
    expect(result).toBe("strengthened");
  });

  it("moved: same text, different section", () => {
    const result = classifyClaimChange("X is Y", "X is Y", "Background", "Criticism");
    expect(result).toBe("moved");
  });

  it("reworded: no direction markers", () => {
    const result = classifyClaimChange("X is Y", "X was Y");
    expect(result).toBe("reworded");
  });

  it("reworded: identical text same section", () => {
    const result = classifyClaimChange("X is Y", "X is Y", "Lead", "Lead");
    expect(result).toBe("reworded");
  });

  it("softened: certainty removed", () => {
    const result = classifyClaimChange("X is definitively Y", "X may be Y");
    expect(result).toBe("softened");
  });

  it("strengthened: hedging removed", () => {
    const result = classifyClaimChange("X may be Y", "X is Y");
    expect(result).toBe("strengthened");
  });

  it("softened: hedging added with reportedly", () => {
    const result = classifyClaimChange("X is Y", "X is reportedly Y");
    expect(result).toBe("softened");
  });

  it("strengthened: hedging replaced with certainty", () => {
    const result = classifyClaimChange("X reportedly may be Y", "X is demonstrated to be Y");
    expect(result).toBe("strengthened");
  });

  it("prioritizes moved over softened when section differs", () => {
    const result = classifyClaimChange("X is definitively Y", "X may be Y", "Lead", "Criticism");
    expect(result).toBe("moved");
  });
});
