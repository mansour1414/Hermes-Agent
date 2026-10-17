import { demoStore, delay, uid } from "./store";
import { HermesServiceError } from "@/services/errors";
import type {
  ChatEvent,
  CreateSessionInput,
  ListOptions,
  McpService,
  ModelService,
  ProviderService,
  SendMessageInput,
  Services,
  SkillService,
  ToolService,
  ProjectService,
  FileService,
  MemoryService,
  AutomationService,
  IntegrationService,
  ActivityService,
  AnalyticsService,
  BrowserService,
  ComputerUseService,
  SystemService,
  ChatService,
} from "@/services/contracts";
import type {
  Automation,
  ChatMessage,
  ChatSession,
  ConnectionStatus,
  McpServer,
  MemoryItem,
  ModelInfo,
  Project,
} from "@/types";

/* ------------------------------------------------------------------ */
/*  Chat                                                               */
/* ------------------------------------------------------------------ */

const stopControllers = new Map<string, { cancelled: boolean }>();

function findSession(id: string): ChatSession {
  const session = demoStore.getState().chats.find((item) => item.id === id);
  if (!session) {
    throw new HermesServiceError("not_found", `Chat session ${id} was not found.`);
  }
  return session;
}

function buildDemoReply(prompt: string, locale: "ar" | "en"): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return locale === "ar"
      ? "لم يصلني نص. اكتب سؤالك وسأجيب (رد تجريبي)."
      : "I did not receive any text. Write a question and I will answer (demo reply).";
  }
  if (locale === "ar") {
    return `سأحلّل طلبك: «${trimmed}»

**ما سأفعله**
1. مراجعة الملفات المرتبطة بالمشروع.
2. تطبيق التغييرات بأقل عدد من التعديلات.
3. التحقق من النتائج قبل العرض.

> رد تجريبي من المحوّل المحلي — لم يتم استدعاء أي نموذج حقيقي.`;
  }
  return `Here is how I would approach: "${trimmed}"

**Steps**
1. Inspect the files related to the project.
2. Apply the change with the smallest possible diff.
3. Verify the result before reporting back.

> Demo reply from the local mock adapter — no real model was contacted.`;
}

async function* streamEvents(
  session: ChatSession,
  assistantMessageId: string,
  prompt: string,
  locale: "ar" | "en",
  includeToolCalls: boolean,
): AsyncGenerator<ChatEvent> {
  const controller = { cancelled: false };
  stopControllers.set(session.id, controller);

  yield { type: "message-start", messageId: assistantMessageId };

  const toolCalls = includeToolCalls
    ? [
        {
          id: uid("tc"),
          name: "files.readWrite",
          status: "success" as const,
          durationMs: 64,
          summary: "Read the project context files",
          output: "3 files inspected in the demo workspace.",
        },
      ]
    : undefined;

  const reply = buildDemoReply(prompt, locale);
  const chunks = reply.match(/.{1,18}/gs) ?? [reply];

  let accumulated = "";
  for (const chunk of chunks) {
    if (controller.cancelled) {
      yield {
        type: "message-end",
        messageId: assistantMessageId,
        message: {
          id: assistantMessageId,
          role: "assistant",
          content: accumulated,
          createdAt: new Date().toISOString(),
          demo: true,
          modelId: session.modelId,
          error: "stopped",
        },
      };
      yield { type: "done" };
      stopControllers.delete(session.id);
      return;
    }
    accumulated += chunk;
    yield { type: "message-delta", messageId: assistantMessageId, delta: chunk };
    await new Promise((resolve) => setTimeout(resolve, 22));
  }

  const finalMessage: ChatMessage = {
    id: assistantMessageId,
    role: "assistant",
    content: accumulated,
    createdAt: new Date().toISOString(),
    demo: true,
    modelId: session.modelId,
    durationMs: 900 + Math.round(Math.random() * 2400),
    tokens: {
      prompt: Math.max(40, prompt.length),
      completion: Math.round(accumulated.length / 4),
      total: Math.max(40, prompt.length) + Math.round(accumulated.length / 4),
    },
    toolCalls,
  };

  yield { type: "message-end", messageId: assistantMessageId, message: finalMessage };
  yield { type: "done" };
  stopControllers.delete(session.id);
}

