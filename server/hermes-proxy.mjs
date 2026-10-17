/**
 * Snowhare Control Center — local Hermes bridge.
 *
 * Zero dependencies (Node >= 18 built-ins only). Responsibilities:
 *
 *   1. Serve the built single-file SPA (dist/) on 127.0.0.1 only.
 *   2. Reverse-proxy `/hermes/api/*` -> `http://127.0.0.1:9119/api/*`, injecting
 *      the dashboard session token SERVER-SIDE. The token is never sent to, or
 *      readable by, the browser.
 *   3. Expose a real chat bridge (`/hermes/bridge/chat`) that runs the official
 *      headless streaming protocol:
 *          hermes chat -q <prompt> --format stream-json --pass-session-id
 *      and relays its JSONL events to the browser as Server-Sent Events.
 *   4. Keep an in-memory map from locally-minted session ids to the real Hermes
 *      session ids produced by the CLI, and rewrite ids in proxied paths so the
 *      UI can treat a brand-new conversation as if it already had a real id.
 *
 * Security posture: loopback bind only, no secrets in responses, no shell
 * interpolation (spawn with an argument array), no API keys handled here.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_DIR = path.resolve(__dirname, "..");

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const CONFIG = {
  host: "127.0.0.1", // never allow external listening for this privileged local bridge
  port: Number(env("SNOWHARE_PORT", "9200")),
  upstream: env("SNOWHARE_UPSTREAM", "http://127.0.0.1:9119").replace(/\/+$/, ""),
  hermesHome: env("HERMES_HOME", "D:\\hermes"),
  hermesBin: env("SNOWHARE_HERMES_BIN", "D:\\hermes\\bin\\hermes.exe"),
  workspace: env("SNOWHARE_WORKSPACE", ""),
  distDir: env("SNOWHARE_DIST", path.join(PROJECT_DIR, "dist")),
  // Tool approvals in non-interactive runs follow Hermes' own policy. Set
  // SNOWHARE_YOLO=1 only if you explicitly want to bypass them.
  yolo: env("SNOWHARE_YOLO", "") === "1",
  chatTimeoutMs: Number(env("SNOWHARE_CHAT_TIMEOUT_MS", String(15 * 60 * 1000))),
};

/* -------------------------------------------------------------------------- */
/*  Session id mapping (local -> real Hermes session)                          */
/* -------------------------------------------------------------------------- */

/** @type {Map<string, string>} */
const sessionMap = new Map();
// Draft chat ids look like `local_<base36>_<base36>` (see localSessionId() in the
// frontend adapter), so the character class must allow underscores — and no
// trailing \b, because `_` is a word character and the id ends in one.
const LOCAL_ID_RE = /(local|pending)_[A-Za-z0-9_-]{6,}/g;

function isLocalId(id) {
  return typeof id === "string" && /^(local|pending)_/.test(id);
}

function resolveId(id) {
  if (!isLocalId(id)) return id;
  return sessionMap.get(id) || null;
}

function rewriteLocalIds(text) {
  if (!text || sessionMap.size === 0) return text;
  return text.replace(LOCAL_ID_RE, (match) => sessionMap.get(match) || match);
}

/* -------------------------------------------------------------------------- */
/*  Token handling                                                             */
/* -------------------------------------------------------------------------- */

let tokenCache = { value: null, at: 0 };

