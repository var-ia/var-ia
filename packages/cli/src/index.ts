import { runAnalyze } from "./commands/analyze.js";
import { runClaim } from "./commands/claim.js";
import { runExport } from "./commands/export.js";
import { runWatch } from "./commands/watch.js";
import type { ModelConfig } from "@var-ia/interpreter";

const HELP = `
wikihistory — Wikipedia edit history analysis

Usage:
  wikihistory analyze <page> [--depth brief|detailed|forensic] [--from <revId>] [--to <revId>] [--cache] [--model <provider>]
  wikihistory claim <page> --text "<claim text>" [--cache] [--model <provider>]
  wikihistory export <page> --format json|csv [--model <provider>]
  wikihistory watch <page> [--section <name>]

Options:
  --depth          Analysis depth (default: detailed)
  --text           Claim text to track across revisions
  --format         Export format (json, csv)
  --section        Watch a specific section only
  --from           Start revision ID
  --to             End revision ID
  --cache          Cache revisions in SQLite (~/.wikihistory/varia.db)
  --model          Model provider for semantic interpretation (openai, anthropic, deepseek, local, byok)
  --model-api-key  API key for model provider (or set env var OPENAI_API_KEY etc.)
  --model-name     Model name override (default: provider-specific)
  --model-endpoint API endpoint override
  --api            MediaWiki API base URL (default: https://en.wikipedia.org/w/api.php)
`;

export async function cli(args: string[]): Promise<void> {
  const command = args[0];

  switch (command) {
    case "analyze": {
      const pageTitle = args[1];
      if (!pageTitle) {
        console.error("Usage: wikihistory analyze <page> [--depth brief|detailed|forensic] [--cache] [--model <provider>]");
        process.exit(1);
      }
      const depth = parseFlag(args, "depth") ?? "detailed";
      const fromRev = parseFlag(args, "from");
      const toRev = parseFlag(args, "to");
      const useCache = args.includes("--cache");
      const modelConfig = parseModelConfig(args);
      const apiUrl = parseFlag(args, "api");

      const events = await runAnalyze(
        pageTitle,
        depth,
        fromRev ? parseInt(fromRev, 10) : undefined,
        toRev ? parseInt(toRev, 10) : undefined,
        useCache,
        modelConfig,
        apiUrl,
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
        if (event.modelInterpretation) {
          console.log(`  ↳ ${event.modelInterpretation.semanticChange} (confidence: ${event.modelInterpretation.confidence.toFixed(2)})`);
          if (event.modelInterpretation.policyDimension) {
            console.log(`  ↳ policy: ${event.modelInterpretation.policyDimension}`);
          }
        }
      }
      break;
    }
    case "claim": {
      const pageTitle = args[1];
      const claimText = parseFlag(args, "text");
      if (!pageTitle || !claimText) {
        console.error('Usage: wikihistory claim <page> --text "<claim text>" [--cache] [--model <provider>]');
        process.exit(1);
      }
      const useCache = args.includes("--cache");
      const modelConfig = parseModelConfig(args);
      const apiUrl = parseFlag(args, "api");
      await runClaim(pageTitle, claimText, useCache, modelConfig, apiUrl);
      break;
    }
    case "export": {
      const pageTitle = args[1];
      const format = parseFlag(args, "format") ?? "json";
      if (!pageTitle) {
        console.error("Usage: wikihistory export <page> --format json|csv [--model <provider>]");
        process.exit(1);
      }
      const modelConfig = parseModelConfig(args);
      const apiUrl = parseFlag(args, "api");
      await runExport(pageTitle, format, modelConfig, apiUrl);
      break;
    }
    case "watch": {
      const pageTitle = args[1];
      if (!pageTitle) {
        console.error("Usage: wikihistory watch <page> [--section <name>]");
        process.exit(1);
      }
      const section = parseFlag(args, "section");
      const apiUrl = parseFlag(args, "api");
      await runWatch(pageTitle, section, apiUrl);
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

function parseModelConfig(args: string[]): ModelConfig | undefined {
  const provider = parseFlag(args, "model");
  if (!provider) return undefined;

  if (!["openai", "anthropic", "deepseek", "local", "byok"].includes(provider)) {
    console.error(`Unknown model provider: ${provider}. Use openai, anthropic, deepseek, local, or byok.`);
    process.exit(1);
  }

  return {
    provider: provider as ModelConfig["provider"],
    apiKey: parseFlag(args, "model-api-key"),
    model: parseFlag(args, "model-name"),
    endpoint: parseFlag(args, "model-endpoint"),
  };
}
