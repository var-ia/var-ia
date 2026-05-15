#!/usr/bin/env bun
/**
 * 06 — Custom Model Adapter (L2 Deep Dive)
 *
 * The L2 adapter interface is the hardest thing in Varia to
 * understand from types alone. This script walks through it
 * step by step:
 *
 *   1. Running the L1 pipeline to produce deterministic events
 *   2. Building lineage context for the adapter
 *   3. Creating an adapter (OpenAI, Anthropic, DeepSeek, local/Ollama, or BYOK)
 *   4. Interpreting events with confidence scores
 *   5. Building a consensus adapter that requires N models to agree
 *   6. Writing your own custom adapter from scratch
 *
 * Unlike the other examples, this one requires API keys:
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
 * It will still run without them and show the adapter setup flow.
 *
 * Usage: bun run examples/06-custom-model-adapter.ts
 */

import { MediaWikiClient } from "@var-ia/ingestion";
import {
  sectionDiffer,
  citationTracker,
  templateTracker,
  revertDetector,
  classifyHeuristic,
  buildSectionLineage,
} from "@var-ia/analyzers";
import type {
  EvidenceEvent,
  Revision,
  ModelInterpretation,
  PolicyDimension,
} from "@var-ia/evidence-graph";
import { createAdapter, ConsensusAdapter } from "@var-ia/interpreter";
import type { ModelAdapter, LineageContext, ModelConfig } from "@var-ia/interpreter";

// ── Step 1: L1 Pipeline ──────────────────────────────────────────────

const PAGE = "CRISPR";
const DEPTH = 8;

const client = new MediaWikiClient({ minDelayMs: 200 });
const revisions = await client.fetchRevisions(PAGE, { direction: "newer", limit: DEPTH });

console.log(`Step 1: L1 pipeline — ${revisions.length} revisions of "${PAGE}"`);
console.log();

const events: EvidenceEvent[] = [];

for (let i = 1; i < revisions.length; i++) {
  const before = revisions[i - 1];
  const after = revisions[i];

  const sectionChanges = sectionDiffer.diffSections(
    sectionDiffer.extractSections(before.content),
    sectionDiffer.extractSections(after.content),
  );

  const citeChanges = citationTracker.diffCitations(
    citationTracker.extractCitations(before.content),
    citationTracker.extractCitations(after.content),
  );

  for (const c of sectionChanges.filter((s) => s.changeType !== "unchanged")) {
    events.push({
      eventType: "section_reorganized",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: c.section,
      before: (c.fromContent ?? "").slice(0, 500),
      after: (c.toContent ?? "").slice(0, 500),
      deterministicFacts: [{ fact: `section "${c.section}" ${c.changeType}` }],
      layer: "observed",
      timestamp: after.timestamp,
    });
  }

  for (const c of citeChanges.filter((c) => c.type !== "unchanged")) {
    events.push({
      eventType: `citation_${c.type}` as EvidenceEvent["eventType"],
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "",
      before: c.before?.raw ?? "",
      after: c.after?.raw ?? "",
      deterministicFacts: [
        { fact: `citation ${c.type}`, detail: c.after?.title ?? c.before?.title ?? "" },
      ],
      layer: "observed",
      timestamp: after.timestamp,
    });
  }
}

console.log(`  ${events.length} deterministic events generated`);
console.log();

// ── Step 2: Build Lineage Context ────────────────────────────────────

const sectionLineage = buildSectionLineage(
  revisions.map((r) => ({ revId: r.revId, timestamp: r.timestamp, content: r.content })),
);

const lineageContext: LineageContext = {
  sectionLineages: sectionLineage.map((s) => ({
    sectionName: s.sectionName,
    events: s.events.map((e) => `${e.eventType} in rev ${e.revisionId}`),
    isActive: s.isActive,
  })),
};

console.log(`Step 2: Lineage context`);
console.log(`  ${lineageContext.sectionLineages?.length} section histories`);
for (const s of lineageContext.sectionLineages ?? []) {
  console.log(`    "${s.sectionName}": ${s.events.length} events, ${s.isActive ? "active" : "removed"}`);
}
console.log();

// ── Step 3: Create an Adapter ────────────────────────────────────────

console.log(`Step 3: Creating model adapters`);
console.log();

