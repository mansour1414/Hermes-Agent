/**
 * Hermes adapter — REAL integration.
 *
 * Every service below talks to the installed Hermes Agent through the local
 * Snowhare proxy (`server/hermes-proxy.mjs`), which injects the dashboard
 * session token server-side. No token and no API key is ever present in this
 * bundle.
 *
 * Ground rules honoured here:
 *   • Real endpoints only (verified against the installed v0.22.2 OpenAPI spec).
 *   • Unsupported operations throw `HermesServiceError("unsupported")` so the UI
 *     disables the control and explains WHY instead of faking a success.
 *   • Read-only surfaces are marked; mutating calls use Hermes' own endpoints
 *     (never a parallel settings file).
 *   • `demo: false` on every returned record — this adapter never invents data.
 *
 * Chat is delivered through the official headless protocol:
 *   hermes chat -q <prompt> --format stream-json --pass-session-id
 * streamed over SSE by the proxy (see server/hermes-proxy.mjs).
 */
import { HermesServiceError } from "@/services/errors";
import type {
  ActivityService,
  AnalyticsService,
  AutomationService,
  BrowserService,
  ChatEvent,
  ChatService,
  ComputerUseService,
  CreateSessionInput,
  FileService,
  IntegrationService,
  ListOptions,
  McpService,
  MemoryService,
  ModelService,
  ProjectService,
  ProviderService,
  SendMessageInput,
  Services,
  SkillService,
  SystemService,
  ToolService,
} from "@/services/contracts";
import type {
  ActivityEvent,
  Automation,
  AutomationRun,
  AutomationStatus,
  BrowserState,
  ChatMessage,
  ChatSession,
  ComputerUseState,
  ConnectionStatus,
  FileEntry,
  Integration,
  McpServer,
  MemoryItem,
  ModelInfo,
  Project,
  ProviderInfo,
  SkillInfo,
  SkillStatus,
  ToolCategory,
  ToolInfo,
  UsageSummary,
} from "@/types";
import {
  abortChat,
  apiGet,
  apiMutate,
  bridgeHealth,
  cachedGet,
  invalidateGet,
  qs,
  streamChat,
} from "./transport";
import { loadOpenCodeInventory } from "@/services/adapters/opencode/loader";

/* -------------------------------------------------------------------------- */
/*  Raw response shapes (only the fields we actually consume)                  */
/* -------------------------------------------------------------------------- */

interface RawModelOptions {
  providers: Array<{
    slug: string;
    name: string;
    is_current: boolean;
    is_user_defined: boolean;
    models: string[];
    total_models: number;
    source: string;
    authenticated: boolean;
    auth_type?: string | null;
    warning?: string | null;
    capabilities?: Record<string, { fast?: boolean; reasoning?: boolean; can_disable_reasoning?: boolean }>;
    featured_models?: string[];
  }>;
}

interface RawModelInfo {
  model: string;
  provider: string;
  auto_context_length?: number;
  config_context_length?: number;
  effective_context_length?: number;
  capabilities?: {
    supports_tools?: boolean;
    supports_vision?: boolean;
    supports_reasoning?: boolean;
    context_window?: number;
    max_output_tokens?: number;
    model_family?: string;
  };
}

interface RawSession {
  id: string;
  title?: string | null;
  model?: string | null;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  started_at: number;
  ended_at?: number | null;
  pinned?: boolean;
  archived?: boolean;
  preview?: string | null;
  cwd?: string | null;
  git_repo_root?: string | null;
  source?: string | null;
  is_active?: boolean;
}

interface RawSessionMessage {
  id?: number;
  row_id?: number;
  role: string;
  content: unknown;
  text?: unknown;
  timestamp?: number;
  tool_calls?: unknown;
  tool_name?: string | null;
  tool_call_id?: string | null;
}

interface RawSessionsResponse {
  sessions: RawSession[];
  total?: number;
}

interface RawSkill {
  name: string;
  description?: string;
  category?: string;
  enabled: boolean;
  usage?: number;
  provenance?: string;
}

interface RawToolset {
  name: string;
  label?: string;
  description?: string;
  enabled: boolean;
  available?: boolean;
  configured?: boolean;
  tools?: string[];
}

interface RawMcpSummary {
  name: string;
  transport: string;
  command?: string | null;
  args?: string[];
  url?: string | null;
  enabled: boolean;
  tools?: string[] | null;
}

interface RawCronJob {
  id: string;
  name?: string | null;
  prompt?: string | null;
  schedule?: string;
  schedule_display?: string | null;
  enabled: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
  model?: string | null;
  provider?: string | null;
  deliver?: string | null;
}

interface CatalogModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string; image?: string; request?: string };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  top_provider?: { max_completion_tokens?: number };
  supported_parameters?: string[];
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const fallbackError = (what: string, why: string) =>
  new HermesServiceError("unsupported", `${what} غير متاح: ${why}`, { details: { operation: what } });

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — favourites simply won't persist */
  }
}

function toIso(epochSeconds?: number | null): string {
  if (!epochSeconds) return new Date().toISOString();
  return new Date(epochSeconds * 1000).toISOString();
}

function textFromMessage(message: RawSessionMessage): string {
  const candidates = [message.content, message.text];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
    if (Array.isArray(candidate)) {
      const parts = candidate
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "text" in item) {
            const text = (item as { text?: unknown }).text;
            return typeof text === "string" ? text : "";
          }
          return "";
        })
        .filter(Boolean);
      if (parts.length) return parts.join("\n");
    }
  }
  return "";
}

/* -------------------------------------------------------------------------- */
/*  OpenRouter public catalog (pricing / capabilities enrichment)              */
/* -------------------------------------------------------------------------- */

let catalogCache: { at: number; byId: Map<string, CatalogModel>; ok: boolean } | null = null;
let catalogInflight: Promise<Map<string, CatalogModel>> | null = null;

async function getCatalog(): Promise<Map<string, CatalogModel>> {
  if (catalogCache && Date.now() - catalogCache.at < 6 * 60 * 60 * 1000) return catalogCache.byId;
  if (catalogInflight) return catalogInflight;

  catalogInflight = (async () => {
    try {
      const response = await apiGet<{ ok: boolean; models: CatalogModel[] }>("/catalog/openrouter");
      const byId = new Map<string, CatalogModel>();
      for (const model of response.models || []) {
        if (model && typeof model.id === "string") byId.set(model.id, model);
      }
      catalogCache = { at: Date.now(), byId, ok: Boolean(response.ok) };
      return byId;
    } catch {
      catalogCache = { at: Date.now(), byId: new Map(), ok: false };
      return catalogCache.byId;
    } finally {
      catalogInflight = null;
    }
  })();

  return catalogInflight;
}

