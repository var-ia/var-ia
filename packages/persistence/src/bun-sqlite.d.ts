declare module "bun:sqlite" {
  export class Database {
    constructor(path: string, options?: { create?: boolean; readonly?: boolean; strict?: boolean });
    run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    prepare(sql: string): Statement;
    query(sql: string): QueryBuilder;
    transaction(fn: () => void): () => void;
    close(): void;
  }

  export class Statement {
    run(...params: unknown[]): void;
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown | null;
  }

  export class QueryBuilder {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown | null;
  }
}
