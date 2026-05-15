import { describe, expect, it, vi } from "vitest";

vi.mock("../commands/analyze.js", () => ({
  runAnalyze: vi.fn(),
}));

import type { EvidenceEvent, Revision } from "@var-ia/evidence-graph";
import { runAnalyze } from "../commands/analyze.js";
import { runVisualize } from "../commands/visualize.js";

function makeRev(id: number, ts: string): Revision {
  return { revId: id, pageId: 1, pageTitle: "Earth", timestamp: ts, comment: "", content: "", size: 100, minor: false };
}

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
    timestamp: "2024-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("visualize command", () => {
  it("generates mermaid output for claim events", async () => {
    const revisions = [makeRev(1, "2024-01-01T00:00:00Z"), makeRev(2, "2024-01-02T00:00:00Z")];
    const events = [makeEvent()];
    vi.mocked(runAnalyze).mockResolvedValue({ events, revisions });

    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s) => output.push(s));

    await runVisualize("Earth", "mermaid");

    const result = output.join("\n");
    expect(result).toContain("graph LR");
    expect(result).toContain("rev 1");
    expect(result).toContain("rev 2");
    expect(result).toContain("sentence_first_seen");
  });

  it("generates dot output", async () => {
    const revisions = [makeRev(1, "2024-01-01T00:00:00Z"), makeRev(2, "2024-01-02T00:00:00Z")];
    const events = [makeEvent()];
    vi.mocked(runAnalyze).mockResolvedValue({ events, revisions });

    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s) => output.push(s));

    await runVisualize("Earth", "dot");

    const result = output.join("\n");
    expect(result).toContain("digraph");
    expect(result).toContain("rankdir=LR");
    expect(result).toContain("rev_1");
    expect(result).toContain("rev_2");
  });

  it("shows all events with --all flag", async () => {
    const revisions = [makeRev(1, "2024-01-01T00:00:00Z"), makeRev(2, "2024-01-02T00:00:00Z")];
    const events = [makeEvent({ eventType: "citation_added" }), makeEvent({ eventType: "revert_detected" })];
    vi.mocked(runAnalyze).mockResolvedValue({ events, revisions });

    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s) => output.push(s));

    await runVisualize("Earth", "mermaid", true);

    const result = output.join("\n");
    expect(result).toContain("citation_added");
    expect(result).toContain("revert_detected");
  });

  it("shows only claim events by default", async () => {
    const revisions = [makeRev(1, "2024-01-01T00:00:00Z"), makeRev(2, "2024-01-02T00:00:00Z")];
    const events = [makeEvent({ eventType: "citation_added" }), makeEvent({ eventType: "sentence_first_seen" })];
    vi.mocked(runAnalyze).mockResolvedValue({ events, revisions });

    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s) => output.push(s));

    await runVisualize("Earth", "mermaid");

    const result = output.join("\n");
    expect(result).toContain("sentence_first_seen");
    expect(result).not.toContain("citation_added");
  });

  it("handles no events gracefully", async () => {
    vi.mocked(runAnalyze).mockResolvedValue({ events: [], revisions: [] });

    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s) => output.push(s));

    await runVisualize("Earth", "mermaid");
    expect(output.join("\n")).toContain("No events");
  });
});
