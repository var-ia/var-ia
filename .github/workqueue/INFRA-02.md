---
id: INFRA-02
status: ready
priority: 11
dependencies: [L1-07]
packages: [cli, persistence]
layer: INFRA
effort: medium
---

# Scheduled Re-Observation

## What
Add `wikihistory watch --cron` that re-observes a page on a schedule, diffs against the prior observation (L1-07), and writes the delta to a file.

## Why
L1-07 added `--since` for manual re-observation. Next step: make it cron-friendly. A nightly cron job observing 50 fandom pages should emit a delta report per page and exit with 0 if nothing changed, 1 if new events were detected. No polling loop — just one-shot with persistent state.

## Context
Read first:
- `packages/cli/src/index.ts` — CLI dispatch
- `packages/cli/src/commands/analyze.ts` — `fromTimestamp` handling from L1-07
- `packages/analyzers/src/observation-differ.ts` — diffObservations

## Implementation
1. Add `wikihistory cron <pages-file> [--interval hours]` command
2. For each page: run analyze with `--since` set to the last observation timestamp (stored in `~/.wikihistory/observations/`)
3. Save the delta as a JSON report: `{ pageTitle, observedAt, eventsNew, eventsResolved, deltaSummary }`
4. If any page has new events, exit 1 (for cron alerting)
5. If all pages are unchanged, exit 0

## Invariants
- No daemon or polling loop — one-shot execution
- Uses same observation file format as L1-07
- Compatible with `--api` for non-Wikipedia instances

## Acceptance
- [ ] `wikihistory cron pages.txt` processes all pages, saves delta reports
- [ ] Exit 1 when new events detected, exit 0 when none
- [ ] Compatible with existing `--api` flag
- [ ] Gate: build, lint, typecheck, test
