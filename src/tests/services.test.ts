import { describe, expect, it, beforeEach } from "vitest";
import { mockServices } from "@/services/adapters/mock";
import { demoStore } from "@/services/adapters/mock/store";
import { parseOpenCodeInventory } from "@/services/adapters/opencode/inventory";
import { createHermesServices } from "@/services/adapters/hermes";

beforeEach(() => {
  demoStore.reset();
});

describe("mock model service", () => {
  it("lists models with the four readiness axes", async () => {
    const models = await mockServices.model.listModels();
    expect(models.length).toBeGreaterThan(0);
    models.forEach((model) => {
      expect(typeof model.catalogAvailable).toBe("boolean");
      expect(typeof model.configured).toBe("boolean");
      expect(typeof model.authenticated).toBe("boolean");
      expect(typeof model.verified).toBe("boolean");
    });
  });

  it("changes the active model and reflects it in the store", async () => {
    const before = await mockServices.model.getActiveModel();
    const other = (await mockServices.model.listModels()).find((model) => model.id !== before.id)!;
    await mockServices.model.setActiveModel(other.id);
    const after = await mockServices.model.getActiveModel();
    expect(after.id).toBe(other.id);
  });

  it("keeps the fallback chain consistent", async () => {
    const models = await mockServices.model.listModels();
    const target = models[models.length - 1];
    await mockServices.model.setFallbackChain([target.id]);
    const chain = await mockServices.model.getFallbackChain();
    expect(chain.map((model) => model.id)).toEqual([target.id]);
  });
});

describe("mock chat service", () => {
  it("creates a session and streams a demo answer", async () => {
    const session = await mockServices.chat.createSession();
    expect(session.messages).toHaveLength(0);

    const events: string[] = [];
    let finalContent = "";
    for await (const event of mockServices.chat.sendMessage({
      sessionId: session.id,
      content: "مرحبا",
    })) {
      events.push(event.type);
      if (event.type === "message-end") finalContent = event.message.content;
    }

    expect(events).toContain("message-delta");
    expect(events).toContain("message-end");
    expect(finalContent.length).toBeGreaterThan(10);
  });

  it("deletes a session", async () => {
    const session = await mockServices.chat.createSession();
    await mockServices.chat.deleteSession(session.id);
    await expect(mockServices.chat.getSession(session.id)).rejects.toThrow();
  });
});

describe("mock skills and mcp services", () => {
  it("toggles a skill and persists the change", async () => {
    const [skill] = await mockServices.skill.listSkills();
    const updated = await mockServices.skill.setEnabled(skill.id, false);
    expect(updated.enabled).toBe(false);
    const [again] = await mockServices.skill.listSkills();
    expect(again.enabled).toBe(false);
  });

  it("adds an mcp server and reports a successful demo connection", async () => {
    const server = await mockServices.mcp.addServer({
      name: "demo",
      nameAr: "تجريبي",
      description: "demo server",
      transport: "stdio",
      enabled: true,
      command: "echo",
      args: ["hello"],
      envVars: [],
      authType: "none",
      scope: "local",
    });
    expect(server.status).toBe("connected");
    const result = await mockServices.mcp.testConnection(server.id);
    expect(result.ok).toBe(true);
  });
});

describe("provider credentials", () => {
  it("never stores the api key value", async () => {
    const provider = (await mockServices.provider.listProviders())[1];
    await mockServices.provider.saveCredential(provider.id, "sk-1234567890");
    const after = await mockServices.provider.getProvider(provider.id);
    expect(after.authStatus).toBe("active");
    expect(JSON.stringify(after)).not.toContain("sk-1234567890");
  });

  it("rejects a too-short key", async () => {
    const provider = (await mockServices.provider.listProviders())[1];
    await expect(mockServices.provider.saveCredential(provider.id, "abc")).rejects.toThrow();
  });
});

describe("opencode inventory contract", () => {
  it("parses a valid inventory", () => {
    const models = parseOpenCodeInventory({
      schemaVersion: "1.0",
      generatedAt: "2026-02-18T00:00:00.000Z",
      source: "opencode",
      models: [
        {
          modelId: "openai/gpt-5",
          name: "GPT-5",
          providerId: "openai",
          providerName: "OpenAI",
          pricing: "paid",
          inputPrice: 1,
          outputPrice: 10,
          contextWindow: 400000,
          maxOutputTokens: 1000,
          capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true, jsonMode: true },
          releaseDate: "2025-08-07",
          tags: ["test"],
        },
      ],
    });
    expect(models).toHaveLength(1);
    expect(models[0].source).toBe("opencode");
    expect(models[0].catalogAvailable).toBe(true);
    expect(models[0].verified).toBe(false);
  });

  it("rejects an invalid schema", () => {
    expect(() => parseOpenCodeInventory({ schemaVersion: "2.0" })).toThrow();
  });
});

describe("hermes adapter stubs", () => {
  it("reports a disconnected status without a transport", async () => {
    const services = createHermesServices();
    const status = await services.system.getConnectionStatus();
    expect(status.state).toBe("disconnected");
  });

  it("throws an unsupported error for unimplemented operations", async () => {
    const services = createHermesServices();
    await expect(services.browser.launch()).rejects.toMatchObject({ code: "unsupported" });
  });
});
