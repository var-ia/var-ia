import { Persistence } from "@var-ia/persistence";
import type { PersistenceAdapter } from "@var-ia/persistence";
import type { Revision } from "@var-ia/evidence-graph";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_CACHE_DIR = join(homedir(), ".wikihistory");

let _instance: PersistenceAdapter | null = null;
let _cacheDir: string | null = null;

export function configureCache(cacheDir?: string): void {
  if (cacheDir) {
    _cacheDir = cacheDir;
    _instance = null;
  }
}

function getPersistence(): PersistenceAdapter {
  const dir = _cacheDir ?? DEFAULT_CACHE_DIR;
  if (!_instance) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    _instance = new Persistence({ dbPath: join(dir, "varia.db") });
  }
  return _instance;
}

export function loadCachedRevisions(pageTitle: string, limit?: number, cacheDir?: string): Revision[] {
  configureCache(cacheDir);
  try {
    const db = getPersistence();
    return db.getRevisions(pageTitle, { limit: limit ?? 500, direction: "newer" });
  } catch {
    return [];
  }
}

export function saveRevisions(revisions: Revision[], cacheDir?: string): void {
  configureCache(cacheDir);
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
