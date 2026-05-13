import type { Revision, DiffResult } from "@varia/evidence-graph";

export interface RevisionFetcher {
  fetchRevisions(pageTitle: string, options?: RevisionOptions): Promise<Revision[]>;
}

export interface DiffFetcher {
  fetchDiff(fromRevId: number, toRevId: number): Promise<DiffResult>;
}

export interface RevisionOptions {
  limit?: number;
  start?: Date;
  end?: Date;
  direction?: "newer" | "older";
}

export { MediaWikiClient } from "./mediawiki-client.js";
export { RateLimiter } from "./rate-limiter.js";
