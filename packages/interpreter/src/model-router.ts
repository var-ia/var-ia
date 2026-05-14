import type { EvidenceEvent, PolicyDimension } from "@var-ia/evidence-graph";
import type { ModelAdapter, InterpretedEvent, LineageContext } from "./index.js";
import { createAdapter } from "./index.js";
import { ConsensusAdapter } from "./consensus-adapter.js";
import type { ConsensusConfig } from "./consensus-adapter.js";

export interface ModelRoute {
  model: string;
  endpoint?: string;
  label?: string;
  dimensions?: PolicyDimension[];
  temperature?: number;
}

export interface RouterConfig {
  routes?: ModelRoute[];
  minConsensus?: number;
  confidenceThreshold?: number;
  probeEndpoint?: boolean;
}

const DEFAULT_ROUTES: ModelRoute[] = [
  {
    model: "qwen2.5:7b",
    label: "qwen-general",
    dimensions: ["verifiability", "npov", "due_weight", "blp"],
    temperature: 0.1,
  },
  {
    model: "llama3.2:3b",
    label: "llama-protection",
    dimensions: ["protection", "edit_warring", "civility"],
    temperature: 0.1,
  },
  {
    model: "qwen2.5:7b",
    label: "qwen-notability",
    dimensions: ["notability", "copyright"],
    temperature: 0.1,
  },
];

export class ModelRouter implements ModelAdapter {
  private routes: ModelRoute[];
  private minConsensus: number;
  private confidenceThreshold: number;
  private probeEndpoint: boolean;
  private cachedAdapter: ConsensusAdapter | null = null;

  constructor(config?: RouterConfig) {
    this.routes = config?.routes ?? DEFAULT_ROUTES;
    this.minConsensus = config?.minConsensus ?? 2;
    this.confidenceThreshold = config?.confidenceThreshold ?? 0.5;
    this.probeEndpoint = config?.probeEndpoint ?? true;
  }

  async interpret(
    events: EvidenceEvent[],
    lineage?: LineageContext,
  ): Promise<InterpretedEvent[]> {
    const adapter = await this.getOrCreateAdapter();
    return adapter.interpret(events, lineage);
  }

  private async getOrCreateAdapter(): Promise<ConsensusAdapter> {
    if (this.cachedAdapter) return this.cachedAdapter;

    const reachable: ModelRoute[] = [];

    for (const route of this.routes) {
      if (this.probeEndpoint) {
        try {
          const ok = await probeModel(route.endpoint ?? "http://localhost:11434");
          if (ok) reachable.push(route);
        } catch {
          continue;
        }
      } else {
        reachable.push(route);
      }
    }

    if (reachable.length === 0) {
      throw new Error(
        "No reachable local models found. Start Ollama: ollama serve && ollama pull qwen2.5:7b",
      );
    }

    const adapters: ModelAdapter[] = reachable.map((r) =>
      createAdapter({
        provider: "local",
        model: r.model,
        endpoint: r.endpoint ?? "http://localhost:11434",
        temperature: r.temperature ?? 0.1,
      }),
    );

    const config: ConsensusConfig = {
      adapters,
      minConsensus: Math.min(this.minConsensus, reachable.length),
      confidenceThreshold: this.confidenceThreshold,
      agreementKey: (interp) => `${interp.policyDimension ?? "general"}:${interp.semanticChange}`,
    };

    this.cachedAdapter = new ConsensusAdapter(config);
    return this.cachedAdapter;
  }
}

async function probeModel(endpoint: string): Promise<boolean> {
  const response = await fetch(`${endpoint}/api/tags`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) return false;
  const data = (await response.json()) as { models?: Array<unknown> };
  return Array.isArray(data.models) && data.models.length > 0;
}
