# @var-ia/ingestion

Wikimedia API adapters — revision fetching, diffing, rate limiting.

```bash
bun add @var-ia/ingestion
```

## Exports

### Interfaces

- `RevisionFetcher` — fetch revisions by page title
- `RevisionSource` — async iterable revision stream
- `DiffFetcher` — fetch diff between two revisions

### Classes

- `MediaWikiClient` — Wikipedia REST API client with pagination and error handling
- `RateLimiter` — configurable request throttling

```ts
import { MediaWikiClient, RateLimiter } from "@var-ia/ingestion";
import type { RevisionFetcher, RevisionOptions } from "@var-ia/ingestion";
```

[Varia](https://github.com/var-ia/var-ia) · [Docs](https://github.com/var-ia/varia-docs) · [npm](https://www.npmjs.com/package/@var-ia/ingestion)
