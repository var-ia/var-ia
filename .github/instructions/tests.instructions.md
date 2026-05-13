---
applyTo: "**/*.test.ts"
description: "Vitest test conventions for varia"
---
# Test conventions

Use `describe`/`it`/`expect` from vitest (global injection is on but explicit imports are used).

Test files live at `src/__tests__/*.test.ts` within each package. They are excluded from tsc builds via tsconfig `exclude`.

## Running tests
- All: `bun run test`
- Single file: `bun run vitest run packages/evidence-graph/src/__tests__/hash-identity.test.ts`

## Timeouts
- Default: 30s (from vitest.config.ts)
- Integration tests hitting live Wikipedia API: set `{ timeout: 60000 }` or higher per-test
- Unit tests: rely on default

## Integration testing
- Cross-package integration tests import from `dist/` via dynamic `import()`:
  ```ts
  const { sectionDiffer } = await import("../../../analyzers/dist/src/index.js");
  ```
- Source code must never import from `dist/`.

## Mocking
- Prefer `vi.fn()` for function mocks.
- Keep test files self-contained; do not create shared test utilities unless multiple test files use the same mock fixture.
