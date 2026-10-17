/**
 * Loader for the exported OpenCode inventory.
 *
 * The control center never talks to OpenCode at runtime. Instead the integrator
 * exports a JSON snapshot (see `tools/generate-opencode-inventory.ps1` and
 * OPENCODE_INVENTORY_CONTRACT.md) into `public/opencode-inventory.json`, and this
 * loader reads it over the same origin that serves the app.
 *
 * Failure is non-fatal: the Hermes model list still renders and the Models page
 * explains that the OpenCode inventory has not been exported.
 */
import type { ModelInfo } from "@/types";
import { parseOpenCodeInventory } from "./inventory";

const INVENTORY_URL = "/opencode-inventory.json";

let cache: ModelInfo[] | null = null;
let inflight: Promise<ModelInfo[]> | null = null;
let lastError: string | null = null;

export function getOpenCodeInventoryError(): string | null {
  return lastError;
}

export async function loadOpenCodeInventory(): Promise<ModelInfo[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch(INVENTORY_URL, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`GET ${INVENTORY_URL} -> HTTP ${response.status}`);
      }
      const raw: unknown = await response.json();
      const models = parseOpenCodeInventory(raw);
      cache = models;
      lastError = null;
      return models;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (typeof console !== "undefined") {
        console.warn("[opencode] inventory not available:", lastError);
      }
      cache = [];
      return cache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