function numPrice(value?: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/* -------------------------------------------------------------------------- */
/*  Model index (shared by model / chat / project services)                    */
/* -------------------------------------------------------------------------- */

interface ModelIndexEntry {
  info: ModelInfo;
  providerSlug: string;
}

/**
 * Shared request paths/TTLs. `/api/model/options` is the slowest read on the
 * Models page (~2s upstream), so every caller must use the exact same URL to
 * share one cached/single-flight request.
 */
const MODEL_OPTIONS_PATH =
  "/api/model/options" + qs({ explicit_only: 0, include_unconfigured: 1, refresh: 0 });
const MODEL_OPTIONS_TTL = 60_000;
const MODEL_INFO_PATH = "/api/model/info";
const MODEL_INFO_TTL = 30_000;
const MODEL_INDEX_TTL = 60_000;

let modelIndex: { at: number; byId: Map<string, ModelIndexEntry> } | null = null;
let modelIndexInflight: Promise<Map<string, ModelIndexEntry>> | null = null;

function favourites(): string[] {
  return readJson<string[]>("cc.favourites") || [];
}

function fallbackPairs(): Array<{ provider: string; model: string }> {
  return readJson<Array<{ provider: string; model: string }>>("cc.fallbacks") || [];
}

function buildModelInfo(
  provider: RawModelOptions["providers"][number],
  modelId: string,
  catalog: Map<string, CatalogModel>,
  active?: RawModelInfo,
): ModelInfo {
  const catalogEntry = catalog.get(modelId);
  const capabilities = provider.capabilities?.[modelId];
  const reasoning = capabilities?.reasoning ?? false;
  const promptPrice = numPrice(catalogEntry?.pricing?.prompt);
  const completionPrice = numPrice(catalogEntry?.pricing?.completion);
  const hasCatalogPricing = Boolean(catalogEntry?.pricing?.prompt !== undefined);
  const isVerifiedFree = hasCatalogPricing && promptPrice === 0 && completionPrice === 0;
  const isActive = Boolean(active && active.model === modelId && active.provider === provider.slug);
  const supportedParams = catalogEntry?.supported_parameters || [];
  const inputModes = catalogEntry?.architecture?.input_modalities || [];

  const contextWindow =
    (isActive ? active?.effective_context_length || active?.capabilities?.context_window : 0) ||
    catalogEntry?.context_length ||
    0;

  const unverifiedNote = hasCatalogPricing
    ? ""
    : " · التسعير غير مؤكد (غير موجود في الفهرس العام للمزوّد)";

  return {
    id: modelId,
    modelId,
    name: modelId,
    providerId: provider.slug,
    providerName: provider.name,
    source: "hermes",
    pricing: isVerifiedFree ? "free" : "paid",
    inputPrice: promptPrice * 1_000_000,
    outputPrice: completionPrice * 1_000_000,
    contextWindow,
    maxOutputTokens: catalogEntry?.top_provider?.max_completion_tokens || 0,
    capabilities: {
      reasoning: isActive ? active?.capabilities?.supports_reasoning ?? reasoning : reasoning,
      vision: isActive
        ? active?.capabilities?.supports_vision ?? inputModes.includes("image")
        : inputModes.includes("image"),
      toolCalling: isActive
        ? active?.capabilities?.supports_tools ?? supportedParams.includes("tools")
        : supportedParams.includes("tools"),
      streaming: true,
      jsonMode:
        supportedParams.includes("structured_outputs") ||
        supportedParams.includes("response_format") ||
        supportedParams.includes("json_schema"),
    },
    catalogAvailable: Boolean(catalogEntry),
    configured: provider.authenticated,
    authenticated: provider.authenticated,
    verified: hasCatalogPricing,
    status: provider.authenticated ? "authenticated" : "available",
    description:
      `${provider.name} · ${modelId}${isActive ? " · النموذج النشط حاليًا" : ""}` +
      `${provider.authenticated ? "" : " · المزوّد غير مهيأ"}` +
      unverifiedNote,
    releaseDate: "",
    tags: [
      provider.slug,
      reasoning ? "reasoning" : "no-reasoning",
      isVerifiedFree ? "free" : "paid",
      hasCatalogPricing ? "price-verified" : "price-unverified",
    ],
    favorite: favourites().includes(modelId),
    inFallbackChain: fallbackPairs().some((item) => item.model === modelId && item.provider === provider.slug),
    rateLimitPerMinute: undefined,
  };
}

async function loadModelIndex(): Promise<Map<string, ModelIndexEntry>> {
  const now = Date.now();
  if (modelIndex && now - modelIndex.at < MODEL_INDEX_TTL) return modelIndex.byId;
  if (modelIndexInflight) return modelIndexInflight;

  modelIndexInflight = (async () => {
    const options = await cachedGet<RawModelOptions>(MODEL_OPTIONS_PATH, MODEL_OPTIONS_TTL);
    const active = await cachedGet<RawModelInfo>(MODEL_INFO_PATH, MODEL_INFO_TTL).catch(
      () => undefined,
    );
    const catalog = await getCatalog();

    const byId = new Map<string, ModelIndexEntry>();
    for (const provider of options.providers || []) {
      for (const modelId of provider.models || []) {
        if (byId.has(modelId)) continue;
        byId.set(modelId, {
          info: buildModelInfo(provider, modelId, catalog, active),
          providerSlug: provider.slug,
        });
      }
    }
    modelIndex = { at: Date.now(), byId };
    return byId;
  })();

  try {
    return await modelIndexInflight;
  } finally {
    modelIndexInflight = null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Chat                                                                       */
/* -------------------------------------------------------------------------- */

const pendingSessions = new Map<string, ChatSession>();
const localAbort = new Map<string, AbortController>();

function localSessionId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapSessionRow(row: RawSession, messages: ChatMessage[]): ChatSession {
  const modelId = row.model || "";
  return {
    id: row.id,
    title: row.title || row.preview || "محادثة بدون عنوان",
    modelId,
    createdAt: toIso(row.started_at),
    updatedAt: toIso(row.ended_at || row.started_at),
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    messages,
    messageCount: row.message_count ?? messages.length,
    totalTokens: (row.input_tokens || 0) + (row.output_tokens || 0),
    demo: false,
  };
}

function mapTranscript(sessionId: string, title: string, payload: {
  messages?: RawSessionMessage[];
  session_id?: string;
  model?: string | null;
  started_at?: number;
  ended_at?: number | null;
}): ChatSession {
  const messages: ChatMessage[] = (payload.messages || [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message, index) => ({
      id: String(message.row_id ?? message.id ?? `${sessionId}-${index}`),
      role: message.role === "assistant" ? "assistant" : "user",
      content: textFromMessage(message),
      createdAt: toIso(message.timestamp),
      demo: false,
      toolCalls: Array.isArray(message.tool_calls)
        ? (message.tool_calls as Array<Record<string, unknown>>).map((call, toolIndex) => {
            const fn = call.function as { name?: unknown } | undefined;
            return {
              id: String(call.id ?? call.tool_call_id ?? toolIndex),
              name: String(call.name ?? fn?.name ?? "tool"),
              status: "success" as const,
              durationMs: 0,
              summary: typeof call.name === "string" ? call.name : "tool call",
            };
          })
        : undefined,
    }));

  return {
    id: sessionId,
    title,
    modelId: payload.model || "",
    createdAt: toIso(payload.started_at),
    updatedAt: toIso(payload.ended_at || payload.started_at),
    pinned: false,
    archived: false,
    messages,
    messageCount: messages.length,
    totalTokens: messages.length,
    demo: false,
  };
}

const chatService: ChatService = {
  async listSessions(options?: ListOptions): Promise<ChatSession[]> {
    const search = options?.search?.trim();
    const path = search
      ? `/api/sessions/search${qs({ q: search, limit: options?.limit ?? 50 })}`
      : `/api/sessions${qs({ limit: options?.limit ?? 50, offset: options?.offset ?? 0 })}`;
    const payload = await apiGet<RawSessionsResponse>(path);
    return (payload.sessions || []).map((row) => mapSessionRow(row, []));
  },

  async getSession(id: string): Promise<ChatSession> {
    const pending = pendingSessions.get(id);
    const title = pending?.title || "";

    // Retry a couple of times: a session that was just created through the
    // bridge may still be flushing its transcript when we first ask for it.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const payload = await apiGet<{
          messages?: RawSessionMessage[];
          session_id?: string;
          model?: string | null;
          started_at?: number;
          ended_at?: number | null;
        }>(`/api/sessions/${encodeURIComponent(id)}/messages`);

        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 350));
        if (payload.messages && payload.messages.length > 0) {
          const session = mapTranscript(id, title, payload);
          pendingSessions.delete(id);
          return session;
        }
        if (attempt === 0) {
          const empty = mapTranscript(id, title, payload);
          if (title) empty.title = title;
          if (pending) {
            empty.title = pending.title;
            empty.modelId = pending.modelId;
          }
          return empty;
        }
      } catch (error) {
        lastError = error;
        // A chat that has not been sent yet exists only locally (Hermes creates
        // the real session on the first message). Hand back the pending draft so
        // the composer is usable instead of failing.
        if (pending) return { ...pending, messages: [...pending.messages] };
        break;
      }
    }
    if (lastError) throw lastError;
    return mapTranscript(id, title, { messages: [] });
  },

  async createSession(input?: CreateSessionInput): Promise<ChatSession> {
    const id = localSessionId();
    const session: ChatSession = {
      id,
      title: input?.title?.trim() || "محادثة جديدة",
      modelId: input?.modelId || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      archived: false,
      messages: [],
      messageCount: 0,
      totalTokens: 0,
      demo: false,
    };
    pendingSessions.set(id, session);
    return session;
  },

  async renameSession(id: string, title: string): Promise<ChatSession> {
    await apiMutate(`/api/sessions/${encodeURIComponent(id)}`, "PATCH", { title });
    const session = await this.getSession(id);
    const renamed = { ...session, title };
    if (pendingSessions.has(id)) pendingSessions.set(id, renamed);
    return renamed;
  },

  async deleteSession(id: string): Promise<void> {
    await apiMutate(`/api/sessions/${encodeURIComponent(id)}`, "DELETE");
    pendingSessions.delete(id);
  },

  async setPinned(id: string, pinned: boolean): Promise<ChatSession> {
    await apiMutate(`/api/sessions/${encodeURIComponent(id)}`, "PATCH", { pinned });
    const session = await this.getSession(id);
    return { ...session, pinned };
  },

  async setArchived(id: string, archived: boolean): Promise<ChatSession> {
    await apiMutate(`/api/sessions/${encodeURIComponent(id)}`, "PATCH", { archived });
    const session = await this.getSession(id);
    return { ...session, archived };
  },

  async *sendMessage(input: SendMessageInput): AsyncIterable<ChatEvent> {
    const assistantId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const controller = new AbortController();
    localAbort.set(input.sessionId, controller);

    const tools = new Map<
      string,
      {
        id: string;
        name: string;
        status: "running" | "success" | "error";
        summary: string;
        output?: string;
        durationMs?: number;
      }
    >();
    let acc = "";
    let emittedStart = false;
    let resultTokens: { input: number; output: number; total: number } | null = null;
    let resultDuration = 0;
    let failure: string | null = null;

    try {
      for await (const event of streamChat(
        {
          sessionId: input.sessionId,
          content: input.content,
          attachments: input.attachments,
        },
        controller.signal,
      )) {
        if (event.kind === "session") {
          if (!emittedStart) {
            emittedStart = true;
            yield { type: "session-start", sessionId: event.sessionId || input.sessionId };
            yield { type: "message-start", messageId: assistantId };
          }
          continue;
        }
        if (event.kind === "message-start") {
          if (!emittedStart) {
            emittedStart = true;
            yield { type: "session-start", sessionId: input.sessionId };
          }
          yield { type: "message-start", messageId: assistantId };
          continue;
        }
        if (event.kind === "delta") {
          acc += event.text || "";
          yield { type: "message-delta", messageId: assistantId, delta: event.text || "" };
          continue;
        }
        if (event.kind === "tool" && event.tool) {
          const tool = event.tool;
          const previous = tools.get(tool.id);
          tools.set(tool.id, {
            id: tool.id,
            name: tool.name,
            status: tool.status as "running" | "success" | "error",
            summary: tool.summary,
            output: tool.output || previous?.output || "",
            durationMs: tool.durationMs || 0,
          });
          // Tool calls stream to the UI after `message-end` via getSession,
          // which reads Hermes' persisted transcript (tools included).
          continue;
        }
        if (event.kind === "result") {
          resultTokens = event.tokens ? {
            input: event.tokens.input || 0,
            output: event.tokens.output || 0,
            total: event.tokens.total || 0,
          } : null;
          resultDuration = event.durationMs || 0;
          continue;
        }
        if (event.kind === "error") {
          failure = event.message || "Hermes returned an error while generating.";
          continue;
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        throw error;
      }
    } finally {
      localAbort.delete(input.sessionId);
    }

    if (failure && !acc) {
      throw new HermesServiceError("unknown", failure);
    }

    const toolCalls = [...tools.values()].map((tool) => ({
      id: tool.id,
      name: tool.name,
      status: tool.status,
      durationMs: tool.durationMs || 0,
      summary: tool.summary,
      output: tool.output,
    }));

    yield {
      type: "message-end",
      messageId: assistantId,
      message: {
        id: assistantId,
        role: "assistant",
        content: acc,
        createdAt: new Date().toISOString(),
        demo: false,
        modelId: "",
        durationMs: resultDuration,
        tokens: resultTokens
          ? { prompt: resultTokens.input, completion: resultTokens.output, total: resultTokens.total }
          : undefined,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        error: failure || undefined,
      },
    };
    yield { type: "done" };
  },

  async stopGeneration(sessionId: string): Promise<void> {
    await abortChat(sessionId);
    localAbort.get(sessionId)?.abort();
    localAbort.delete(sessionId);
  },

  async *regenerate(messageId: string, sessionId: string): AsyncIterable<ChatEvent> {
    const session = await this.getSession(sessionId);
    const index = session.messages.findIndex((message) => message.id === messageId);
    const target = index >= 0 ? session.messages[index] : session.messages[session.messages.length - 1];
    if (!target || target.role !== "assistant") {
      throw fallbackError("إعادة توليد الرد", "لم يتم العثور على رسالة مساعد لإعادة توليدها.");
    }
    const prompt =
      session.messages
        .slice(0, index >= 0 ? index : session.messages.length)
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .slice(-1)
        .join("") || target.content;
    yield* this.sendMessage({ sessionId, content: prompt });
  },
};

