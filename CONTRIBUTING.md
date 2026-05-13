# Contributing

## Phase Discipline

All measurement claims must carry a phase tag. The phase indicates how much validation supports the claim:

| Phase | Allowed | Meaning |
|-------|---------|---------|
| **Phase 0** | Nothing | No production backtest. Internal exploration only. |
| **Phase 1b** | Cross-lane transferability | Claim transfers across contexts. Lane-specific values prohibited. |
| **Phase 2a** | n=1 values with caveat | Validated on one case. No generalization. |
| **Phase 2b** | Full validated claims | Holdout > 0, multiple independent backtests. |

Unsure of a claim's phase → Phase 0.

## Commit Convention

Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.

## Code Style

- TypeScript throughout
- No comments unless explaining a non-obvious constraint (not what code does — what it must not do)
- Deterministic code before model code
- Model code never receives raw text — always pre-extracted evidence

## Pull Requests

1. PR description must state what the code shows, not what it claims
2. New analyzers must include an eval (even a single sample page)
3. Model prompt changes must include before/after confidence scores on 3 sample pages
4. Architecture changes require an ARCHITECTURE.md update in the same PR

## What Not to Contribute

- ❌ Features that target or identify individual editors
- ❌ Sentiment analysis or toxicity scoring of editor behavior
- ❌ Prediction or forecasting modules
- ❌ Automated Wikipedia editing or templating
- ❌ Claims about "truth" or "accuracy" of Wikipedia content
- ❌ Healthcare-specific vocabulary (drug names, FDA, clinical trials, payer language) — this repo is domain-agnostic
