import { Command } from "commander";
import type { ModelConfig } from "@var-ia/interpreter";
import { runAnalyze } from "./commands/analyze.js";
import { runClaim } from "./commands/claim.js";
import { runDiff } from "./commands/diff.js";
import { runEval } from "./commands/eval.js";
import { runExport } from "./commands/export.js";
import { runWatch } from "./commands/watch.js";
import { bold, cyan, dim, formatEvent, gray, green, heading, red, success, table } from "./render.js";

function withModel(cmd: Command): Command {
  return cmd
    .option("-m, --model <provider>", "model provider: openai, anthropic, deepseek, local, byok")
    .option("--model-api-key <key>", "API key for model provider")
    .option("--model-name <name>", "model name override")
    .option("--model-endpoint <url>", "API endpoint override")
    .option("--temperature <n>", "model temperature (default: 0.1)", parseFloat)
    .option("--prompt <text>", "override system prompt for interpretation");
}

function withGlobal(cmd: Command): Command {
  return cmd.option("--api <url>", "MediaWiki API base URL").option("--cache-dir <path>", "cache directory path");
}

function extractModel(opts: Record<string, unknown>): ModelConfig | undefined {
  if (!opts.model) return undefined;
  return {
    provider: opts.model as ModelConfig["provider"],
    apiKey: opts.modelApiKey as string | undefined,
    model: opts.modelName as string | undefined,
    endpoint: opts.modelEndpoint as string | undefined,
    temperature: opts.temperature as number | undefined,
    systemPrompt: opts.prompt as string | undefined,
  };
}

const program = new Command();

program
  .name("wikihistory")
  .description("Wikipedia edit history analysis — deterministic L1 observation engine")
  .version("0.3.1")
  .addHelpCommand("help [command]", "show help for a specific command");

// ── analyze ──
const analyzeCmd = program
  .command("analyze [page]")
  .description("analyze full edit history of a page")
  .option("-d, --depth <depth>", "analysis depth: brief, detailed, forensic", "detailed")
  .option("--from <revId>", "start revision ID")
  .option("--to <revId>", "end revision ID")
  .option("--since <timestamp>", "re-observe from ISO timestamp")
  .option("-c, --cache", "cache revisions in SQLite (~/.wikihistory/varia.db)")
  .option("--pages-file <path>", "batch file of page titles (one per line)")
  .option("--router", "use local open-weight models via Ollama");
withModel(analyzeCmd);
withGlobal(analyzeCmd);
analyzeCmd.action(async (page, opts) => {
  const pagesFile = opts.pagesFile as string | undefined;
  const modelConfig = extractModel(opts);

  if (pagesFile) {
    const result = await runAnalyze(
      "",
      opts.depth as string,
      opts.from ? parseInt(opts.from as string, 10) : undefined,
      opts.to ? parseInt(opts.to as string, 10) : undefined,
      opts.since as string | undefined,
      !!opts.cache,
      modelConfig,
      opts.api as string | undefined,
      pagesFile,
      opts.cacheDir as string | undefined,
      !!opts.router,
    );
    console.log(`\n${success(`Batch complete. ${result.events.length} events total.`)}`);
    return;
  }

  if (!page) {
    console.error(red("Error: page title required (or use --pages-file for batch mode)"));
    console.error(gray("  wikihistory analyze <page> [options]"));
    process.exit(1);
  }

  const { events } = await runAnalyze(
    page,
    opts.depth as string,
    opts.from ? parseInt(opts.from as string, 10) : undefined,
    opts.to ? parseInt(opts.to as string, 10) : undefined,
    opts.since as string | undefined,
    !!opts.cache,
    modelConfig,
    opts.api as string | undefined,
    undefined,
    opts.cacheDir as string | undefined,
    !!opts.router,
  );

  console.log(heading("Analysis Results"));
  console.log(`  ${bold("Page:")}    ${page}`);
  console.log(`  ${bold("Events:")}  ${cyan(String(events.length))}`);
  if (opts.since) console.log(`  ${gray(`Re-observation since: ${opts.since}`)}`);
  console.log();

  for (const event of events) {
    console.log(formatEvent(event));
  }

  if (events.length === 0) {
    console.log(gray("  No events detected."));
  }
});

// ── claim ──
const claimCmd = program
  .command("claim <page>")
  .description("track a specific claim across revisions")
  .option("-t, --text <text>", "claim text to track (required)")
  .option("-c, --cache", "cache revisions in SQLite");
