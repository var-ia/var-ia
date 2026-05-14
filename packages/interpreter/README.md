# @var-ia/interpreter

Pluggable model adapter for semantic interpretation of evidence events. L2 in the three-knowledge-split architecture.

## Exports

### Functions

- `createAdapter(config)` — create a model adapter for the specified provider

### Interfaces

- `ModelAdapter` — `interpret(events)` → `InterpretedEvent[]`
- `ModelConfig` — `{ provider, apiKey?, model?, endpoint? }`

### Supported providers

| Provider | Config name | Default model | Auth |
|----------|-------------|---------------|------|
| OpenAI | `openai` | `gpt-4o` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| DeepSeek | `deepseek` | `deepseek-chat` | `DEEPSEEK_API_KEY` |
| Local (Ollama) | `local` | `llama3` | None |
| Bring Your Own Key | `byok` | Required | `BYOK_API_KEY` + endpoint |

```ts
import { createAdapter } from "@var-ia/interpreter";
import type { ModelAdapter, ModelConfig, InterpretedEvent } from "@var-ia/interpreter";
```
