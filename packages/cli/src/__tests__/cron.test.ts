import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../commands/analyze.js", () => ({
  runAnalyze: vi.fn(),
}));

import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { runAnalyze } from "../commands/analyze.js";
import { runCron } from "../commands/cron.js";

function makeEvent(overrides: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return {
    eventType: "sentence_first_seen",
    fromRevisionId: 1,
    toRevisionId: 2,
    section: "lead",
    before: "",
    after: "Earth is a planet",
    deterministicFacts: [],
    layer: "observed",
    timestamp: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("cron command", () => {
  it("processes pages file and returns reports", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\nMars\n", "utf-8");

    vi.mocked(runAnalyze).mockResolvedValue({ events: [makeEvent()], revisions: [] });

    const result = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(result.pagesProcessed).toBe(2);
    expect(result.totalNewEvents).toBe(0);
    expect(result.reports).toHaveLength(2);
    expect(result.reports[0].pageTitle).toBe("Earth");
    expect(result.reports[0].deltaSummary).toBe("baseline established");
    expect(result.reports[1].pageTitle).toBe("Mars");
    expect(result.generatedAt).toBeTruthy();

    expect(existsSync(join(tmpDir, "reports", "Earth.json"))).toBe(true);
    expect(existsSync(join(tmpDir, "reports", "Mars.json"))).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports new events when prior observation exists", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");

    const priorEvent = makeEvent({ timestamp: "2023-12-01T00:00:00Z" });
    const obsDir = join(tmpDir, "observations");
    mkdirSync(obsDir, { recursive: true });
    writeFileSync(join(obsDir, "Earth.json"), JSON.stringify([priorEvent], null, 2));

    const newEvent = makeEvent({
      eventType: "revert_detected",
      fromRevisionId: 3,
      toRevisionId: 4,
      timestamp: "2024-01-15T00:00:00Z",
    });
    vi.mocked(runAnalyze).mockResolvedValue({ events: [priorEvent, newEvent], revisions: [] });

    const result = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(result.totalNewEvents).toBe(1);
    expect(result.reports[0].eventsNew).toBe(1);
    expect(result.reports[0].eventsResolved).toBe(0);
    expect(result.reports[0].deltaSummary).toContain("1 new");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports no changes when events are unchanged", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");

    const event = makeEvent();
    const obsDir = join(tmpDir, "observations");
    mkdirSync(obsDir, { recursive: true });
    writeFileSync(join(obsDir, "Earth.json"), JSON.stringify([event], null, 2));

    vi.mocked(runAnalyze).mockResolvedValue({ events: [event], revisions: [] });

    const result = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(result.totalNewEvents).toBe(0);
    expect(result.reports[0].eventsNew).toBe(0);
    expect(result.reports[0].deltaSummary).toBe("no changes");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles interval-based lookback", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");

    vi.mocked(runAnalyze).mockResolvedValue({ events: [makeEvent()], revisions: [] });

    const result = await runCron(pagesFile, 48, undefined, tmpDir);

    expect(result.pagesProcessed).toBe(1);
    expect(result.totalNewEvents).toBe(0);
    expect(result.reports[0].deltaSummary).toBe("baseline established");
    expect(runAnalyze).toHaveBeenCalledWith(
      "Earth",
      "detailed",
      undefined,
      undefined,
      expect.stringMatching(/^202/),
      false,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips comment lines in pages file", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "# This is a comment\nEarth\n\nMars\n", "utf-8");

    vi.mocked(runAnalyze).mockResolvedValue({ events: [makeEvent()], revisions: [] });

    const result = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(result.pagesProcessed).toBe(2);
    expect(result.totalNewEvents).toBe(0);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
