# @var-ia/observable

Observable Framework data loader for Sequent evidence exports. Loads JSON or SQLite
evidence cache and exposes the full event stream in Observable notebooks.

```bash
# Not published to npm — use from the monorepo
```

## Exports

- `SequentLoader` — DataLoader class that reads Sequent JSON/L or SQLite exports
  and provides a structured `EvidenceEvent` stream for Observable Framework.

```ts
import { SequentLoader } from "@var-ia/observable";

const loader = new SequentLoader({ path: "./bitcoin-analysis.json" });
// loader.load() → { events: EvidenceEvent[], metadata: { page, revisionCount, ... } }
```

---

Part of the [Sequent](https://github.com/var-ia/sequent) project — a deterministic
observation engine for public revision histories.
