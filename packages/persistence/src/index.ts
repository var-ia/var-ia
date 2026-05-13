import { Database } from "bun:sqlite";
import type { Revision } from "@var-ia/evidence-graph";
import type { ClaimObject } from "@var-ia/evidence-graph";

export interface PersistenceConfig {
  dbPath: string;
}

export class Persistence {
  private db: Database;

  constructor(config: PersistenceConfig) {
    this.db = new Database(config.dbPath);
    this.db.run("PRAGMA journal_mode=WAL");
    this.db.run("PRAGMA synchronous=NORMAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS revisions (
        rev_id INTEGER PRIMARY KEY,
        page_id INTEGER NOT NULL,
        page_title TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        comment TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        size INTEGER NOT NULL DEFAULT 0,
        minor INTEGER NOT NULL DEFAULT 0,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_revisions_page
      ON revisions(page_title, timestamp)
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS claims (
        claim_id TEXT PRIMARY KEY,
        identity_key TEXT NOT NULL,
        page_title TEXT NOT NULL,
        page_id INTEGER NOT NULL,
        current_state TEXT NOT NULL DEFAULT 'absent',
        proposition_type TEXT NOT NULL DEFAULT 'unknown',
        first_seen_rev_id INTEGER NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_rev_id INTEGER,
        last_seen_at TEXT,
        phase TEXT NOT NULL DEFAULT 'Phase 0',
        stored_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_claims_page
      ON claims(page_title)
    `);
  }

  insertRevision(rev: Revision): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO revisions
        (rev_id, page_id, page_title, timestamp, comment, content, size, minor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      rev.revId,
      rev.pageId,
      rev.pageTitle,
      rev.timestamp,
      rev.comment,
      rev.content,
      rev.size,
      rev.minor ? 1 : 0,
    );
  }

  insertRevisions(revisions: Revision[]): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO revisions
        (rev_id, page_id, page_title, timestamp, comment, content, size, minor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.db.transaction(() => {
      for (const rev of revisions) {
        insert.run(
          rev.revId,
          rev.pageId,
          rev.pageTitle,
          rev.timestamp,
          rev.comment,
          rev.content,
          rev.size,
          rev.minor ? 1 : 0,
        );
      }
    })();
  }

  getRevisions(
    pageTitle: string,
    options?: { limit?: number; direction?: "newer" | "older" },
  ): Revision[] {
    const dir = options?.direction === "newer" ? "ASC" : "DESC";
    const limit = options?.limit ?? 100;
    const rows = this.db
      .query(
        `SELECT rev_id, page_id, page_title, timestamp, comment, content, size, minor
         FROM revisions
         WHERE page_title = ?
         ORDER BY timestamp ${dir}
         LIMIT ?`,
      )
      .all(pageTitle, limit) as Array<{
      rev_id: number;
      page_id: number;
      page_title: string;
      timestamp: string;
      comment: string;
      content: string;
      size: number;
      minor: number;
    }>;

    return rows.map((r) => ({
      revId: r.rev_id,
      pageId: r.page_id,
      pageTitle: r.page_title,
      timestamp: r.timestamp,
      comment: r.comment,
      content: r.content,
      size: r.size,
      minor: r.minor === 1,
    }));
  }

  hasRevision(revId: number): boolean {
    const row = this.db
      .query("SELECT 1 FROM revisions WHERE rev_id = ? LIMIT 1")
      .get(revId);
    return row !== null;
  }

  insertClaim(claim: ClaimObject): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO claims
        (claim_id, identity_key, page_title, page_id, current_state,
         proposition_type, first_seen_rev_id, first_seen_at,
         last_seen_rev_id, last_seen_at, phase)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      claim.identity.claimId,
      claim.identity.identityKey,
      claim.identity.pageTitle,
      claim.identity.pageId,
      claim.currentState,
      claim.propositionType,
      claim.lineage.firstSeenRevisionId,
      claim.lineage.firstSeenAt,
      claim.lineage.lastSeenRevisionId ?? null,
      claim.lineage.lastSeenAt ?? null,
      claim.phase,
    );
  }

  getClaims(pageTitle: string): Array<{
    claim_id: string;
    identity_key: string;
    current_state: string;
    proposition_type: string;
    first_seen_rev_id: number;
    first_seen_at: string;
  }> {
    return this.db
      .query(
        `SELECT claim_id, identity_key, current_state, proposition_type,
                first_seen_rev_id, first_seen_at
         FROM claims WHERE page_title = ?`,
      )
      .all(pageTitle) as Array<{
      claim_id: string;
      identity_key: string;
      current_state: string;
      proposition_type: string;
      first_seen_rev_id: number;
      first_seen_at: string;
    }>;
  }

  close(): void {
    this.db.close();
  }
}