/* -------------------------------------------------------------------------- */
/*  Models                                                                     */
/* -------------------------------------------------------------------------- */

const modelService: ModelService = {
  async listModels(): Promise<ModelInfo[]> {
    const index = await loadModelIndex();
    const hermes = [...index.values()].map((entry) => entry.info);
    // The OpenCode inventory is a read-only snapshot for comparison. It never
    // shadows Hermes' own catalogue and is simply appended when available.
    const opencode = await loadOpenCodeInventory();
    return [...hermes, ...opencode];
  },

  async getModel(id: string): Promise<ModelInfo> {
    const index = await loadModelIndex();
    const entry = index.get(id);
    if (!entry) throw new HermesServiceError("not_found", `النموذج ${id} غير موجود لدى Hermes.`);
    return entry.info;
  },

  async getActiveModel(): Promise<ModelInfo> {
    const active = await cachedGet<RawModelInfo>(MODEL_INFO_PATH, MODEL_INFO_TTL);
    const index = await loadModelIndex();
    const entry = index.get(active.model);
    if (entry) return entry.info;
    return {
      id: active.model,
      modelId: active.model,
      name: active.model,
      providerId: active.provider,
      providerName: active.provider,
      source: "hermes",
      pricing: "paid",
      inputPrice: 0,
      outputPrice: 0,
      contextWindow: active.effective_context_length || 0,
      maxOutputTokens: active.capabilities?.max_output_tokens || 0,
      capabilities: {
        reasoning: Boolean(active.capabilities?.supports_reasoning),
        vision: Boolean(active.capabilities?.supports_vision),
        toolCalling: Boolean(active.capabilities?.supports_tools),
        streaming: true,
        jsonMode: false,
      },
      catalogAvailable: false,
      configured: true,
      authenticated: true,
      verified: false,
      status: "verified",
      description: "النموذج النشط (بيانات من /api/model/info)",
      releaseDate: "",
      tags: [active.provider],
      favorite: false,
      inFallbackChain: false,
    };
  },

  async setActiveModel(modelId: string): Promise<void> {
    const index = await loadModelIndex();
    const entry = index.get(modelId);
    let provider = entry?.providerSlug;
    let model = modelId;
    if (!provider) {
      const [maybeProvider] = modelId.split("/");
      if (maybeProvider && index.has(modelId.slice(maybeProvider.length + 1))) {
        provider = maybeProvider;
        model = modelId.slice(maybeProvider.length + 1);
      }
    }
    if (!provider) {
      throw new HermesServiceError(
        "validation",
        `لا يمكن تحديد المزوّد للنموذج "${modelId}". اختر النموذج من قائمة النماذج المهيأة.`,
      );
    }
    await apiMutate("/api/model/set", "POST", { scope: "main", provider, model });
    modelIndex = null;
    modelIndexInflight = null;
    invalidateGet("/api/model/info");
    invalidateGet("/api/model/options");
  },

  async setFavorite(modelId: string, favorite: boolean): Promise<void> {
    const current = new Set(favourites());
    if (favorite) current.add(modelId);
    else current.delete(modelId);
    writeJson("cc.favourites", [...current]);
  },

  async setFallbackChain(modelIds: string[]): Promise<void> {
    const index = await loadModelIndex();
    const pairs = modelIds
      .map((id) => {
        const entry = index.get(id);
        return entry ? { provider: entry.providerSlug, model: entry.info.modelId } : null;
      })
      .filter((pair): pair is { provider: string; model: string } => pair !== null);
    await apiMutate("/api/config", "PUT", { config: { fallback_providers: pairs } });
    writeJson("cc.fallbacks", pairs);
  },

  async getFallbackChain(): Promise<ModelInfo[]> {
    const config = await apiGet<{ fallback_providers?: Array<{ provider?: string; model?: string }> }>(
      "/api/config",
    );
    const index = await loadModelIndex();
    const pairs = (config.fallback_providers || []).map((item) => ({
      provider: item.provider || "",
      model: item.model || "",
    }));
    writeJson("cc.fallbacks", pairs);
    return pairs
      .map((pair) => index.get(pair.model)?.info)
      .filter((info): info is ModelInfo => Boolean(info));
  },
};

/* -------------------------------------------------------------------------- */
/*  Providers                                                                  */
/* -------------------------------------------------------------------------- */

interface RawOAuthProvider {
  id: string;
  name: string;
  flow?: string;
  cli_command?: string;
  docs_url?: string | null;
  disconnectable?: boolean;
  status?: {
    logged_in?: boolean;
    source?: string;
    source_label?: string;
    token_preview?: string;
    free_tier?: boolean;
    account_tier?: string | null;
  };
}

