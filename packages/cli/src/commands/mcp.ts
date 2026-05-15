import type { EvidenceEvent } from "@var-ia/evidence-graph";
import { buildInterpretationPrompt, parseInterpretationResponse } from "@var-ia/evidence-graph";
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

interface SamplingMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
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

const CLIENT_NAME = "refract-mcp";
const CLIENT_VERSION = "0.2.0";
const PROTOCOL_VERSION = "2025-06-18";

let clientCapabilities: Record<string, unknown> | null = null;
const pendingSampling = new Map<string, { resolve: (value: JsonRpcResponse) => void; reject: (err: Error) => void }>();

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
        api: { type: "string", description: "MediaWiki API base URL. Defaults to English Wikipedia." },
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
      "Track a specific sentence's provenance across revisions. Shows when a sentence first appeared, was removed, or was reintroduced — with section context and revision IDs.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title" },
        text: { type: "string", description: "Sentence text to track (partial match supported)" },
        api: { type: "string", description: "MediaWiki API base URL" },
      },
      required: ["page", "text"],
    },
  },
  {
    name: "export",
    description:
      "Export page analysis as structured JSON. Returns all events with revision, section, and timestamp provenance.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title" },
        depth: { type: "string", enum: ["brief", "detailed", "forensic"], description: "Analysis depth" },
        api: { type: "string", description: "MediaWiki API base URL" },
        since: { type: "string", description: "Re-observe from ISO timestamp" },
      },
      required: ["page"],
    },
  },
  {
    name: "cron",
    description:
      "Re-observe pages and return current analysis results. For scheduled monitoring — detects new edits, citation changes, and template changes.",
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
  {
    name: "interpret",
    description:
      "Analyze a page and return semantic interpretations of every event. For each event, provides what changed and why (confidence 0–1), the relevant Wikipedia policy dimension, and the type of talk page discussion it correlates with.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title" },
        depth: { type: "string", enum: ["brief", "detailed", "forensic"], description: "Analysis depth" },
        api: { type: "string", description: "MediaWiki API base URL" },
        from: { type: "string", description: "Start revision ID" },
        to: { type: "string", description: "End revision ID" },
        since: { type: "string", description: "Re-observe from ISO timestamp" },
        mode: {
          type: "string",
          enum: ["auto", "prompt", "interpret"],
          description:
            "auto: try host LLM, fallback to prompt; prompt: return prompt only; interpret: require host LLM",
        },
      },
      required: ["page"],
    },
  },
];

function send(response: JsonRpcResponse): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function sendRequest(request: JsonRpcRequest): void {
  process.stdout.write(`${JSON.stringify(request)}\n`);
}

function sendError(id: number | string, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function extractAuth(params?: Record<string, unknown>): AuthConfig | undefined {
  const key = params?.apiKey as string | undefined;
  const user = params?.apiUser as string | undefined;
  const pass = params?.apiPassword as string | undefined;
  if (!key && !user && !pass) return undefined;
  return { apiKey: key, apiUser: user, apiPassword: pass };
}

function summarizeEvents(events: EvidenceEvent[]): { byType: Record<string, number>; sections: number } {
  const byType: Record<string, number> = {};
  const secSet = new Set<string>();
  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
    if (e.section) secSet.add(e.section);
  }
  return { byType, sections: secSet.size };
}

function formatEventLine(e: EvidenceEvent): string {
  const section = e.section ? ` [${e.section}]` : "";
  const facts = e.deterministicFacts.map((f) => f.fact).join("; ");
  const detail = facts ? ` — ${facts}` : "";
  return `[${e.timestamp}] ${e.eventType} (rev ${e.fromRevisionId}→${e.toRevisionId})${section}${detail}`;
}