const chatService: ChatService = {
  async listSessions(options?: ListOptions) {
    await delay(100, 220);
    let sessions = [...demoStore.getState().chats];
    if (options?.search) {
      const needle = options.search.toLowerCase();
      sessions = sessions.filter(
        (session) =>
          session.title.toLowerCase().includes(needle) ||
          session.messages.some((message) => message.content.toLowerCase().includes(needle)),
      );
    }
    sessions.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    return sessions;
  },

  async getSession(id) {
    await delay(60, 140);
    return findSession(id);
  },

  async createSession(input: CreateSessionInput = {}) {
    await delay(120, 240);
    const state = demoStore.getState();
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: uid("ch"),
      title: input.title?.trim() || "New conversation",
      projectId: input.projectId,
      modelId: input.modelId ?? state.activeModelId,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      archived: false,
      messages: [],
      messageCount: 0,
      totalTokens: 0,
      demo: true,
    };
    demoStore.setState((draft) => {
      draft.chats = [session, ...draft.chats];
      if (session.projectId) {
        const project = draft.projects.find((item) => item.id === session.projectId);
        if (project) project.conversationIds = [...project.conversationIds, session.id];
      }
    });
    return session;
  },

  async renameSession(id, title) {
    await delay(60, 140);
    demoStore.setState((draft) => {
      const session = draft.chats.find((item) => item.id === id);
      if (session) {
        session.title = title;
        session.updatedAt = new Date().toISOString();
      }
    });
    return findSession(id);
  },

  async deleteSession(id) {
    await delay(80, 160);
    demoStore.setState((draft) => {
      draft.chats = draft.chats.filter((item) => item.id !== id);
      draft.projects.forEach((project) => {
        project.conversationIds = project.conversationIds.filter((sessionId) => sessionId !== id);
      });
    });
  },

  async setPinned(id, pinned) {
    await delay(50, 120);
    demoStore.setState((draft) => {
      const session = draft.chats.find((item) => item.id === id);
      if (session) session.pinned = pinned;
    });
    return findSession(id);
  },

  async setArchived(id, archived) {
    await delay(50, 120);
    demoStore.setState((draft) => {
      const session = draft.chats.find((item) => item.id === id);
      if (session) session.archived = archived;
    });
    return findSession(id);
  },

  async *sendMessage(input: SendMessageInput) {
    const session = findSession(input.sessionId);
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: input.content,
      createdAt: now,
      demo: true,
      attachments: input.attachments?.map((attachment) => ({
        id: uid("att"),
        name: attachment.name,
        kind: attachment.mime.startsWith("image/") ? "image" : "text",
        size: attachment.size,
        mime: attachment.mime,
        content: attachment.content,
      })),
    };
    const assistantId = uid("msg");

    demoStore.setState((draft) => {
      const target = draft.chats.find((item) => item.id === input.sessionId);
      if (!target) return;
      target.messages = [...target.messages, userMessage];
      target.messageCount = target.messages.length;
      target.updatedAt = now;
      if (target.title === "New conversation") {
        target.title = input.content.slice(0, 48) || "New conversation";
      }
    });

    const locale: "ar" | "en" =
      typeof document !== "undefined" && document.documentElement.lang === "ar" ? "ar" : "en";

    for await (const event of streamEvents(
      session,
      assistantId,
      input.content,
      locale,
      true,
    )) {
      if (event.type === "message-end") {
        demoStore.setState((draft) => {
          const target = draft.chats.find((item) => item.id === input.sessionId);
          if (!target) return;
          target.messages = [...target.messages, event.message];
          target.messageCount = target.messages.length;
          target.updatedAt = event.message.createdAt;
          target.totalTokens += event.message.tokens?.total ?? 0;
        });
      }
      yield event;
    }
  },

  async stopGeneration(sessionId) {
    const controller = stopControllers.get(sessionId);
    if (controller) controller.cancelled = true;
  },

  async *regenerate(messageId, sessionId) {
    const session = findSession(sessionId);
    const index = session.messages.findIndex((message) => message.id === messageId);
    const previous = index >= 0 ? session.messages[index - 1] : undefined;
    const prompt = previous?.role === "user" ? previous.content : "Regenerate the previous answer.";
    const assistantId = uid("msg");

    demoStore.setState((draft) => {
      const target = draft.chats.find((item) => item.id === sessionId);
      if (!target) return;
      target.messages = target.messages.filter((message) => message.id !== messageId);
    });

    const locale: "ar" | "en" =
      typeof document !== "undefined" && document.documentElement.lang === "ar" ? "ar" : "en";

    for await (const event of streamEvents(session, assistantId, prompt, locale, false)) {
      if (event.type === "message-end") {
        demoStore.setState((draft) => {
          const target = draft.chats.find((item) => item.id === sessionId);
          if (!target) return;
          target.messages = [...target.messages, event.message];
          target.updatedAt = event.message.createdAt;
        });
      }
      yield event;
    }
  },
};

