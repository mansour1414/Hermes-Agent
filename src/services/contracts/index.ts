/**
 * Service contracts (ports) for the Hermes Control Center.
 *
 * The UI layer only ever talks to these interfaces. A concrete adapter
 * (mock / hermes / opencode) is injected at runtime through the
 * `ServiceProvider` in `src/services/index.ts`.
 *
 * Every method may reject with a `HermesServiceError` — see `errors.ts`.
 */
import type {
  ActivityEvent,
  ActivityEventType,
  Automation,
  AutomationStatus,
  BrowserState,
  ChatMessage,
  ChatSession,
  ComputerUseState,
  ConnectionStatus,
  FileEntry,
  ID,
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

export interface ListOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateSessionInput {
  title?: string;
  modelId?: ID;
  projectId?: ID;
}

export interface SendMessageInput {
  sessionId: ID;
  content: string;
  attachments?: { name: string; size: number; mime: string; content?: string }[];
}

export type ChatEvent =
  | { type: "session-start"; sessionId: ID }
  | { type: "message-start"; messageId: ID }
  | { type: "message-delta"; messageId: ID; delta: string }
  | { type: "tool-call"; messageId: ID; tool: { id: ID; name: string; status: "running" | "success" | "error"; summary: string } }
  | { type: "message-end"; messageId: ID; message: ChatMessage }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ChatService {
  listSessions(options?: ListOptions): Promise<ChatSession[]>;
  getSession(id: ID): Promise<ChatSession>;
  createSession(input?: CreateSessionInput): Promise<ChatSession>;
  renameSession(id: ID, title: string): Promise<ChatSession>;
  deleteSession(id: ID): Promise<void>;
  setPinned(id: ID, pinned: boolean): Promise<ChatSession>;
  setArchived(id: ID, archived: boolean): Promise<ChatSession>;
  sendMessage(input: SendMessageInput): AsyncIterable<ChatEvent>;
  stopGeneration(sessionId: ID): Promise<void>;
  regenerate(messageId: ID, sessionId: ID): AsyncIterable<ChatEvent>;
}

export interface ModelService {
  listModels(): Promise<ModelInfo[]>;
  getModel(id: ID): Promise<ModelInfo>;
  getActiveModel(): Promise<ModelInfo>;
  setActiveModel(modelId: ID): Promise<void>;
  setFavorite(modelId: ID, favorite: boolean): Promise<void>;
  setFallbackChain(modelIds: ID[]): Promise<void>;
  getFallbackChain(): Promise<ModelInfo[]>;
}

export interface ProviderService {
  listProviders(): Promise<ProviderInfo[]>;
  getProvider(id: ID): Promise<ProviderInfo>;
  /** Credentials are never persisted by the UI adapters — the Hermes adapter proxies them. */
  saveCredential(providerId: ID, apiKey: string): Promise<void>;
  disconnect(providerId: ID): Promise<void>;
}

export interface McpService {
  listServers(): Promise<McpServer[]>;
  addServer(input: Omit<McpServer, "id" | "status" | "tools" | "toolsCount">): Promise<McpServer>;
  updateServer(id: ID, patch: Partial<McpServer>): Promise<McpServer>;
  removeServer(id: ID): Promise<void>;
  setEnabled(id: ID, enabled: boolean): Promise<McpServer>;
  testConnection(id: ID): Promise<{ ok: boolean; latencyMs: number; message: string }>;
}

export interface SkillService {
  listSkills(): Promise<SkillInfo[]>;
  getSkill(id: ID): Promise<SkillInfo>;
  setEnabled(id: ID, enabled: boolean): Promise<SkillInfo>;
  install(id: ID): Promise<SkillInfo>;
  remove(id: ID): Promise<void>;
  setFavorite(id: ID, favorite: boolean): Promise<SkillInfo>;
}

export interface ToolService {
  listTools(): Promise<ToolInfo[]>;
  setEnabled(id: ID, enabled: boolean): Promise<ToolInfo>;
  updateOptions(id: ID, options: ToolInfo["options"]): Promise<ToolInfo>;
}

export interface ProjectService {
  listProjects(): Promise<Project[]>;
  getProject(id: ID): Promise<Project>;
  createProject(input: Omit<Project, "id" | "createdAt" | "updatedAt" | "conversationIds">): Promise<Project>;
  updateProject(id: ID, patch: Partial<Project>): Promise<Project>;
  deleteProject(id: ID): Promise<void>;
  listProjectFiles(id: ID): Promise<FileEntry[]>;
}

export interface FileService {
  list(path: string, projectId?: ID): Promise<FileEntry[]>;
  read(path: string): Promise<FileEntry>;
  search(query: string): Promise<FileEntry[]>;
}

export interface MemoryService {
  listItems(): Promise<MemoryItem[]>;
  getItem(id: ID): Promise<MemoryItem>;
  upsertItem(item: Partial<MemoryItem> & { id?: ID }): Promise<MemoryItem>;
  deleteItem(id: ID): Promise<void>;
}

export interface AutomationService {
  listAutomations(): Promise<Automation[]>;
  createAutomation(input: Omit<Automation, "id" | "logs" | "runCount" | "failureCount">): Promise<Automation>;
  updateAutomation(id: ID, patch: Partial<Automation>): Promise<Automation>;
  deleteAutomation(id: ID): Promise<void>;
  setEnabled(id: ID, enabled: boolean): Promise<Automation>;
  runNow(id: ID): Promise<AutomationRunResult>;
  listRuns(id: ID): Promise<Automation["logs"]>;
}

export interface AutomationRunResult {
  runId: ID;
  status: AutomationStatus;
  durationMs: number;
  output: string;
}

export interface IntegrationService {
  listIntegrations(): Promise<Integration[]>;
  connect(id: ID): Promise<Integration>;
  disconnect(id: ID): Promise<Integration>;
  saveSettings(id: ID, settings: Integration["settings"]): Promise<Integration>;
}

export interface ActivityService {
  listEvents(options?: ListOptions & { type?: ActivityEventType | "all"; status?: string | "all" }): Promise<ActivityEvent[]>;
  exportEvents(): Promise<string>;
}

export interface AnalyticsService {
  getUsageSummary(): Promise<UsageSummary>;
}

export interface BrowserService {
  getState(): Promise<BrowserState>;
  launch(): Promise<BrowserState>;
  close(): Promise<BrowserState>;
  clearSession(): Promise<BrowserState>;
}

export interface ComputerUseService {
  getState(): Promise<ComputerUseState>;
  startSession(): Promise<ComputerUseState>;
  stopSession(): Promise<ComputerUseState>;
  emergencyStop(): Promise<ComputerUseState>;
  setPermission(id: string, granted: boolean): Promise<ComputerUseState>;
}

export interface SystemService {
  getConnectionStatus(): Promise<ConnectionStatus>;
  getCapabilities(): Promise<Record<string, boolean>>;
  getVersion(): Promise<{ app: string; build: string; hermes?: string }>;
}

/** Aggregated service registry injected through React context. */
export interface Services {
  chat: ChatService;
  model: ModelService;
  provider: ProviderService;
  mcp: McpService;
  skill: SkillService;
  tool: ToolService;
  project: ProjectService;
  file: FileService;
  memory: MemoryService;
  automation: AutomationService;
  integration: IntegrationService;
  activity: ActivityService;
  analytics: AnalyticsService;
  browser: BrowserService;
  computerUse: ComputerUseService;
  system: SystemService;
}
