import { createHash } from "node:crypto";
import type { ClaimIdentity } from "./schemas/claim.js";

export function createClaimIdentity(params: {
  text: string;
  section: string;
  pageTitle: string;
  pageId: number;
}): ClaimIdentity {
  const identityKey = `${params.pageTitle}|${params.pageId}|${params.section}|${params.text.toLowerCase().trim()}`;
  const claimId = createHash("sha256")
    .update(identityKey)
    .digest("hex")
    .slice(0, 16);
  return {
    claimId,
    identityKey,
    pageTitle: params.pageTitle,
    pageId: params.pageId,
  };
}
