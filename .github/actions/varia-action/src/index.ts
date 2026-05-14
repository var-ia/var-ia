import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const input = (name: string): string => {
  const envKey = `INPUT_${name.replace(/-/g, "_").toUpperCase()}`;
  return process.env[envKey] ?? "";
};

function run(): void {
  const pages = input("pages");
  if (!pages) {
    console.log("No pages provided. Set the 'pages' input.");
    return;
  }

  const depth = input("depth") || "brief";
  const api = input("api");
  const since = input("since");
  const format = input("format") || "table";
  const apiKey = input("api-key");
  const apiUser = input("api-user");
  const apiPassword = input("api-password");

  const pagesList = pages
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const results: Array<{
    page: string;
    events: number;
    revisionRange: string;
  }> = [];
  let totalEvents = 0;

  for (const page of pagesList) {
    try {
      const args = ["analyze", page, "--depth", depth];
      if (api) args.push("--api", api);
      if (since) args.push("--since", since);
      if (apiKey) args.push("--api-key", apiKey);
      if (apiUser) args.push("--api-user", apiUser);
      if (apiPassword) args.push("--api-password", apiPassword);

      const output = execSync(`bunx wikihistory ${args.join(" ")}`, {
        encoding: "utf-8",
        timeout: 120_000,
      });

      const eventMatch = output.match(/Events:\s+(\d+)/);
      const events = eventMatch ? parseInt(eventMatch[1], 10) : 0;
      totalEvents += events;

      const revMatch = output.match(/Revisions fetched:\s+(\d+)/);
      const revs = revMatch ? revMatch[1] : "?";

      results.push({ page, events, revisionRange: `${revs} revisions` });
    } catch (err) {
      console.error(`Error analyzing ${page}:`, err);
    }
  }

  if (format === "json") {
    const report = {
      generatedAt: new Date().toISOString(),
      totalEvents,
      pages: results,
    };
    writeFileSync(process.env.GITHUB_OUTPUT as string, `new-events=${totalEvents}\n`);
    writeFileSync(process.env.GITHUB_OUTPUT as string, `report=${JSON.stringify(report)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("## Varia Edit History Analysis");
    console.log();
    console.log(`| Page | Events | Revisions |`);
    console.log(`|------|--------|-----------|`);
    for (const r of results) {
      console.log(`| ${r.page} | ${r.events} | ${r.revisionRange} |`);
    }
    console.log();
    console.log(`**Total events detected:** ${totalEvents}`);

    writeFileSync(process.env.GITHUB_OUTPUT as string, `new-events=${totalEvents}\n`);
  }
}

run();
