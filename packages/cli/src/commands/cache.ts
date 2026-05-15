import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Revision } from "@var-ia/evidence-graph";

const DEFAULT_CACHE_DIR = join(homedir(), ".wikihistory");

let _instance: {
  getRevisions: (page: string, opts: { limit: number; direction: string }) => Revision[];
  insertRevisions: (revs: Revision[]) => void;
  getLatestTimestamp: (page: string) => string | undefined;
  close: () => void;
} | null = null;
let _cacheDir: string | null = null;

export function configureCache(cacheDir?: string): void {
  if (cacheDir) {
    _cacheDir = cacheDir;
    _instance = null;
  }
}

async function getPersistence(): Promise<{
  getRevisions: (page: string, opts: { limit: number; direction: string }) => Revision[];
  insertRevisions: (revs: Revision[]) => void;
  getLatestTimestamp: (page: string) => string | undefined;
  close: () => void;
}> {
  const dir = _cacheDir ?? DEFAULT_CACHE_DIR;
  if (!_instance) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    try {
      const { Persistence } = await import("@var-ia/persistence");
      _instance = new Persistence({ dbPath: join(dir, "refract.db") }) as unknown as typeof _instance;
    } catch (_err) {
      throw new Error(
        "Caching requires the optional @var-ia/persistence package.\n" +
          "Install it: bun add @var-ia/persistence\n" +
          "Or run without --cache to skip caching.",
      );
    }
  }
  return _instance as NonNullable<typeof _instance>;
}

export async function loadCachedRevisions(pageTitle: string, limit?: number, cacheDir?: string): Promise<Revision[]> {
  configureCache(cacheDir);
  try {
    const db = await getPersistence();
    return db.getRevisions(pageTitle, { limit: limit ?? 500, direction: "newer" });
  } catch {
    return [];
  }
}

export async function saveRevisions(revisions: Revision[], cacheDir?: string): Promise<void> {
  configureCache(cacheDir);
  try {
    const db = await getPersistence();
    db.insertRevisions(revisions);
  } catch (err) {
    console.error("Cache write failed:", (err as Error).message);
  }
}

export async function loadLatestCachedTimestamp(pageTitle: string, cacheDir?: string): Promise<string | undefined> {
  configureCache(cacheDir);
  try {
    const db = await getPersistence();
    return db.getLatestTimestamp(pageTitle);
  } catch {
    return undefined;
  }
}

export async function closePersistence(): Promise<void> {
  if (_instance) {
    _instance.close();
    _instance = null;
  }
}
