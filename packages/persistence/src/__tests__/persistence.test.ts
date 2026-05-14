import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bun:sqlite", () => {
  const store = { revisions: [] as Record<string, unknown>[], claims: [] as Record<string, unknown>[] };

  class MockDB {
    run(sql: string, ...params: unknown[]) {
      if (sql.includes("INSERT OR REPLACE INTO revisions")) {
        const idx = store.revisions.findIndex((r) => r.rev_id === params[0]);
        const row = {
          rev_id: params[0],
          page_id: params[1],
          page_title: params[2],
          timestamp: params[3],
          comment: params[4],
          content: params[5],
          size: params[6],
          minor: params[7],
        };
        if (idx >= 0) store.revisions[idx] = row;
        else store.revisions.push(row);
      }
      if (sql.includes("INSERT OR REPLACE INTO claims")) {
        const idx = store.claims.findIndex((c) => c.claim_id === params[0]);
        const row = {
          claim_id: params[0],
          identity_key: params[1],
          page_title: params[2],
          page_id: params[3],
          current_state: params[4],
          proposition_type: params[5],
          first_seen_rev_id: params[6],
          first_seen_at: params[7],
          last_seen_rev_id: params[8],
          last_seen_at: params[9],
          phase: params[10],
        };
        if (idx >= 0) store.claims[idx] = row;
        else store.claims.push(row);
      }
    }
    query(_sql: string) {
      return {
        all: (...params: unknown[]) => {
          if (_sql.includes("FROM revisions")) {
            const rows = _sql.includes("WHERE page_title = ?")
              ? store.revisions.filter((r) => r.page_title === params[0])
              : [...store.revisions];
            if (_sql.includes("ORDER BY timestamp")) {
              const dir = _sql.includes("DESC") ? -1 : 1;
              rows.sort((a, b) => dir * String(a.timestamp).localeCompare(String(b.timestamp)));
            }
            const limit = params.length > 1 ? (params[params.length - 1] as number) : rows.length;
            return rows.slice(0, limit);
          }
          if (_sql.includes("FROM claims")) {
            return store.claims.filter((c) => c.page_title === params[0]);
          }
          return [];
        },
        get: (...params: unknown[]) => {
          const idx = _sql.includes("FROM revisions") ? store.revisions.findIndex((r) => r.rev_id === params[0]) : -1;
          return idx >= 0 ? store.revisions[idx] : null;
        },
      };
    }
    prepare(sql: string) {
      return { run: (...params: unknown[]) => this.run(sql, ...params) };
    }
    transaction(fn: () => void) {
      return fn;
    }
    close() {
      store.revisions = [];
      store.claims = [];
    }
  }
  return { Database: MockDB };
});

import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClaimObject, ClaimState, PropositionType, Revision } from "@var-ia/evidence-graph";
import { Persistence } from "../index.js";

const dbPath = join(tmpdir(), `varia-test-${Date.now()}.db`);

function makeRev(revId: number, title = "Test", ts?: string): Revision {
  return {
    revId,
    pageId: 100,
    pageTitle: title,
    timestamp: ts ?? `2026-01-${String(revId).padStart(2, "0")}T00:00:00Z`,
    comment: `edit ${revId}`,
    content: `Content for revision ${revId}`,
    size: 100,
    minor: revId % 2 === 0,
  };
}

function makeClaim(pageTitle = "Test"): ClaimObject {
  return {
    identity: {
      claimId: `claim-${pageTitle}-1`,
      identityKey: "test-claim-key",
      pageTitle,
      pageId: 100,
    },
    lineage: {
      firstSeenRevisionId: 1,
      firstSeenAt: "2026-01-01T00:00:00Z",
      lastSeenRevisionId: 2,
      lastSeenAt: "2026-01-02T00:00:00Z",
      variants: [{ revisionId: 1, text: "original text", section: "body", observedAt: "2026-01-01T00:00:00Z" }],
    },
    currentState: "emerging" as ClaimState,
    propositionType: "factual_claim" as PropositionType,
    sourceLineage: [],
    phase: "Phase 1b",
  };
}

describe("Persistence", () => {
  let db: Persistence;

  beforeEach(() => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    db = new Persistence({ dbPath });
  });

  afterEach(() => {
    db.close();
    try {
      if (existsSync(dbPath)) unlinkSync(dbPath);
    } catch {
      /* file may not exist */
    }
  });

  describe("revisions", () => {
    it("inserts and retrieves a revision", () => {
      const rev = makeRev(1);
      db.insertRevision(rev);

      const loaded = db.getRevisions("Test");
      expect(loaded).toHaveLength(1);
      expect(loaded[0].revId).toBe(1);
      expect(loaded[0].content).toBe("Content for revision 1");
    });

    it("inserts revisions in bulk", () => {
      const revs = [makeRev(1), makeRev(2), makeRev(3)];
      db.insertRevisions(revs);

      const loaded = db.getRevisions("Test", { limit: 10, direction: "newer" });
      expect(loaded).toHaveLength(3);
    });

    it("hasRevision returns true for existing revision", () => {
      db.insertRevision(makeRev(1));
      expect(db.hasRevision(1)).toBe(true);
    });

    it("hasRevision returns false for non-existent revision", () => {
      expect(db.hasRevision(999)).toBe(false);
    });

    it("retrieves revisions ordered by timestamp", () => {
      db.insertRevisions([makeRev(2, "Test", "2026-01-02T00:00:00Z"), makeRev(1, "Test", "2026-01-01T00:00:00Z")]);
      const loaded = db.getRevisions("Test", { direction: "newer" });
      expect(loaded[0].revId).toBe(1);
      expect(loaded[1].revId).toBe(2);
    });

    it("handles page filtering", () => {
      db.insertRevision(makeRev(1, "PageA"));
      db.insertRevision(makeRev(2, "PageB"));

      expect(db.getRevisions("PageA")).toHaveLength(1);
      expect(db.getRevisions("PageB")).toHaveLength(1);
    });
  });

  describe("claims", () => {
    it("inserts and retrieves a claim", () => {
      const claim = makeClaim();
      db.insertClaim(claim);

      const claims = db.getClaims("Test");
      expect(claims).toHaveLength(1);
      expect(claims[0].claim_id).toBe("claim-Test-1");
      expect(claims[0].current_state).toBe("emerging");
    });

    it("retrieves claims by page title", () => {
      const claimA = makeClaim("PageA");
      const claimB = makeClaim("PageB");

      db.insertClaim(claimA);
      db.insertClaim(claimB);

      expect(db.getClaims("PageA")).toHaveLength(1);
      expect(db.getClaims("PageB")).toHaveLength(1);
    });

    it("replaces existing claim on re-insert", () => {
      const claim = makeClaim();
      db.insertClaim(claim);

      const updated: ClaimObject = {
        ...claim,
        currentState: "stabilizing" as ClaimState,
      };
      db.insertClaim(updated);

      const claims = db.getClaims("Test");
      expect(claims[0].current_state).toBe("stabilizing");
    });
  });

  it("closes without error", () => {
    expect(() => db.close()).not.toThrow();
  });
});
