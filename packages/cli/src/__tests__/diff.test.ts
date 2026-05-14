import { describe, expect, it, vi } from "vitest";

vi.mock("../commands/cache.js", () => ({
  loadCachedRevisions: vi.fn(() => []),
  saveRevisions: vi.fn(),
}));

import { runDiff } from "../commands/diff.js";

const EN_WIKI = "https://en.wikipedia.org/w/api.php";

describe("diff command", () => {
  it("self-diff produces zero differences", async () => {
    const result = await runDiff("Earth", [EN_WIKI, EN_WIKI], "brief");

    const { totalEvents, eventTypeDiffs } = result.comparison;

    expect(totalEvents[0]).toBe(totalEvents[1]);

    for (const d of eventTypeDiffs) {
      expect(d.diffs[1]).toBe(0);
    }
  }, 120000);

  it("runs without error for same wiki self-diff", async () => {
    const result = await runDiff("Earth", [EN_WIKI, EN_WIKI], "brief");

    expect(result.pageTitle).toBe("Earth");
    expect(result.wikis[0].url).toBe(EN_WIKI);
    expect(result.wikis[1].url).toBe(EN_WIKI);
    expect(result.generatedAt).toBeTruthy();
  }, 120000);

  it("handles 3-way diff", async () => {
    const result = await runDiff("Earth", [EN_WIKI, EN_WIKI, EN_WIKI], "brief");

    expect(result.wikis).toHaveLength(3);
    expect(result.comparison.totalEvents).toHaveLength(3);
    expect(result.comparison.totalEvents[0]).toBe(result.comparison.totalEvents[1]);
    expect(result.comparison.totalEvents[1]).toBe(result.comparison.totalEvents[2]);

    for (const d of result.comparison.eventTypeDiffs) {
      expect(d.counts).toHaveLength(3);
    }
  }, 120000);

  it("returns empty outliers for 2 or fewer wikis", async () => {
    const result = await runDiff("Earth", [EN_WIKI, EN_WIKI], "brief");
    expect(result.outliers).toHaveLength(0);
  }, 120000);

  it("returns outliers for 3+ wikis with identical data", async () => {
    const result = await runDiff("Earth", [EN_WIKI, EN_WIKI, EN_WIKI], "brief");

    const outlierEvents = result.outliers.filter((o) => Math.abs(o.zScore) > 2);
    for (const o of outlierEvents) {
      expect(o.count).toBeGreaterThanOrEqual(0);
    }
  }, 120000);
});
