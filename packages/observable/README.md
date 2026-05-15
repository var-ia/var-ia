# @refract-org/observable

Observable Framework data loader for Refract evidence exports. Loads JSON or SQLite
evidence cache and exposes the full event stream in Observable notebooks.

```bash
# Not published to npm — use from the monorepo
```

## Exports

- `RefractLoader` — DataLoader class that reads Refract JSON/L or SQLite exports
  and provides a structured `EvidenceEvent` stream for Observable Framework.

```ts
import { RefractLoader } from "@refract-org/observable";

const loader = new RefractLoader({ path: "./bitcoin-analysis.json" });
// loader.load() → { events: EvidenceEvent[], metadata: { page, revisionCount, ... } }
```

---

Part of the [Refract](https://github.com/refract-org/sequent) project — a deterministic
observation engine for public revision histories.
