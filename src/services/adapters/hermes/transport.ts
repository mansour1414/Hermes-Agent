/**
 * HTTP transport for the Hermes adapter.
 *
 * All calls are relative (`/hermes/...`) so they go to the local Snowhare
 * proxy (127.0.0.1:9200), which injects the dashboard session token
 * server-side. The browser never sees a token or an API key.
 */
import { HermesServiceError, type HermesErrorCode } from "@/services/errors";

export const TRANSPORT_BASE = "/hermes";

function codeForStatus(status: number): HermesErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unknown";
  return "unknown";
}

function messageFor(status: number): string {
  if (status === 401 || status === 403)
    return "Hermes rejected the local session. Restart the Snowhare proxy to obtain a fresh one.";
  if (status === 404) return "العنوان المطلوب غير موجود في Hermes.";
  if (status === 429) return "تم تجاوز حد الطلبات المؤقت لدى Hermes.";
  if (status >= 500) return "Hermes devnet returned an internal error.";
  return `Hermes API request failed (${status}).`;
}

/** Query-string builder that drops empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

/** JSON request against the local proxy's API passthrough. */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${TRANSPORT_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    throw new HermesServiceError(
      "offline",
      "تعذّر الوصول إلى Snowhare Control Center المحلي. تأكد أن المشغّل يعمل على 127.0.0.1:9200.",
      { details: error },
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      /* ignore */
    }
    let serverMessage = "";
    try {
      const parsed = JSON.parse(detail) as { message?: string; error?: string; detail?: string };
      serverMessage = parsed.message || parsed.error || parsed.detail || "";
    } catch {
      /* ignore */
    }
    throw new HermesServiceError(
      codeForStatus(response.status),
      serverMessage || messageFor(response.status),
      { status: response.status, details: detail || undefined },
    );
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new HermesServiceError("unknown", "Hermes API returned a malformed JSON response.", {
      details: error,
    });
  }
}

/** Convenience: JSON GET. */
export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" });
}

/** Convenience: JSON POST/PUT/DELETE with an optional body. */
export function apiMutate<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  return apiRequest<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/* -------------------------------------------------------------------------- */
/*  Single-flight GET cache                                                    */
/* -------------------------------------------------------------------------- */
/**
 * Deduplicates concurrent GETs and memoises successful responses for `ttlMs`.
 *
 *  • In-flight requests are always shared, so several components mounting at
 *    the same moment produce ONE upstream request (no duplicate/race).
 *  • Only successful responses are cached. Failures are evicted immediately so
 *    an error can never be served as if it were a fresh result.
 *  • Memory only — nothing is written to localStorage/sessionStorage, so no
 *    payload can leak between sessions.
 *  • Any code path that mutates the underlying state MUST call `invalidateGet`
 *    so the UI cannot show stale data after a change.
 */
interface GetCacheEntry {
  /** null while the request is still in flight. */
  settledAt: number | null;
  promise: Promise<unknown>;
}

const getCacheStore = new Map<string, GetCacheEntry>();

/** Drops every cached GET whose path starts with `prefix`. */
export function invalidateGet(prefix: string): void {
  for (const key of [...getCacheStore.keys()]) {
    if (key.startsWith(prefix)) getCacheStore.delete(key);
  }
}

export function cachedGet<T>(path: string, ttlMs: number): Promise<T> {
  const entry = getCacheStore.get(path);
  if (entry && (entry.settledAt === null || Date.now() - entry.settledAt < ttlMs)) {
    return entry.promise as Promise<T>;
  }

  const promise = apiGet<T>(path).then(
    (value) => {
      const current = getCacheStore.get(path);
      if (current && current.promise === promise) current.settledAt = Date.now();
      return value;
    },
    (error) => {
      const current = getCacheStore.get(path);
      if (current && current.promise === promise) getCacheStore.delete(path);
      throw error;
    },
  );

  getCacheStore.set(path, { settledAt: null, promise });
  return promise;
}

/* -------------------------------------------------------------------------- */
/*  Chat bridge (Server-Sent Events)                                           */
/* -------------------------------------------------------------------------- */

export interface BridgeEvent {
  kind: "session" | "message-start" | "delta" | "tool" | "result" | "error" | "done";
  messageId?: string;
  sessionId?: string;
  realSessionId?: string;
  model?: string;
  text?: string;
  token?: { id: string; name: string; status: string; summary: string; output?: string; durationMs?: number };
  tokens?: { input: number; output: number; total: number } | null;
  durationMs?: number;
  exitCode?: number;
  message?: string;
}

export interface ChatBridgeInput {
  sessionId: string;
  content: string;
  attachments?: { name: string; size: number; mime: string; content?: string }[];
  model?: string;
  provider?: string;
  reasoning?: string;
}

/** Streams normalized bridge events from the local proxy. */
export async function* streamChat(input: ChatBridgeInput, signal?: AbortSignal): AsyncGenerator<BridgeEvent> {
  let response: Response;
  try {
    response = await fetch(`${TRANSPORT_BASE}/bridge/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) return;
    throw new HermesServiceError(
      "offline",
      "تعذّر فتح قناة المحادثة مع Hermes. تأكد أن المشغّل المحلي يعمل.",
      { details: error },
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      /* ignore */
    }
    throw new HermesServiceError(codeForStatus(response.status), messageFor(response.status), {
      status: response.status,
      details: detail || undefined,
    });
  }

  if (!response.body) {
    throw new HermesServiceError("unknown", "القناة المستدمعة من Hermes لا تحتوي على بيانات.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let index: number;
      while ((index = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6)) as BridgeEvent;
            yield parsed;
          } catch {
            /* skip malformed frame */
          }
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) return;
    throw new HermesServiceError("unknown", "انقطع بث المحادثة من Hermes.", { details: error });
  }
}

/** Stops a running bridge stream for the given (possibly local) session id. */
export async function abortChat(sessionId: string): Promise<void> {
  try {
    await fetch(`${TRANSPORT_BASE}/bridge/abort`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    /* the UI aborts its own reader regardless */
  }
}

/* -------------------------------------------------------------------------- */
/*  Health                                                                     */
/* -------------------------------------------------------------------------- */

export interface BridgeHealth {
  ok: boolean;
  proxy: { host: string; port: number; version: string };
  upstream?: { ok?: boolean; version?: string; displayVersion?: string; auth_required?: boolean; error?: string };
  hermesHome: string;
  workspace: string;
  tokenAvailable: boolean;
  runningChats: number;
  knownLocalSessions: number;
  yolo: boolean;
}

export function bridgeHealth(): Promise<BridgeHealth> {
  return apiGet<BridgeHealth>("/bridge/health");
}
