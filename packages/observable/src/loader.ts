import { readFileSync } from "node:fs";

export interface RefractLoaderOptions {
  path: string;
  format?: "json" | "sqlite";
}

export class RefractLoader {
  private path: string;
  private format: "json" | "sqlite";

  constructor(options: RefractLoaderOptions) {
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

export function sequentLoader(options: RefractLoaderOptions): RefractLoader {
  return new RefractLoader(options);
}
