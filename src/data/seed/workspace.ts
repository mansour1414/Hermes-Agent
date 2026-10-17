import type { Automation, FileEntry, Integration, MemoryItem, Project } from "@/types";

export const seedProjects: Project[] = [
  {
    id: "pr-atlas",
    name: "Atlas Dashboard",
    nameAr: "لوحة أطلس",
    description: "Rebuild of the internal analytics dashboard with a new design system.",
    icon: "rocket",
    color: "#0d9488",
    path: "D:\\hermes\\workspace\\atlas",
    createdAt: "2025-12-04T10:00:00.000Z",
    updatedAt: "2026-02-18T08:20:00.000Z",
    preferredModelId: "m-hermes-pro",
    conversationIds: ["ch-atlas-1", "ch-atlas-2"],
    toolIds: ["tool-files", "tool-terminal", "tool-code"],
    skillIds: ["sk-review", "sk-test-writer"],
    instructions:
      "Prefer TypeScript strict mode. Keep the design tokens in styles/theme.css and never hard-code colours.",
    fileCount: 128,
  },
  {
    id: "pr-orion",
    name: "Orion API",
    nameAr: "واجهة أوريون",
    description: "Public API gateway with rate limiting, usage metering and OpenAPI docs.",
    icon: "cube",
    color: "#6366f1",
    path: "D:\\hermes\\workspace\\orion",
    createdAt: "2025-10-19T14:30:00.000Z",
    updatedAt: "2026-02-17T17:05:00.000Z",
    preferredModelId: "m-or-mistral-small",
    conversationIds: ["ch-orion-1"],
    toolIds: ["tool-terminal", "tool-code", "tool-postgres"],
    skillIds: ["sk-refactor", "sk-doc-writer"],
    instructions: "Every endpoint needs a request id, structured logs and a matching integration test.",
    fileCount: 312,
  },
  {
    id: "pr-nimbus",
    name: "Nimbus Docs",
    nameAr: "مستندات نيمبوس",
    description: "Bilingual documentation site with an Arabic-first reading experience.",
    icon: "book",
    color: "#f59e0b",
    path: "D:\\hermes\\workspace\\nimbus",
    createdAt: "2026-01-08T09:15:00.000Z",
    updatedAt: "2026-02-16T11:48:00.000Z",
    preferredModelId: "m-or-llama-free",
    conversationIds: ["ch-nimbus-1"],
    toolIds: ["tool-files", "tool-search"],
    skillIds: ["sk-localization", "sk-doc-writer"],
    instructions: "Arabic is the primary locale. Never use left/right specific CSS in prose.",
    fileCount: 84,
  },
  {
    id: "pr-nova",
    name: "Nova Research",
    nameAr: "أبحاث نوفا",
    description: "Literature review pipeline that collects and summarises papers.",
    icon: "flask",
    color: "#ec4899",
    path: "D:\\hermes\\workspace\\nova",
    createdAt: "2026-01-22T16:40:00.000Z",
    updatedAt: "2026-02-14T09:02:00.000Z",
    preferredModelId: "m-or-qwen-free",
    conversationIds: [],
    toolIds: ["tool-search", "tool-code", "tool-files"],
    skillIds: ["sk-web-research", "sk-data-analysis"],
    instructions: "Always cite the source URL. Flag any claim that has no supporting evidence.",
    fileCount: 47,
  },
  {
    id: "pr-quartz",
    name: "Quartz Mobile",
    nameAr: "كوارتز للجوال",
    description: "Companion mobile client for the Quartz field-service toolkit.",
    icon: "bolt",
    color: "#0ea5e9",
    path: "D:\\hermes\\workspace\\quartz",
    createdAt: "2025-09-30T08:20:00.000Z",
    updatedAt: "2026-02-12T13:26:00.000Z",
    preferredModelId: "m-hermes-mini",
    conversationIds: ["ch-quartz-1"],
    toolIds: ["tool-code", "tool-files"],
    skillIds: ["sk-test-writer"],
    instructions: "Keep the bundle under 120 kB. Offline mode is mandatory for field technicians.",
    fileCount: 196,
  },
  {
    id: "pr-ember",
    name: "Ember Sandbox",
    nameAr: "بيئة إمبر",
    description: "Scratch space for experiments that are not yet promoted to a real project.",
    icon: "sparkles",
    color: "#ef4444",
    path: "D:\\hermes\\workspace\\ember",
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-02-10T10:10:00.000Z",
    conversationIds: [],
    toolIds: ["tool-code"],
    skillIds: [],
    instructions: "Nothing here is production code.",
    fileCount: 12,
  },
];

