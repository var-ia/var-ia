import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { AuthConfig } from "@var-ia/ingestion";
import { runAnalyze } from "./analyze.js";
import { runClaim } from "./claim.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

const TOOLS: McpTool[] = [
  {
    name: "analyze",
    description:
      "Analyze a MediaWiki page's full edit history. Returns a structured event stream: claims, citations, sections, templates, categories, wikilinks, and reverts — all provenance-tagged with revision IDs and timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title (e.g. 'Bitcoin', 'Climate change')" },
        depth: {
          type: "string",
          enum: ["brief", "detailed", "forensic"],
          description:
            "Analysis depth: brief (event metadata only), detailed (text included), forensic (full wikitext)",
        },
        api: {
          type: "string",
          description: "MediaWiki API base URL. Defaults to English Wikipedia.",
        },
        from: { type: "string", description: "Start revision ID" },
        to: { type: "string", description: "End revision ID" },
        since: { type: "string", description: "Re-observe from ISO timestamp" },
      },
      required: ["page"],
    },
  },
  {
    name: "claim",
    description:
      "Track a specific claim's provenance across revisions. Shows when a sentence first appeared, was reworded, strengthened, softened, or removed — with confidence scores.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title" },
        text: { type: "string", description: "Claim text to track (partial match supported)" },
        api: { type: "string", description: "MediaWiki API base URL" },
      },
      required: ["page", "text"],
    },
  },
  {
    name: "export",
    description:
      "Export page analysis as structured JSON data. Returns claim lineage, source lineage, section history, and policy signals — deterministic and replay-safe.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title" },
        api: { type: "string", description: "MediaWiki API base URL" },
      },
      required: ["page"],
    },
  },
  {
    name: "cron",
    description:
      "Re-observe pages and return current analysis results. For scheduled monitoring — detects edits, claim changes, citation turnover.",
    inputSchema: {
      type: "object",
      properties: {
        pagesFile: { type: "string", description: "Path to file with one page title per line" },
        interval: { type: "string", description: "Lookback window in hours (default: from last observation)" },
        api: { type: "string", description: "MediaWiki API base URL" },
      },
      required: ["pagesFile"],
    },
  },
];

const CLIENT_NAME = "varia-mcp";
const CLIENT_VERSION = "0.1.0";