async function fetchToken(force) {
  const now = Date.now();
  if (!force && tokenCache.value && now - tokenCache.at < 60_000) return tokenCache.value;
  const res = await fetch(`${CONFIG.upstream}/`, { redirect: "follow" });
  const html = await res.text();
  const match = html.match(/__HERMES_SESSION_TOKEN__\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("Could not locate the dashboard session token in the upstream page.");
  tokenCache = { value: match[1], at: now };
  return tokenCache.value;
}

/* -------------------------------------------------------------------------- */
/*  Small HTTP helpers                                                         */
/* -------------------------------------------------------------------------- */

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req, limit = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/* -------------------------------------------------------------------------- */
/*  API passthrough                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Short-lived cache for read-only Hermes endpoints that are slow to compute.
 *
 * Hermes evaluates some READ endpoints lazily and can take ~20s (for example
 * `/api/messaging/platforms` probes per-platform gateway/env state). The data is
 * configuration metadata that changes rarely, so a brief server-side cache plus
 * in-flight de-duplication keeps the UI responsive without faking anything —
 * a cache miss always returns whatever Hermes just said.
 */
const GET_CACHE_TTL = new Map([["/api/messaging/platforms", 5 * 60 * 1000]]);
/** @type {Map<string, { at: number, status: number, contentType: string, body: Buffer }>} */
const getCache = new Map();
/** @type {Map<string, Promise<{ at: number, status: number, contentType: string, body: Buffer }>>} */
const inflightGet = new Map();

async function proxyApi(req, res, incomingUrl) {
  const upstreamPath = rewriteLocalIds(incomingUrl.pathname.replace(/^\/hermes/, ""));
  const target = `${CONFIG.upstream}${upstreamPath}${incomingUrl.search}`;

  const method = req.method || "GET";
  const headers = {};
  // Forward only content-type / accept; everything else is regenerated.
  if (req.headers["content-type"]) headers["Content-Type"] = req.headers["content-type"];
  if (req.headers["accept"]) headers["Accept"] = req.headers["accept"];

  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await readBody(req) : undefined;

  // A fresh chat exists only locally until its first message is sent through the
  // bridge. Hermes has no transcript for it yet, so answer with an empty one
  // instead of returning a 404 the UI would have to swallow (and log).
  const localDraft = /^\/api\/sessions\/((?:local|pending)_[A-Za-z0-9_-]+)\/messages$/.exec(upstreamPath);
  if (localDraft && method === "GET") {
    const draftId = decodeURIComponent(localDraft[1]);
    if (!sessionMap.has(draftId)) {
      sendJson(res, 200, { session_id: draftId, messages: [], model: null, started_at: null, ended_at: null });
      return;
    }
  }

  async function attempt(force) {
    const token = await fetchToken(force);
    return fetch(target, {
      method,
      headers: { ...headers, "X-Hermes-Session-Token": token },
      body,
      redirect: "manual",
    });
  }

  const cacheKey = `${upstreamPath}${incomingUrl.search}`;
  const ttl = method === "GET" ? GET_CACHE_TTL.get(upstreamPath) : undefined;

  if (ttl) {
    const hit = getCache.get(cacheKey);
    if (hit && Date.now() - hit.at < ttl) {
      res.writeHead(hit.status, {
        "Content-Type": hit.contentType,
        "Cache-Control": "no-store",
        "X-Snowhare-Cache": "hit",
      });
      res.end(hit.body);
      return;
    }

    let entry;
    let cacheStatus = "miss";
    try {
      const warm = getCache.get(cacheKey);
      if (warm) {
        entry = warm;
        cacheStatus = "hit";
      } else {
        let pending = inflightGet.get(cacheKey);
        if (!pending) {
          pending = (async () => {
            let fresh = await attempt(false);
            if (fresh.status === 401 || fresh.status === 403) fresh = await attempt(true);
            const contentType = fresh.headers.get("content-type") || "application/json";
            const buffer = Buffer.from(await fresh.arrayBuffer());
            const stored = { at: Date.now(), status: fresh.status, contentType, body: buffer };
            // Only cache successful reads; never memoise an error.
            if (fresh.status < 400) getCache.set(cacheKey, stored);
            return stored;
          })();
          inflightGet.set(cacheKey, pending);
          pending.catch(() => {}).finally(() => inflightGet.delete(cacheKey));
        }
        entry = await pending;
      }
    } catch (error) {
      sendJson(res, 502, {
        error: "upstream_unreachable",
        message:
          `Cannot reach the Hermes dashboard at ${CONFIG.upstream}. ` +
          "Start it with `hermes dashboard --skip-build --no-open --host 127.0.0.1 --port 9119`.",
        detail: String(error),
      });
      return;
    }

    res.writeHead(entry.status, {
      "Content-Type": entry.contentType,
      "Cache-Control": "no-store",
      "X-Snowhare-Cache": cacheStatus,
    });
    res.end(entry.body);
    return;
  }

  let upstream;
  try {
    upstream = await attempt(false);
    if (upstream.status === 401 || upstream.status === 403) {
      upstream = await attempt(true);
    }
  } catch (error) {
    sendJson(res, 502, {
      error: "upstream_unreachable",
      message:
        `Cannot reach the Hermes dashboard at ${CONFIG.upstream}. ` +
        "Start it with `hermes dashboard --skip-build --no-open --host 127.0.0.1 --port 9119`.",
      detail: String(error),
    });
    return;
  }

  const outHeaders = {};
  const contentType = upstream.headers.get("content-type");
  if (contentType) outHeaders["Content-Type"] = contentType;
  outHeaders["Cache-Control"] = "no-store";
  res.writeHead(upstream.status, outHeaders);

  if (!upstream.body) {
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch {
    /* client went away */
  }
  res.end();
}

/* -------------------------------------------------------------------------- */
/*  Chat bridge                                                                */
/* -------------------------------------------------------------------------- */

/** @type {Map<string, import('node:child_process').ChildProcess>} */
const running = new Map();

function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function prepareAttachments(attachments) {
  const images = [];
  const textParts = [];
  if (!Array.isArray(attachments)) return { images, textParts };
  if (attachments.length > 4) throw new Error('Too many attachments (maximum 4).');
  let totalDecoded = 0;
  for (const item of attachments) {
    if (!item || typeof item !== "object") continue;
    const mime = String(item.mime || "");
    const content = typeof item.content === "string" ? item.content : "";
    if (!content) continue;
    if (mime.startsWith('image/')) {
      const formats = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
      const ext = formats[mime];
      if (!ext || !content.startsWith(`data:${mime};base64,`)) throw new Error('Unsupported image type or encoding.');
      const base64 = content.slice(content.indexOf(',') + 1);
      if (!/^[a-zA-Z0-9+/]*={0,2}$/.test(base64)) throw new Error('Invalid image payload.');
      const decodedSize = Buffer.byteLength(base64, 'base64');
      if (decodedSize > 5 * 1024 * 1024) throw new Error('Image exceeds 5 MiB.');
      totalDecoded += decodedSize;
      if (totalDecoded > 10 * 1024 * 1024) throw new Error('Attachments exceed 10 MiB.');
      const file = path.join(os.tmpdir(), `snowhare-${crypto.randomUUID()}.${ext}`);
      await fs.promises.writeFile(file, Buffer.from(base64, 'base64'), { flag: 'wx', mode: 0o600 });
      images.push(file);
    } else if (mime.startsWith('text/') || mime === 'application/json') {
      if (Buffer.byteLength(content, 'utf8') > 256 * 1024) throw new Error('Text attachment exceeds 256 KiB.');
      totalDecoded += Buffer.byteLength(content, 'utf8');
      if (totalDecoded > 10 * 1024 * 1024) throw new Error('Attachments exceed 10 MiB.');
      textParts.push(`\n\n--- attached file: ${String(item.name || 'attachment').slice(0, 120)} ---\n${content}`);
    } else {
      throw new Error('Unsupported attachment MIME type.');
    }
  }
  return { images, textParts };
}

async function bridgeChat(req, res) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  } catch {
    sendJson(res, 400, { error: "bad_request", message: "Invalid JSON body." });
    return;
  }

  const requested = String(payload.sessionId || "");
  const content = String(payload.content || "");
  if (!content.trim()) {
    sendJson(res, 400, { error: "bad_request", message: "content is required." });
    return;
  }

  const resumeId = resolveId(requested) || (isLocalId(requested) ? null : requested || null);

  let images, textParts;
  try {
    ({ images, textParts } = await prepareAttachments(payload.attachments));
  } catch {
    sendJson(res, 400, { error: 'invalid_attachments', message: 'Attachments rejected: check type, size, and count.' });
    return;
  }
  const prompt = content + textParts.join('');

  const args = ["chat", "-q", prompt, "--format", "stream-json", "--pass-session-id"];
  if (resumeId) args.push("--resume", resumeId);
  if (payload.model) args.push("-m", String(payload.model));
  if (payload.provider) args.push("--provider", String(payload.provider));
  if (payload.reasoning) args.push("--reasoning", String(payload.reasoning));
  for (const image of images) args.push("--image", image);
  if (CONFIG.yolo) args.push("--yolo");

  const cwd = CONFIG.workspace || CONFIG.hermesHome;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let child;
  try {
    child = spawn(CONFIG.hermesBin, args, {
      cwd,
      env: { ...process.env, HERMES_HOME: CONFIG.hermesHome, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
      shell: false,
    });
  } catch (error) {
    sseWrite(res, { kind: "error", message: "Failed to start Hermes process." });
    sseWrite(res, { kind: "done" });
    res.end();
    return;
  }

  running.set(requested, child);

  let buffer = "";
  let stderrTail = "";
  let assistantId = `msg_${crypto.randomUUID().slice(0, 8)}`;
  let sawText = false;
  let pendingResult = null;
  const toolIndex = new Map();
  let toolSeq = 0;
  let closed = false;

  const timer = setTimeout(() => {
    sseWrite(res, { kind: "error", message: "Timed out waiting for Hermes." });
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }, CONFIG.chatTimeoutMs);

  function handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (event.type === "system" && event.subtype === "init") {
      const realId = String(event.session_id || "");
      if (realId && isLocalId(requested) && !sessionMap.has(requested)) {
        sessionMap.set(requested, realId);
      }
      sseWrite(res, {
        kind: "session",
        sessionId: requested || realId,
        realSessionId: realId,
        model: event.model || null,
        messageId: assistantId,
      });
      return;
    }

    if (event.type === "text" && typeof event.text === "string" && event.text.length > 0) {
      if (!sawText) {
        sawText = true;
        sseWrite(res, { kind: "message-start", messageId: assistantId });
      }
      sseWrite(res, { kind: "delta", messageId: assistantId, text: event.text });
      return;
    }

    if (event.type === "tool_use") {
      const callId = String(event.tool_call_id || event.id || `${event.name}_${toolSeq++}`);
      toolIndex.set(callId, event.name);
      sseWrite(res, {
        kind: "tool",
        messageId: assistantId,
        tool: {
          id: callId,
          name: String(event.name || "tool"),
          status: "running",
          summary: summarizeInput(event.input),
          output: "",
          durationMs: 0,
        },
      });
      return;
    }

    if (event.type === "tool_result") {
      const callId = String(event.tool_call_id || event.id || `${event.name}_${toolSeq}`);
      const output = cap(String(event.output ?? event.result ?? ""), 5000);
      sseWrite(res, {
        kind: "tool",
        messageId: assistantId,
        tool: {
          id: callId,
          name: String(event.name || toolIndex.get(callId) || "tool"),
          status: event.is_error ? "error" : "success",
          summary: event.is_error ? "tool reported an error" : "completed",
          output,
          durationMs: Number(event.duration_ms || 0),
        },
      });
      return;
    }

    if (event.type === "result") {
      // Defer until the process exits so persisted messages are readable.
      pendingResult = event;
      return;
    }
  }

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      handleLine(line);
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrTail = cap(stderrTail + chunk, 4000);
  });

  function finish() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    running.delete(requested);

    if (buffer.trim()) handleLine(buffer);

    const result = pendingResult;
    if (result) {
      const realId = String(result.session_id || resolveId(requested) || "");
      if (realId && isLocalId(requested) && !sessionMap.has(requested)) {
        sessionMap.set(requested, realId);
      }
      const exitCode = Number(result.exit_code ?? 0);
      if (result.error || exitCode !== 0) {
        sseWrite(res, {
          kind: "error",
          message: `Hermes failed (exit ${exitCode}). Check local server logs.`,
        });
      }
      sseWrite(res, {
        kind: "result",
        messageId: assistantId,
        sessionId: requested || realId,
        realSessionId: realId,
        text: typeof result.text === "string" ? result.text : "",
        tokens: result.tokens || null,
        durationMs: Number(result.duration_ms || 0),
        exitCode,
      });
    } else {
      sseWrite(res, {
        kind: "error",
        message: "Hermes produced no result. Check local server logs.",
      });
    }

    sseWrite(res, { kind: "done" });
    res.end();

    for (const image of images) {
      fs.promises.unlink(image).catch(() => {});
    }
  }

  child.on("error", (error) => {
    stderrTail = cap(`${stderrTail}\n${String(error)}`, 4000);
    finish();
  });
  child.on("close", finish);

  req.on("close", () => {
    // Client navigated away: stop the run so we don't leak a process.
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  });
}

