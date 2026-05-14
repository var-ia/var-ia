# @var-ia/persistence

SQLite persistence layer for varia. Uses `bun:sqlite` — Bun only.

## Exports

### Class

- `Persistence` — full CRUD for revisions and claims

### Interface

- `PersistenceAdapter` — `insertRevision`, `insertRevisions`, `getRevisions`, `hasRevision`, `insertClaim`, `getClaims`, `close`

```ts
import { Persistence } from "@var-ia/persistence";
import type { PersistenceAdapter, PersistenceConfig } from "@var-ia/persistence";
```