export const seedFiles: FileEntry[] = [
  {
    id: "f-readme",
    name: "README.md",
    path: "atlas/README.md",
    type: "file",
    extension: "md",
    size: 2841,
    modifiedAt: "2026-02-18T08:20:00.000Z",
    projectId: "pr-atlas",
    language: "markdown",
    content: `# Atlas Dashboard

Reconstruction of the internal analytics dashboard.

## Stack
- React 19 + TypeScript (strict)
- Vite 7
- Tailwind CSS 4

## Design rules
1. Colours come from the design tokens, never raw hex values.
2. Every interactive element is keyboard reachable.
3. The Arabic layout is the reference layout, not a translation of the English one.
`,
  },
  {
    id: "f-tokens",
    name: "theme.css",
    path: "atlas/styles/theme.css",
    type: "file",
    extension: "css",
    size: 6104,
    modifiedAt: "2026-02-17T15:44:00.000Z",
    projectId: "pr-atlas",
    language: "css",
    content: `:root {
  --cc-canvas: 246 247 249;
  --cc-surface: 255 255 255;
  --cc-accent: 13 148 136;
}

.dark {
  --cc-canvas: 9 11 15;
  --cc-surface: 18 21 28;
  --cc-accent: 45 212 191;
}
`,
  },
  {
    id: "f-app",
    name: "App.tsx",
    path: "atlas/src/App.tsx",
    type: "file",
    extension: "tsx",
    size: 9182,
    modifiedAt: "2026-02-18T07:02:00.000Z",
    projectId: "pr-atlas",
    language: "tsx",
    content: `import { BrowserRouter, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
`,
  },
  {
    id: "f-api",
    name: "gateway.ts",
    path: "orion/src/gateway.ts",
    type: "file",
    extension: "ts",
    size: 14220,
    modifiedAt: "2026-02-17T17:05:00.000Z",
    projectId: "pr-orion",
    language: "ts",
    content: `export async function handle(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const start = performance.now();
  const result = await route(request);
  log.info({ requestId, durationMs: performance.now() - start });
  return result;
}
`,
  },
  {
    id: "f-openapi",
    name: "openapi.yaml",
    path: "orion/docs/openapi.yaml",
    type: "file",
    extension: "yaml",
    size: 24880,
    modifiedAt: "2026-02-15T12:11:00.000Z",
    projectId: "pr-orion",
    language: "yaml",
    content: `openapi: 3.1.0
info:
  title: Orion API
  version: 2.4.0
paths:
  /v1/sessions:
    get:
      summary: List agent sessions
`,
  },
  {
    id: "f-arabic",
    name: "index.ar.md",
    path: "nimbus/content/index.ar.md",
    type: "file",
    extension: "md",
    size: 7420,
    modifiedAt: "2026-02-16T11:48:00.000Z",
    projectId: "pr-nimbus",
    language: "markdown",
    content: `# نيمبوس

هذه الصفحة هي النسخة العربية المرجعية.

> استخدم الخصائص المنطقية في CSS حتى يعمل التخطيط في الاتجاهين.
`,
  },
  {
    id: "f-nova",
    name: "review.md",
    path: "nova/reviews/2026-02.md",
    type: "file",
    extension: "md",
    size: 5120,
    modifiedAt: "2026-02-14T09:02:00.000Z",
    projectId: "pr-nova",
    language: "markdown",
    content: `# مراجعة فبراير 2026

- 12 ورقة تمت مراجعتها
- 3 ادعاءات بلا مصدر
`,
  },
  {
    id: "f-quartz",
    name: "build.gradle",
    path: "quartz/android/app/build.gradle",
    type: "file",
    extension: "gradle",
    size: 3980,
    modifiedAt: "2026-02-12T13:26:00.000Z",
    projectId: "pr-quartz",
    language: "groovy",
    content: `android {
    buildTypes {
        release {
            minifyEnabled true
        }
    }
}
`,
  },
];