/* ------------------------------------------------------------------ */
/*  Models                                                             */
/* ------------------------------------------------------------------ */

const modelService: ModelService = {
  async listModels() {
    await delay(100, 200);
    return [...demoStore.getState().models];
  },
  async getModel(id) {
    await delay(50, 120);
    const model = demoStore.getState().models.find((item) => item.id === id);
    if (!model) throw new HermesServiceError("not_found", `Model ${id} was not found.`);
    return model;
  },
  async getActiveModel() {
    await delay(40, 100);
    const state = demoStore.getState();
    return (
      state.models.find((item) => item.id === state.activeModelId) ??
      state.models[0]
    );
  },
  async setActiveModel(modelId) {
    await delay(80, 160);
    demoStore.setState((draft) => {
      if (!draft.models.some((item) => item.id === modelId)) {
        throw new HermesServiceError("not_found", `Model ${modelId} was not found.`);
      }
      draft.activeModelId = modelId;
    });
  },
  async setFavorite(modelId, favorite) {
    await delay(40, 90);
    demoStore.setState((draft) => {
      const model = draft.models.find((item) => item.id === modelId);
      if (model) model.favorite = favorite;
    });
  },
  async setFallbackChain(modelIds) {
    await delay(60, 120);
    demoStore.setState((draft) => {
      draft.fallbackChain = modelIds;
      draft.models.forEach((model) => {
        model.inFallbackChain = modelIds.includes(model.id);
      });
    });
  },
  async getFallbackChain() {
    await delay(40, 90);
    const state = demoStore.getState();
    return state.fallbackChain
      .map((id) => state.models.find((model) => model.id === id))
      .filter((model): model is ModelInfo => Boolean(model));
  },
};

/* ------------------------------------------------------------------ */
/*  Providers                                                          */
/* ------------------------------------------------------------------ */

const providerService: ProviderService = {
  async listProviders() {
    await delay(100, 200);
    return [...demoStore.getState().providers];
  },
  async getProvider(id) {
    await delay(50, 110);
    const provider = demoStore.getState().providers.find((item) => item.id === id);
    if (!provider) throw new HermesServiceError("not_found", `Provider ${id} was not found.`);
    return provider;
  },
  async saveCredential(providerId, apiKey) {
    await delay(200, 400);
    if (!apiKey || apiKey.trim().length < 8) {
      throw new HermesServiceError("validation", "The API key looks too short to be valid.");
    }
    demoStore.setState((draft) => {
      const provider = draft.providers.find((item) => item.id === providerId);
      if (!provider) throw new HermesServiceError("not_found", `Provider ${providerId} was not found.`);
      // The demo never stores the key itself — only the fact that one exists.
      provider.authStatus = "active";
      provider.status = "connected";
    });
  },
  async disconnect(providerId) {
    await delay(120, 220);
    demoStore.setState((draft) => {
      const provider = draft.providers.find((item) => item.id === providerId);
      if (!provider) throw new HermesServiceError("not_found", `Provider ${providerId} was not found.`);
      provider.authStatus = "none";
      provider.status = "not-configured";
      provider.configuredModels = 0;
    });
  },
};

