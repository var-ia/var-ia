import { createServer } from "node:http";
import type { AuthConfig } from "@var-ia/ingestion";
import { renderHtmlReport } from "../html-renderer.js";
import { runAnalyze } from "./analyze.js";

export async function runExplore(
  pageTitle: string,
  port: number,
  noOpen: boolean,
  apiUrl?: string,
  auth?: AuthConfig,
): Promise<void> {
  const { events, revisions } = await runAnalyze(
    pageTitle,
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

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (url.pathname === "/api/events") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(events));
      return;
    }
    if (url.pathname === "/api/revisions") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(revisions));
      return;
    }
    const html = renderHtmlReport(pageTitle, events, revisions, true);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  const url = `http://localhost:${port}`;
  console.log(`\n  Varia Explorer running at ${url}`);
  console.log(`  Page: ${pageTitle}`);
  console.log(`  Events: ${events.length}  |  Revisions: ${revisions.length}`);
  console.log(`  Press Ctrl+C to stop\n`);
  if (!noOpen) console.log(`  Open ${url} in your browser`);

  server.listen(port);
}
