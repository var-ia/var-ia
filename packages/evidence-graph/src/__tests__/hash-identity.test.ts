import { describe, expect, it } from "vitest";
import { createClaimIdentity, createEventIdentity } from "../hash-identity.js";
import type { EvidenceEvent } from "../schemas/evidence.js";

describe("Claim identity hash", () => {
  it("produces deterministic hash from same inputs", () => {
    const a = createClaimIdentity({
      text: "The sky is blue",
      section: "Introduction",
      pageTitle: "Color",
      pageId: 12345,
    });
    const b = createClaimIdentity({
      text: "The sky is blue",
      section: "Introduction",
      pageTitle: "Color",
      pageId: 12345,
    });
    expect(a.claimId).toBe(b.claimId);
    expect(a.identityKey).toBe(b.identityKey);
  });

  it("produces different hash for different text", () => {
    const a = createClaimIdentity({
      text: "The sky is blue",
      section: "Introduction",
      pageTitle: "Color",
      pageId: 12345,
    });
    const b = createClaimIdentity({
      text: "The sky is green",
      section: "Introduction",
      pageTitle: "Color",
      pageId: 12345,
    });
    expect(a.claimId).not.toBe(b.claimId);
  });

  it("produces different hash for different sections", () => {
    const a = createClaimIdentity({
      text: "The sky is blue",
      section: "Introduction",
      pageTitle: "Color",
      pageId: 12345,
    });
    const b = createClaimIdentity({
      text: "The sky is blue",
      section: "Discussion",
      pageTitle: "Color",
      pageId: 12345,
    });
    expect(a.claimId).not.toBe(b.claimId);
  });

  it("normalizes whitespace and case", () => {
    const a = createClaimIdentity({
      text: "  The Sky Is Blue  ",
      section: "Introduction",
      pageTitle: "Color",
      pageId: 12345,
    });
    const b = createClaimIdentity({
      text: "the sky is blue",
      section: "Introduction",
      pageTitle: "Color",
      pageId: 12345,
    });
    expect(a.claimId).toBe(b.claimId);
  });

  it("claimId is 16 hex characters", () => {
    const id = createClaimIdentity({
      text: "test",
      section: "test",
      pageTitle: "Test",
      pageId: 1,
    });
    expect(id.claimId).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("createEventIdentity", () => {
  const base: Omit<EvidenceEvent, "eventId" | "modelInterpretation"> = {
    eventType: "revert_detected",
    fromRevisionId: 1,
    toRevisionId: 2,
    section: "body",
    before: "",
    after: "reverted",
    deterministicFacts: [{ fact: "test" }],
    layer: "observed",
    timestamp: "2026-01-01T00:00:00Z",
  };

  it("produces a deterministic 16-char hex hash", () => {
    const id = createEventIdentity(base);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for same input", () => {
    const a = createEventIdentity(base);
    const b = createEventIdentity(base);
    expect(a).toBe(b);
  });

  it("differs for different event types", () => {
    const a = createEventIdentity({ ...base, eventType: "claim_removed" });
    const b = createEventIdentity(base);
    expect(a).not.toBe(b);
  });
});