/* ------------------------------------------------------------------ */
/*  MCP                                                                */
/* ------------------------------------------------------------------ */

const mcpService: McpService = {
  async listServers() {
    await delay(100, 200);
    return [...demoStore.getState().mcpServers];
  },
  async addServer(input) {
    await delay(140, 260);
    const server: McpServer = {
      ...input,
      id: uid("mcp"),
      status: "starting",
      tools: [],
      toolsCount: 0,
    };
    demoStore.setState((draft) => {
      draft.mcpServers = [...draft.mcpServers, server];
    });
    await delay(400, 700);
    demoStore.setState((draft) => {
      const target = draft.mcpServers.find((item) => item.id === server.id);
      if (target) {
        target.status = "connected";
        target.tools = ["list_resources", "read_resource"];
        target.toolsCount = target.tools.length;
        target.latencyMs = 18 + Math.round(Math.random() * 40);
        target.lastCheckedAt = new Date().toISOString();
      }
    });
    return demoStore.getState().mcpServers.find((item) => item.id === server.id)!;
  },
  async updateServer(id, patch) {
    await delay(90, 180);
    demoStore.setState((draft) => {
      const index = draft.mcpServers.findIndex((item) => item.id === id);
      if (index === -1) throw new HermesServiceError("not_found", `Server ${id} was not found.`);
      draft.mcpServers[index] = { ...draft.mcpServers[index], ...patch };
    });
    return demoStore.getState().mcpServers.find((item) => item.id === id)!;
  },
  async removeServer(id) {
    await delay(90, 160);
    demoStore.setState((draft) => {
      draft.mcpServers = draft.mcpServers.filter((item) => item.id !== id);
    });
  },
  async setEnabled(id, enabled) {
    await delay(60, 120);
    demoStore.setState((draft) => {
      const server = draft.mcpServers.find((item) => item.id === id);
      if (!server) throw new HermesServiceError("not_found", `Server ${id} was not found.`);
      server.enabled = enabled;
      server.status = enabled ? "connected" : "disabled";
    });
    return demoStore.getState().mcpServers.find((item) => item.id === id)!;
  },
  async testConnection(id) {
    await delay(500, 900);
    const server = demoStore.getState().mcpServers.find((item) => item.id === id);
    if (!server) throw new HermesServiceError("not_found", `Server ${id} was not found.`);
    const ok = server.transport !== "http" || server.url?.length !== 0;
    return {
      ok,
      latencyMs: ok ? 20 + Math.round(Math.random() * 60) : 0,
      message: ok
        ? "Connection succeeded (demo adapter — no process was started)."
        : "Connection failed (demo adapter).",
    };
  },
};

/* ------------------------------------------------------------------ */
/*  Skills & Tools                                                     */
/* ------------------------------------------------------------------ */

const skillService: SkillService = {
  async listSkills() {
    await delay(100, 200);
    return [...demoStore.getState().skills];
  },
  async getSkill(id) {
    await delay(50, 110);
    const skill = demoStore.getState().skills.find((item) => item.id === id);
    if (!skill) throw new HermesServiceError("not_found", `Skill ${id} was not found.`);
    return skill;
  },
  async setEnabled(id, enabled) {
    await delay(60, 120);
    demoStore.setState((draft) => {
      const skill = draft.skills.find((item) => item.id === id);
      if (!skill) throw new HermesServiceError("not_found", `Skill ${id} was not found.`);
      skill.enabled = enabled;
      skill.status = enabled ? "installed" : "disabled";
    });
    return demoStore.getState().skills.find((item) => item.id === id)!;
  },
  async install(id) {
    await delay(300, 600);
    demoStore.setState((draft) => {
      const skill = draft.skills.find((item) => item.id === id);
      if (!skill) throw new HermesServiceError("not_found", `Skill ${id} was not found.`);
      skill.status = "installed";
      skill.enabled = true;
    });
    return demoStore.getState().skills.find((item) => item.id === id)!;
  },
  async remove(id) {
    await delay(120, 220);
    demoStore.setState((draft) => {
      const skill = draft.skills.find((item) => item.id === id);
      if (!skill) throw new HermesServiceError("not_found", `Skill ${id} was not found.`);
      skill.status = "available";
      skill.enabled = false;
    });
  },
  async setFavorite(id, favorite) {
    await delay(40, 90);
    demoStore.setState((draft) => {
      const skill = draft.skills.find((item) => item.id === id);
      if (skill) skill.favorite = favorite;
    });
    return demoStore.getState().skills.find((item) => item.id === id)!;
  },
};

