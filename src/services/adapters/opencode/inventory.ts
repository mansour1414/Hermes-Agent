/**
 * OpenCode model inventory contract.
 *
 * The control center never talks to OpenCode directly. Instead the integrator
 * exports a JSON inventory (see OPENCODE_INVENTORY_CONTRACT.md) and the UI reads
 * it through this adapter. The distinction between the four readiness axes
 * (catalog / configured / authenticated / verified) is preserved end to end.
 */
import type { ModelInfo } from "@/types";
import { HermesServiceError } from "@/services/errors";

export interface OpenCodeInventoryEntry {
  modelId: string;
  name: string;
  providerId: string;
  providerName: string;
  pricing: "free" | "paid";
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: {
    reasoning: boolean;
    vision: boolean;
    toolCalling: boolean;
    streaming: boolean;
    jsonMode: boolean;
  };
  releaseDate: string;
  tags: string[];
  description?: string;
  configured?: boolean;
  authenticated?: boolean;
  verified?: boolean;
  rateLimitPerMinute?: number;
}

export interface OpenCodeInventory {
  schemaVersion: "1.0";
  generatedAt: string;
  source: "opencode";
  models: OpenCodeInventoryEntry[];
}

export interface OpenCodeInventoryAdapter {
  load(): Promise<ModelInfo[]>;
  isLoaded(): boolean;
}

export function parseOpenCodeInventory(raw: unknown): ModelInfo[] {
  if (!raw || typeof raw !== "object") {
    throw new HermesServiceError("validation", "The OpenCode inventory file is not valid JSON.");
  }
  const inventory = raw as Partial<OpenCodeInventory>;
  if (inventory.schemaVersion !== "1.0" || !Array.isArray(inventory.models)) {
    throw new HermesServiceError(
      "validation",
      "The OpenCode inventory must use schemaVersion 1.0 and contain a models array.",
    );
  }
  return inventory.models.map((entry) => ({
    id: `oc-${entry.modelId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    modelId: entry.modelId,
    name: entry.name,
    providerId: entry.providerId,
    providerName: entry.providerName,
    source: "opencode",
    pricing: entry.pricing,
    inputPrice: entry.inputPrice,
    outputPrice: entry.outputPrice,
    contextWindow: entry.contextWindow,
    maxOutputTokens: entry.maxOutputTokens,
    capabilities: entry.capabilities,
    catalogAvailable: true,
    configured: entry.configured ?? false,
    authenticated: entry.authenticated ?? false,
    verified: entry.verified ?? false,
    status: entry.verified
      ? "verified"
      : entry.authenticated
        ? "authenticated"
        : entry.configured
          ? "configured"
          : "available",
    description: entry.description ?? "Imported from the OpenCode inventory.",
    releaseDate: entry.releaseDate,
    tags: entry.tags,
    favorite: false,
    inFallbackChain: false,
    rateLimitPerMinute: entry.rateLimitPerMinute,
  }));
}

/** In-memory adapter used by the demo build and by the integrator's tests. */
export function createOpenCodeInventoryAdapter(raw?: unknown): OpenCodeInventoryAdapter {
  let models: ModelInfo[] = [];

  return {
    async load() {
      if (raw === undefined) {
        throw new HermesServiceError(
          "unsupported",
          "No OpenCode inventory has been provided. Export one following OPENCODE_INVENTORY_CONTRACT.md.",
        );
      }
      models = parseOpenCodeInventory(raw);
      return models;
    },
    isLoaded() {
      return models.length > 0;
    },
  };
}