function showAdapterSetup(config: ModelConfig): void {
  const keyPresent = config.apiKey || envVarForProvider(config.provider);
  console.log(`  ${config.provider}:`);
  console.log(`    model:    ${config.model ?? "(default)"}`);
  console.log(`    endpoint: ${config.endpoint ?? "(default)"}`);
  console.log(`    api key:  ${keyPresent ? "✓ set" : "✗ not set (will fail on interpret())"}`);
  if (keyPresent) {
    try {
      const adapter = createAdapter(config);
      console.log(`    adapter:  ✓ created`);
    } catch (e) {
      console.log(`    adapter:  ✗ ${(e as Error).message}`);
    }
  }
}

showAdapterSetup({ provider: "openai" });
showAdapterSetup({ provider: "anthropic" });
showAdapterSetup({ provider: "local", model: "llama3", endpoint: "http://localhost:11434" });
showAdapterSetup({
  provider: "byok",
  model: "your-model",
  endpoint: "https://your-endpoint.example.com/v1",
  apiKey: process.env.BYOK_API_KEY,
});

console.log();

// ── Step 4: Run Interpretation ───────────────────────────────────────

const activeProvider = (["openai", "anthropic", "deepseek"] as const)
  .find((p) => envVarForProvider(p));
const localAvailable = checkOllama();

let adapter: ModelAdapter | null = null;

if (activeProvider) {
  adapter = createAdapter({ provider: activeProvider as ModelConfig["provider"] });
  console.log(`Step 4: Running interpretation via ${activeProvider}`);
  console.log(`  Sending ${events.length} events + lineage context to model…`);
  try {
    const interpreted = await adapter.interpret(events, lineageContext);
    console.log(`  Received ${interpreted.length} interpreted events`);
    for (const ie of interpreted) {
      const mi = ie.modelInterpretation;
      console.log(`    [${ie.eventType}] ${mi.semanticChange} (conf: ${mi.confidence.toFixed(2)})`);
      if (mi.policyDimension) console.log(`      policy: ${mi.policyDimension}`);
    }
  } catch (e) {
    console.log(`  Interpretation failed: ${(e as Error).message}`);
  }
} else if (localAvailable) {
  adapter = createAdapter({ provider: "local", model: "llama3" });
  console.log(`Step 4: Running interpretation via local Ollama`);
  try {
    const interpreted = await adapter.interpret(events, lineageContext);
    console.log(`  Received ${interpreted.length} interpreted events`);
  } catch (e) {
    console.log(`  Ollama error: ${(e as Error).message}`);
  }
} else {
  console.log(`Step 4: No API keys set (OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY)`);
  console.log(`  and Ollama not running at http://localhost:11434`);
  console.log(`  Set one of these env vars to see live interpretation.`);
}
console.log();

// ── Step 5: Consensus Adapter ────────────────────────────────────────

console.log(`Step 5: Consensus adapter (multi-model agreement)`);
console.log(`  The ConsensusAdapter runs N adapters and returns only`);
console.log(`  interpretations where a minimum number agree.`);
console.log();

const availableAdapters: ModelAdapter[] = [];
if (activeProvider) {
  availableAdapters.push(createAdapter({ provider: activeProvider as ModelConfig["provider"] }));
  console.log(`  Would use ${activeProvider} + local as consensus pair`);
  console.log(`  (only the configured provider is available — second adapter skipped)`);
} else {
  console.log(`  No adapters available — set API keys to test consensus mode.`);
}
console.log();

// ── Step 6: Custom Adapter from Scratch ──────────────────────────────

console.log(`Step 6: Writing a custom adapter`);
console.log(`
  import type { ModelAdapter, EvidenceEvent, InterpretedEvent } from "@var-ia/interpreter";

  const myAdapter: ModelAdapter = {
    async interpret(events, lineage) {
      return events.map((event, index) => ({
        ...event,
        modelInterpretation: {
          semanticChange: classifyMyWay(event),
          confidence: 0.85,
          policyDimension: detectPolicy(event),
        },
      }));
    },
  };

  // Use it anywhere a ModelAdapter is expected — CLI, ConsensusAdapter, etc.
`);

function envVarForProvider(provider: string): string | undefined {
  switch (provider) {
    case "openai": return process.env.OPENAI_API_KEY;
    case "anthropic": return process.env.ANTHROPIC_API_KEY;
    case "deepseek": return process.env.DEEPSEEK_API_KEY;
    case "byok": return process.env.BYOK_API_KEY;
    default: return undefined;
  }
}

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:11434/api/tags");
    return res.ok;
  } catch {
    return false;
  }
}
