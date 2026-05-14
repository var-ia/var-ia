import { describe, expect, it, vi } from "vitest";

vi.mock("../commands/cache.js", () => ({
  loadCachedRevisions: vi.fn(() => []),
  saveRevisions: vi.fn(),
}));

import { classifyClaimChange } from "@var-ia/analyzers";

const DE_WIKI = "https://de.wikipedia.org/w/api.php";
const FR_WIKI = "https://fr.wikipedia.org/w/api.php";
const JA_WIKI = "https://ja.wikipedia.org/w/api.php";
const AR_WIKI = "https://ar.wikipedia.org/w/api.php";

describe("cross-language claim classification", () => {
  it("detects German hedging", () => {
    const result = classifyClaimChange(
      "Die Erde ist der dritte Planet.",
      "Die Erde ist angeblich der dritte Planet.",
    );
    expect(result).toBe("softened");
  });

  it("detects German certainty", () => {
    const result = classifyClaimChange(
      "Die Erde ist angeblich der dritte Planet.",
      "Die Erde ist zweifellos der dritte Planet.",
    );
    expect(result).toBe("strengthened");
  });

  it("detects French hedging", () => {
    const result = classifyClaimChange(
      "La Terre est la troisième planète.",
      "La Terre serait la troisième planète.",
    );
    expect(result).toBe("softened");
  });

  it("detects French certainty", () => {
    const result = classifyClaimChange(
      "La Terre serait la troisième planète.",
      "La Terre est incontestablement la troisième planète.",
    );
    expect(result).toBe("strengthened");
  });

  it("detects Japanese hedging", () => {
    const result = classifyClaimChange(
      "地球は太陽から三番目の惑星です。",
      "地球は太陽から三番目の惑星かもしれない。",
    );
    expect(result).toBe("softened");
  });

  it("detects Japanese certainty", () => {
    const result = classifyClaimChange(
      "地球は太陽から三番目の惑星かもしれない。",
      "地球は太陽から三番目の惑星であることは確かです。",
    );
    expect(result).toBe("strengthened");
  });

  it("detects Arabic hedging", () => {
    const result = classifyClaimChange(
      "الأرض هي الكوكب الثالث.",
      "ربما الأرض هي الكوكب الثالث.",
    );
    expect(result).toBe("softened");
  });

  it("detects Arabic certainty", () => {
    const result = classifyClaimChange(
      "ربما الأرض هي الكوكب الثالث.",
      "بالتأكيد الأرض هي الكوكب الثالث.",
    );
    expect(result).toBe("strengthened");
  });

  it("detects sentence splits across languages", () => {
    const split = /(?:[.!?]\s+|[。！？؟]\s*)/;

    const eng = "Hello world. Next sentence.";
    expect(eng.split(split).filter(Boolean).length).toBeGreaterThanOrEqual(2);

    const jpn = "地球は惑星。太陽の周り。第三番目。";
    expect(jpn.split(split).filter(Boolean).length).toBeGreaterThanOrEqual(3);

    const ara = "الأرض كوكب. الشمس نجم.";
    expect(ara.split(split).filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });
});

describe("cross-language integration (live API)", () => {
  it("German Wikipedia produces events", async () => {
    const { runAnalyze } = await import("../commands/analyze.js");
    const { events } = await runAnalyze("Erde", "brief", undefined, undefined, undefined, false, undefined, DE_WIKI);
    expect(events.length).toBeGreaterThan(0);
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain("section_reorganized");
  }, 60000);

  it("French Wikipedia produces events", async () => {
    const { runAnalyze } = await import("../commands/analyze.js");
    const { events } = await runAnalyze("Terre", "brief", undefined, undefined, undefined, false, undefined, FR_WIKI);
    expect(events.length).toBeGreaterThan(0);
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain("section_reorganized");
  }, 60000);

  it("Japanese Wikipedia produces events", async () => {
    const { runAnalyze } = await import("../commands/analyze.js");
    const { events } = await runAnalyze("地球", "brief", undefined, undefined, undefined, false, undefined, JA_WIKI);
    expect(events.length).toBeGreaterThan(0);
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain("section_reorganized");
  }, 60000);

  it("Arabic Wikipedia produces events", async () => {
    const { runAnalyze } = await import("../commands/analyze.js");
    const { events } = await runAnalyze("الأرض", "brief", undefined, undefined, undefined, false, undefined, AR_WIKI);
    expect(events.length).toBeGreaterThan(0);
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain("section_reorganized");
  }, 60000);
});
