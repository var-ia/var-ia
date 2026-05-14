# Examples

## CLI

```bash
wikihistory analyze "Earth" --depth brief
wikihistory analyze "COVID-19 pandemic" --depth detailed
wikihistory claim "Theranos" --text "revolutionary blood testing technology"
wikihistory export "COVID-19 pandemic" --format json
wikihistory analyze "Donald Trump" --depth detailed --model openai
wikihistory analyze --pages-file pages.txt --depth brief
wikihistory eval
```

## Library — programmatic analysis

```ts
// Use individual analyzers programmatically
import { sectionDiffer, citationTracker } from "@var-ia/analyzers";
import { MediaWikiClient } from "@var-ia/ingestion";
import type { EvidenceEvent } from "@var-ia/evidence-graph";

const client = new MediaWikiClient();
const revisions = await client.fetchRevisions("Earth", { limit: 10 });

for (let i = 1; i < revisions.length; i++) {
  const before = revisions[i - 1].content;
  const after = revisions[i].content;

  const sections = sectionDiffer.diffSections(
    sectionDiffer.extractSections(before),
    sectionDiffer.extractSections(after),
  );

  const citations = citationTracker.diffCitations(
    citationTracker.extractCitations(before),
    citationTracker.extractCitations(after),
  );

  console.log(`Revision ${revisions[i].revId}:`);
  console.log(`  Sections changed: ${sections.length}`);
  console.log(`  Citation changes: ${citations.length}`);
}
```

## Custom model adapter

```ts
import { createAdapter } from "@var-ia/interpreter";
import type { ModelAdapter } from "@var-ia/interpreter";

// OpenAI
const openai = createAdapter({ provider: "openai" });

// Local Ollama
const local = createAdapter({ provider: "local", model: "llama3" });

// Bring your own endpoint
const byok = createAdapter({
  provider: "byok",
  endpoint: "https://your-endpoint.com/v1",
  model: "your-model",
  apiKey: process.env.YOUR_API_KEY,
});
```

## Evaluation harness

```ts
import { createEvalHarness } from "@var-ia/eval";
import { MediaWikiClient } from "@var-ia/ingestion";
import { sectionDiffer } from "@var-ia/analyzers";

const harness = createEvalHarness();
const client = new MediaWikiClient();
const results = [];

for (const test of harness.benchmarkPages()) {
  const revisions = await client.fetchRevisions(test.pageTitle, { limit: 20 });
  // Run analyzers to produce evidence events
  const events = runAnalyzers(revisions); // your event pipeline
  const result = harness.evaluate(test, events);
  results.push(result);
}

const summary = harness.computeScores(results);
console.log(`Precision: ${summary.overallPrecision}`);
console.log(`Passed: ${summary.testsPassed}/${summary.totalTests}`);
```
