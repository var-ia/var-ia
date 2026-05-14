import type { EvidenceEvent } from "@var-ia/evidence-graph";
import { describe, expect, it } from "vitest";
import { diffObservations } from "../observation-differ.js";

function makeEvent(eventType: string, fromRevId: number, toRevId: number, section = "body"): EvidenceEvent {
  return {
    eventType: eventType as EvidenceEvent["eventType"],
    fromRevisionId: fromRevId,
    toRevisionId: toRevId,
    section,
    before: "",
    after: "",
    deterministicFacts: [],
    layer: "observed",
    timestamp: "2026-01-01T00:00:00Z",
  };
}

describe("diffObservations", () => {
  it("returns zero delta for identical streams", () => {
    const prior = [makeEvent("revert_detected", 1, 2)];
    const current = [makeEvent("revert_detected", 1, 2)];

    const diff = diffObservations(prior, current);
    expect(diff.new).toHaveLength(0);
    expect(diff.resolved).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(1);
  });

  it("detects new events in current stream", () => {
    const prior = [makeEvent("revert_detected", 1, 2)];
    const current = [makeEvent("revert_detected", 1, 2), makeEvent("citation_added", 2, 3)];

    const diff = diffObservations(prior, current);
    expect(diff.new).toHaveLength(1);
    expect(diff.new[0].eventType).toBe("citation_added");
    expect(diff.resolved).toHaveLength(0);
  });

  it("detects resolved events when prior has them and current does not", () => {
    const prior = [makeEvent("revert_detected", 1, 2), makeEvent("template_added", 2, 3)];
    const current = [makeEvent("revert_detected", 1, 2)];

    const diff = diffObservations(prior, current);
    expect(diff.resolved).toHaveLength(1);
    expect(diff.resolved[0].eventType).toBe("template_added");
    expect(diff.new).toHaveLength(0);
  });

  it("handles empty prior stream (first run)", () => {
    const current = [makeEvent("revert_detected", 1, 2)];

    const diff = diffObservations([], current);
    expect(diff.new).toHaveLength(1);
    expect(diff.resolved).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(0);
  });
});
