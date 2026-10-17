import type { ActivityEvent, UsageSummary } from "@/types";

export const seedEvents: ActivityEvent[] = [
  {
    id: "ev-1",
    type: "chat-started",
    title: "Chat started",
    description: "Session 'Atlas: replace the legacy colour tokens' opened with Hermes Pro.",
    timestamp: "2026-02-18T09:12:00.000Z",
    durationMs: 2140,
    status: "success",
    actor: "user",
    target: "ch-atlas-1",
    demo: true,
  },
  {
    id: "ev-2",
    type: "tool-called",
    title: "Tool called",
    description: "code.execute finished in the Atlas project.",
    timestamp: "2026-02-18T09:11:40.000Z",
    durationMs: 1180,
    status: "success",
    actor: "hermes",
    target: "tool-code",
    demo: true,
  },
  {
    id: "ev-3",
    type: "model-changed",
    title: "Model changed",
    description: "Active model switched from Hermes Mini to Hermes Pro.",
    timestamp: "2026-02-18T08:30:00.000Z",
    status: "info",
    actor: "user",
    target: "m-hermes-pro",
    demo: true,
  },
  {
    id: "ev-4",
    type: "mcp-connected",
    title: "MCP connected",
    description: "The filesystem server answered its handshake in 24 ms.",
    timestamp: "2026-02-18T08:10:00.000Z",
    durationMs: 24,
    status: "success",
    actor: "system",
    target: "mcp-fs",
    demo: true,
  },
  {
    id: "ev-5",
    type: "automation-executed",
    title: "Automation executed",
    description: "Nightly dependency audit finished with 2 advisories.",
    timestamp: "2026-02-18T03:00:41.000Z",
    durationMs: 41200,
    status: "success",
    actor: "system",
    target: "au-daily",
    demo: true,
  },
  {
    id: "ev-6",
    type: "error",
    title: "Error",
    description: "Orion uptime probe timed out after 5000 ms.",
    timestamp: "2026-02-18T06:00:05.000Z",
    durationMs: 5000,
    status: "error",
    actor: "system",
    target: "au-cron",
    demo: true,
  },
  {
    id: "ev-7",
    type: "skill-enabled",
    title: "Skill enabled",
    description: "The security-audit skill was enabled for the workspace.",
    timestamp: "2026-02-17T13:20:00.000Z",
    status: "success",
    actor: "user",
    target: "sk-security-audit",
    demo: true,
  },
  {
    id: "ev-8",
    type: "browser-session",
    title: "Browser session",
    description: "Chromium session started in the isolated profile.",
    timestamp: "2026-02-17T11:02:00.000Z",
    durationMs: 840,
    status: "success",
    actor: "system",
    target: "browser",
    demo: true,
  },
  {
    id: "ev-9",
    type: "project-created",
    title: "Project created",
    description: "Ember Sandbox was added as a scratch workspace.",
    timestamp: "2026-02-10T10:10:00.000Z",
    status: "info",
    actor: "user",
    target: "pr-ember",
    demo: true,
  },
  {
    id: "ev-10",
    type: "provider-updated",
    title: "Provider updated",
    description: "The OpenRouter provider was marked as authenticated.",
    timestamp: "2026-02-09T16:44:00.000Z",
    status: "info",
    actor: "user",
    target: "p-openrouter",
    demo: true,
  },
];

const modelUsage = [
  { modelId: "m-hermes-pro", name: "Hermes Pro", requests: 412, tokens: 612000, cost: 8.42 },
  { modelId: "m-hermes-mini", name: "Hermes Mini", requests: 286, tokens: 198000, cost: 0 },
  { modelId: "m-or-llama-free", name: "Llama 3.3 70B (Free)", requests: 154, tokens: 142000, cost: 0 },
  { modelId: "m-or-qwen-free", name: "Qwen2.5 Coder 32B (Free)", requests: 98, tokens: 86000, cost: 0 },
  { modelId: "m-or-mistral-small", name: "Mistral Small 3.2", requests: 64, tokens: 74000, cost: 0.31 },
];

const toolUsage = [
  { toolId: "tool-files", name: "files.readWrite", calls: 1204 },
  { toolId: "tool-code", name: "code.execute", calls: 517 },
  { toolId: "tool-terminal", name: "terminal.exec", calls: 412 },
  { toolId: "tool-browser", name: "browser.navigate", calls: 233 },
  { toolId: "tool-search", name: "search.web", calls: 189 },
];

const daySeries = (days: number, seed: number) => {
  const result: UsageSummary["points"] = [];
  const now = new Date("2026-02-18T12:00:00.000Z");
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now.getTime() - i * 86_400_000);
    const wave = Math.sin((days - i + seed) / 2.4);
    const requests = Math.round(46 + wave * 18 + ((days - i) % 5) * 4);
    const tokens = requests * (1180 + ((days - i + seed) % 7) * 90);
    result.push({
      date: date.toISOString().slice(0, 10),
      requests,
      tokens,
      cost: Number((requests * 0.021).toFixed(2)),
      modelId: "m-hermes-pro",
    });
  }
  return result;
};

export const seedUsage: UsageSummary = {
  points: daySeries(14, 3),
  totalRequests: 1014,
  totalTokens: 1_112_000,
  totalCost: 8.73,
  byModel: modelUsage,
  byTool: toolUsage,
};
