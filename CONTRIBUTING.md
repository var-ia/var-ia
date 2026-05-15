# Contributing

## Repository Boundary

Contributions must stay inside the open-source observability boundary described
in [docs/repository-boundary.md](./docs/repository-boundary.md). Varia must not
include healthcare-specific logic, domain-specific source weighting, or
customer-workflow rules.

## Commit Convention

Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.

## Code Style

- TypeScript throughout
- No comments unless explaining a non-obvious constraint (not what code does — what it must not do)

## Pull Requests

1. PR description must state what the code shows, not what it claims
2. New analyzers must include an eval (even a single sample page)
3. Architecture changes require an ARCHITECTURE.md update in the same PR

## What Not to Contribute

- ❌ Features that target or identify individual editors
- ❌ Sentiment analysis or toxicity scoring of editor behavior
- ❌ Prediction or forecasting modules
- ❌ Automated Wikipedia editing or templating
- ❌ Claims about "truth" or "accuracy" of Wikipedia content
- ❌ Healthcare-specific vocabulary (drug names, FDA, clinical trials, payer language) — this repo is domain-agnostic