const toolService: ToolService = {
  async listTools() {
    await delay(100, 200);
    return [...demoStore.getState().tools];
  },
  async setEnabled(id, enabled) {
    await delay(60, 120);
    demoStore.setState((draft) => {
      const tool = draft.tools.find((item) => item.id === id);
      if (!tool) throw new HermesServiceError("not_found", `Tool ${id} was not found.`);
      tool.enabled = enabled;
      tool.status = enabled ? "ready" : "disabled";
    });
    return demoStore.getState().tools.find((item) => item.id === id)!;
  },
  async updateOptions(id, options) {
    await delay(50, 110);
    demoStore.setState((draft) => {
      const tool = draft.tools.find((item) => item.id === id);
      if (tool) tool.options = options;
    });
    return demoStore.getState().tools.find((item) => item.id === id)!;
  },
};

/* ------------------------------------------------------------------ */
/*  Projects & Files                                                   */
/* ------------------------------------------------------------------ */

const projectService: ProjectService = {
  async listProjects() {
    await delay(100, 200);
    return [...demoStore.getState().projects];
  },
  async getProject(id) {
    await delay(50, 110);
    const project = demoStore.getState().projects.find((item) => item.id === id);
    if (!project) throw new HermesServiceError("not_found", `Project ${id} was not found.`);
    return project;
  },
  async createProject(input) {
    await delay(160, 280);
    const now = new Date().toISOString();
    const project: Project = {
      ...input,
      id: uid("pr"),
      createdAt: now,
      updatedAt: now,
      conversationIds: [],
    };
    demoStore.setState((draft) => {
      draft.projects = [project, ...draft.projects];
    });
    return project;
  },
  async updateProject(id, patch) {
    await delay(110, 200);
    demoStore.setState((draft) => {
      const index = draft.projects.findIndex((item) => item.id === id);
      if (index === -1) throw new HermesServiceError("not_found", `Project ${id} was not found.`);
      draft.projects[index] = { ...draft.projects[index], ...patch, updatedAt: new Date().toISOString() };
    });
    return demoStore.getState().projects.find((item) => item.id === id)!;
  },
  async deleteProject(id) {
    await delay(100, 180);
    demoStore.setState((draft) => {
      draft.projects = draft.projects.filter((item) => item.id !== id);
    });
  },
  async listProjectFiles(id) {
    await delay(80, 160);
    return demoStore.getState().files.filter((file) => file.projectId === id);
  },
};

const fileService: FileService = {
  async list(path, projectId) {
    await delay(90, 180);
    const files = demoStore.getState().files;
    if (projectId) return files.filter((file) => file.projectId === projectId);
    const prefix = path ? `${path}/` : "";
    const filtered = files.filter((file) => file.path.startsWith(prefix));
    return filtered.length > 0
      ? filtered
      : files.filter((file) => !path || file.path.split("/").length === 1);
  },
  async read(path) {
    await delay(60, 140);
    const file = demoStore.getState().files.find((item) => item.path === path);
    if (!file) throw new HermesServiceError("not_found", `File ${path} was not found.`);
    return file;
  },
  async search(query) {
    await delay(120, 220);
    const needle = query.toLowerCase();
    return demoStore.getState().files.filter(
      (file) =>
        file.name.toLowerCase().includes(needle) || file.path.toLowerCase().includes(needle),
    );
  },
};

/* ------------------------------------------------------------------ */
/*  Memory                                                             */
/* ------------------------------------------------------------------ */