function send(response: JsonRpcResponse): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function sendError(id: number | string, code: number, message: string): void {
  send({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

function extractAuth(params?: Record<string, unknown>): AuthConfig | undefined {
  const key = params?.apiKey as string | undefined;
  const user = params?.apiUser as string | undefined;
  const pass = params?.apiPassword as string | undefined;
  if (!key && !user && !pass) return undefined;
  return { apiKey: key, apiUser: user, apiPassword: pass };
}

function summarizeEvents(events: EvidenceEvent[]): {
  byType: Record<string, number>;
  sections: number;
  revisionRange: string;
} {
  const byType: Record<string, number> = {};
  const secSet = new Set<string>();

  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
    if (e.section) secSet.add(e.section);
  }

  const first = events[0];
  const last = events[events.length - 1];
  const revisionRange = first && last ? `${first.fromRevisionId ?? "?"} → ${last.toRevisionId ?? "?"}` : "N/A";

  return { byType, sections: secSet.size, revisionRange };
}

function formatEventLine(e: EvidenceEvent): string {
  const section = e.section ? ` [${e.section}]` : "";
  const facts = e.deterministicFacts.map((f) => f.fact).join("; ");
  const detail = facts ? ` — ${facts}` : "";
  return `[${e.timestamp}] ${e.eventType} (rev ${e.fromRevisionId}→${e.toRevisionId})${section}${detail}`;
}

async function handleCallTool(
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args ?? {};
  const apiUrl = params.api as string | undefined;
  const auth = extractAuth(params);

  switch (name) {
    case "analyze": {
      const page = params.page as string;
      const depth = (params.depth as string) ?? "detailed";
      const from = params.from ? parseInt(params.from as string, 10) : undefined;
      const to = params.to ? parseInt(params.to as string, 10) : undefined;
      const since = params.since as string | undefined;

      const { events, revisions } = await runAnalyze(
        page,
        depth,
        from,
        to,
        since,
        false,
        apiUrl,
        undefined,
        undefined,
        auth,
      );

      const summary = summarizeEvents(events);
      const lines = [
        `Analysis of "${page}" (depth=${depth}):`,
        `  Revisions fetched: ${revisions.length}`,
        `  Revision range: ${summary.revisionRange}`,
        `  Total events: ${events.length}`,
        `  Sections with activity: ${summary.sections}`,
        "",
        "Event type breakdown:",
      ];

      for (const [type, count] of Object.entries(summary.byType).sort(([, a], [, b]) => b - a)) {
        lines.push(`  ${type}: ${count}`);
      }

      if (events.length > 0) {
        const sample = events.slice(0, 30);
        lines.push("", "Sample events:");
        for (const e of sample) {
          lines.push(`  ${formatEventLine(e)}`);
        }
        if (events.length > 30) lines.push(`  ... and ${events.length - 30} more events`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    case "claim": {
      const page = params.page as string;
      const text = params.text as string;

      let captured = "";
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        captured += `${args.map(String).join(" ")}\n`;
      };

      try {
        await runClaim(page, text, false, apiUrl, undefined, auth);
      } finally {
        console.log = origLog;
      }

      if (!captured.trim()) {
        captured = `Claim "${text}" not found in "${page}" revision history.`;
      }

      return { content: [{ type: "text", text: captured.trim() }] };
    }

    case "export": {
      const page = params.page as string;
      const { events, revisions } = await runAnalyze(
        page,
        "detailed",
        undefined,
        undefined,
        undefined,
        false,
        apiUrl,
        undefined,
        undefined,
        auth,
      );

      const report = {
        format: "varia-export/v1",
        generatedAt: new Date().toISOString(),
        pageTitle: page,
        revisionCount: revisions.length,
        eventCount: events.length,
        summary: summarizeEvents(events),
        events,
      };

      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    }

    case "cron": {
      const pagesFile = params.pagesFile as string;
      const fs = await import("node:fs");
      if (!fs.existsSync(pagesFile)) {
        return { content: [{ type: "text", text: `Error: pages file not found: ${pagesFile}` }] };
      }

      const pages = fs
        .readFileSync(pagesFile, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const results: Array<{ page: string; newEvents: number; ok: boolean; error?: string }> = [];
      for (const page of pages) {
        try {
          const { events } = await runAnalyze(
            page,
            "brief",
            undefined,
            undefined,
            undefined,
            false,
            apiUrl,
            undefined,
            undefined,
            auth,
          );
          results.push({ page, newEvents: events.length, ok: true });
        } catch (err) {
          results.push({ page, newEvents: 0, ok: false, error: String(err) });
        }
      }

      const totalNew = results.reduce((s, r) => s + r.newEvents, 0);
      const errors = results.filter((r) => !r.ok).length;
      const lines = [
        "Cron re-observation:",
        `  Pages checked: ${results.length}`,
        `  New events total: ${totalNew}`,
        `  Errors: ${errors}`,
      ];

      const changed = results.filter((r) => r.newEvents > 0);
      if (changed.length > 0) {
        lines.push("", "Changed pages:");
        for (const r of changed) {
          lines.push(`  ${r.page}: ${r.newEvents} new events`);
        }
      }

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        lines.push("", "Errors:");
        for (const f of failed) {
          lines.push(`  ${f.page}: ${f.error ?? "unknown error"}`);
        }
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
}

export async function runMcpServer(): Promise<void> {
  process.stderr.write("Varia MCP server starting...\n");

  let buffer = "";
  let initialized = false;

  process.stdin.setEncoding("utf-8");

  for await (const chunk of process.stdin) {
    buffer += chunk;

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      let request: JsonRpcRequest;
      try {
        request = JSON.parse(line);
      } catch {
        continue;
      }

      if (request.jsonrpc !== "2.0") continue;

      switch (request.method) {
        case "initialize": {
          initialized = true;
          process.stderr.write("Varia MCP server initialized.\n");
          send({
            jsonrpc: "2.0",
            id: request.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
            },
          });
          break;
        }

        case "initialized": {
          break;
        }

        case "tools/list": {
          send({
            jsonrpc: "2.0",
            id: request.id,
            result: { tools: TOOLS },
          });
          break;
        }

        case "tools/call": {
          if (!initialized) {
            sendError(request.id, -32002, "Not initialized");
            break;
          }
          const toolParams = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
          if (!toolParams?.name) {
            sendError(request.id, -32602, "Missing tool name");
            break;
          }

          try {
            const result = await handleCallTool(toolParams.name, toolParams.arguments);
            send({
              jsonrpc: "2.0",
              id: request.id,
              result,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write(`Tool error: ${message}\n`);
            send({
              jsonrpc: "2.0",
              id: request.id,
              result: { content: [{ type: "text", text: `Error: ${message}` }], isError: true },
            });
          }
          break;
        }

        default: {
          sendError(request.id, -32601, `Method not found: ${request.method}`);
        }
      }
    }
  }
}
