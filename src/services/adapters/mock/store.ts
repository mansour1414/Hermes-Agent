/**
 * Mock repository — the single source of truth for demo data.
 *
 * It keeps an in-memory state seeded from `src/data/seed` and mirrors the
 * mutable slice into `localStorage` so that demo edits survive a reload.
 * Replacing this file with a real backend is the only change required to
 * move from demo mode to a live Hermes instance.
 */
import {
  seedActiveModelId,
  seedFallbackChain,
  seedModels,
} from "@/data/seed/models";
import { seedProviders } from "@/data/seed/providers";
import { seedMcpServers, seedSkills, seedTools } from "@/data/seed/capabilities";
import {
  seedAutomations,
  seedFiles,
  seedIntegrations,
  seedMemoryItems,
  seedProjects,
} from "@/data/seed/workspace";
import { seedChats } from "@/data/seed/chats";
import { seedEvents, seedUsage } from "@/data/seed/activity";
import type {
  ActivityEvent,
  Automation,
  ChatSession,
  FileEntry,
  Integration,
  McpServer,
  MemoryItem,
  ModelInfo,
  Project,
  ProviderInfo,
  SkillInfo,
  ToolInfo,
  UsageSummary,
} from "@/types";

const STORAGE_KEY = "hermes.demo.store.v1";

export interface DemoState {
  models: ModelInfo[];
  providers: ProviderInfo[];
  activeModelId: string;
  fallbackChain: string[];
  mcpServers: McpServer[];
  skills: SkillInfo[];
  tools: ToolInfo[];
  projects: Project[];
  chats: ChatSession[];
  files: FileEntry[];
  memory: MemoryItem[];
  automations: Automation[];
  integrations: Integration[];
  events: ActivityEvent[];
  usage: UsageSummary;
}

type PersistedSlice = Pick<
  DemoState,
  | "models"
  | "activeModelId"
  | "fallbackChain"
  | "mcpServers"
  | "skills"
  | "tools"
  | "projects"
  | "chats"
  | "memory"
  | "automations"
  | "integrations"
  | "events"
>;

function seedState(): DemoState {
  return {
    models: structuredClone(seedModels),
    providers: structuredClone(seedProviders),
    activeModelId: seedActiveModelId,
    fallbackChain: [...seedFallbackChain],
    mcpServers: structuredClone(seedMcpServers),
    skills: structuredClone(seedSkills),
    tools: structuredClone(seedTools),
    projects: structuredClone(seedProjects),
    chats: structuredClone(seedChats),
    files: structuredClone(seedFiles),
    memory: structuredClone(seedMemoryItems),
    automations: structuredClone(seedAutomations),
    integrations: structuredClone(seedIntegrations),
    events: structuredClone(seedEvents),
    usage: structuredClone(seedUsage),
  };
}

function loadState(): DemoState {
  const base = seedState();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PersistedSlice>;
    return { ...base, ...parsed, providers: base.providers, files: base.files, usage: base.usage };
  } catch {
    return base;
  }
}

let state: DemoState = loadState();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  const slice: PersistedSlice = {
    models: state.models,
    activeModelId: state.activeModelId,
    fallbackChain: state.fallbackChain,
    mcpServers: state.mcpServers,
    skills: state.skills,
    tools: state.tools,
    projects: state.projects,
    chats: state.chats,
    memory: state.memory,
    automations: state.automations,
    integrations: state.integrations,
    events: state.events.slice(0, 200),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
  } catch {
    /* storage is unavailable — demo state simply stays in memory */
  }
}

function emit() {
  persist();
  listeners.forEach((listener) => listener());
}

export const demoStore = {
  getState: (): DemoState => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setState(updater: (draft: DemoState) => DemoState | void) {
    const next = updater(state);
    if (next) state = next;
    emit();
  },

  reset() {
    state = seedState();
    emit();
  },

  pushEvent(event: ActivityEvent) {
    state = { ...state, events: [event, ...state.events].slice(0, 300) };
    emit();
  },
};

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/** Simulated network latency so loading states are exercised in the demo. */
export function delay(min = 120, max = 320): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