const memoryService: MemoryService = {
  async listItems() {
    await delay(100, 200);
    return [...demoStore.getState().memory];
  },
  async getItem(id) {
    await delay(50, 100);
    const item = demoStore.getState().memory.find((entry) => entry.id === id);
    if (!item) throw new HermesServiceError("not_found", `Memory item ${id} was not found.`);
    return item;
  },
  async upsertItem(item) {
    await delay(110, 200);
    const now = new Date().toISOString();
    let saved: MemoryItem | undefined;
    demoStore.setState((draft) => {
      if (item.id) {
        const index = draft.memory.findIndex((entry) => entry.id === item.id);
        if (index === -1) throw new HermesServiceError("not_found", `Memory item ${item.id} was not found.`);
        saved = { ...draft.memory[index], ...item, updatedAt: now } as MemoryItem;
        draft.memory[index] = saved;
      } else {
        saved = {
          id: uid("mem"),
          title: item.title ?? "Untitled",
          content: item.content ?? "",
          category: item.category ?? "general",
          tags: item.tags ?? [],
          importance: item.importance ?? "medium",
          pinned: item.pinned ?? false,
          createdAt: now,
          updatedAt: now,
          source: item.source ?? "manual",
        };
        draft.memory = [saved, ...draft.memory];
      }
    });
    return saved!;
  },
  async deleteItem(id) {
    await delay(90, 160);
    demoStore.setState((draft) => {
      draft.memory = draft.memory.filter((item) => item.id !== id);
    });
  },
};

/* ------------------------------------------------------------------ */
/*  Automations                                                        */
/* ------------------------------------------------------------------ */

const automationService: AutomationService = {
  async listAutomations() {
    await delay(100, 200);
    return [...demoStore.getState().automations];
  },
  async createAutomation(input) {
    await delay(140, 240);
    const automation: Automation = {
      ...input,
      id: uid("au"),
      logs: [],
      runCount: 0,
      failureCount: 0,
    };
    demoStore.setState((draft) => {
      draft.automations = [automation, ...draft.automations];
    });
    return automation;
  },
  async updateAutomation(id, patch) {
    await delay(100, 190);
    demoStore.setState((draft) => {
      const index = draft.automations.findIndex((item) => item.id === id);
      if (index === -1) throw new HermesServiceError("not_found", `Automation ${id} was not found.`);
      draft.automations[index] = { ...draft.automations[index], ...patch };
    });
    return demoStore.getState().automations.find((item) => item.id === id)!;
  },
  async deleteAutomation(id) {
    await delay(90, 160);
    demoStore.setState((draft) => {
      draft.automations = draft.automations.filter((item) => item.id !== id);
    });
  },
  async setEnabled(id, enabled) {
    await delay(60, 120);
    demoStore.setState((draft) => {
      const automation = draft.automations.find((item) => item.id === id);
      if (!automation) throw new HermesServiceError("not_found", `Automation ${id} was not found.`);
      automation.enabled = enabled;
    });
    return demoStore.getState().automations.find((item) => item.id === id)!;
  },
  async runNow(id) {
    await delay(600, 1100);
    const runId = uid("run");
    const durationMs = 900 + Math.round(Math.random() * 3200);
    const failed = Math.random() > 0.82;
    demoStore.setState((draft) => {
      const automation = draft.automations.find((item) => item.id === id);
      if (!automation) throw new HermesServiceError("not_found", `Automation ${id} was not found.`);
      automation.lastStatus = failed ? "failed" : "success";
      automation.lastRunAt = new Date().toISOString();
      automation.runCount += 1;
      if (failed) automation.failureCount += 1;
      const run: Automation["logs"][number] = {
        id: runId,
        startedAt: new Date().toISOString(),
        durationMs,
        status: failed ? "failed" : "success",
        output: failed
          ? "The demo runner could not resolve the workspace path."
          : "The demo runner completed the instruction successfully.",
        error: failed ? "DEMO_WORKSPACE_UNREACHABLE" : undefined,
      };
      automation.logs = [run, ...automation.logs].slice(0, 20);
    });
    return {
      runId,
      status: failed ? "failed" : "success",
      durationMs,
      output: failed
        ? "The demo runner could not resolve the workspace path."
        : "The demo runner completed the instruction successfully.",
    };
  },
  async listRuns(id) {
    await delay(60, 120);
    return demoStore.getState().automations.find((item) => item.id === id)?.logs ?? [];
  },
};

