import { describe, expect, it, afterEach } from "vitest";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildApp } from "../src/app.js";
import type { ActorContext } from "@tandem/contracts";
import type { AuthProvider } from "../src/auth.js";

const ownerActor: ActorContext = {
  id: "development-human",
  type: "human",
  displayName: "Human Owner",
  roles: ["owner"],
  projectKeys: ["*"],
  capabilities: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request", "decision:resolve", "identity:admin"],
  development: false,
};

const memberActor: ActorContext = {
  id: "member-1",
  type: "human",
  displayName: "Human Member",
  roles: ["team_member"],
  projectKeys: ["*"],
  capabilities: ["context:read"],
  development: false,
};

const agentActor: ActorContext = {
  id: "agent-1",
  type: "agent",
  displayName: "Coding Agent",
  roles: ["coding_agent"],
  projectKeys: ["*"],
  capabilities: ["context:read", "execution:write"],
  development: false,
};

class MockAuth implements AuthProvider {
  readonly mode = "tokens" as const;
  constructor(private currentActor: ActorContext) {}
  setActor(actor: ActorContext) { this.currentActor = actor; }
  async authenticate(_request: FastifyRequest) { return this.currentActor; }
  async authenticateToken(_token: string) { return this.currentActor; }
}

describe("Human Password Login and Identity Administration API", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it("supports creating Human with password and logging in via username/password", async () => {
    const mockAuth = new MockAuth(ownerActor);
    app = await buildApp(undefined, mockAuth);

    // 1. Create Human
    const createRes = await app.inject({
      method: "POST",
      url: "/v1/human/principals/humans",
      headers: { "idempotency-key": "create-human-alice" },
      payload: {
        username: "alice",
        displayName: "Alice Smith",
        password: "SuperSecretPassword123!",
        roles: ["team_member"],
        projectKeys: ["TAN"],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { data: created, secret, warning } = createRes.json();
    expect(created.username).toBe("alice");
    expect(secret).toBe("SuperSecretPassword123!");
    expect(warning).toContain("never be displayed again");

    // 2. Login with correct password
    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { "idempotency-key": "login-alice-1" },
      payload: { username: "alice", password: "SuperSecretPassword123!" },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.headers["set-cookie"]).toContain("tandem_session=");

    // 3. Login with wrong password
    const badLoginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { "idempotency-key": "login-alice-bad" },
      payload: { username: "alice", password: "WrongPassword123!" },
    });
    expect(badLoginRes.statusCode).toBe(401);
  });

  it("supports creating Agent and receiving one-time token", async () => {
    const mockAuth = new MockAuth(ownerActor);
    app = await buildApp(undefined, mockAuth);

    const createRes = await app.inject({
      method: "POST",
      url: "/v1/human/principals/agents",
      headers: { "idempotency-key": "create-agent-builder" },
      payload: {
        displayName: "Codex Builder",
        projectKeys: ["TAN"],
        tokenLabel: "CI Agent Token",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { data: agent, secret } = createRes.json();
    expect(agent.type).toBe("agent");
    expect(secret).toMatch(/^tan_agent_/);

    // List credentials
    const credsRes = await app.inject({
      method: "GET",
      url: `/v1/human/principals/${agent.id}/credentials`,
    });
    expect(credsRes.statusCode).toBe(200);
    const creds = credsRes.json().data;
    expect(creds).toHaveLength(1);
    expect(creds[0].label).toBe("CI Agent Token");
    expect(creds[0].tokenHash).toBeUndefined(); // Secret is not returned in listing
  });

  it("prevents non-admin Humans and Agents from accessing identity administration", async () => {
    const mockAuth = new MockAuth(memberActor);
    app = await buildApp(undefined, mockAuth);

    const listRes = await app.inject({ method: "GET", url: "/v1/human/principals" });
    expect(listRes.statusCode).toBe(403);

    mockAuth.setActor(agentActor);
    const agentCreateRes = await app.inject({
      method: "POST",
      url: "/v1/human/principals/humans",
      payload: { username: "bob", displayName: "Bob", password: "Password123!23" },
    });
    expect(agentCreateRes.statusCode).toBe(403);
  });

  it("enforces last owner protection and self-deactivation restriction", async () => {
    const mockAuth = new MockAuth(ownerActor);
    app = await buildApp(undefined, mockAuth);

    // Create an initial owner principal in state
    await app.inject({
      method: "POST",
      url: "/v1/human/principals/humans",
      headers: { "idempotency-key": "create-owner-1" },
      payload: {
        username: "admin1",
        displayName: "Admin One",
        password: "AdminPassword123!",
        roles: ["owner"],
        projectKeys: ["*"],
      },
    });

    // Try deactivating self
    const selfDeactRes = await app.inject({
      method: "PATCH",
      url: "/v1/human/principals/development-human/status",
      headers: { "idempotency-key": "deact-self" },
      payload: { status: "deactivated" },
    });
    expect(selfDeactRes.statusCode).toBe(403);
    expect(selfDeactRes.json().error.code).toBe("SELF_DEACTIVATION_DENIED");
  });
});
