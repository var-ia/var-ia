import { Persistence } from "@varia/persistence";
import type { Revision } from "@varia/evidence-graph";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_DIR = join(homedir(), ".wikihistory");
const DB_PATH = join(CACHE_DIR, "varia.db");

let _instance: Persistence | null = null;

export function getPersistence(): Persistence {
  if (!_instance) {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    _instance = new Persistence({ dbPath: DB_PATH });
  }
  return _instance;
}

export function loadCachedRevisions(pageTitle: string, limit?: number): Revision[] {
  try {
    const db = getPersistence();
    return db.getRevisions(pageTitle, { limit: limit ?? 500, direction: "newer" });
  } catch {
    return [];
  }
}

export function saveRevisions(revisions: Revision[]): void {
  try {
    const db = getPersistence();
    db.insertRevisions(revisions);
  } catch (err) {
    console.error("Cache write failed:", (err as Error).message);
  }
}

export function closePersistence(): void {
  if (_instance) {
    _instance.close();
    _instance = null;
  }
}
