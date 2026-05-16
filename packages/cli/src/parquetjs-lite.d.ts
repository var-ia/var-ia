declare module "parquetjs-lite" {
  export class ParquetSchema {
    constructor(schema: Record<string, { type: string; optional?: boolean }>);
  }
  export class ParquetWriter {
    static openStream(
      schema: ParquetSchema,
      outputStream: NodeJS.WritableStream,
      opts?: Record<string, unknown>,
    ): Promise<ParquetWriter>;
    appendRow(row: Record<string, unknown>): Promise<void>;
    close(callback?: () => void): Promise<void>;
  }
}
