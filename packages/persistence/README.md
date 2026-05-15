# @var-ia/persistence

SQLite persistence layer. Uses `bun:sqlite` — Bun only.

```bash
bun add @var-ia/persistence
```

## Exports

### Class

- `Persistence` — full CRUD for revisions and claims

### Interface

- `PersistenceAdapter` — `insertRevision`, `insertRevisions`, `getRevisions`, `hasRevision`, `insertClaim`, `getClaims`, `close`

```ts
import { Persistence } from "@var-ia/persistence";
import type { PersistenceAdapter, PersistenceConfig } from "@var-ia/persistence";
```

[Sequent](https://github.com/var-ia/sequent) · [Docs](https://github.com/var-ia/sequent-docs)
