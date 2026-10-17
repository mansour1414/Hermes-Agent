/**
 * Domain model for Hermes Control Center.
 * All types are transport-agnostic: they are shared by the Mock adapters and the
 * future Hermes backend adapters, so no UI component ever depends on a data source.
 */

export type ID = string;

export type ConnectionState = "connected" | "connecting" | "disconnected" | "error" | "demo";

export interface ConnectionStatus {
  state: ConnectionState;
  message: string;
  lastCheckedAt: string;
  latencyMs?: number;
  version?: string;
}

export type CapabilityLevel = "full" | "partial" | "read-only" | "unsupported";

export interface Capability {
  id: string;
  level: CapabilityLevel;
  note?: string;
}

export type ModelSource = "hermes" | "opencode" | "catalog";
export type PricingTier = "free" | "paid";
export type ModelStatus = "available" | "configured" | "authenticated" | "verified" | "deprecated";

export interface ModelCapabilities {
  reasoning: boolean;
  vision: boolean;
  toolCalling: boolean;
  streaming: boolean;
  jsonMode: boolean;
}

export interface ModelInfo {
  id: ID;
  modelId: string;
  name: string;
  providerId: ID;
  providerName: string;
  source: ModelSource;
  pricing: PricingTier;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: ModelCapabilities;
  /** The four independent readiness axes required by the product spec. */
  catalogAvailable: boolean;
  configured: boolean;
  authenticated: boolean;
  verified: boolean;
  status: ModelStatus;
  description: string;
  releaseDate: string;
  tags: string[];
  favorite: boolean;
  inFallbackChain: boolean;
  rateLimitPerMinute?: number;
}

export type ProviderStatus = "connected" | "not-configured" | "error" | "demo";

export interface ProviderInfo {
  id: ID;
  name: string;
  kind: string;
  status: ProviderStatus;
  authStatus: "none" | "pending" | "active" | "expired";
  configuredModels: number;
  totalModels: number;
  capabilities: string[];
  baseUrl: string;
  docsUrl: string;
  notes: string;
  lastUsedAt?: string;
}

export type McpTransport = "stdio" | "sse" | "http" | "websocket";
export type McpStatus = "connected" | "disconnected" | "error" | "starting" | "disabled";

export interface McpServer {
  id: ID;
  name: string;
  nameAr: string;
  transport: McpTransport;
  status: McpStatus;
  enabled: boolean;
  command?: string;
  args?: string[];
  url?: string;
  envVars: { key: string; value: string; secret: boolean }[];
  authType: "none" | "header" | "bearer" | "oauth";
  toolsCount: number;
  tools: string[];
  latencyMs?: number;
  lastCheckedAt?: string;
  description: string;
  scope: "local" | "remote";
}

export type SkillStatus = "installed" | "available" | "update-available" | "disabled";

export interface SkillInfo {
  id: ID;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  category: string;
  source: string;
  version?: string;
  status: SkillStatus;
  enabled: boolean;
  favorite: boolean;
  requiredTools: string[];
  usageCount: number;
  lastUsedAt?: string;
  author: string;
}

export type ToolCategory =
  | "terminal"
  | "files"
  | "browser"
  | "computer-use"
  | "code"
  | "search"
  | "memory"
  | "media"
  | "integrations";

export interface ToolInfo {
  id: ID;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  category: ToolCategory;
  enabled: boolean;
  status: "ready" | "limited" | "disabled" | "demo";
  permissions: string[];
  lastUsedAt?: string;
  usageCount: number;
  options: { id: string; label: string; type: "boolean" | "number" | "text"; value: string }[];
  requiresConfirmation: boolean;
}

export type ProjectIcon = "rocket" | "code" | "sparkles" | "database" | "book" | "flask" | "cube" | "bolt";