/* ------------------------------------------------------------------ */
/*  Integrations                                                       */
/* ------------------------------------------------------------------ */

const integrationService: IntegrationService = {
  async listIntegrations() {
    await delay(100, 200);
    return [...demoStore.getState().integrations];
  },
  async connect(id) {
    await delay(260, 480);
    demoStore.setState((draft) => {
      const integration = draft.integrations.find((item) => item.id === id);
      if (!integration) throw new HermesServiceError("not_found", `Integration ${id} was not found.`);
      integration.connected = true;
      integration.lastSyncAt = new Date().toISOString();
    });
    return demoStore.getState().integrations.find((item) => item.id === id)!;
  },
  async disconnect(id) {
    await delay(140, 240);
    demoStore.setState((draft) => {
      const integration = draft.integrations.find((item) => item.id === id);
      if (!integration) throw new HermesServiceError("not_found", `Integration ${id} was not found.`);
      integration.connected = false;
    });
    return demoStore.getState().integrations.find((item) => item.id === id)!;
  },
  async saveSettings(id, settings) {
    await delay(120, 220);
    demoStore.setState((draft) => {
      const integration = draft.integrations.find((item) => item.id === id);
      if (!integration) throw new HermesServiceError("not_found", `Integration ${id} was not found.`);
      integration.settings = settings;
    });
    return demoStore.getState().integrations.find((item) => item.id === id)!;
  },
};

/* ------------------------------------------------------------------ */
/*  Activity & Analytics                                               */
/* ------------------------------------------------------------------ */

const activityService: ActivityService = {
  async listEvents(options) {
    await delay(90, 180);
    let events = [...demoStore.getState().events];
    if (options?.type && options.type !== "all") {
      events = events.filter((event) => event.type === options.type);
    }
    if (options?.status && options.status !== "all") {
      events = events.filter((event) => event.status === options.status);
    }
    if (options?.search) {
      const needle = options.search.toLowerCase();
      events = events.filter(
        (event) =>
          event.title.toLowerCase().includes(needle) ||
          event.description.toLowerCase().includes(needle),
      );
    }
    return events;
  },
  async exportEvents() {
    await delay(120, 200);
    return JSON.stringify(demoStore.getState().events, null, 2);
  },
};

const analyticsService: AnalyticsService = {
  async getUsageSummary() {
    await delay(160, 300);
    return demoStore.getState().usage;
  },
};

/* ------------------------------------------------------------------ */
/*  Browser & Computer Use                                             */
/* ------------------------------------------------------------------ */

let browserState = {
  installed: true,
  running: false,
  version: "Chromium 128.0.0",
  executablePath: "D:\\hermes\\bin\\chromium\\chrome.exe",
  profilePath: "D:\\hermes\\profiles\\chromium",
  storageLocation: "D:\\hermes\\profiles\\chromium",
  persistenceEnabled: true,
  sessions: [] as { id: string; profile: string; startedAt: string; pages: string[]; persistent: boolean; state: "running" | "closed" }[],
  engine: "Chromium (bundled with Hermes)",
  isolationNote:
    "The profile is created by Hermes and is separate from any personal Chrome installation.",
};

const browserService: BrowserService = {
  async getState() {
    await delay(80, 160);
    return { ...browserState, sessions: [...browserState.sessions] };
  },
  async launch() {
    await delay(400, 700);
    browserState = {
      ...browserState,
      running: true,
      sessions: [
        {
          id: uid("bs"),
          profile: "hermes-default",
          startedAt: new Date().toISOString(),
          pages: ["about:blank"],
          persistent: true,
          state: "running",
        },
        ...browserState.sessions,
      ],
    };
    return { ...browserState };
  },
  async close() {
    await delay(300, 500);
    browserState = {
      ...browserState,
      running: false,
      sessions: browserState.sessions.map((session) => ({ ...session, state: "closed" })),
    };
    return { ...browserState };
  },
  async clearSession() {
    await delay(250, 450);
    browserState = { ...browserState, sessions: [] };
    return { ...browserState };
  },
};

