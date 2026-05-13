---
agent: agent
description: Run build, lint, typecheck, and test — fix any failures at root cause
---
Run the full verification gate:

```
bun run build && bun run lint && bun run typecheck && bun run test
```

If any step fails, fix the root cause and re-run from `bun run build`. Do not chain multiple fix-attempt commits. One fix, verify, then stop.