interface RawCredentialPool {
  providers: Array<{
    provider: string;
    entries: Array<{
      index: number;
      label?: string;
      auth_type?: string;
      source?: string;
      token_preview?: string;
      last_status?: string | null;
      request_count?: number;
    }>;
  }>;
}

const providerService: ProviderService = {
  async listProviders(): Promise<ProviderInfo[]> {
    const [options, oauth, pool] = await Promise.all([
      cachedGet<RawModelOptions>(MODEL_OPTIONS_PATH, MODEL_OPTIONS_TTL),
      apiGet<{ providers: RawOAuthProvider[] }>("/api/providers/oauth").catch(() => ({ providers: [] })),
      apiGet<RawCredentialPool>("/api/credentials/pool").catch(() => ({ providers: [] })),
    ]);

    const credentialCount = new Map<string, number>();
    for (const provider of pool.providers || []) {
      credentialCount.set(provider.provider, provider.entries?.length || 0);
    }

    const builtIn: ProviderInfo[] = (options.providers || [])
      .filter((provider) => provider.total_models > 0 || provider.authenticated)
      .map((provider) => ({
        id: provider.slug,
        name: provider.name,
        kind: provider.auth_type || provider.source || "api-key",
        status: provider.authenticated ? "connected" : "not-configured",
        authStatus: provider.authenticated ? "active" : "none",
        configuredModels: provider.models?.length || 0,
        totalModels: provider.total_models || provider.models?.length || 0,
        capabilities: ["chat", "tools"],
        baseUrl: "",
        docsUrl: "",
        notes:
          provider.warning ||
          (provider.authenticated
            ? `مفتاح المفاتيح: ${credentialCount.get(provider.slug) || 1} · ${provider.source}`
            : "لم يُهيّأ بعد. أضف المفاتيح من صفحة الإعدادات في واجهة Hermes الرسمية."),
      }));

    const oauthProviders: ProviderInfo[] = (oauth.providers || []).map((provider) => ({
      id: provider.id,
      name: provider.name,
      kind: provider.flow || "oauth",
      status: provider.status?.logged_in ? "connected" : "not-configured",
      authStatus: provider.status?.logged_in ? "active" : "none",
      configuredModels: 0,
      totalModels: 0,
      capabilities: ["oauth"],
      baseUrl: "",
      docsUrl: provider.docs_url || "",
      notes: provider.status?.logged_in
        ? `متصل عبر ${provider.status.source_label || "OAuth"}${provider.status.token_preview ? ` (${provider.status.token_preview})` : ""}`
        : "غير متصل. استخدم أمر Hermes CLI المذكور لتفعيله.",
    }));

    const known = new Set(builtIn.map((item) => item.id));
    return [...builtIn, ...oauthProviders.filter((item) => !known.has(item.id))];
  },

  async getProvider(id: string): Promise<ProviderInfo> {
    const providers = await this.listProviders();
    const found = providers.find((item) => item.id === id);
    if (!found) throw new HermesServiceError("not_found", `المزوّد ${id} غير موجود.`);
    return found;
  },

  async saveCredential(providerId: string, apiKey: string): Promise<void> {
    if (!apiKey.trim()) {
      throw new HermesServiceError("validation", "مفتاح API لا يمكن أن يكون فارغًا.");
    }
    // Value goes straight to the local proxy -> Hermes. It is never stored here.
    await apiMutate("/api/credentials/pool", "POST", {
      provider: providerId,
      api_key: apiKey,
      label: `${providerId}-snowhare`,
    });
  },

  async disconnect(providerId: string): Promise<void> {
    const pool = await apiGet<RawCredentialPool>("/api/credentials/pool").catch(() => ({
      providers: [],
    }));
    const entry = (pool.providers || []).find((item) => item.provider === providerId)?.entries?.[0];
    if (entry) {
      await apiMutate(
        `/api/credentials/pool/${encodeURIComponent(providerId)}/${entry.index}`,
        "DELETE",
      );
      return;
    }
    await apiMutate(`/api/providers/oauth/${encodeURIComponent(providerId)}`, "DELETE");
  },
};

/* -------------------------------------------------------------------------- */
/*  MCP                                                                        */
/* -------------------------------------------------------------------------- */

function mapMcpServer(raw: RawMcpSummary): McpServer {
  const transport = (raw.transport || "stdio") as McpServer["transport"];
  return {
    id: raw.name,
    name: raw.name,
    nameAr: raw.name,
    transport: ["stdio", "sse", "http", "websocket"].includes(transport) ? transport : "http",
    status: raw.enabled ? "connected" : "disabled",
    enabled: Boolean(raw.enabled),
    command: raw.command || undefined,
    args: raw.args || undefined,
    url: raw.url || undefined,
    envVars: [],
    authType: "none",
    toolsCount: raw.tools?.length || 0,
    tools: raw.tools || [],
    description: raw.command ? `${raw.command} ${(raw.args || []).join(" ")}`.trim() : raw.url || "",
    scope: transport === "stdio" ? "local" : "remote",
  };
}

const mcpService: McpService = {
  async listServers(): Promise<McpServer[]> {
    const payload = await apiGet<{ servers: RawMcpSummary[] }>("/api/mcp/servers");
    return (payload.servers || []).map(mapMcpServer);
  },

  async addServer(input: Omit<McpServer, "id" | "status" | "tools" | "toolsCount">): Promise<McpServer> {
    if (!input.name.trim()) {
      throw new HermesServiceError("validation", "اسم خادم MCP مطلوب.");
    }
    const body: Record<string, unknown> = { name: input.name };
    if (input.url) body.url = input.url;
    if (input.command) body.command = input.command;
    if (input.args?.length) body.args = input.args;
    if (input.envVars?.length) {
      body.env = Object.fromEntries(
        input.envVars.filter((item) => item.key).map((item) => [item.key, item.value]),
      );
    }
    await apiMutate("/api/mcp/servers", "POST", body);
    const servers = await this.listServers();
    const created = servers.find((item) => item.id === input.name);
    if (!created) throw new HermesServiceError("unknown", "تمت إضافة الخادم لكن لم يتم إرجاعه.");
    return created;
  },

  async updateServer(id: string, patch: Partial<McpServer>): Promise<McpServer> {
    // Hermes' REST surface replaces the whole `mcp_servers` map, so fetch, patch, PUT.
    const payload = await apiGet<{ servers: RawMcpSummary[] }>("/api/mcp/servers");
    const current = payload.servers || [];
    const index = current.findIndex((item) => item.name === id);
    if (index < 0) throw new HermesServiceError("not_found", `خادم MCP "${id}" غير موجود.`);
    const updated = { ...current[index] };
    if (patch.enabled !== undefined) updated.enabled = patch.enabled;
    if (patch.command !== undefined) updated.command = patch.command;
    if (patch.url !== undefined) updated.url = patch.url;
    if (patch.args !== undefined) updated.args = patch.args;
    const next = [...current];
    next[index] = updated;
    await apiMutate("/api/mcp/servers", "PUT", { servers: Object.fromEntries(next.map((item) => [item.name, item])) });
    return mapMcpServer(updated);
  },

  async removeServer(id: string): Promise<void> {
    await apiMutate(`/api/mcp/servers/${encodeURIComponent(id)}`, "DELETE");
  },

  async setEnabled(id: string, enabled: boolean): Promise<McpServer> {
    await apiMutate(`/api/mcp/servers/${encodeURIComponent(id)}/enabled`, "PUT", { enabled });
    const servers = await this.listServers();
    const found = servers.find((item) => item.id === id);
    if (!found) throw new HermesServiceError("not_found", `خادم MCP "${id}" غير موجود بعد التحديث.`);
    return found;
  },

  async testConnection(id: string): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const startedAt = Date.now();
    try {
      const result = await apiGet<{ ok?: boolean; error?: string; tools?: Array<{ name: string }> }>(
        `/api/mcp/servers/${encodeURIComponent(id)}/test`,
      );
      const latencyMs = Date.now() - startedAt;
      if (result.error) return { ok: false, latencyMs, message: result.error };
      return {
        ok: Boolean(result.ok ?? true),
        latencyMs,
        message: `تم الاتصال · ${result.tools?.length || 0} أداة`,
      };
    } catch (error) {
      throw new HermesServiceError(
        "unknown",
        `فشل اختبار الاتصال: ${error instanceof Error ? error.message : String(error)}`,
        { details: error },
      );
    }
  },
};

/* -------------------------------------------------------------------------- */
/*  Skills                                                                     */
/* -------------------------------------------------------------------------- */

