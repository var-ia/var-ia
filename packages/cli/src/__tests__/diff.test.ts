import { describe, it, expect, vi } from "vitest";

vi.mock("../commands/cache.js", () => ({
  loadCachedRevisions: vi.fn(() => []),
  saveRevisions: vi.fn(),
}));

import { runDiff } from "../commands/diff.js";

const EN_WIKI = "https://en.wikipedia.org/w/api.php";

describe("diff command", () => {
  it(
    "self-diff produces zero differences",
    async () => {
      const result = await runDiff("Earth", EN_WIKI, EN_WIKI, "brief");

      const { totalEventsA, totalEventsB, eventTypeDiffs } = result.comparison;

      expect(totalEventsA).toBe(totalEventsB);

      for (const d of eventTypeDiffs) {
        expect(d.diff).toBe(0);
      }
    },
    { timeout: 120000 },
  );

  it(
    "runs without error for same wiki self-diff",
    async () => {
      const result = await runDiff("Earth", EN_WIKI, EN_WIKI, "brief");

      expect(result.pageTitle).toBe("Earth");
      expect(result.wikiA.url).toBe(EN_WIKI);
      expect(result.wikiB.url).toBe(EN_WIKI);
      expect(result.generatedAt).toBeTruthy();
    },
    { timeout: 120000 },
  );
});
