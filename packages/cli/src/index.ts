import { runAnalyze } from "./commands/analyze.js";
import { runClaim } from "./commands/claim.js";
import { runExport } from "./commands/export.js";
import { runWatch } from "./commands/watch.js";

const HELP = `
wikihistory — Wikipedia edit history analysis

Usage:
  wikihistory analyze <page> [--depth brief|detailed|forensic] [--from <revId>] [--to <revId>] [--cache]
  wikihistory claim <page> --text "<claim text>" [--cache]
  wikihistory export <page> --format json|csv
  wikihistory watch <page> [--section <name>]

Options:
  --depth      Analysis depth (default: detailed)
  --text       Claim text to track across revisions
  --format     Export format (json, csv)
  --section    Watch a specific section only
  --from       Start revision ID
  --to         End revision ID
  --cache      Cache revisions in SQLite (~/.wikihistory/varia.db)
`;

export async function cli(args: string[]): Promise<void> {
  const command = args[0];

  switch (command) {
    case "analyze": {
      const pageTitle = args[1];
      if (!pageTitle) {
        console.error("Usage: wikihistory analyze <page> [--depth brief|detailed|forensic] [--cache]");
        process.exit(1);
      }
      const depth = parseFlag(args, "depth") ?? "detailed";
      const fromRev = parseFlag(args, "from");
      const toRev = parseFlag(args, "to");
      const useCache = args.includes("--cache");

      const events = await runAnalyze(
        pageTitle,
        depth,
        fromRev ? parseInt(fromRev, 10) : undefined,
        toRev ? parseInt(toRev, 10) : undefined,
        useCache,
      );

      console.log(`\n=== Analysis Results ===`);
      console.log(`Page: ${pageTitle}`);
      console.log(`Events detected: ${events.length}`);
      console.log();

      for (const event of events) {
        console.log(`[${event.timestamp}] ${event.eventType} (rev ${event.fromRevisionId}→${event.toRevisionId})`);
        if (event.section) console.log(`  Section: ${event.section}`);
        for (const fact of event.deterministicFacts) {
          console.log(`  • ${fact.fact}${fact.detail ? `: ${fact.detail}` : ""}`);
        }
      }
      break;
    }
    case "claim": {
      const pageTitle = args[1];
      const claimText = parseFlag(args, "text");
      if (!pageTitle || !claimText) {
        console.error('Usage: wikihistory claim <page> --text "<claim text>" [--cache]');
        process.exit(1);
      }
      const useCache = args.includes("--cache");
      await runClaim(pageTitle, claimText, useCache);
      break;
    }
    case "export": {
      const pageTitle = args[1];
      const format = parseFlag(args, "format") ?? "json";
      if (!pageTitle) {
        console.error("Usage: wikihistory export <page> --format json|csv");
        process.exit(1);
      }
      await runExport(pageTitle, format);
      break;
    }
    case "watch": {
      const pageTitle = args[1];
      if (!pageTitle) {
        console.error("Usage: wikihistory watch <page> [--section <name>]");
        process.exit(1);
      }
      const section = parseFlag(args, "section");
      await runWatch(pageTitle, section);
      break;
    }
    case "--help":
    case "-h":
    default:
      console.log(HELP);
      break;
  }
}

export function parseFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  const eqIdx = args.findIndex((a) => a.startsWith(`--${name}=`));
  if (eqIdx >= 0) {
    return args[eqIdx].split("=")[1];
  }
  return undefined;
}
