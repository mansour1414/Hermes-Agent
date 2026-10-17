import type { ChatSession } from "@/types";

export const seedChats: ChatSession[] = [
  {
    id: "ch-atlas-1",
    title: "Atlas: replace the legacy colour tokens",
    projectId: "pr-atlas",
    modelId: "m-hermes-pro",
    createdAt: "2026-02-18T08:02:00.000Z",
    updatedAt: "2026-02-18T09:12:00.000Z",
    pinned: true,
    archived: false,
    messageCount: 4,
    totalTokens: 18420,
    demo: true,
    messages: [
      {
        id: "msg-a1",
        role: "user",
        content:
          "The old stylesheet still hard-codes hex values. Migrate it to the new token system without breaking the dark theme.",
        createdAt: "2026-02-18T08:02:00.000Z",
        demo: true,
      },
      {
        id: "msg-a2",
        role: "assistant",
        content: `I inspected the stylesheet and found **37 hard-coded colours**.

Plan:
1. Introduce semantic tokens for canvas, surface, border and ink.
2. Replace each literal with the matching variable.
3. Re-run the visual regression snapshots for both themes.

\`\`\`css
.dashboard-panel {
  background-color: rgb(var(--cc-surface));
  border: 1px solid rgb(var(--cc-border));
  color: rgb(var(--cc-fg));
}
\`\`\`

> This is a generated demo reply produced by the local mock adapter.`,
        createdAt: "2026-02-18T08:03:00.000Z",
        modelId: "m-hermes-pro",
        durationMs: 2140,
        tokens: { prompt: 612, completion: 418, total: 1030 },
        demo: true,
        toolCalls: [
          {
            id: "tc-1",
            name: "files.readWrite",
            status: "success",
            durationMs: 82,
            summary: "Read styles/theme.css and 4 imported partials",
            output: "37 hex literals found across 5 files.",
          },
          {
            id: "tc-2",
            name: "code.execute",
            status: "success",
            durationMs: 1180,
            summary: "Replaced literals with token references",
            output: "Build passed with no remaining raw hex values.",
          },
        ],
      },
      {
        id: "msg-a3",
        role: "user",
        content: "Good. Now check that the Arabic layout still reads correctly.",
        createdAt: "2026-02-18T09:05:00.000Z",
        demo: true,
      },
      {
        id: "msg-a4",
        role: "assistant",
        content: `Checked the mirrored layouts with logical properties.

- Sidebar switches to the **inline-end** side under \`dir="rtl"\`.
- Icon alignment uses \`start\`/\`end\` keywords only.
- Numbers stay left-to-right inside Arabic sentences.

Demo reply — no real model was contacted.`,
        createdAt: "2026-02-18T09:12:00.000Z",
        modelId: "m-hermes-pro",
        durationMs: 1880,
        tokens: { prompt: 498, completion: 356, total: 854 },
        demo: true,
      },
    ],
  },
  {
    id: "ch-atlas-2",
    title: "Atlas: plan the settings tabs",
    projectId: "pr-atlas",
    modelId: "m-hermes-pro",
    createdAt: "2026-02-17T13:20:00.000Z",
    updatedAt: "2026-02-17T14:02:00.000Z",
    pinned: false,
    archived: false,
    messageCount: 2,
    totalTokens: 6120,
    demo: true,
    messages: [
      {
        id: "msg-b1",
        role: "user",
        content: "How should we group the settings tabs?",
        createdAt: "2026-02-17T13:20:00.000Z",
        demo: true,
      },
      {
        id: "msg-b2",
        role: "assistant",
        content: `Group by intent rather than by data type:

| Group | Contains |
| --- | --- |
| General | language, theme, notifications |
| Appearance | accent, density, font size |
| AI | default model, fallbacks, context |
| Tools & Privacy | permissions, browser, telemetry |

Demo reply.`,
        createdAt: "2026-02-17T13:22:00.000Z",
        modelId: "m-hermes-pro",
        durationMs: 1240,
        tokens: { prompt: 210, completion: 390, total: 600 },
        demo: true,
      },
    ],
  },
  {
    id: "ch-orion-1",
    title: "Orion: rate limit middleware",
    projectId: "pr-orion",
    modelId: "m-or-mistral-small",
    createdAt: "2026-02-16T10:00:00.000Z",
    updatedAt: "2026-02-16T10:26:00.000Z",
    pinned: false,
    archived: false,
    messageCount: 2,
    totalTokens: 4310,
    demo: true,
    messages: [
      {
        id: "msg-c1",
        role: "user",
        content: "Add a per-key rate limit to the gateway with a token bucket.",
        createdAt: "2026-02-16T10:00:00.000Z",
        demo: true,
      },
      {
        id: "msg-c2",
        role: "assistant",
        content: `Added a token bucket limiter keyed by API key.

- Capacity 60 requests, refill 1 request per second.
- \`Retry-After\` header set on rejection.
- Unit tests cover burst, refill and key isolation.

Demo reply.`,
        createdAt: "2026-02-16T10:26:00.000Z",
        modelId: "m-or-mistral-small",
        durationMs: 3180,
        tokens: { prompt: 480, completion: 940, total: 1420 },
        demo: true,
        toolCalls: [
          {
            id: "tc-3",
            name: "terminal.exec",
            status: "success",
            durationMs: 940,
            summary: "Ran the gateway test suite",
            output: "18 passed, 0 failed",
          },
        ],
      },
    ],
  },
  {
    id: "ch-nimbus-1",
    title: "Nimbus: Arabic typography review",
    projectId: "pr-nimbus",
    modelId: "m-or-llama-free",
    createdAt: "2026-02-15T15:40:00.000Z",
    updatedAt: "2026-02-15T16:05:00.000Z",
    pinned: false,
    archived: false,
    messageCount: 2,
    totalTokens: 2980,
    demo: true,
    messages: [
      {
        id: "msg-d1",
        role: "user",
        content: "راجع تنسيق النصوص العربية في الصفحة الرئيسية.",
        createdAt: "2026-02-15T15:40:00.000Z",
        demo: true,
      },
      {
        id: "msg-d2",
        role: "assistant",
        content: `ملاحظات المراجعة:

- ارتفاع السطر يحتاج زيادة إلى **1.8** للنصوص العربية.
- يجب ضبط المسافة بين الكلمات عبر \`word-spacing\` وليس \`letter-spacing\`.
- الأرقام داخل النص تبقى من اليسار إلى اليمين.

رد تجريبي.`,
        createdAt: "2026-02-15T16:05:00.000Z",
        modelId: "m-or-llama-free",
        durationMs: 2960,
        tokens: { prompt: 300, completion: 640, total: 940 },
        demo: true,
      },
    ],
  },
  {
    id: "ch-quartz-1",
    title: "Quartz: offline queue design",
    projectId: "pr-quartz",
    modelId: "m-hermes-mini",
    createdAt: "2026-02-12T09:00:00.000Z",
    updatedAt: "2026-02-12T09:40:00.000Z",
    pinned: false,
    archived: false,
    messageCount: 2,
    totalTokens: 3500,
    demo: true,
    messages: [
      {
        id: "msg-e1",
        role: "user",
        content: "Design an offline action queue for field technicians.",
        createdAt: "2026-02-12T09:00:00.000Z",
        demo: true,
      },
      {
        id: "msg-e2",
        role: "assistant",
        content: `Queue design:

1. **Outbox table** — every action is written locally first.
2. **Sync worker** — retries with exponential backoff when the network returns.
3. **Conflict policy** — last-write-wins per field, server timestamp wins.

Demo reply.`,
        createdAt: "2026-02-12T09:40:00.000Z",
        modelId: "m-hermes-mini",
        durationMs: 1740,
        tokens: { prompt: 280, completion: 720, total: 1000 },
        demo: true,
      },
    ],
  },
];