async function requestSampling(messages: SamplingMessage[], systemPrompt: string, maxTokens = 2000): Promise<string> {
  const id = `sampling-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingSampling.delete(id);
      reject(new Error("Sampling request timed out after 60s"));
    }, 60_000);

    pendingSampling.set(id, {
      resolve: (response: JsonRpcResponse) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error.message));
          return;
        }
        const result = response.result as { content?: { type: string; text: string }[] } | undefined;
        const text = result?.content?.find((c) => c.type === "text")?.text;
        if (!text) {
          reject(new Error("No text content in sampling response"));
          return;
        }
        resolve(text);
      },
      reject: (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      },
    });

    sendRequest({
      jsonrpc: "2.0",
      id,
      method: "sampling/createMessage",
      params: {
        messages,
        systemPrompt,
        maxTokens,
        temperature: 0.3,
        stopSequences: [],
        metadata: {},
      },
    });
  });
}

async function handleToolCall(
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
        for (const e of sample) lines.push(`  ${formatEventLine(e)}`);
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
      if (!captured.trim()) captured = `Sentence "${text}" not found in "${page}" revision history.`;
      return { content: [{ type: "text", text: captured.trim() }] };
    }

    case "export": {
      const page = params.page as string;
      const depth = (params.depth as string) ?? "detailed";
      const since = params.since as string | undefined;
      const { events, revisions } = await runAnalyze(
        page,
        depth,
        undefined,
        undefined,
        since,
        false,
        apiUrl,
        undefined,
        undefined,
        auth,
      );
      const report = {
        format: "refract-export/v1",
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
        for (const r of changed) lines.push(`  ${r.page}: ${r.newEvents} new events`);
      }
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        lines.push("", "Errors:");
        for (const f of failed) lines.push(`  ${f.page}: ${f.error ?? "unknown error"}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    case "interpret": {
      const page = params.page as string;
      const depth = (params.depth as string) ?? "detailed";
      const from = params.from ? parseInt(params.from as string, 10) : undefined;
      const to = params.to ? parseInt(params.to as string, 10) : undefined;
      const since = params.since as string | undefined;
      const mode = (params.mode as string) ?? "auto";

      const { events } = await runAnalyze(page, depth, from, to, since, false, apiUrl, undefined, undefined, auth);
      const prompt = buildInterpretationPrompt(events, page);

      const supportsSampling = clientCapabilities && typeof clientCapabilities.sampling === "object";
      const useSampling = mode === "interpret" || (mode === "auto" && !!supportsSampling);

      if (useSampling && supportsSampling) {
        try {
          const response = await requestSampling(
            [{ role: "user", content: { type: "text", text: prompt } }],
            "You are an expert Wikipedia editor classifying editorial activity. Return valid JSON only.",
          );
          const interpretations = parseInterpretationResponse(response);
          const merged = events.map((e, i) => ({
            ...e,
            modelInterpretation: interpretations[i] ?? null,
            modelInterpretation_requested: true,
          }));
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    pageTitle: page,
                    eventCount: events.length,
                    interpretedCount: interpretations.length,
                    confidenceAvailable: interpretations.length > 0,
                    mode: "sampling",
                    events: merged,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch {
          if (mode === "interpret") {
            return {
              content: [
                {
                  type: "text",
                  text: "Host LLM unavailable. mode=interpret requires sampling support from the MCP host.",
                },
              ],
            };
          }
          // Fall through to prompt mode
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                pageTitle: page,
                eventCount: events.length,
                mode: "prompt",
                prompt,
                events,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
}

async function handleRequest(request: JsonRpcRequest): Promise<void> {
  switch (request.method) {
    case "initialize": {
      clientCapabilities = (request.params?.capabilities as Record<string, unknown>) ?? null;
      process.stderr.write("Refract MCP server initialized.\n");
      send({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {}, sampling: {} },
          serverInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
        },
      });
      break;
    }

    case "initialized":
      break;

    case "tools/list":
      send({ jsonrpc: "2.0", id: request.id, result: { tools: TOOLS } });
      break;

    case "tools/call": {
      const toolParams = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      if (!toolParams?.name) {
        sendError(request.id, -32602, "Missing tool name");
        break;
      }
      try {
        const result = await handleToolCall(toolParams.name, toolParams.arguments);
        send({ jsonrpc: "2.0", id: request.id, result });
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

    default:
      sendError(request.id, -32601, `Method not found: ${request.method}`);
  }
}

export async function runMcpServer(): Promise<void> {
  process.stderr.write("Refract MCP server starting...\n");

  let buffer = "";

  process.stdin.setEncoding("utf-8");

  for await (const chunk of process.stdin) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }

      const id = String(msg.id ?? "");
      if (pendingSampling.has(id)) {
        const handler = pendingSampling.get(id);
        if (!handler) continue;
        pendingSampling.delete(id);
        if (msg.error) {
          handler.reject(new Error(String((msg.error as Record<string, unknown>).message ?? "Sampling error")));
        } else {
          handler.resolve({ jsonrpc: "2.0", id, result: msg.result });
        }
        continue;
      }

      const request = msg as unknown as JsonRpcRequest;
      if (request.jsonrpc !== "2.0") continue;

      handleRequest(request).catch((err) => {
        process.stderr.write(`Unhandled error: ${err.message}\n`);
      });
    }
  }
}