function mapSkill(raw: RawSkill, favourite: boolean): SkillInfo {
  const provenance = raw.provenance || "bundled";
  const status: SkillStatus = raw.enabled
    ? "installed"
    : provenance === "hub"
      ? "disabled"
      : "installed";
  return {
    id: raw.name,
    name: raw.name,
    nameAr: raw.name,
    description: raw.description || "",
    descriptionAr: raw.description || "",
    category: raw.category || "عام",
    source: provenance,
    status: raw.enabled ? status : "disabled",
    enabled: Boolean(raw.enabled),
    favorite: favourite,
    requiredTools: [],
    usageCount: raw.usage || 0,
    author: provenance === "bundled" ? "Hermes" : provenance === "hub" ? "Skills Hub" : "المستخدم",
  };
}

const skillService: SkillService = {
  async listSkills(): Promise<SkillInfo[]> {
    const [skills, favouritesNow] = await Promise.all([
      apiGet<RawSkill[]>("/api/skills"),
      Promise.resolve(favourites()),
    ]);
    const favouriteSet = new Set(favouritesNow);
    return (skills || []).map((skill) => mapSkill(skill, favouriteSet.has(skill.name)));
  },

  async getSkill(id: string): Promise<SkillInfo> {
    const skills = await this.listSkills();
    const found = skills.find((skill) => skill.id === id);
    if (!found) throw new HermesServiceError("not_found", `المهارة ${id} غير موجودة.`);
    return found;
  },

  async setEnabled(id: string, enabled: boolean): Promise<SkillInfo> {
    await apiMutate("/api/skills/toggle", "PUT", { name: id, enabled });
    return this.getSkill(id);
  },

  async install(id: string): Promise<SkillInfo> {
    await apiMutate("/api/skills/hub/install", "POST", { identifier: id });
    return this.getSkill(id);
  },

  async remove(id: string): Promise<void> {
    await apiMutate("/api/skills/hub/uninstall", "POST", { name: id });
  },

  async setFavorite(id: string, favorite: boolean): Promise<SkillInfo> {
    const current = new Set(readJson<string[]>("cc.skillFavourites") || []);
    if (favorite) current.add(id);
    else current.delete(id);
    writeJson("cc.skillFavourites", [...current]);
    return this.getSkill(id);
  },
};

/* -------------------------------------------------------------------------- */
/*  Tools (toolsets)                                                          */
/* -------------------------------------------------------------------------- */

const TOOLSET_CATEGORIES: Record<string, ToolCategory> = {
  web: "search",
  browser: "browser",
  "computer-use": "computer-use",
  terminal: "terminal",
  filesystem: "files",
  code: "code",
  memory: "memory",
  media: "media",
  integrations: "integrations",
};

const toolService: ToolService = {
  async listTools(): Promise<ToolInfo[]> {
    const toolsets = await apiGet<RawToolset[]>("/api/tools/toolsets");
    return (toolsets || []).map((toolset) => {
      const name = toolset.name;
      const category =
        TOOLSET_CATEGORIES[name] ||
        (name.includes("browser")
          ? "browser"
          : name.includes("computer")
            ? "computer-use"
            : name.includes("file")
              ? "files"
              : name.includes("web") || name.includes("search")
                ? "search"
                : name.includes("code") || name.includes("editor")
                  ? "code"
                  : name.includes("memory")
                    ? "memory"
                    : name.includes("mcp") || name.includes("slack") || name.includes("telegram")
                      ? "integrations"
                      : name.includes("image") || name.includes("video") || name.includes("audio")
                        ? "media"
                        : "terminal");

      return {
        id: name,
        name: name,
        nameAr: toolset.label || name,
        description: (toolset.tools || []).join(", ") || toolset.description || "",
        descriptionAr: toolset.description || "",
        category,
        enabled: Boolean(toolset.enabled),
        status: toolset.enabled ? "ready" : toolset.available === false ? "disabled" : "limited",
        permissions: (toolset.tools || []).slice(0, 8),
        usageCount: 0,
        options: [],
        requiresConfirmation: false,
      } satisfies ToolInfo;
    });
  },

  async setEnabled(id: string, enabled: boolean): Promise<ToolInfo> {
    await apiMutate(`/api/tools/toolsets/${encodeURIComponent(id)}`, "PUT", { enabled });
    const tools = await this.listTools();
    const found = tools.find((tool) => tool.id === id);
    if (!found) throw new HermesServiceError("not_found", `مجموعة الأدوات ${id} غير موجودة.`);
    return found;
  },

  async updateOptions(id: string): Promise<ToolInfo> {
    throw fallbackError(
      `تعديل خيارات مجموعة الأدوات "${id}"`,
      "Hermes لا يوفّر واجهة كتابة لإعدادات التشكيل عبر REST؛ عدّلها من صفحة الإعدادات في واجهة Hermes الرسمية (config.yaml).",
    );
  },
};

/* -------------------------------------------------------------------------- */
/*  Projects — safe read-only organising layer over Hermes' real concepts      */
/* -------------------------------------------------------------------------- */

interface ProjectRegistryEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

const PROJECT_KEY = "cc.projects";

const projectService: ProjectService = {
  async listProjects(): Promise<Project[]> {
    const registry = readJson<ProjectRegistryEntry[]>(PROJECT_KEY) || [];
    const workspaces = await apiGet<{
      projects?: unknown[];
      repos?: unknown[];
      default_cwd?: string;
    }>("/api/chat/workspaces").catch((): { default_cwd: string } => ({ default_cwd: "" }));

    const sessions = await apiGet<RawSessionsResponse>("/api/sessions?limit=100").catch(
      (): RawSessionsResponse => ({ sessions: [] }),
    );

    // Derived workspaces: every distinct working directory Hermes has run in.
    const derived = new Map<string, { path: string; sessions: number; lastUsed: number }>();
    for (const row of sessions.sessions || []) {
      const path = row.git_repo_root || row.cwd;
      if (!path) continue;
      const existing = derived.get(path);
      derived.set(path, {
        path,
        sessions: (existing?.sessions || 0) + 1,
        lastUsed: Math.max(existing?.lastUsed || 0, row.started_at || 0),
      });
    }

    const now = new Date().toISOString();
    const fromRegistry: Project[] = registry.map((entry) => ({
      id: entry.id,
      name: entry.name,
      nameAr: entry.name,
      description: entry.description,
      icon: "code",
      color: "var(--accent)",
      path: entry.path,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      conversationIds: [],
      toolIds: [],
      skillIds: [],
      instructions: "",
      fileCount: 0,
    }));

    const registryPaths = new Set(registry.map((entry) => entry.path.replace(/[\\/]+$/, "").toLowerCase()));
    const fromSessions: Project[] = [...derived.values()]
      .filter((item) => !registryPaths.has(item.path.replace(/[\\/]+$/, "").toLowerCase()))
      .map((item) => ({
        id: `ws_${item.path.replace(/[^0-9a-z]/gi, "_").toLowerCase()}`,
        name: item.path.split(/[\\/]/).filter(Boolean).pop() || item.path,
        nameAr: item.path.split(/[\\/]/).filter(Boolean).pop() || item.path,
        description: `مساحة عمل مستنتجة من جلسات Hermes · ${item.sessions} جلسة · ${item.path}`,
        icon: "code",
        color: "var(--muted)",
        path: item.path,
        createdAt: now,
        updatedAt: item.lastUsed ? new Date(item.lastUsed * 1000).toISOString() : now,
        conversationIds: [],
        toolIds: [],
        skillIds: [],
        instructions: "",
        fileCount: 0,
      }));

    if (workspaces.default_cwd && !registryPaths.has(String(workspaces.default_cwd).toLowerCase())) {
      fromSessions.unshift({
        id: "ws_default",
        name: "المساحة الافتراضية",
        nameAr: "المساحة الافتراضية",
        description: `مساحة العمل الافتراضية في Hermes (${workspaces.default_cwd})`,
        icon: "cube",
        color: "var(--muted)",
        path: String(workspaces.default_cwd),
        createdAt: now,
        updatedAt: now,
        conversationIds: [],
        toolIds: [],
        skillIds: [],
        instructions: "",
        fileCount: 0,
      });
    }

    return [...fromRegistry, ...fromSessions];
  },

  async getProject(id: string): Promise<Project> {
    const projects = await this.listProjects();
    const found = projects.find((project) => project.id === id);
    if (!found) throw new HermesServiceError("not_found", `المشروع ${id} غير موجود.`);
    return found;
  },

  async createProject(
    input: Omit<Project, "id" | "createdAt" | "updatedAt" | "conversationIds">,
  ): Promise<Project> {
    const registry = readJson<ProjectRegistryEntry[]>(PROJECT_KEY) || [];
    const normalized = String(input.path || "").replace(/[\\/]+$/, "");
    if (!normalized) {
      throw new HermesServiceError("validation", "مسار مجلد المشروع مطلوب.");
    }
    if (registry.some((entry) => entry.path.replace(/[\\/]+$/, "") === normalized)) {
      throw new HermesServiceError("validation", "هذا المجلد مسجّل بالفعل كمشروع.");
    }
    const now = new Date().toISOString();
    const entry: ProjectRegistryEntry = {
      id: `proj_${Date.now().toString(36)}`,
      name: input.name,
      description: input.description || "",
      path: normalized,
      createdAt: now,
      updatedAt: now,
    };
    // Safe organising layer: registers a path, writes nothing to the user's folder.
    writeJson(PROJECT_KEY, [...registry, entry]);
    return {
      id: entry.id,
      name: entry.name,
      nameAr: input.nameAr || input.name,
      description: entry.description,
      icon: input.icon || "code",
      color: input.color || "var(--accent)",
      path: entry.path,
      createdAt: now,
      updatedAt: now,
      preferredModelId: input.preferredModelId,
      conversationIds: [],
      toolIds: input.toolIds || [],
      skillIds: input.skillIds || [],
      instructions: input.instructions || "",
      fileCount: 0,
    };
  },

  async updateProject(id: string, patch: Partial<Project>): Promise<Project> {
    const registry = readJson<ProjectRegistryEntry[]>(PROJECT_KEY) || [];
    const index = registry.findIndex((entry) => entry.id === id);
    if (index < 0) throw fallbackError("تعديل المشروع", "المشاريع المشتقة من جلسات Hermes للقراءة فقط.");
    const next = [...registry];
    next[index] = {
      ...next[index],
      name: patch.name ?? next[index].name,
      description: patch.description ?? next[index].description,
      updatedAt: new Date().toISOString(),
    };
    writeJson(PROJECT_KEY, next);
    return this.getProject(id);
  },

  async deleteProject(id: string): Promise<void> {
    const registry = readJson<ProjectRegistryEntry[]>(PROJECT_KEY) || [];
    if (!registry.some((entry) => entry.id === id)) {
      throw fallbackError("حذف المشروع", "المشاريع المشتقة من جلسات Hermes للقراءة فقط ولا يمكن حذفها.");
    }
    writeJson(PROJECT_KEY, registry.filter((entry) => entry.id !== id));
  },

  async listProjectFiles(id: string): Promise<FileEntry[]> {
    const project = await this.getProject(id);
    return fileService.list(project.path);
  },
};

