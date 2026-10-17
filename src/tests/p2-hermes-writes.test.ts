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
    new Response(JSON.stringify(body), {
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

  it("propagates Hermes API failures instead of reporting a successful write", async () => {
    intercept(403, { message: "Operation denied" });
    await expect(createHermesServices().skill.remove("test-skill")).rejects.toMatchObject({
      code: "unauthorized",
      message: "Operation denied",
    });
  });
});
