import type { ActorContext } from "@tandem/contracts";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildApp } from "../src/app.js";
import { OAuthIntrospectionAgentProvider, type AuthProvider } from "../src/auth.js";

const agent = (id: string, projectKeys = ["TAN"]): ActorContext => ({
  id,
  type: "agent",
  displayName: id,
  roles: ["coding_agent"],
  projectKeys,
  capabilities: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request"],
  development: false,
});

const human: ActorContext = {
  id: "reviewer-1",
  type: "human",
  displayName: "Reviewer",
  roles: ["owner"],
  projectKeys: ["TAN"],
  capabilities: ["context:read", "decision:resolve"],
  development: false,
};

class FixedAuth implements AuthProvider {
  readonly mode = "tokens" as const;
  constructor(private readonly actor?: ActorContext) {}
  async authenticate(_request: FastifyRequest): Promise<ActorContext | undefined> { return this.actor; }
}

describe("authenticated actor boundary", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it("requires a credential outside public health and metadata", async () => {
    app = await buildApp(undefined, new FixedAuth());
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    const response = await app.inject({ method: "GET", url: "/v1/projects" });
    expect(response.statusCode).toBe(401);
    expect(response.headers["www-authenticate"]).toContain("oauth-protected-resource");
  });

  it("derives Agent identity and ignores an impersonation field", async () => {
    app = await buildApp(undefined, new FixedAuth(agent("authenticated-agent")));
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/sessions",
      headers: { "idempotency-key": "auth-test-session" },
      payload: { issueKey: "TAN-2", agentId: "impersonated-agent" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.agentId).toBe("authenticated-agent");
  });

  it("prevents an Agent from using Human authority", async () => {
    app = await buildApp(undefined, new FixedAuth(agent("agent-without-human-authority")));
    const response = await app.inject({ method: "POST", url: "/v1/human/issues/TAN-2/verify", payload: {} });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("AUTHORIZATION_DENIED");
  });

  it("requires and safely replays Agent idempotency keys", async () => {
    app = await buildApp(undefined, new FixedAuth(agent("retrying-agent")));
    const request = { method: "POST" as const, url: "/v1/agent/sessions", headers: { "idempotency-key": "retry-session-001" }, payload: { issueKey: "TAN-2" } };
    const first = await app.inject(request);
    const replay = await app.inject(request);
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().data.id).toBe(first.json().data.id);

    const mismatch = await app.inject({ ...request, payload: { issueKey: "TAN-3" } });
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().error.code).toBe("IDEMPOTENCY_KEY_REUSED");

    const missing = await app.inject({ method: "POST", url: "/v1/agent/sessions", payload: { issueKey: "TAN-3" } });
    expect(missing.statusCode).toBe(428);
    expect(missing.json().error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("enforces Project scope and Session ownership", async () => {
    app = await buildApp(undefined, new FixedAuth(agent("scoped-elsewhere", ["OTHER"])));
    const scoped = await app.inject({ method: "GET", url: "/v1/projects/TAN/snapshot" });
    expect(scoped.statusCode).toBe(403);
    await app.close();

    app = await buildApp(undefined, new FixedAuth(human));
    const agentEndpoint = await app.inject({ method: "POST", url: "/v1/agent/sessions", headers: { "idempotency-key": "auth-test-human" }, payload: { issueKey: "TAN-2" } });
    expect(agentEndpoint.statusCode).toBe(403);
  });
});

describe("OAuth Agent access-token introspection", () => {
  it("derives Agent identity, Project scope, and capabilities from active issuer claims", async () => {
    const provider = new OAuthIntrospectionAgentProvider(
      "https://identity.example.test/introspect",
      "tandem",
      "resource-secret",
      async (_input, init) => {
        expect(init?.headers).toMatchObject({ "content-type": "application/x-www-form-urlencoded" });
        expect(String(init?.body)).toContain("token=oauth-agent-token");
        return new Response(JSON.stringify({
          active: true,
          sub: "oauth-agent-42",
          client_id: "codex-builder",
          actor_type: "agent",
          scope: "context:read planning:write execution:write decision:request",
          project_keys: ["ACME"],
          roles: ["coding_agent"],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    );
    await expect(provider.authenticateToken("oauth-agent-token")).resolves.toMatchObject({
      id: "oauth-agent-42",
      type: "agent",
      projectKeys: ["ACME"],
      capabilities: ["context:read", "planning:write", "execution:write", "decision:request"],
      development: false,
    });
  });

  it("fails closed for inactive, Human, or unscoped access tokens", async () => {
    const responses = [
      { active: false, sub: "inactive", scope: "context:read", project_keys: ["ACME"] },
      { active: true, sub: "human-token", actor_type: "human", scope: "context:read", project_keys: ["ACME"] },
      { active: true, sub: "unscoped", actor_type: "agent", scope: "context:read", project_keys: [] },
    ];
    const provider = new OAuthIntrospectionAgentProvider("https://identity.example.test/introspect", "tandem", "secret", async () => new Response(JSON.stringify(responses.shift()), { status: 200 }));
    await expect(provider.authenticateToken("inactive")).resolves.toBeUndefined();
    await expect(provider.authenticateToken("human")).resolves.toBeUndefined();
    await expect(provider.authenticateToken("unscoped")).resolves.toBeUndefined();
  });
});
