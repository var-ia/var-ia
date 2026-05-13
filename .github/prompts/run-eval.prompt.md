---
agent: agent
description: Run an evaluation harness on a Wikipedia page
tools: ['run/terminal']
---
Run the evaluation harness from `packages/eval/` against a Wikipedia page.

Ask for:
- Wikipedia page title (e.g. "Earth", "Climate change")
- Number of revisions to sample (default 10)
- Whether to include L2 interpretation (default false — L1 only)

Run the eval and report:
- Total revisions processed
- Sections extracted per revision
- Citation count changes across revisions
- Revert count detected
- Any errors or timeouts

If L2 is included, report confidence scores per interpretation.
