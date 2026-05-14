import { createHash } from "node:crypto";
import type { ClaimIdentity } from "./schemas/claim.js";
import type { EvidenceEvent } from "./schemas/evidence.js";

export function createClaimIdentity(params: {
  text: string;
  section: string;
  pageTitle: string;
  pageId: number;
}): ClaimIdentity {
  const identityKey = `${params.pageTitle}|${params.pageId}|${params.section}|${params.text.toLowerCase().trim()}`;
  const claimId = createHash("sha256").update(identityKey).digest("hex").slice(0, 16);
  return {
    claimId,
    identityKey,
    pageTitle: params.pageTitle,
    pageId: params.pageId,
  };
}

export function createEventIdentity(event: Omit<EvidenceEvent, "eventId" | "modelInterpretation">): string {
  const factsStr = event.deterministicFacts.map((f) => `${f.fact}:${f.detail ?? ""}`).join("|");
  const identityKey = `${event.eventType}|${event.fromRevisionId}|${event.toRevisionId}|${event.section}|${event.before}|${event.after}|${event.timestamp}|${factsStr}`;
  return createHash("sha256").update(identityKey).digest("hex").slice(0, 16);
}
