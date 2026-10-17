import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Services } from "@/services/contracts";
import { mockServices } from "@/services/adapters/mock";
import { createHermesServices } from "@/services/adapters/hermes";

const ServicesContext = createContext<Services | null>(null);

export type AdapterMode = "mock" | "hermes";

/** localStorage key used ONLY to opt back into the demo adapter (testing). */
export const ADAPTER_MODE_KEY = "cc.adapter-mode";

/**
 * Chooses the active adapter.
 *
 * The REAL Hermes adapter is the default. Demo data is never shown unless
 * something explicitly opts out, and the UI flags that state with the demo
 * banner so demo rows can never be mistaken for live data.
 *
 * Precedence: build-time `VITE_HERMES_MODE` > runtime `localStorage` > default.
 */
export function resolveAdapterMode(): AdapterMode {
  const configured =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env.VITE_HERMES_MODE as string | undefined)
      : undefined;

  let stored: string | null = null;
  if (typeof localStorage !== "undefined") {
    try {
      stored = localStorage.getItem(ADAPTER_MODE_KEY);
    } catch {
      stored = null;
    }
  }

  if (configured === "mock" || stored === "mock") return "mock";
  if (configured === "hermes" || stored === "hermes") return "hermes";
  return "hermes";
}

/** True only when the app is running on the in-memory demo adapter. */
export function isDemoMode(): boolean {
  return resolveAdapterMode() === "mock";
}

export function createServices(mode: AdapterMode = "hermes"): Services {
  return mode === "hermes" ? createHermesServices() : mockServices;
}

export function ServicesProvider({
  children,
  mode,
}: {
  children: ReactNode;
  mode?: AdapterMode;
}) {
  const value = useMemo(() => createServices(mode ?? resolveAdapterMode()), [mode]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error("useServices must be used within <ServicesProvider>");
  }
  return services;
}

export * from "@/services/contracts";
export { HermesServiceError } from "@/services/errors";