export const seedMemoryItems: MemoryItem[] = [
  {
    id: "mem-1",
    title: "Preferred response language",
    content: "The user prefers Arabic-first answers with English identifiers kept in code.",
    category: "preferences",
    tags: ["locale", "style"],
    importance: "high",
    pinned: true,
    createdAt: "2025-12-10T09:00:00.000Z",
    updatedAt: "2026-02-12T10:20:00.000Z",
    source: "manual",
  },
  {
    id: "mem-2",
    title: "Hermes home location",
    content: "Hermes is installed at D:\\hermes with the executable at D:\\hermes\\bin\\hermes.exe.",
    category: "environment",
    tags: ["paths", "windows"],
    importance: "medium",
    pinned: true,
    createdAt: "2025-12-10T09:05:00.000Z",
    updatedAt: "2025-12-10T09:05:00.000Z",
    source: "manual",
  },
  {
    id: "mem-3",
    title: "Free models first",
    content: "Prefer OpenRouter free tier models for routine tasks; use paid models only for hard reasoning.",
    category: "preferences",
    tags: ["cost", "models"],
    importance: "high",
    pinned: false,
    createdAt: "2026-01-05T13:40:00.000Z",
    updatedAt: "2026-02-01T08:15:00.000Z",
    source: "chat",
  },
  {
    id: "mem-4",
    title: "Orion gateway retry policy",
    content: "Orion retries idempotent calls twice with exponential backoff starting at 400 ms.",
    category: "architecture",
    tags: ["orion", "reliability"],
    importance: "medium",
    pinned: false,
    createdAt: "2026-01-12T11:00:00.000Z",
    updatedAt: "2026-01-12T11:00:00.000Z",
    source: "chat",
  },
  {
    id: "mem-5",
    title: "Nimbus editorial rule",
    content: "Arabic pages are written first; English pages are derived and reviewed by a second pass.",
    category: "content",
    tags: ["nimbus", "i18n"],
    importance: "medium",
    pinned: false,
    createdAt: "2026-01-20T15:25:00.000Z",
    updatedAt: "2026-01-28T09:10:00.000Z",
    source: "manual",
  },
  {
    id: "mem-6",
    title: "Quartz offline constraint",
    content: "Field technicians work without connectivity; the mobile client must queue actions locally.",
    category: "architecture",
    tags: ["quartz", "offline"],
    importance: "high",
    pinned: false,
    createdAt: "2026-01-28T10:05:00.000Z",
    updatedAt: "2026-02-05T16:30:00.000Z",
    source: "automation",
  },
  {
    id: "mem-7",
    title: "Code style",
    content: "Named exports only, no barrel files deeper than two levels, comments explain intent not mechanics.",
    category: "preferences",
    tags: ["code-style"],
    importance: "low",
    pinned: false,
    createdAt: "2025-11-30T12:00:00.000Z",
    updatedAt: "2026-01-15T09:45:00.000Z",
    source: "chat",
  },
  {
    id: "mem-8",
    title: "Browser profile isolation",
    content: "Hermes uses its own Chromium profile; personal Chrome profiles are never reused.",
    category: "environment",
    tags: ["browser", "privacy"],
    importance: "high",
    pinned: true,
    createdAt: "2026-02-01T08:30:00.000Z",
    updatedAt: "2026-02-01T08:30:00.000Z",
    source: "manual",
  },
];

