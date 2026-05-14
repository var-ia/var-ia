export type { ClaimIdentity, ClaimLineage, ClaimState, ClaimObject, PropositionType } from "./schemas/claim.js";
export type { EvidenceEvent, DeterministicFact, FactProvenance, PolicyDimension, ModelInterpretation, EvidenceLayer } from "./schemas/evidence.js";
export type { SourceRecord, SourceLineage, SourceReplacement, SourceType, SourceAuthority } from "./schemas/source.js";
export type { Report, ReportLayer, ReportLayerLabel, ExportFormat, Depth, PageTimeline, TimelineEvent, PolicySignal } from "./schemas/report.js";
export type { Revision, DiffResult, DiffLine, Section, SectionChange } from "./schemas/revision.js";
export { createClaimIdentity, createEventIdentity } from "./hash-identity.js";
export { createReplayManifest, buildMerkleTree, getMerkleProof, verifyMerkleProof, singleEventProof } from "./replay-manifest.js";
export type { ReplayManifest, MerkleProof } from "./replay-manifest.js";