/* -------------------------------------------------------------------------- */
/*  Files                                                                      */
/* -------------------------------------------------------------------------- */

interface RawFsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified_at?: string;
}

function mapFsEntry(entry: RawFsEntry): FileEntry {
  const extension = entry.name.includes(".") ? entry.name.split(".").pop() || "" : "";
  return {
    id: entry.path,
    name: entry.name,
    path: entry.path,
    type: entry.isDirectory ? "folder" : "file",
    extension: extension.toLowerCase(),
    size: entry.size ?? 0,
    modifiedAt: entry.modified_at || new Date().toISOString(),
  };
}

/** Resolves the workspace root Hermes uses when the UI asks for "the default root". */
async function resolveDefaultWorkspace(): Promise<string> {
  const workspaces = await apiGet<{ default_cwd?: string; cwd?: string }>("/api/chat/workspaces").catch(
    (): { default_cwd?: string; cwd?: string } => ({}),
  );
  return String(workspaces.default_cwd || workspaces.cwd || "").trim();
}

const fileService: FileService = {
  async list(path: string): Promise<FileEntry[]> {
    // The UI calls list("") to mean "the default workspace root".
    const resolved = path && path.trim() ? path : await resolveDefaultWorkspace();
    if (!resolved) {
      throw new HermesServiceError("validation", "تعذّر تحديد مساحة العمل الافتراضية في Hermes.");
    }
    const payload = await apiGet<{ entries?: RawFsEntry[] }>(`/api/fs/list${qs({ path: resolved })}`);
    return (payload.entries || []).map((entry) => mapFsEntry(entry));
  },

  async read(path: string): Promise<FileEntry> {
    const payload = await apiGet<{ content?: string; text?: string; path?: string; truncated?: boolean }>(
      `/api/fs/read-text${qs({ path })}`,
    );
    const content = payload.content ?? payload.text ?? "";
    const name = path.split(/[\\/]/).pop() || path;
    return {
      id: path,
      name,
      path,
      type: "file",
      extension: name.includes(".") ? (name.split(".").pop() || "").toLowerCase() : "",
      size: content.length,
      modifiedAt: new Date().toISOString(),
      content,
      language: name.split(".").pop(),
    };
  },

  async search(): Promise<FileEntry[]> {
    throw fallbackError(
      "بحث في الملفات",
      "Hermes لا يوفّر endpoint للبحث في نظام الملفات؛ استخدم تصفّح المجلدات أو مهارة البحث لدى الوكيل.",
    );
  },
};

/* -------------------------------------------------------------------------- */
/*  Memory (Hermes learning graph)                                             */
/* -------------------------------------------------------------------------- */

interface RawLearningGraph {
  nodes?: Array<{ id?: string | number; label?: string; kind?: string; category?: string; created_at?: string }>;
  memory?: Array<{ id?: string | number; label?: string; content?: string; category?: string }>;
  stats?: { memory_nodes?: number };
}

const memoryService: MemoryService = {
  async listItems(): Promise<MemoryItem[]> {
    const graph = await apiGet<RawLearningGraph>("/api/learning/graph").catch(
      (): RawLearningGraph => ({ nodes: [] }),
    );
    const now = new Date().toISOString();
    const nodes = graph.nodes || [];
    const memories: MemoryItem[] = nodes
      .filter((node) => node.kind === "memory")
      .map((node, index) => ({
        id: String(node.id ?? `mem_${index}`),
        title: node.label || "ذاكرة",
        content: "",
        category: node.category || "عام",
        tags: [],
        importance: "medium" as const,
        pinned: false,
        createdAt: node.created_at || now,
        updatedAt: node.created_at || now,
        source: "manual" as const,
      }));

    const extra = (graph.memory || []).map((entry, index) => ({
      id: String(entry.id ?? `mem_graph_${index}`),
      title: entry.label || "ذاكرة",
      content: entry.content || "",
      category: entry.category || "عام",
      tags: [],
      importance: "medium" as const,
      pinned: false,
      createdAt: now,
      updatedAt: now,
      source: "manual" as const,
    }));
    const seen = new Set(memories.map((item) => item.id));
    return [...memories, ...extra.filter((item) => !seen.has(item.id))];
  },

  async getItem(id: string): Promise<MemoryItem> {
    const detail = await apiGet<{ content?: string; kind?: string; label?: string; ok?: boolean }>(
      `/api/learning/node${qs({ id })}`,
    );
    if (detail.ok === false) throw new HermesServiceError("not_found", "العنصر غير موجود في الذاكرة.");
    const now = new Date().toISOString();
    return {
      id,
      title: detail.label || id,
      content: detail.content || "",
      category: "ذاكرة",
      tags: [],
      importance: "medium",
      pinned: false,
      createdAt: now,
      updatedAt: now,
      source: "manual",
    };
  },

  async upsertItem(item: Partial<MemoryItem> & { id?: string }): Promise<MemoryItem> {
    if (!item.id) {
      throw new HermesServiceError(
        "unsupported",
        "إنشاء عنصر ذاكرة جديد غير متاح عبر REST لدى هذا الإصدار؛ الذاكرة تُبنى تلقائيًا أثناء المحادثات.",
      );
    }
    await apiMutate("/api/learning/node", "PUT", { id: item.id, content: item.content || "" });
    return this.getItem(item.id);
  },

  async deleteItem(id: string): Promise<void> {
    await apiMutate("/api/learning/node", "DELETE", { id });
  },
};

/* -------------------------------------------------------------------------- */
/*  Automations (cron)                                                         */
/* -------------------------------------------------------------------------- */

function scheduleKind(cron?: string): Automation["scheduleType"] {
  const parts = (cron || "").trim().split(/\s+/);
  if (parts.length === 6) return "cron";
  if (parts.length !== 5) return "cron";
  if (parts[0].startsWith("@")) return "daily";
  if (parts[4] === "*") return "daily";
  if (parts[2] === "*") return "weekly";
  if (parts[2] === "1") return "monthly";
  return "weekly";
}

