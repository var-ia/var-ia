import { describe, it, expect } from "vitest";
import { createClaimIdentity } from "../hash-identity.js";

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
