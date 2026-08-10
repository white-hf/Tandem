import type { ActorContext, Capability } from "@tandem/contracts";
import type { PostgresIdentityRepository } from "@tandem/db";
import type { FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    actor?: ActorContext;
  }
}

const ALL_CAPABILITIES: Capability[] = ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request", "decision:resolve", "identity:admin"];

export class AuthenticationError extends Error {
  constructor(
    readonly statusCode: 401 | 403,
    readonly code: "AUTHENTICATION_REQUIRED" | "AUTHORIZATION_DENIED",
    message: string,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export interface AuthProvider {
  readonly mode: "development" | "tokens" | "oauth";
  authenticate(request: FastifyRequest): Promise<ActorContext | undefined>;
  authenticateToken?(token: string): Promise<ActorContext | undefined>;
}

export class DevelopmentAuthProvider implements AuthProvider {
  readonly mode = "development" as const;

  async authenticate(request: FastifyRequest): Promise<ActorContext | undefined> {
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.ip)) return undefined;
    const agentRoute = request.url === "/mcp" || request.url.startsWith("/v1/agent/");
    return {
      id: agentRoute ? "development-agent" : "development-human",
      type: agentRoute ? "agent" : "human",
      displayName: agentRoute ? "Local Development Agent" : "Local Development Human",
      roles: agentRoute ? ["coding_agent"] : ["owner"],
      projectKeys: ["*"],
      capabilities: ALL_CAPABILITIES,
      development: true,
    };
  }
}

export class TokenAuthProvider implements AuthProvider {
  readonly mode = "tokens" as const;

  constructor(
    private readonly identities: PostgresIdentityRepository,
    private readonly runtime?: { read<T>(query: (service: any) => T): T },
  ) {}

  async authenticate(request: FastifyRequest): Promise<ActorContext | undefined> {
    const authorization = request.headers.authorization;
    const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
    const cookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("tandem_session="))?.slice("tandem_session=".length);
    const token = bearer || (cookie ? decodeURIComponent(cookie) : undefined);
    if (!token) return undefined;
    return this.authenticateToken(token);
  }

  async authenticateToken(token: string): Promise<ActorContext | undefined> {
    const pgActor = await this.identities.authenticate(token);
    if (pgActor) return pgActor;
    if (this.runtime) {
      const p = this.runtime.read((service) => service.authenticateTokenInState(token));
      if (p) {
        return {
          id: p.id,
          type: p.type,
          displayName: p.displayName,
          roles: p.roles,
          projectKeys: p.projectKeys,
          capabilities: p.capabilities,
          development: false,
        };
      }
    }
    return undefined;
  }
}

interface OAuthIntrospectionResponse {
  active?: boolean;
  sub?: string;
  client_id?: string;
  scope?: string;
  actor_type?: string;
  display_name?: string;
  roles?: unknown;
  project_keys?: unknown;
  tandem_projects?: unknown;
}

const stringArrayClaim = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return value.split(/[ ,]+/).filter(Boolean);
  return [];
};

export class OAuthIntrospectionAgentProvider implements AuthProvider {
  readonly mode = "oauth" as const;

  constructor(
    private readonly introspectionUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async authenticate(request: FastifyRequest): Promise<ActorContext | undefined> {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
    return token ? this.authenticateToken(token) : undefined;
  }

  async authenticateToken(token: string): Promise<ActorContext | undefined> {
    const response = await this.fetcher(this.introspectionUrl, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({ token, token_type_hint: "access_token" }),
    });
    if (!response.ok) return undefined;
    const claims = await response.json() as OAuthIntrospectionResponse;
    if (!claims.active || !claims.sub || (claims.actor_type && claims.actor_type !== "agent")) return undefined;
    const grantedScopes = new Set((claims.scope ?? "").split(/\s+/).filter(Boolean));
    const grantedCapabilities = ALL_CAPABILITIES.filter((capability) => grantedScopes.has(capability));
    const projectKeys = stringArrayClaim(claims.project_keys ?? claims.tandem_projects);
    if (!grantedCapabilities.includes("context:read") || projectKeys.length === 0) return undefined;
    return {
      id: claims.sub,
      type: "agent",
      displayName: claims.display_name ?? claims.client_id ?? claims.sub,
      roles: stringArrayClaim(claims.roles).length ? stringArrayClaim(claims.roles) : ["coding_agent"],
      projectKeys,
      capabilities: grantedCapabilities,
      development: false,
    };
  }
}

export class HostedOAuthAuthProvider implements AuthProvider {
  readonly mode = "oauth" as const;

  constructor(
    private readonly humans: TokenAuthProvider,
    private readonly agents: OAuthIntrospectionAgentProvider,
  ) {}

  async authenticate(request: FastifyRequest): Promise<ActorContext | undefined> {
    const agentRoute = request.url === "/mcp" || request.url.startsWith("/v1/agent/");
    if (agentRoute) return this.agents.authenticate(request);
    const actor = await this.humans.authenticate(request);
    return actor?.type === "human" ? actor : undefined;
  }

  async authenticateToken(token: string): Promise<ActorContext | undefined> {
    const actor = await this.humans.authenticateToken(token);
    return actor?.type === "human" ? actor : undefined;
  }
}

export function requireActor(request: FastifyRequest, type?: "human" | "agent", capability?: Capability): ActorContext {
  const actor = request.actor;
  if (!actor) throw new AuthenticationError(401, "AUTHENTICATION_REQUIRED", "A valid Tandem credential is required");
  if (type && actor.type !== type) throw new AuthenticationError(403, "AUTHORIZATION_DENIED", `${type} authority is required`);
  if (capability && !actor.capabilities.includes(capability)) throw new AuthenticationError(403, "AUTHORIZATION_DENIED", `Missing capability: ${capability}`);
  return actor;
}

export function requireProjectScope(actor: ActorContext, projectKey: string): void {
  if (!actor.projectKeys.includes("*") && !actor.projectKeys.includes(projectKey)) {
    throw new AuthenticationError(403, "AUTHORIZATION_DENIED", `Principal is not scoped to Project ${projectKey}`);
  }
}
