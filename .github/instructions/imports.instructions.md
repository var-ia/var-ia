---
applyTo: "**/*.ts"
description: "Import and module conventions"
---
# Import conventions

## Cross-package
```ts
import type { EvidenceEvent } from "@var-ia/evidence-graph";
import { sectionDiffer } from "@var-ia/analyzers";
```

Always use `import type` for type-only imports. Biome's `useImportType` rule enforces this.

## Intra-package
```ts
import { createClaimIdentity } from "./hash-identity.js";
```

Relative paths with `.js` extension. No `.ts` extension in imports.

## Built-ins
```ts
import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";
```

## Forbidden
- Never import from `dist/` in source code.
- Never use `import type` for runtime values.
- Never use bare specifiers without `.js` extension for intra-package imports.