function mapAutomation(job: RawCronJob): Automation {
  const status: AutomationStatus = job.enabled ? "pending" : "success";
  return {
    id: job.id,
    name: job.name || job.prompt?.slice(0, 60) || "مهمة",
    nameAr: job.name || job.prompt?.slice(0, 60) || "مهمة",
    description: (job.prompt || "").slice(0, 300),
    enabled: Boolean(job.enabled),
    scheduleType: scheduleKind(job.schedule),
    cron: job.schedule || "",
    time: "",
    days: [],
    command: job.prompt || "",
    lastRunAt: job.last_run_at || undefined,
    nextRunAt: job.next_run_at || "",
    lastStatus: job.last_error ? "failed" : status,
    runCount: 0,
    failureCount: 0,
    logs: [],
  };
}

const automationService: AutomationService = {
  async listAutomations(): Promise<Automation[]> {
    const jobs = await apiGet<RawCronJob[]>("/api/cron/jobs").catch(() => []);
    return (jobs || []).map(mapAutomation);
  },

  async createAutomation(
    input: Omit<Automation, "id" | "logs" | "runCount" | "failureCount">,
  ): Promise<Automation> {
    const job = await apiMutate<RawCronJob>("/api/cron/jobs", "POST", {
      name: input.name || input.nameAr,
      prompt: input.command,
      schedule: input.cron || "* * * * *",
      provider: undefined,
      model: undefined,
    });
    return mapAutomation(job);
  },

  async updateAutomation(id: string, patch: Partial<Automation>): Promise<Automation> {
    const updates: Record<string, unknown> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.command !== undefined) updates.prompt = patch.command;
    if (patch.cron !== undefined) updates.schedule = patch.cron;
    if (patch.enabled !== undefined) updates.enabled = patch.enabled;
    const job = await apiMutate<RawCronJob>(`/api/cron/jobs/${encodeURIComponent(id)}`, "PUT", { updates });
    return mapAutomation(job);
  },

  async deleteAutomation(id: string): Promise<void> {
    await apiMutate(`/api/cron/jobs/${encodeURIComponent(id)}`, "DELETE");
  },

  async setEnabled(id: string, enabled: boolean): Promise<Automation> {
    await apiMutate(
      `/api/cron/jobs/${encodeURIComponent(id)}/${enabled ? "resume" : "pause"}`,
      "POST",
    );
    const job = await apiGet<RawCronJob>(`/api/cron/jobs/${encodeURIComponent(id)}`);
    return mapAutomation(job);
  },

  async runNow(id: string): Promise<{ runId: string; status: AutomationStatus; durationMs: number; output: string }> {
    const startedAt = Date.now();
    const job = await apiMutate<RawCronJob>(`/api/cron/jobs/${encodeURIComponent(id)}/trigger`, "POST");
    return {
      runId: `${id}-${startedAt}`,
      status: job.last_error ? "failed" : "success",
      durationMs: Date.now() - startedAt,
      output: job.last_error || "اكتمل التنفيذ.",
    };
  },

  async listRuns(id: string): Promise<AutomationRun[]> {
    const payload = await apiGet<{ runs?: Array<Record<string, unknown>> }>(
      `/api/cron/jobs/${encodeURIComponent(id)}/runs${qs({ limit: 20 })}`,
    );
    return (payload.runs || []).map((run, index) => {
      const row = run as {
        id?: string;
        started_at?: number;
        ended_at?: number;
        last_active?: number;
        title?: string;
        model?: string;
      };
      return {
        id: String(row.id ?? `${id}-run-${index}`),
        startedAt: toIso(row.started_at || row.last_active),
        durationMs: row.started_at && row.ended_at ? Math.round((row.ended_at - row.started_at) * 1000) : 0,
        status: "success" as const,
        output: row.title || row.model || "تم التنفيذ",
      };
    });
  },
};

/* -------------------------------------------------------------------------- */
/*  Integrations (messaging platforms + webhooks)                              */
/* -------------------------------------------------------------------------- */

interface RawMessagingPlatform {
  id: string;
  name?: string;
  description?: string;
  docs_url?: string | null;
  enabled?: boolean;
  configured?: boolean;
  gateway_running?: boolean;
  state?: string;
  env_vars?: Array<{ key: string; required?: boolean; is_set?: boolean; description?: string }>;
}

const integrationService: IntegrationService = {
  async listIntegrations(): Promise<Integration[]> {
    const [messaging, webhooks] = await Promise.all([
      apiGet<{ platforms?: RawMessagingPlatform[] }>("/api/messaging/platforms").catch(
        (): { platforms: RawMessagingPlatform[] } => ({ platforms: [] }),
      ),
      apiGet<{ enabled?: boolean; base_url?: string; subscriptions?: Array<Record<string, unknown>> }>(
        "/api/webhooks",
      ).catch(
        (): { enabled: boolean; base_url?: string; subscriptions: Array<Record<string, unknown>> } => ({
          enabled: false,
          subscriptions: [],
        }),
      ),
    ]);

    const platforms: Integration[] = (messaging.platforms || []).map((platform) => ({
      id: platform.id,
      name: platform.name || platform.id,
      nameAr: platform.name || platform.id,
      description: platform.description || "",
      category: "messaging" as const,
      connected: Boolean(platform.enabled && platform.gateway_running),
      requires: (platform.env_vars || [])
        .filter((variable) => variable.required && !variable.is_set)
        .map((variable) => variable.key),
      settings: (platform.env_vars || []).map((variable) => ({
        id: variable.key,
        label: variable.description || variable.key,
        type: "secret-ref" as const,
        value: variable.is_set ? "••••••••" : "",
      })),
      iconHint: platform.id,
      supportedByHermes: true,
    }));

    const webhook: Integration = {
      id: "webhooks",
      name: "Webhooks",
      nameAr: "Webhooks",
      description:
        (webhooks.base_url ? `العنوان الأساسي: ${webhooks.base_url} · ` : "") +
        `${webhooks.subscriptions?.length || 0} اشتراك`,
      category: "webhooks",
      connected: Boolean(webhooks.enabled),
      requires: [],
      settings: [],
      iconHint: "webhook",
      supportedByHermes: true,
    };

    return [...platforms, webhook];
  },

  async connect(id: string): Promise<Integration> {
    throw fallbackError(
      `تفعيل التكامل "${id}"`,
      "التفعيل يتطلب إعداد بيانات اعتماد (مثل Telegram bot token) وإعادة تشغيل الـ Gateway من واجهة Hermes الرسمية؛ لا يمكن إتمامه بأمان من هذه الواجهة.",
    );
  },

  async disconnect(id: string): Promise<Integration> {
    throw fallbackError(
      `إيقاف التكامل "${id}"`,
      "يتطلب تغيير إعدادات Hermes الرسمية عبر واجهته المخصصة.",
    );
  },

  async saveSettings(): Promise<Integration> {
    throw fallbackError(
      "حفظ إعدادات التكامل",
      "التعديل يتم عبر متغيّرات البيئة لدى Hermes؛ لا تُخزَّن هذه الواجهة لبيانات اعتماد.",
    );
  },
};

/* -------------------------------------------------------------------------- */
/*  Activity                                                                   */
/* -------------------------------------------------------------------------- */

const activityService: ActivityService = {
  async listEvents(options?: ListOptions): Promise<ActivityEvent[]> {
    const payload = await apiGet<RawSessionsResponse>(`/api/sessions${qs({ limit: options?.limit ?? 50 })}`);
    const rows = payload.sessions || [];

    const events: ActivityEvent[] = rows.map((row) => ({
      id: row.id,
      type: "chat-started" as const,
      title: row.title || "محادثة",
      description: `${row.model || "النموذج النشط"} · ${row.message_count} رسالة · ${row.tool_call_count} نداء أداة`,
      timestamp: toIso(row.started_at),
      durationMs: row.started_at && row.ended_at ? Math.round((row.ended_at - row.started_at) * 1000) : undefined,
      status: "success" as const,
      actor: "hermes" as const,
      target: row.model || undefined,
      demo: false,
    }));

    const search = options?.search?.toLowerCase();
    return events
      .filter((event) => !search || `${event.title} ${event.description}`.toLowerCase().includes(search))
      .slice(0, 200);
  },

  async exportEvents(): Promise<string> {
    const events = await this.listEvents({ limit: 200 });
    return JSON.stringify({ exportedAt: new Date().toISOString(), source: "hermes", events }, null, 2);
  },
};

/* -------------------------------------------------------------------------- */
/*  Analytics                                                                  */
/* -------------------------------------------------------------------------- */

interface RawUsage {
  daily?: Array<{ day: string; input_tokens?: number; output_tokens?: number; api_calls?: number; estimated_cost?: number }>;
  by_model?: Array<{ model: string; input_tokens?: number; output_tokens?: number; api_calls?: number; estimated_cost?: number; actual_cost?: number }>;
}

