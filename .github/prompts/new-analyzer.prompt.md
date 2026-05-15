---
agent: agent
description: Scaffold a new L1 deterministic analyzer package
tools: ['search/codebase', 'read/file', 'edit/file']
---
Scaffold a new deterministic (L1) analyzer package. Use `${input:name}` for the kebab-case package name.

## Package structure
Copy the pattern from `packages/analyzers/`:
```
packages/${input:name}/
├── package.json       # @var-ia/${input:name}, type:module, main: dist/src/index.js
├── tsconfig.json      # composite:true, target:ES2022, module:NodeNext
│                      # references: ["../evidence-graph"], exclude: ["src/__tests__"]
└── src/
    ├── index.ts        # Public barrel — export only what's needed
    └── __tests__/
        └── ${input:name}.test.ts   # Basic shape test + one deterministic invariant
```

## Requirements
- No model calls in the analyzer (L1 invariant)
- Byte-for-byte reproducible output
- Package name must be added to root `tsconfig.json` references and root `package.json` workspaces
- Must include at minimum one eval test on a stable Wikipedia page

After scaffolding, run `/gate` to verify the build passes.