export const seedAutomations: Automation[] = [
  {
    id: "au-daily",
    name: "Nightly dependency audit",
    nameAr: "تدقيق الاعتماديات الليلي",
    description: "Scans the workspace for outdated or vulnerable dependencies and opens a report.",
    enabled: true,
    scheduleType: "daily",
    cron: "0 3 * * *",
    time: "03:00",
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    command: "audit dependencies in D:\\hermes\\workspace and summarise the findings",
    projectId: "pr-atlas",
    lastRunAt: "2026-02-18T03:00:00.000Z",
    nextRunAt: "2026-02-19T03:00:00.000Z",
    lastStatus: "success",
    runCount: 148,
    failureCount: 3,
    logs: [
      {
        id: "run-1",
        startedAt: "2026-02-18T03:00:00.000Z",
        durationMs: 41200,
        status: "success",
        output: "Scanned 4 projects. 2 advisories found, both in dev dependencies.",
      },
      {
        id: "run-2",
        startedAt: "2026-02-17T03:00:00.000Z",
        durationMs: 38900,
        status: "success",
        output: "Scanned 4 projects. No blocking advisories.",
      },
      {
        id: "run-3",
        startedAt: "2026-02-16T03:00:00.000Z",
        durationMs: 12400,
        status: "failed",
        output: "Audit aborted before completion.",
        error: "Package registry unreachable: ETIMEDOUT after 12000 ms",
      },
    ],
  },
  {
    id: "au-weekly",
    name: "Weekly docs freshness check",
    nameAr: "فحص حداثة التوثيق الأسبوعي",
    description: "Compares public API routes against the OpenAPI description.",
    enabled: true,
    scheduleType: "weekly",
    cron: "0 9 * * 1",
    time: "09:00",
    days: ["Mon"],
    command: "compare the Orion routes with docs/openapi.yaml and list the differences",
    projectId: "pr-orion",
    lastRunAt: "2026-02-16T09:00:00.000Z",
    nextRunAt: "2026-02-23T09:00:00.000Z",
    lastStatus: "success",
    runCount: 22,
    failureCount: 1,
    logs: [
      {
        id: "run-4",
        startedAt: "2026-02-16T09:00:00.000Z",
        durationMs: 22600,
        status: "success",
        output: "1 undocumented route found: POST /v1/sessions/:id/stop",
      },
    ],
  },
  {
    id: "au-monthly",
    name: "Monthly release digest",
    nameAr: "ملخص الإصدار الشهري",
    description: "Groups the last month of commits into user-facing release notes.",
    enabled: false,
    scheduleType: "monthly",
    cron: "0 8 1 * *",
    time: "08:00",
    days: ["1"],
    command: "summarise the last 30 days of commits in D:\\hermes\\workspace\\atlas",
    projectId: "pr-atlas",
    lastRunAt: "2026-02-01T08:00:00.000Z",
    nextRunAt: "2026-03-01T08:00:00.000Z",
    lastStatus: "success",
    runCount: 6,
    failureCount: 0,
    logs: [
      {
        id: "run-5",
        startedAt: "2026-02-01T08:00:00.000Z",
        durationMs: 61200,
        status: "success",
        output: "4 themes, 31 changes grouped into 6 release-note sections.",
      },
    ],
  },
  {
    id: "au-cron",
    name: "Orion uptime probe",
    nameAr: "فحص جاهزية أوريون",
    description: "Probes the health endpoint every six hours and records the result.",
    enabled: true,
    scheduleType: "cron",
    cron: "0 */6 * * *",
    time: "00:00",
    days: [],
    command: "probe the Orion health endpoint and record the response time",
    projectId: "pr-orion",
    lastRunAt: "2026-02-18T06:00:00.000Z",
    nextRunAt: "2026-02-18T12:00:00.000Z",
    lastStatus: "failed",
    runCount: 312,
    failureCount: 9,
    logs: [
      {
        id: "run-6",
        startedAt: "2026-02-18T06:00:00.000Z",
        durationMs: 5000,
        status: "failed",
        output: "Probe timed out.",
        error: "No response from http://127.0.0.1:8080/health within 5000 ms",
      },
    ],
  },
];

