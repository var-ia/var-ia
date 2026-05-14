import { Command } from "commander";
import type { ModelConfig } from "@var-ia/interpreter";
import { runAnalyze } from "./commands/analyze.js";
import { runCron } from "./commands/cron.js";
import { runDiff } from "./commands/diff.js";
import type { DiffResult } from "./commands/diff.js";
import { runVisualize } from "./commands/visualize.js";
import { runClaim } from "./commands/claim.js";
import { runEval } from "./commands/eval.js";
import { runExport } from "./commands/export.js";
import { runWatch } from "./commands/watch.js";
import { bold, cyan, dim, formatEvent, gray, green, heading, red, success } from "./render.js";

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

// ── cron ──
const cronCmd = program
  .command("cron <pages-file>")
  .description("one-shot re-observation for cron (exits 1 if new events detected)")
  .option("-i, --interval <hours>", "lookback window in hours (default: from last observation)", parseInt);
withGlobal(cronCmd);
cronCmd.action(async (pagesFile, opts) => {
  const result = await runCron(
    pagesFile,
    opts.interval as number | undefined,
    opts.api as string | undefined,
    opts.cacheDir as string | undefined,
  );
  if (result.totalNewEvents > 0) {
    process.exit(1);
  }
});

// ── visualize ──
const visualizeCmd = program
  .command("visualize <page>")
  .description("export evidence graph as Mermaid or DOT diagram")
  .option("-f, --format <format>", "output format: mermaid, dot", "mermaid")
  .option("--all", "show all event types (default: claim events only)");
withGlobal(visualizeCmd);
visualizeCmd.action(async (page, opts) => {
  await runVisualize(page, opts.format as string, !!opts.all, opts.api as string | undefined);
});

// ── diff ──
const diffCmd = program
  .command("diff <topic>")
  .description("cross-wiki comparison of the same topic (2+ wikis)")
  .requiredOption("--wiki-a <url>", "first wiki API URL")
  .requiredOption("--wiki-b <url>", "second wiki API URL")
  .option("--wiki-c <url>", "third wiki API URL (optional)")
  .option("--wiki-d <url>", "fourth wiki API URL (optional)")
  .option("--wiki-e <url>", "fifth wiki API URL (optional)")
  .option("--wiki-f <url>", "sixth wiki API URL (optional)")
  .option("-d, --depth <depth>", "analysis depth: brief, detailed, forensic", "detailed");
withModel(diffCmd);
diffCmd.action(async (topic, opts) => {
  const wikiUrls = [
    opts.wikiA as string,
    opts.wikiB as string,
    ...(opts.wikiC ? [opts.wikiC as string] : []),
    ...(opts.wikiD ? [opts.wikiD as string] : []),
    ...(opts.wikiE ? [opts.wikiE as string] : []),
    ...(opts.wikiF ? [opts.wikiF as string] : []),
  ];

  const result = await runDiff(topic, wikiUrls, opts.depth as string, extractModel(opts));
  printUserFacingDiff(result);
});

function printUserFacingDiff(result: DiffResult): void {
  const { wikis, comparison, outliers } = result;
  const labels = wikis.length <= 26
    ? wikis.map((_, i) => String.fromCharCode(65 + i))
    : wikis.map((_, i) => `W${i + 1}`);

  console.log(heading(`Cross-Wiki Diff: "${result.pageTitle}"`));
  for (let i = 0; i < wikis.length; i++) {
    console.log(`  ${bold(`Wiki ${labels[i]}:`)} ${dim(wikis[i].url)}`);
  }
  console.log();

  console.log(bold("── Overview ──"));
  console.log(`  ${"Total events".padEnd(14)} ${comparison.totalEvents.map((n) => cyan(String(n).padStart(6))).join(" ")}`);
  console.log(`  ${"Sections".padEnd(14)} ${comparison.totalSections.map((n) => String(n).padStart(6)).join(" ")}`);
  console.log(`  ${"Citations".padEnd(14)} ${wikis.map((w) => String(w.summary.citations).padStart(6)).join(" ")}`);
  console.log(`  ${"Templates".padEnd(14)} ${wikis.map((w) => String(w.summary.templates).padStart(6)).join(" ")}`);
  console.log(`  ${"Reverts".padEnd(14)} ${wikis.map((w) => String(w.summary.reverts).padStart(6)).join(" ")}`);
  console.log(`  ${"Categories".padEnd(14)} ${wikis.map((w) => String(w.summary.categories).padStart(6)).join(" ")}`);
  console.log(`  ${"Wikilinks".padEnd(14)} ${wikis.map((w) => String(w.summary.wikilinks).padStart(6)).join(" ")}`);

  if (comparison.eventTypeDiffs.length > 0) {
    console.log(bold("\n── Event Type Breakdown ──"));
    const headerLabels = labels.map((l) => l.padStart(5));
    console.log(`  ${"Event Type".padEnd(28)} ${headerLabels.join(" ")}`);
    console.log(`  ${"─".repeat(28)} ${"─".repeat(6 * labels.length - 1)}`);
    for (const d of comparison.eventTypeDiffs) {
      const label = d.eventType.padEnd(28);
      const values = d.counts.map((c, i) => {
        const str = String(c).padStart(5);
        const baselineZero = i === 0;
        if (!baselineZero && c !== d.counts[0]) {
          return c > d.counts[0] ? green(str) : red(str);
        }
        return str;
      });
      console.log(`  ${label} ${values.join(" ")}`);
    }
  }

  if (outliers.length > 0) {
    console.log(bold("\n── Outliers (|z-score| > 2) ──"));
    for (const o of outliers) {
      const sign = o.zScore > 0 ? "+" : "";
      console.log(`  Wiki ${o.wikiLabel}: ${o.eventType} = ${cyan(String(o.count))} (mean=${o.mean}, z=${sign}${o.zScore})`);
    }
  }
}

// ── eval ──
const evalCmd = program
  .command("eval")
  .description("run evaluation harness against benchmark pages or ground truth")
  .option("--page <title>", "run only benchmarks for a specific page")
  .option("--ground-truth <path|builtin>", "validate against L3 ground truth labels")
  .option("--l2", "run L2 quality benchmarks against synthetic dataset");
withModel(evalCmd);
evalCmd.action(async (opts) => {
  await runEval(
    opts.page as string | undefined,
    opts.groundTruth as string | undefined,
    !!opts.l2,
    extractModel(opts),
  );
});

export async function cli(args: string[]): Promise<void> {
  if (args.length === 0) {
    program.outputHelp();
    return;
  }
  await program.parseAsync(args, { from: "user" });
}