export interface Project {
  id: ID;
  name: string;
  nameAr: string;
  description: string;
  icon: ProjectIcon;
  color: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  preferredModelId?: ID;
  conversationIds: ID[];
  toolIds: ID[];
  skillIds: ID[];
  instructions: string;
  fileCount: number;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ToolCall {
  id: ID;
  name: string;
  status: "running" | "success" | "error";
  durationMs: number;
  summary: string;
  output?: string;
}

export interface Attachment {
  id: ID;
  name: string;
  kind: "image" | "text" | "pdf" | "code" | "archive";
  size: number;
  mime: string;
  previewUrl?: string;
  content?: string;
}

export interface ChatMessage {
  id: ID;
  role: MessageRole;
  content: string;
  createdAt: string;
  streaming?: boolean;
  modelId?: ID;
  durationMs?: number;
  tokens?: { prompt: number; completion: number; total: number };
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
  demo: boolean;
  error?: string;
}

export interface ChatSession {
  id: ID;
  title: string;
  projectId?: ID;
  modelId: ID;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  archived: boolean;
  messages: ChatMessage[];
  messageCount: number;
  totalTokens: number;
  demo: boolean;
}

export type ActivityEventType =
  | "chat-started"
  | "model-changed"
  | "tool-called"
  | "mcp-connected"
  | "skill-enabled"
  | "browser-session"
  | "automation-executed"
  | "error"
  | "project-created"
  | "provider-updated";

export type EventStatus = "success" | "warning" | "error" | "info";

export interface ActivityEvent {
  id: ID;
  type: ActivityEventType;
  title: string;
  description: string;
  timestamp: string;
  durationMs?: number;
  status: EventStatus;
  actor: "hermes" | "user" | "system";
  target?: string;
  demo: boolean;
}

export type AutomationScheduleType = "daily" | "weekly" | "monthly" | "cron";
export type AutomationStatus = "success" | "failed" | "running" | "pending";

export interface Automation {
  id: ID;
  name: string;
  nameAr: string;
  description: string;
  enabled: boolean;
  scheduleType: AutomationScheduleType;
  cron: string;
  time: string;
  days: string[];
  command: string;
  projectId?: ID;
  lastRunAt?: string;
  nextRunAt: string;
  lastStatus: AutomationStatus;
  runCount: number;
  failureCount: number;
  logs: AutomationRun[];
}

export interface AutomationRun {
  id: ID;
  startedAt: string;
  durationMs: number;
  status: AutomationStatus;
  output: string;
  error?: string;
}

export interface Integration {
  id: ID;
  name: string;
  nameAr: string;
  description: string;
  category: "messaging" | "git" | "email" | "storage" | "notes" | "webhooks";
  connected: boolean;
  requires: string[];
  settings: { id: string; label: string; type: "text" | "secret-ref" | "url" | "select"; value: string; options?: string[] }[];
  iconHint: string;
  supportedByHermes: boolean;
  lastSyncAt?: string;
}

export interface MemoryItem {
  id: ID;
  title: string;
  content: string;
  category: string;
  tags: string[];
  importance: "low" | "medium" | "high";
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  source: "manual" | "chat" | "automation";
}

export interface FileEntry {
  id: ID;
  name: string;
  path: string;
  type: "folder" | "file";
  extension: string;
  size: number;
  modifiedAt: string;
  projectId?: ID;
  content?: string;
  language?: string;
}

export interface BrowserSession {
  id: ID;
  profile: string;
  startedAt: string;
  pages: string[];
  persistent: boolean;
  state: "running" | "closed";
}

export interface BrowserState {
  installed: boolean;
  running: boolean;
  version: string;
  executablePath: string;
  profilePath: string;
  storageLocation: string;
  persistenceEnabled: boolean;
  sessions: BrowserSession[];
  engine: string;
  isolationNote: string;
}

export interface ComputerUseState {
  driverInstalled: boolean;
  sessionActive: boolean;
  screenCaptureAvailable: boolean;
  mouseControl: boolean;
  keyboardControl: boolean;
  permissions: { id: string; label: string; granted: boolean }[];
  lastActivityAt?: string;
  sessionStartedAt?: string;
  history: { id: ID; at: string; action: string; result: string }[];
  emergencyStopAvailable: boolean;
}

export interface UsagePoint {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  modelId: ID;
}

export interface UsageSummary {
  points: UsagePoint[];
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byModel: { modelId: ID; name: string; requests: number; tokens: number; cost: number }[];
  byTool: { toolId: ID; name: string; calls: number }[];
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  locale: "ar" | "en";
  accent: string;
  fontSize: "sm" | "md" | "lg";
  density: "comfortable" | "compact";
  sidebar: "expanded" | "collapsed";
  animations: boolean;
  notifications: { desktop: boolean; sound: boolean; digest: boolean };
  defaultModelId: ID;
  fallbackModelIds: ID[];
  telemetry: boolean;
  sessionStorage: "memory" | "local";
  sensitiveOpsConfirmation: boolean;
  hermesHome: string;
  apiEndpoint: string;
  developerMode: boolean;
  showDemoData: boolean;
}