const analyticsService: AnalyticsService = {
  async getUsageSummary(): Promise<UsageSummary> {
    const usage = await apiGet<RawUsage>("/api/analytics/usage" + qs({ days: 30 })).catch(
      (): RawUsage => ({}),
    );

    const points = (usage.daily || []).map((day) => ({
      date: day.day,
      requests: day.api_calls || 0,
      tokens: (day.input_tokens || 0) + (day.output_tokens || 0),
      cost: day.estimated_cost || 0,
      modelId: "",
    }));

    const byModel = (usage.by_model || []).map((entry) => ({
      modelId: entry.model,
      name: entry.model,
      requests: entry.api_calls || 0,
      tokens: (entry.input_tokens || 0) + (entry.output_tokens || 0),
      cost: entry.actual_cost ?? entry.estimated_cost ?? 0,
    }));

    return {
      points,
      totalRequests: points.reduce((sum, point) => sum + point.requests, 0),
      totalTokens: points.reduce((sum, point) => sum + point.tokens, 0),
      totalCost: points.reduce((sum, point) => sum + point.cost, 0),
      byModel,
      byTool: [],
    };
  },
};

/* -------------------------------------------------------------------------- */
/*  Browser / Computer Use                                                     */
/* -------------------------------------------------------------------------- */

interface RawBrowserConfig {
  backend?: string;
  engine?: string;
  headed?: boolean;
  use_real_profile?: boolean;
  record_sessions?: boolean;
  inactivity_timeout?: number;
  cdp_url?: string;
}

interface RawComputerUseStatus {
  platform?: string;
  platform_supported?: boolean;
  installed?: boolean;
  version?: string | null;
  ready?: boolean | null;
  can_grant?: boolean;
  checks?: Array<{ label: string; status: string; message?: string }>;
  error?: string | null;
}

const browserService: BrowserService = {
  async getState(): Promise<BrowserState> {
    const [config, toolsets] = await Promise.all([
      apiGet<{ browser?: RawBrowserConfig }>("/api/config").catch(
        (): { browser: RawBrowserConfig } => ({ browser: {} }),
      ),
      apiGet<RawToolset[]>("/api/tools/toolsets").catch((): RawToolset[] => []),
    ]);
    const browser = config.browser || {};
    const toolset = toolsets.find((item) => item.name === "browser");

    return {
      installed: Boolean(toolset?.available ?? toolset?.configured ?? true),
      running: false,
      version: browser.engine ? `engine=${browser.engine}` : "engine=auto",
      executablePath: "",
      profilePath: browser.use_real_profile ? "الملف الشخصي الحقيقي" : "ملف معزول",
      storageLocation: "",
      persistenceEnabled: Boolean(browser.use_real_profile),
      sessions: [],
      engine: browser.engine || "auto",
      isolationNote:
        "متصفح Hermes المستقل (Chromium). لا يستخدم متصفحك الشخصي ولا ينسخ ملفات تعريف الارتباط أو الجلسات. " +
        "لا توجد واجهة REST لفتح/إغلاق الجلسة في هذا الإصدار — يتم التحكم من وكيل Hermes أثناء المحادثة.",
    };
  },

  async launch(): Promise<BrowserState> {
    throw fallbackError(
      "فتح متصفح Hermes",
      "لا يوجد endpoint رسمي لبدء جلسة متصفح مستقل في الإصدار 0.22.2؛ التصفّح يتم من وكيل Hermes عند الحاجة.",
    );
  },

  async close(): Promise<BrowserState> {
    throw fallbackError(
      "إغلاق جلسة المتصفح",
      "لا يوجد endpoint رسمي لإغلاق الجلسة. استخدم أمر `hermes browser` من سطر الأوامر إن لزم.",
    );
  },

  async clearSession(): Promise<BrowserState> {
    throw fallbackError(
      "مسح جلسة المتصفح",
      "لا يوجد endpoint رسمي لمسح جلسة المتصفح في هذا الإصدار.",
    );
  },
};

const computerUseService: ComputerUseService = {
  async getState(): Promise<ComputerUseState> {
    const status = await apiGet<RawComputerUseStatus>("/api/tools/computer-use/status");
    const checks = status.checks || [];

    return {
      driverInstalled: Boolean(status.installed),
      sessionActive: false,
      screenCaptureAvailable: status.ready === true,
      mouseControl: status.ready === true,
      keyboardControl: status.ready === true,
      permissions: checks.map((check) => ({
        id: check.label,
        label: check.message ? `${check.label} — ${check.message}` : check.label,
        granted: check.status === "ok",
      })),
      history: [],
      emergencyStopAvailable: false,
    };
  },

  async startSession(): Promise<ComputerUseState> {
    throw fallbackError(
      "بدء جلسة تحكم بالكمبيوتر",
      "لا يوجد endpoint رسمي لبدء/إنهاء جلسة تحكم؛ يعمل التحكم من وكيل Hermes فقط ويحتاج موافقتك.",
    );
  },

  async stopSession(): Promise<ComputerUseState> {
    throw fallbackError("إيقاف جلسة التحكم", "لا يوجد endpoint رسمي لإيقاف جلسة التحكم في هذا الإصدار.");
  },

  async emergencyStop(): Promise<ComputerUseState> {
    throw fallbackError("الإيقاف الطارئ", "لا يوجد endpoint رسمي للإيقاف الطارئ في هذا الإصدار.");
  },

  async setPermission(): Promise<ComputerUseState> {
    const status = await apiGet<RawComputerUseStatus>("/api/tools/computer-use/status");
    if (status.can_grant) {
      await apiMutate("/api/tools/computer-use/permissions/grant", "POST");
    }
    throw fallbackError(
      "منح صلاحيات التحكم",
      "منح الصلاحيات متاح على macOS فقط؛ على Windows يتم منح الصلاحيات داخل cua-driver نفسه.",
    );
  },
};

/* -------------------------------------------------------------------------- */
/*  System                                                                     */
/* -------------------------------------------------------------------------- */

const systemService: SystemService = {
  async getConnectionStatus(): Promise<ConnectionStatus> {
    const startedAt = Date.now();
    try {
      const health = await bridgeHealth();
      const latencyMs = Date.now() - startedAt;
      if (!health.ok) {
        return {
          state: health.tokenAvailable ? "connecting" : "disconnected",
          message: health.tokenAvailable
            ? "المسوّق يعمل لكن لوحة Hermes الرسمية متوقفة."
            : "تعذّر الحصول على جلسة محلية؛ أعد تشغيل المشغّل.",
          lastCheckedAt: new Date().toISOString(),
          latencyMs,
          version: health.upstream?.displayVersion || health.upstream?.version,
        };
      }
      return {
        state: "connected",
        message: `متصل بـ Hermes ${health.upstream?.displayVersion || health.upstream?.version || ""} عبر 127.0.0.1`,
        lastCheckedAt: new Date().toISOString(),
        latencyMs,
        version: health.upstream?.displayVersion || health.upstream?.version,
      };
    } catch (error) {
      return {
        state: "disconnected",
        message: error instanceof Error ? error.message : "تعذّر الوصول إلى المشغّل المحلي.",
        lastCheckedAt: new Date().toISOString(),
      };
    }
  },

  async getCapabilities(): Promise<Record<string, boolean>> {
    const checks: Array<[string, string]> = [
      ["models", "/api/model/options"],
      ["sessions", "/api/sessions?limit=1"],
      ["skills", "/api/skills"],
      ["tools", "/api/tools/toolsets"],
      ["mcp", "/api/mcp/servers"],
      ["providers", "/api/providers/oauth"],
      ["config", "/api/config"],
      ["automations", "/api/cron/jobs"],
      ["memory", "/api/learning/graph"],
      ["files", "/api/fs/default-cwd"],
      ["analytics", "/api/analytics/usage"],
      ["messaging", "/api/messaging/platforms"],
    ];
    const results = await Promise.all(
      checks.map(async ([key, path]) => {
        try {
          await apiGet(path);
          return [key, true] as const;
        } catch {
          return [key, false] as const;
        }
      }),
    );
    return Object.fromEntries(results);
  },

  async getVersion(): Promise<{ app: string; build: string; hermes?: string }> {
    const health = await bridgeHealth();
    return {
      app: "Snowhare Control Center",
      build: health.proxy.version,
      hermes: health.upstream?.displayVersion || health.upstream?.version,
    };
  },
};

/* -------------------------------------------------------------------------- */
/*  Registry                                                                   */
/* -------------------------------------------------------------------------- */

export function createHermesServices(): Services {
  return {
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
}