function bridgeAbort(req, res) {
  void (async () => {
    let payload = {};
    try {
      payload = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    } catch {
      /* ignore */
    }
    const id = String(payload.sessionId || "");
    const child = running.get(id);
    if (child) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      running.delete(id);
      sendJson(res, 200, { ok: true, stopped: true });
      return;
    }
    // Never stop unrelated sessions on an unknown id.
    sendJson(res, 404, { ok: false, error: "session_not_running", stopped: false });
  })();
}

/* -------------------------------------------------------------------------- */
/*  OpenRouter public catalog (metadata only — no keys, no paid calls)         */
/* -------------------------------------------------------------------------- */

let catalogCache = { value: null, at: 0 };

async function openRouterCatalog(res) {
  const now = Date.now();
  if (catalogCache.value && now - catalogCache.at < 6 * 60 * 60 * 1000) {
    sendJson(res, 200, { ok: true, cached: true, models: catalogCache.value });
    return;
  }
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) throw new Error(`catalog HTTP ${upstream.status}`);
    const json = await upstream.json();
    const models = Array.isArray(json.data) ? json.data : [];
    catalogCache = { value: models, at: now };
    sendJson(res, 200, { ok: true, cached: false, models });
  } catch (error) {
    sendJson(res, 200, {
      ok: false,
      message: "OpenRouter public catalog is unreachable; pricing/capability enrichment is unavailable.",
      detail: String(error),
      models: [],
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  Health                                                                     */
/* -------------------------------------------------------------------------- */

async function bridgeHealth(res) {
  let upstream = null;
  let ok = false;
  let tokenOk = false;
  try {
    const r = await fetch(`${CONFIG.upstream}/api/health`, { redirect: "manual" });
    upstream = await r.json();
    ok = Boolean(upstream && upstream.ok);
    await fetchToken(false);
    tokenOk = true;
  } catch (error) {
    upstream = { error: String(error) };
  }
  sendJson(res, 200, {
    ok: ok && tokenOk,
    proxy: { host: CONFIG.host, port: CONFIG.port, version: "1.0.0" },
    upstream,
    hermesHome: "[local]",
    workspace: "[local]",
    tokenAvailable: tokenOk,
    runningChats: running.size,
    knownLocalSessions: sessionMap.size,
    yolo: CONFIG.yolo,
  });
}

/* -------------------------------------------------------------------------- */
/*  Static files                                                               */
/* -------------------------------------------------------------------------- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function serveStatic(req, res, incomingUrl) {
  const distDir = path.resolve(CONFIG.distDir);
  let rel;
  try { rel = decodeURIComponent(incomingUrl.pathname); }
  catch { return sendJson(res, 400, { error: 'bad_path' }); }
  if (rel === "/" || rel === "") rel = "/index.html";

  let filePath = path.resolve(path.join(distDir, rel));
  // Path-traversal guard: never serve outside dist/.
  if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback (hash routing makes this mostly unnecessary, but be safe).
    filePath = path.join(distDir, "index.html");
    if (!fs.existsSync(filePath)) {
      res.writeHead(503, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<!doctype html><meta charset=utf-8><h1>Snowhare Control Center</h1>" +
          "<p>The UI bundle (<code>dist/</code>) is missing. Run <code>npm run build</code> " +
          "inside <code>D:\\hermes\\custom-dashboard\\snowhare-control-center</code>.</p>",
      );
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600",
  });
  fs.createReadStream(filePath).pipe(res);
}

/* -------------------------------------------------------------------------- */
/*  Server                                                                     */
/* -------------------------------------------------------------------------- */

const ALLOWED_HOSTS = new Set([
  `127.0.0.1:${CONFIG.port}`,
  `localhost:${CONFIG.port}`,
  '127.0.0.1:5180',
  'localhost:5180',
]);
const ALLOWED_ORIGINS = new Set([...ALLOWED_HOSTS].map((host) => `http://${host}`));

function requestPermitted(req) {
  const host = String(req.headers.host || '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return false;
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return false;
  const fetchSite = req.headers['sec-fetch-site'];
  if (fetchSite === 'cross-site') return false;
  return true;
}

const server = http.createServer((req, res) => {
  if (!requestPermitted(req)) return sendJson(res, 403, { error: 'forbidden' });
  if (req.method === 'OPTIONS') return sendJson(res, 403, { error: 'forbidden' });
  let incomingUrl;
  try { incomingUrl = new URL(req.url || '/', `http://${CONFIG.host}:${CONFIG.port}`); }
  catch { return sendJson(res, 400, { error: 'bad_url' }); }
  const pathname = incomingUrl.pathname;

  if (pathname.startsWith("/hermes/bridge/")) {
    if (pathname === "/hermes/bridge/health") return void bridgeHealth(res);
    if (pathname === "/hermes/bridge/chat" && req.method === "POST") return void bridgeChat(req, res);
    if (pathname === "/hermes/bridge/abort" && req.method === "POST") return void bridgeAbort(req, res);
    return sendJson(res, 404, { error: "not_found" });
  }

  if (pathname === "/hermes/catalog/openrouter") return void openRouterCatalog(res);

  if (pathname.startsWith("/hermes/api/")) return void proxyApi(req, res, incomingUrl);

  return serveStatic(req, res, incomingUrl);
});

server.listen(CONFIG.port, CONFIG.host, () => {
  const url = `http://${CONFIG.host}:${CONFIG.port}`;
  console.log(`SNOWHARE_READY url=${url} upstream=${CONFIG.upstream} hermes_home=${CONFIG.hermesHome}`);
});

server.on("error", (error) => {
  console.error(`SNOWHARE_ERROR ${error && error.code ? error.code : ""} ${String(error)}`.trim());
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const [, child] of running) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500);
  });
}

function cap(text, max) {
  const value = String(text ?? "");
  return value.length > max ? `${value.slice(0, max)}… [truncated]` : value;
}

function summarizeInput(input) {
  if (input === undefined || input === null) return "";
  if (typeof input === "string") return cap(input, 200);
  try {
    return cap(JSON.stringify(input), 200);
  } catch {
    return "";
  }
}
