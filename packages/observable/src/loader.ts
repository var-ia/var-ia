import { readFileSync } from "node:fs";

export interface SequentLoaderOptions {
  path: string;
  format?: "json" | "sqlite";
}

export class SequentLoader {
  private path: string;
  private format: "json" | "sqlite";

  constructor(options: SequentLoaderOptions) {
    this.path = options.path;
    this.format = options.format ?? (options.path.endsWith(".db") ? "sqlite" : "json");
  }

  async load(): Promise<Record<string, unknown>> {
    if (this.format === "json") {
      const raw = readFileSync(this.path, "utf-8");
      return JSON.parse(raw) as Record<string, unknown>;
    }

    const { Database } = await import("bun:sqlite");
    const db = new Database(this.path, { readonly: true });

    const events = db.query("SELECT * FROM evidence_events").all();
    const revisions = db.query("SELECT * FROM revisions").all();

    db.close();

    return { events, revisions };
  }
}

export function sequentLoader(options: SequentLoaderOptions): SequentLoader {
  return new SequentLoader(options);
}
