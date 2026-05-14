import type { Revision, DiffResult, DiffLine } from "@var-ia/evidence-graph";
import type { RevisionFetcher, RevisionSource, DiffFetcher, RevisionOptions } from "./index.js";
import { RateLimiter } from "./rate-limiter.js";

const DEFAULT_API_URL = "https://en.wikipedia.org/w/api.php";
const DEFAULT_USER_AGENT = "Varia/0.1.0 (https://github.com/anomalyco/varia; varia@anomaly.co)";
const MAX_REVISIONS_PER_REQUEST = 500;

interface PageInfo {
  pageId: number;
  title: string;
}

interface RawRevision {
  revid: number;
  parentid: number;
  timestamp: string;
  comment: string;
  size: number;
  minor?: boolean;
  slots?: {
    main?: {
      content?: string;
    };
  };
}

interface RevisionQueryResponse {
  query?: {
    pages?: Record<string, {
      pageid: number;
      title: string;
      revisions?: RawRevision[];
      missing?: string;
    }>;
  };
  continue?: {
    rvcontinue: string;
  };
}

interface CompareResponse {
  compare?: {
    fromrevid: number;
    torevid: number;
    fromsize: number;
    tosize: number;
    "*"?: string;
  };
}

export class MediaWikiClient implements RevisionFetcher, RevisionSource, DiffFetcher {
  private rateLimiter: RateLimiter;
  private userAgent: string;
  private apiUrl: string;

  constructor(options?: { apiUrl?: string; userAgent?: string; minDelayMs?: number }) {
    this.apiUrl = options?.apiUrl ?? DEFAULT_API_URL;
    this.userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
    this.rateLimiter = new RateLimiter(options?.minDelayMs ?? 100);
  }

  async fetchRevisions(pageTitle: string, options?: RevisionOptions): Promise<Revision[]> {
    const revisions: Revision[] = [];
    const limit = Math.min(options?.limit ?? MAX_REVISIONS_PER_REQUEST, MAX_REVISIONS_PER_REQUEST);
    let rvcontinue: string | undefined;

    let pageInfo: PageInfo | null = null;

    while (true) {
      const params = new URLSearchParams({
        action: "query",
        prop: "revisions",
        titles: pageTitle,
        rvprop: "content|ids|timestamp|flags|comment|size",
        rvslots: "main",
        rvlimit: String(limit),
        format: "json",
        formatversion: "2",
      });

      const isNewer = options?.direction === "newer";
      params.set("rvdir", isNewer ? "newer" : "older");

      if (options?.start && options?.end) {
        params.set("rvstart", formatTimestamp(isNewer ? options.start : options.end));
        params.set("rvend", formatTimestamp(isNewer ? options.end : options.start));
      } else if (options?.start) {
        params.set("rvstart", formatTimestamp(options.start));
      } else if (options?.end) {
        params.set("rvend", formatTimestamp(options.end));
      }
      if (options?.startRevId) {
        params.set("rvstartid", String(options.startRevId));
      }
      if (options?.endRevId) {
        params.set("rvendid", String(options.endRevId));
      }

      if (rvcontinue) {
        params.set("rvcontinue", rvcontinue);
      }

      const url = `${this.apiUrl}?${params.toString()}`;
      const response = await this.fetch(url);
      const data: RevisionQueryResponse = await response.json();

      if (!data.query?.pages) {
        break;
      }

      for (const page of Object.values(data.query.pages)) {
        if (page.missing) continue;
        if (!pageInfo) {
          pageInfo = { pageId: page.pageid, title: page.title };
        }
        if (page.revisions) {
          for (const rev of page.revisions) {
            revisions.push(this.mapRevision(rev, pageInfo!));
          }
        }
      }

      if (data.continue?.rvcontinue) {
        rvcontinue = data.continue.rvcontinue;
        if (revisions.length >= (options?.limit ?? MAX_REVISIONS_PER_REQUEST)) break;
      } else {
        break;
      }
    }

    return revisions;
  }

  async fetchDiff(fromRevId: number, toRevId: number): Promise<DiffResult> {
    const params = new URLSearchParams({
      action: "compare",
      fromrev: String(fromRevId),
      torev: String(toRevId),
      format: "json",
      formatversion: "2",
    });

    const url = `${this.apiUrl}?${params.toString()}`;
    const response = await this.fetch(url);
    const data: CompareResponse = await response.json();

    if (!data.compare) {
      throw new Error(`Failed to fetch diff for revisions ${fromRevId} -> ${toRevId}`);
    }

    const sizeDelta = data.compare.tosize - data.compare.fromsize;
    const lines = data.compare["*"] ? parseUnifiedDiff(data.compare["*"]) : [];

    return {
      fromRevId: data.compare.fromrevid,
      toRevId: data.compare.torevid,
      lines,
      sections: [],
      sizeDelta,
    };
  }

  private async fetch(url: string): Promise<Response> {
    await this.rateLimiter.acquire();
    const response = await fetch(url, {
      headers: {
        "User-Agent": this.userAgent,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`MediaWiki API error: ${response.status} ${response.statusText} for ${url}`);
    }

    return response;
  }

  async *revisions(pageTitle: string, options?: RevisionOptions): AsyncIterable<Revision> {
    const revs = await this.fetchRevisions(pageTitle, options);
    for (const rev of revs) {
      yield rev;
    }
  }

  private mapRevision(raw: RawRevision, page: PageInfo): Revision {
    const content = raw.slots?.main?.content ?? "";
    return {
      revId: raw.revid,
      pageId: page.pageId,
      pageTitle: page.title,
      timestamp: raw.timestamp,
      comment: raw.comment ?? "",
      content,
      size: raw.size,
      minor: raw.minor ?? false,
    };
  }
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseUnifiedDiff(diffText: string): DiffLine[] {
  const lines: DiffLine[] = [];
  const textLines = diffText.split("\n");

  let fromLine = 0;
  let toLine = 0;

  for (const line of textLines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        fromLine = parseInt(match[1], 10);
        toLine = parseInt(match[2], 10);
      }
      continue;
    }

    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith(" ")) {
      lines.push({ type: "unchanged", content: line.slice(1), lineNumber: toLine });
      fromLine++;
      toLine++;
    } else if (line.startsWith("-")) {
      lines.push({ type: "removed", content: line.slice(1), lineNumber: fromLine });
      fromLine++;
    } else if (line.startsWith("+")) {
      lines.push({ type: "added", content: line.slice(1), lineNumber: toLine });
      toLine++;
    }
  }

  return lines;
}