export const seedIntegrations: Integration[] = [
  {
    id: "in-telegram",
    name: "Telegram",
    nameAr: "تيليجرام",
    description: "Receive and send agent messages from a Telegram bot.",
    category: "messaging",
    connected: true,
    requires: ["Bot token from @BotFather", "Chat id of the target channel"],
    settings: [
      { id: "botToken", label: "Bot token", type: "secret-ref", value: "telegram:bot:****92f1" },
      { id: "chatId", label: "Chat id", type: "text", value: "-1004920331" },
    ],
    iconHint: "TG",
    supportedByHermes: true,
    lastSyncAt: "2026-02-18T08:58:00.000Z",
  },
  {
    id: "in-discord",
    name: "Discord",
    nameAr: "ديسكورد",
    description: "Mirror conversations into a Discord channel.",
    category: "messaging",
    connected: false,
    requires: ["Bot token", "Server and channel ids"],
    settings: [
      { id: "botToken", label: "Bot token", type: "secret-ref", value: "" },
      { id: "channelId", label: "Channel id", type: "text", value: "" },
    ],
    iconHint: "DC",
    supportedByHermes: true,
  },
  {
    id: "in-slack",
    name: "Slack",
    nameAr: "سلاك",
    description: "Post summaries and approvals into a Slack workspace.",
    category: "messaging",
    connected: false,
    requires: ["OAuth app with chat:write scope"],
    settings: [{ id: "workspace", label: "Workspace", type: "text", value: "" }],
    iconHint: "SL",
    supportedByHermes: true,
  },
  {
    id: "in-github",
    name: "GitHub",
    nameAr: "غيت هاب",
    description: "Read repositories, open pull requests and post review comments.",
    category: "git",
    connected: true,
    requires: ["Fine-grained personal access token with repository scope"],
    settings: [
      { id: "token", label: "Access token", type: "secret-ref", value: "github:pat:****44c7" },
      { id: "owner", label: "Owner", type: "text", value: "hermes-labs" },
    ],
    iconHint: "GH",
    supportedByHermes: true,
    lastSyncAt: "2026-02-17T22:14:00.000Z",
  },
  {
    id: "in-gmail",
    name: "Gmail",
    nameAr: "جيميل",
    description: "Search and draft email through the Gmail API.",
    category: "email",
    connected: false,
    requires: ["OAuth 2.0 consent for gmail.readonly and gmail.compose"],
    settings: [{ id: "account", label: "Account", type: "text", value: "" }],
    iconHint: "GM",
    supportedByHermes: false,
  },
  {
    id: "in-drive",
    name: "Google Drive",
    nameAr: "جوجل درايف",
    description: "Mount Drive folders as read/write project sources.",
    category: "storage",
    connected: false,
    requires: ["Service account with domain-wide delegation"],
    settings: [{ id: "rootFolderId", label: "Root folder id", type: "text", value: "" }],
    iconHint: "GD",
    supportedByHermes: false,
  },
  {
    id: "in-notion",
    name: "Notion",
    nameAr: "نوشن",
    description: "Read and update pages in a Notion workspace.",
    category: "notes",
    connected: false,
    requires: ["Internal integration token"],
    settings: [{ id: "databaseId", label: "Database id", type: "text", value: "" }],
    iconHint: "NT",
    supportedByHermes: false,
  },
  {
    id: "in-webhook",
    name: "Webhooks",
    nameAr: "خطوط الويب",
    description: "Expose a signed HTTP endpoint that triggers agent runs.",
    category: "webhooks",
    connected: true,
    requires: ["Public HTTPS endpoint with a shared signing secret"],
    settings: [
      { id: "endpoint", label: "Public endpoint", type: "url", value: "https://hooks.hermes.local/incoming" },
      { id: "signingSecret", label: "Signing secret", type: "secret-ref", value: "webhook:secret:****a71e" },
    ],
    iconHint: "WH",
    supportedByHermes: true,
    lastSyncAt: "2026-02-18T07:10:00.000Z",
  },
];
