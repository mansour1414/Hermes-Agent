import { afterEach, describe, expect, it, vi } from "vitest";
import { createHermesServices } from "@/services/adapters/hermes";

/**
 * Phase 2 write-contract checks. Every fetch is intercepted inside jsdom:
 * these tests NEVER start a proxy or contact the installed Hermes instance.
 * No real API keys, MCP servers or skills are modified.
 */
afterEach(() => vi.unstubAllGlobals());

function intercept(status = 200, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(status === 204 || status === 205 || status === 304 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("P2 Hermes write operations — isolated HTTP contracts", () => {
  it("submits a provider credential to the credential pool, not browser storage", async () => {
    const fetchMock = intercept();
    await createHermesServices().provider.saveCredential("openrouter", "test-placeholder-key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/hermes/api/credentials/pool");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      provider: "openrouter",
      api_key: "test-placeholder-key",
    });
  });

  it("rejects invalid empty provider credentials without making a request", async () => {
    const fetchMock = intercept();
    await expect(createHermesServices().provider.saveCredential("openrouter", " ")).rejects.toMatchObject({
      code: "validation",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("issues a skill uninstall request with the correct name", async () => {
    const fetchMock = intercept();
    await createHermesServices().skill.remove("test-skill");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/hermes/api/skills/hub/uninstall");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ name: "test-skill" });
  });

  it("issues MCP deletion against the encoded server path", async () => {
    const fetchMock = intercept(204, undefined);
    await createHermesServices().mcp.removeServer("test/server");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/hermes/api/mcp/servers/test%2Fserver");
    expect(init.method).toBe("DELETE");
  });


  it("installs a skill, then verifies it appears in the refreshed skill list", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.endsWith("/api/skills/hub/install")) {
        expect(JSON.parse(String(init?.body))).toEqual({ identifier: "safe-test-skill" });
        return new Response("{}", { status: 200 });
      }
      if (url.endsWith("/api/skills"))
        return new Response(JSON.stringify([{ name: "safe-test-skill", enabled: true, provenance: "hub" }]), { status: 200 });
      throw new Error("Unexpected request: " + url);
    }));
    const installed = await createHermesServices().skill.install("safe-test-skill");
    expect(installed.id).toBe("safe-test-skill");
    expect(installed.enabled).toBe(true);
    expect(calls).toEqual([
      "POST /hermes/api/skills/hub/install",
      "GET /hermes/api/skills",
    ]);
  });

  it("rejects failed skill installation without reporting success", async () => {
    intercept(500, { message: "Installation rejected" });
    await expect(createHermesServices().skill.install("safe-test-skill")).rejects.toMatchObject({
      message: "Installation rejected",
    });
  });

  it("toggles MCP enabled state and verifies the server returned by Hermes", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/enabled")) return new Response("{}", { status: 200 });
      if (url.endsWith("/api/mcp/servers")) {
        return new Response(JSON.stringify({ servers: [{ name: "isolated-mcp", enabled: true, transport: "stdio" }] }), { status: 200 });
      }
      throw new Error("Unexpected request: " + url);
    });
    vi.stubGlobal("fetch", fetchMock);
    const updated = await createHermesServices().mcp.setEnabled("isolated-mcp", true);
    expect(updated.enabled).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("/hermes/api/mcp/servers/isolated-mcp/enabled");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ enabled: true });
  });

  it("rejects MCP toggles when the refreshed server does not exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) =>
      url.endsWith("/enabled")
        ? new Response("{}", { status: 200 })
        : new Response(JSON.stringify({ servers: [] }), { status: 200 })
    ));
    await expect(createHermesServices().mcp.setEnabled("missing-server", true)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("changes active model using the configured provider slug", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/model/options")) return new Response(JSON.stringify({
        providers: [{ slug: "test-provider", name: "Test Provider", models: ["safe-test-model"], authenticated: true }],
      }), { status: 200 });
      if (url.includes("/api/model/info")) return new Response(JSON.stringify({
        provider: "test-provider", model: "safe-test-model",
      }), { status: 200 });
      if (url.includes("/catalog/openrouter")) return new Response(JSON.stringify({ ok: true, models: [] }), { status: 200 });
      if (url.endsWith("/api/model/set")) return new Response("{}", { status: 200 });
      throw new Error("Unexpected request: " + url);
    });
    vi.stubGlobal("fetch", fetchMock);
    await createHermesServices().model.setActiveModel("safe-test-model");
    const call = fetchMock.mock.calls.find((args) => String(args[0]).endsWith("/api/model/set"));
    expect(call).toBeDefined();
    expect(call![1].method).toBe("POST");
    expect(JSON.parse(String(call![1].body))).toEqual({
      scope: "main", provider: "test-provider", model: "safe-test-model",
    });
  });

  it("propagates Hermes API failures instead of reporting a successful write", async () => {
    intercept(403, { message: "Operation denied" });
    await expect(createHermesServices().skill.remove("test-skill")).rejects.toMatchObject({
      code: "unauthorized",
      message: "Operation denied",
    });
  });
});
