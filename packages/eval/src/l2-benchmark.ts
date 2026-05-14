import type { EvidenceEvent } from "@var-ia/evidence-graph";
import type { ModelConfig } from "@var-ia/interpreter";
import { createAdapter } from "@var-ia/interpreter";

export interface L2TestCase {
  id: string;
  description: string;
  events: EvidenceEvent[];
  expected: ExpectedInterpretation[];
}

export interface ExpectedInterpretation {
  eventIndex: number;
  semanticChange?: string;
  confidence?: number;
  policyDimension?: string;
  discussionType?: string;
}

export interface L2MetricScore {
  metric: string;
  correct: number;
  total: number;
  accuracy: number;
}

export interface L2ProviderResult {
  provider: string;
  model: string;
  metrics: L2MetricScore[];
  avgConfidence: number;
  overallAccuracy: number;
  totalEvents: number;
}

export interface L2BenchmarkResult {
  generatedAt: string;
  testCases: number;
  totalEvents: number;
  providers: L2ProviderResult[];
}

export async function runL2Benchmark(providers: ModelConfig[]): Promise<L2BenchmarkResult> {
  const testCases = buildL2Dataset();
  const totalEvents = testCases.reduce((s, tc) => s + tc.events.length, 0);
  const providerResults: L2ProviderResult[] = [];

  for (const config of providers) {
    try {
      const adapter = createAdapter(config);
      const results = await runProviderBenchmark(config, adapter, testCases);
      providerResults.push(results);
    } catch {
      providerResults.push({
        provider: config.provider,
        model: config.model ?? "unknown",
        metrics: [],
        avgConfidence: 0,
        overallAccuracy: 0,
        totalEvents: 0,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    testCases: testCases.length,
    totalEvents,
    providers: providerResults,
  };
}

async function runProviderBenchmark(
  config: ModelConfig,
  adapter: ReturnType<typeof createAdapter>,
  testCases: L2TestCase[],
): Promise<L2ProviderResult> {
  let eventsCorrect = 0;
  let totalEvents = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;

  const metricBuckets: Record<string, { correct: number; total: number }> = {
    semanticChange: { correct: 0, total: 0 },
    policyDimension: { correct: 0, total: 0 },
    discussionType: { correct: 0, total: 0 },
  };

  for (const tc of testCases) {
    const interpreted = await adapter.interpret(tc.events);

    for (const exp of tc.expected) {
      const actual = interpreted[exp.eventIndex];
      if (!actual?.modelInterpretation) continue;

      totalEvents++;
      let eventCorrect = true;

      if (exp.semanticChange) {
        metricBuckets.semanticChange.total++;
        if (actual.modelInterpretation.semanticChange === exp.semanticChange) {
          metricBuckets.semanticChange.correct++;
        } else {
          eventCorrect = false;
        }
      }

      if (exp.policyDimension) {
        metricBuckets.policyDimension.total++;
        if (actual.modelInterpretation.policyDimension === exp.policyDimension) {
          metricBuckets.policyDimension.correct++;
        } else {
          eventCorrect = false;
        }
      }

      if (exp.discussionType) {
        metricBuckets.discussionType.total++;
        if (actual.modelInterpretation.discussionType === exp.discussionType) {
          metricBuckets.discussionType.correct++;
        } else {
          eventCorrect = false;
        }
      }

      if (eventCorrect) eventsCorrect++;

      if (exp.confidence !== undefined) {
        totalConfidence += actual.modelInterpretation.confidence;
        confidenceCount++;
      }
    }
  }

  const metrics: L2MetricScore[] = Object.entries(metricBuckets)
    .filter(([, b]) => b.total > 0)
    .map(([metric, b]) => ({
      metric,
      correct: b.correct,
      total: b.total,
      accuracy: b.total > 0 ? Math.round((b.correct / b.total) * 10000) / 100 : 0,
    }));

  return {
    provider: config.provider,
    model: config.model ?? "default",
    metrics,
    avgConfidence: confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) / 100 : 0,
    overallAccuracy: totalEvents > 0 ? Math.round((eventsCorrect / totalEvents) * 10000) / 100 : 0,
    totalEvents,
  };
}

export function printBenchmarkResult(result: L2BenchmarkResult): void {
  console.log(`\n=== L2 Quality Benchmarks ===`);
  console.log(`Test cases: ${result.testCases} (${result.totalEvents} events)`);
  console.log(`Providers:  ${result.providers.length}`);
  console.log();

  for (const p of result.providers) {
    console.log(`── ${p.provider}/${p.model} ──`);
    if (p.totalEvents === 0) {
      console.log("  (skipped — no results)");
      continue;
    }
    console.log(`  Overall accuracy: ${p.overallAccuracy}%`);
    console.log(`  Avg confidence:  ${p.avgConfidence}`);
    for (const m of p.metrics) {
      console.log(`  ${m.metric}: ${m.correct}/${m.total} (${m.accuracy}%)`);
    }
    console.log();
  }
}

function makeEvent(overrides: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return {
    eventType: "claim_first_seen",
    fromRevisionId: 1,
    toRevisionId: 2,
    section: "lead",
    before: "",
    after: "",
    deterministicFacts: [],
    layer: "observed",
    timestamp: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function buildL2Dataset(): L2TestCase[] {
  return [
    {
      id: "simple-claim-add",
      description: "A new factual claim appears in the lead section",
      events: [
        makeEvent({
          eventType: "claim_first_seen",
          section: "lead",
          after: "Earth is the third planet from the Sun",
          deterministicFacts: [{ fact: "claim_detected", detail: "sentence_length=42" }],
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "factual claim introduced",
          policyDimension: "verifiability",
        },
      ],
    },
    {
      id: "claim-removal",
      description: "A claim is removed between revisions",
      events: [
        makeEvent({
          eventType: "claim_removed",
          section: "body",
          before: "Some scientists believe the theory is flawed",
          deterministicFacts: [{ fact: "claim_removed", detail: "sentence_length=42" }],
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "factual claim removed",
          policyDimension: "verifiability",
        },
      ],
    },
    {
      id: "claim-softened",
      description: "A claim is softened with hedging language",
      events: [
        makeEvent({
          eventType: "claim_softened",
          section: "body",
          before: "The drug cures the disease",
          after: "The drug may help treat the disease",
          deterministicFacts: [{ fact: "claim_changed", detail: "change=softened" }],
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "claim softened with hedging",
          policyDimension: "npov",
        },
      ],
    },
    {
      id: "claim-strengthened",
      description: "A claim is strengthened with more definitive language",
      events: [
        makeEvent({
          eventType: "claim_strengthened",
          section: "body",
          before: "The event may have occurred in 1920",
          after: "The event occurred in 1920",
          deterministicFacts: [{ fact: "claim_changed", detail: "change=strengthened" }],
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "claim strengthened with definitive language",
        },
      ],
    },
    {
      id: "citation-added",
      description: "A citation is added to support a claim",
      events: [
        makeEvent({
          eventType: "citation_added",
          section: "body",
          after: '<ref name="smith2023">{{cite journal |title=Study}}</ref>',
          deterministicFacts: [{ fact: "citation_changed", detail: "type=added" }],
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "citation added to support claim",
          policyDimension: "verifiability",
        },
      ],
    },
    {
      id: "citation-removed",
      description: "A citation is removed from a claim",
      events: [
        makeEvent({
          eventType: "citation_removed",
          section: "body",
          before: '<ref name="old2020">{{cite web |title=Old}}</ref>',
          deterministicFacts: [{ fact: "citation_changed", detail: "type=removed" }],
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "citation removed from article",
          policyDimension: "verifiability",
        },
      ],
    },
    {
      id: "template-npov",
      description: "A POV template is added, indicating neutrality concern",
      events: [
        makeEvent({
          eventType: "template_added",
          section: "body",
          after: "POV",
          deterministicFacts: [
            { fact: "template_changed", detail: "name=POV type=added" },
            { fact: "policy_signal", detail: "dimension=npov signal=pov" },
          ],
          layer: "policy_coded",
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "neutrality concern template added",
          policyDimension: "npov",
        },
      ],
    },
    {
      id: "blp-template",
      description: "A BLP template is added to a biography",
      events: [
        makeEvent({
          eventType: "template_added",
          section: "body",
          after: "BLP sources",
          deterministicFacts: [
            { fact: "template_changed", detail: "name=BLP sources type=added" },
            { fact: "policy_signal", detail: "dimension=blp signal=blp_sources" },
          ],
          layer: "policy_coded",
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "BLP sourcing concern template added",
          policyDimension: "blp",
        },
      ],
    },
    {
      id: "revert-detected",
      description: "A revert is detected in edit war",
      events: [
        makeEvent({
          eventType: "revert_detected",
          section: "",
          after: "Undid revision 123456 by UserX",
          deterministicFacts: [
            { fact: "revert_detected", detail: "Undid revision 123456 by UserX" },
            { fact: "policy_signal", detail: "dimension=edit_warring signal=revert_detected" },
          ],
          layer: "policy_coded",
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "revert detected indicating edit warring",
          policyDimension: "edit_warring",
        },
      ],
    },
    {
      id: "talk-sourcing-dispute",
      description: "Talk page discussion about sourcing",
      events: [
        makeEvent({
          eventType: "talk_page_correlated",
          section: "Sources",
          deterministicFacts: [{ fact: "talk_revision_match", detail: "type=discussion" }],
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "talk page discussion about sources",
          discussionType: "sourcing_dispute",
        },
      ],
    },
    {
      id: "talk-notability",
      description: "Talk page discussion about notability",
      events: [
        makeEvent({
          eventType: "talk_page_correlated",
          section: "Notability",
          deterministicFacts: [{ fact: "talk_revision_match", detail: "type=discussion" }],
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "talk page discussion about notability",
          discussionType: "notability_challenge",
        },
      ],
    },
    {
      id: "category-change",
      description: "Category added, changing page classification",
      events: [
        makeEvent({
          eventType: "category_added",
          section: "",
          after: "Living people",
          deterministicFacts: [{ fact: "category_added", detail: "category=Living people" }],
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "category added to page classification",
        },
      ],
    },
    {
      id: "protection-change",
      description: "Page protection level changed",
      events: [
        makeEvent({
          eventType: "protection_changed",
          section: "",
          after: "protect",
          deterministicFacts: [
            { fact: "protection_changed", detail: "name=pp-protect type=added" },
            { fact: "policy_signal", detail: "dimension=protection signal=page_protected" },
          ],
          layer: "policy_coded",
        }),
      ],
      expected: [
        {
          eventIndex: 0,
          semanticChange: "page protection level changed",
          policyDimension: "protection",
        },
      ],
    },
  ];
}
