import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ActorContext } from "@tandem/contracts";
import { TandemRuntime } from "@tandem/db";
import { createEmptyTandemService } from "@tandem/domain";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpServer } from "../src/mcp.js";

describe("Project-scoped MCP", () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => close?.());

  it("advertises dynamic Project resources and Agent-first bootstrap/update tools", async () => {
    const service = createEmptyTandemService();
    service.createProject({
      key: "MCP",
      name: "MCP Delivery",
      goal: "Verify generic Agent resource discovery for a real Project.",
      owner: "Product Owner",
      targetDate: "2026-09-30",
      successMeasures: [],
      nonGoals: [],
      repositories: [{ provider: "github", host: "github.com", owner: "acme", name: "mcp-delivery", defaultBranch: "main" }],
      artifacts: [],
      actorType: "human",
      actorId: "product-owner",
    });
    const runtime = TandemRuntime.ephemeral(service);
    const actor: ActorContext = {
      id: "mcp-agent",
      type: "agent",
      displayName: "MCP Agent",
      roles: ["coding_agent"],
      projectKeys: ["MCP"],
      capabilities: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request"],
      development: false,
    };
    const server = createMcpServer(runtime, actor);
    const client = new Client({ name: "tandem-test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    close = async () => { await client.close(); await server.close(); await runtime.close(); };

    const templates = await client.listResourceTemplates();
    expect(templates.resourceTemplates.map((item) => item.uriTemplate)).toEqual(expect.arrayContaining([
      "tandem://projects/{projectKey}/baseline",
      "tandem://projects/{projectKey}/ready-issues",
    ]));
    const resources = await client.listResources();
    expect(resources.resources.map((item) => item.uri)).toEqual(expect.arrayContaining([
      "tandem://projects/MCP/baseline",
      "tandem://projects/MCP/ready-issues",
    ]));
    const tools = await client.listTools();
    expect(tools.tools.map((item) => item.name)).toEqual(expect.arrayContaining(["create_project", "create_issue", "update_issue", "start_session"]));
    const context = await client.callTool({ name: "get_project_context", arguments: { projectKey: "MCP" } });
    expect(context.isError).not.toBe(true);
    expect(context.structuredContent).toMatchObject({ data: { project: { key: "MCP" } } });
  });
});
