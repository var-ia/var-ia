## Summary

<!-- What does this PR show, not claim? (required) -->

## Related issue

<!-- Closes #123 or N/A -->

## Type of change

- [ ] L1 (deterministic)
- [ ] L2 (model-assisted)
- [ ] L3 (eval / ground truth)
- [ ] Infrastructure / tooling
- [ ] Documentation

## Verification

- [ ] `bun run build` passes
- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] New analyzers include an eval (even single sample page)
- [ ] Model prompt changes include before/after confidence scores on 3 pages
- [ ] Architecture changes update ARCHITECTURE.md

## Scope check

<!-- Confirm your change does not violate the forbidden contributions list -->

- [ ] I read `docs/repository-boundary.md`
- [ ] Does not target individual editors, score sentiment, predict outcomes, automate editing, or make truth claims
- [ ] Does not add healthcare decision judgment, payer/guideline logic, source weighting, thresholds, production backtests, outcome-data claims, customer workflows, or NextConsensus-private logic