let computerState: {
  driverInstalled: boolean;
  sessionActive: boolean;
  screenCaptureAvailable: boolean;
  mouseControl: boolean;
  keyboardControl: boolean;
  permissions: { id: string; label: string; granted: boolean }[];
  lastActivityAt?: string;
  sessionStartedAt?: string;
  history: { id: string; at: string; action: string; result: string }[];
  emergencyStopAvailable: boolean;
} = {
  driverInstalled: false,
  sessionActive: false,
  screenCaptureAvailable: false,
  mouseControl: false,
  keyboardControl: false,
  permissions: [
    { id: "screen.capture", label: "Screen capture", granted: false },
    { id: "mouse.control", label: "Mouse control", granted: false },
    { id: "keyboard.control", label: "Keyboard control", granted: false },
    { id: "clipboard.read", label: "Clipboard read", granted: false },
  ],
  history: [] as { id: string; at: string; action: string; result: string }[],
  emergencyStopAvailable: true,
};

const computerUseService: ComputerUseService = {
  async getState() {
    await delay(80, 160);
    return { ...computerState, permissions: [...computerState.permissions], history: [...computerState.history] };
  },
  async startSession() {
    await delay(400, 700);
    computerState = {
      ...computerState,
      sessionActive: true,
      sessionStartedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      history: [
        {
          id: uid("cu"),
          at: new Date().toISOString(),
          action: "start-session",
          result: "Demo session started — no real driver was loaded.",
        },
        ...computerState.history,
      ],
    };
    return { ...computerState };
  },
  async stopSession() {
    await delay(300, 500);
    computerState = {
      ...computerState,
      sessionActive: false,
      history: [
        {
          id: uid("cu"),
          at: new Date().toISOString(),
          action: "stop-session",
          result: "Demo session stopped.",
        },
        ...computerState.history,
      ],
    };
    return { ...computerState };
  },
  async emergencyStop() {
    await delay(120, 260);
    computerState = {
      ...computerState,
      sessionActive: false,
      history: [
        {
          id: uid("cu"),
          at: new Date().toISOString(),
          action: "emergency-stop",
          result: "Emergency stop recorded in the demo log.",
        },
        ...computerState.history,
      ],
    };
    return { ...computerState };
  },
  async setPermission(id, granted) {
    await delay(120, 240);
    computerState = {
      ...computerState,
      permissions: computerState.permissions.map((permission) =>
        permission.id === id ? { ...permission, granted } : permission,
      ),
    };
    return { ...computerState };
  },
};

/* ------------------------------------------------------------------ */
/*  System                                                             */
/* ------------------------------------------------------------------ */

const systemService: SystemService = {
  async getConnectionStatus(): Promise<ConnectionStatus> {
    await delay(60, 140);
    return {
      state: "demo",
      message: "Demo Mode — not connected to Hermes",
      lastCheckedAt: new Date().toISOString(),
      latencyMs: 12,
      version: "v0.22.2 (expected)",
    };
  },
  async getCapabilities() {
    await delay(40, 90);
    return {
      chat: true,
      streaming: true,
      tools: true,
      mcp: true,
      skills: true,
      browser: true,
      computerUse: false,
      files: true,
      memory: true,
      automations: true,
      providerCredentials: false,
    };
  },
  async getVersion() {
    await delay(30, 70);
    return { app: "0.1.0", build: "demo", hermes: "v0.22.2 (expected)" };
  },
};

export const mockServices: Services = {
  chat: chatService,
  model: modelService,
  provider: providerService,
  mcp: mcpService,
  skill: skillService,
  tool: toolService,
  project: projectService,
  file: fileService,
  memory: memoryService,
  automation: automationService,
  integration: integrationService,
  activity: activityService,
  analytics: analyticsService,
  browser: browserService,
  computerUse: computerUseService,
  system: systemService,
};

export { demoStore };
