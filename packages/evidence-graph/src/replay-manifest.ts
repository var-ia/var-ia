import { createHash } from "node:crypto";
import { createEventIdentity } from "./hash-identity.js";
import type { EvidenceEvent } from "./schemas/evidence.js";
import type { Revision } from "./schemas/revision.js";

export interface ReplayManifest {
  format: "varia-replay-manifest/v1";
  generatedAt: string;
  pageTitle: string;
  analyzerVersions: Record<string, string>;
  inputRevisionHashes: string[];
  outputEventHashes: string[];
  manifestHash: string;
}

export function createReplayManifest(params: {
  pageTitle: string;
  analyzerVersions: Record<string, string>;
  revisions: Revision[];
  events: EvidenceEvent[];
}): ReplayManifest {
  const inputHashes = params.revisions.map((r) =>
    createHash("sha256").update(r.content).digest("hex"),
  );

  const outputHashes = params.events.map((e) =>
    e.eventId ?? createEventIdentity(e),
  );

  const partial = {
    format: "varia-replay-manifest/v1" as const,
    generatedAt: new Date().toISOString(),
    pageTitle: params.pageTitle,
    analyzerVersions: params.analyzerVersions,
    inputRevisionHashes: inputHashes,
    outputEventHashes: outputHashes,
  };

  const manifestHash = createHash("sha256")
    .update(JSON.stringify(partial))
    .digest("hex");

  return { ...partial, manifestHash };
}
