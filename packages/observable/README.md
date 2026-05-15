# @var-ia/observable

Observable Framework data loader for Varia evidence exports. Loads JSON or SQLite
evidence cache and exposes the full event stream in Observable notebooks.

```bash
# Not published to npm — use from the monorepo
```

## Exports

- `VariaLoader` — DataLoader class that reads Varia JSON/L or SQLite exports
  and provides a structured `EvidenceEvent` stream for Observable Framework.

```ts
import { VariaLoader } from "@var-ia/observable";

const loader = new VariaLoader({ path: "./bitcoin-analysis.json" });
// loader.load() → { events: EvidenceEvent[], metadata: { page, revisionCount, ... } }
```

---

Part of the [Varia](https://github.com/var-ia/var-ia) project — a deterministic
observation engine for public revision histories.