withModel(claimCmd);
withGlobal(claimCmd);
claimCmd.action(async (page, opts) => {
  const claimText = opts.text as string | undefined;
  if (!claimText) {
    console.error(red("Error: --text is required"));
    process.exit(1);
  }
  await runClaim(
    page,
    claimText,
    !!opts.cache,
    extractModel(opts),
    opts.api as string | undefined,
    opts.cacheDir as string | undefined,
  );
});

// ── export ──
const exportCmd = program
  .command("export <page>")
  .description("export analysis as structured data")
  .option("-f, --format <format>", "output format: json, csv, ndjson", "json")
  .option("--bundle", "export as signed evidence bundle with SHA-256 hash")
  .option("--manifest", "export as replay manifest listing all hashes");
withModel(exportCmd);
withGlobal(exportCmd);
exportCmd.action(async (page, opts) => {
  await runExport(
    page,
    opts.format as string,
    extractModel(opts),
    opts.api as string | undefined,
    !!opts.bundle,
  );
});

// ── watch ──
const watchCmd = program
  .command("watch <page>")
  .description("live polling daemon for new edits")
  .option("-s, --section <name>", "watch a specific section only")
  .option("-i, --interval <ms>", "poll interval in ms (default: 60000)", parseInt)
  .option("--api <url>", "MediaWiki API base URL");
watchCmd.action(async (page, opts) => {
  await runWatch(page, opts.section as string | undefined, opts.api as string | undefined, opts.interval as number | undefined);
});

// ── diff ──
const diffCmd = program
  .command("diff <topic>")
  .description("cross-wiki comparison of the same topic")
  .requiredOption("--wiki-a <url>", "first wiki API URL")
  .requiredOption("--wiki-b <url>", "second wiki API URL")
  .option("-d, --depth <depth>", "analysis depth: brief, detailed, forensic", "detailed");
withModel(diffCmd);
diffCmd.action(async (topic, opts) => {
  const result = await runDiff(
    topic,
    opts.wikiA as string,
    opts.wikiB as string,
    opts.depth as string,
    extractModel(opts),
  );

  console.log(heading(`Cross-Wiki Diff: "${result.pageTitle}"`));
  console.log(`  ${bold("Wiki A:")} ${dim(result.wikiA.url)}`);
  console.log(`  ${bold("Wiki B:")} ${dim(result.wikiB.url)}`);
  console.log();

  console.log(bold("── Overview ──"));
  console.log(`  Total events: A=${cyan(String(result.comparison.totalEventsA))}, B=${cyan(String(result.comparison.totalEventsB))}`);
  console.log(`  Sections:     A=${result.wikiA.sections.length}, B=${result.wikiB.sections.length}`);
  console.log(`  Citations:    A=${result.wikiA.summary.citations}, B=${result.wikiB.summary.citations}`);
  console.log(`  Templates:    A=${result.wikiA.summary.templates}, B=${result.wikiB.summary.templates}`);
  console.log(`  Reverts:      A=${result.wikiA.summary.reverts}, B=${result.wikiB.summary.reverts}`);
  console.log(`  Categories:   A=${result.wikiA.summary.categories}, B=${result.wikiB.summary.categories}`);
  console.log(`  Wikilinks:    A=${result.wikiA.summary.wikilinks}, B=${result.wikiB.summary.wikilinks}`);
  console.log();

  if (result.comparison.eventTypeDiffs.length > 0) {
    console.log(bold("── Event Type Breakdown ──"));
    const rows = result.comparison.eventTypeDiffs.map((d) => {
      const sign = d.diff > 0 ? "+" : "";
      return [
        d.eventType,
        String(d.aCount),
        String(d.bCount),
        d.diff === 0 ? gray(String(d.diff)) : d.diff > 0 ? green(`${sign}${d.diff}`) : red(`${d.diff}`),
      ];
    });
    console.log(table(["Event Type", "A", "B", "\u0394"], rows, ["left", "right", "right", "right"]));
  }
});

// ── eval ──
const evalCmd = program
  .command("eval")
  .description("run evaluation harness against benchmark pages or ground truth")
  .option("--page <title>", "run only benchmarks for a specific page")
  .option("--ground-truth <path|builtin>", "validate against L3 ground truth labels");
evalCmd.action(async (opts) => {
  await runEval(opts.page as string | undefined, opts.groundTruth as string | undefined);
});

export async function cli(args: string[]): Promise<void> {
  if (args.length === 0) {
    program.outputHelp();
    return;
  }
  await program.parseAsync(args, { from: "user" });
}

export { parseFlag } from "./parse-flag.js";
