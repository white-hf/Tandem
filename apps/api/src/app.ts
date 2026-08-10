import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import {
  artifactCheckpointInput,
  artifactDraftInput,
  checkpointInput,
  claimIssueInput,
  confirmUnderstandingInput,
  evidenceInput,
  handoffInput,
  cyclePlanInput,
  createIssueInput,
  issueDependencyInput,
  issueReviewInput,
  projectBootstrapInput,
  decisionInput,
  decisionRequestInput,
  startSessionInput,
  createAgentInput,
  createHumanInput,
  issueTokenInput,
  loginPasswordInput,
  loginTokenInput,
  setPasswordInput,
  updatePrincipalInput,
} from "@tandem/contracts";
import { IdempotencyConflictError, MemoryEventStore, StateRevisionConflictError, TandemRuntime, type EventStore } from "@tandem/db";
import { createSeededTandemService, DomainError } from "@tandem/domain";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { handleMcpRequest } from "./mcp.js";
import { AuthenticationError, DevelopmentAuthProvider, requireActor, requireProjectScope, type AuthProvider } from "./auth.js";
import { mutateWithIdempotency, restIdempotency } from "./integrity.js";

const verifyInput = z.object({});
const loginInput = z.object({ token: z.string().min(32) });

declare module "fastify" {
  interface FastifyRequest { rawBody?: Buffer; }
}

export async function buildApp(
  runtime: TandemRuntime = TandemRuntime.ephemeral(createSeededTandemService()),
  auth?: AuthProvider,
  events: EventStore = new MemoryEventStore(),
): Promise<FastifyInstance> {
  const effectiveAuth = auth ?? new DevelopmentAuthProvider();
  const app = Fastify({ logger: true });
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
    request.rawBody = rawBody;
    try { done(null, rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {}); } catch (error) { done(error as Error); }
  });
  await app.register(cors, {
    origin: effectiveAuth.mode === "development" ? true : (process.env.TANDEM_WEB_ORIGIN ?? false),
    credentials: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    if (error instanceof StateRevisionConflictError) {
      return reply.status(409).send({ error: { code: error.code, message: error.message, expectedRevision: error.expectedRevision, actualRevision: error.actualRevision } });
    }
    if (error instanceof IdempotencyConflictError) {
      return reply.status(409).send({ error: { code: error.code, message: error.message } });
    }
    if (error instanceof AuthenticationError) {
      if (error.statusCode === 401 && !reply.hasHeader("WWW-Authenticate")) reply.header("WWW-Authenticate", "Bearer");
      return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: { code: "INVALID_INPUT", message: z.prettifyError(error), issues: error.issues } });
    }
    app.log.error(error);
    return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
  });

  app.addHook("onRequest", async (request, reply) => {
    if (
      request.url === "/health" ||
      request.url === "/ready" ||
      request.url.startsWith("/.well-known/") ||
      request.url === "/v1/auth/login" ||
      request.url === "/v1/auth/login-token" ||
      request.url === "/v1/integrations/github/webhook"
    ) return;
    const actor = await effectiveAuth.authenticate(request);
    if (!actor) {
      reply.header("WWW-Authenticate", `Bearer resource_metadata="${request.protocol}://${request.host}/.well-known/oauth-protected-resource"`);
      throw new AuthenticationError(401, "AUTHENTICATION_REQUIRED", "A valid Tandem credential is required");
    }
    request.actor = actor;
    if (request.url === "/mcp" || request.url.startsWith("/v1/agent/")) requireActor(request, "agent");
    if (request.url.startsWith("/v1/human/")) requireActor(request, "human");
  });

  app.get("/health", async () => ({ status: "ok", product: "tandem", storage: runtime.storageKind, auth: effectiveAuth.mode, stateRevision: runtime.stateRevision, time: new Date().toISOString() }));
  app.get("/ready", async () => ({ status: "ready", storage: runtime.storageKind, stateRevision: runtime.stateRevision }));
  app.get("/.well-known/oauth-protected-resource", async (request) => ({
    resource: `${request.protocol}://${request.host}`,
    authorization_servers: process.env.TANDEM_AUTHORIZATION_SERVER ? [process.env.TANDEM_AUTHORIZATION_SERVER] : [],
    bearer_methods_supported: ["header"],
    scopes_supported: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request", "decision:resolve", "identity:admin"],
  }));

  // Login via username + password
  app.post("/v1/auth/login", async (request, reply) => {
    const { username, password } = loginPasswordInput.parse(request.body);
    let principal: any;
    const providerIdentities = (effectiveAuth as any).identities;
    if (providerIdentities?.authenticateByPassword) {
      principal = await providerIdentities.authenticateByPassword(username, password);
    }
    if (!principal) {
      principal = runtime.read((service) => service.authenticatePassword(username, password));
    }

    let secret: string;
    if (providerIdentities?.createWebSession) {
      const res = await providerIdentities.createWebSession(principal.id);
      secret = res.secret;
    } else {
      const res = await mutateWithIdempotency(runtime, restIdempotency(request, { id: principal.id, type: "human", displayName: principal.displayName, roles: principal.roles, projectKeys: principal.projectKeys, capabilities: principal.capabilities, development: false }, 200), (service) => service.createWebSession(principal.id));
      secret = res.secret;
    }

    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    reply.header("Set-Cookie", `tandem_session=${encodeURIComponent(secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
    return { data: principal };
  });

  // Login via access token (legacy/PAT alternative)
  app.post("/v1/auth/login-token", async (request, reply) => {
    if (!effectiveAuth.authenticateToken) throw new AuthenticationError(403, "AUTHORIZATION_DENIED", "Token login is unavailable in development mode");
    const { token } = loginTokenInput.parse(request.body);
    const actor = await effectiveAuth.authenticateToken(token);
    if (!actor || actor.type !== "human") throw new AuthenticationError(401, "AUTHENTICATION_REQUIRED", "A valid Human credential is required");

    let secret: string;
    const providerIdentities = (effectiveAuth as any).identities;
    if (providerIdentities?.createWebSession) {
      const res = await providerIdentities.createWebSession(actor.id);
      secret = res.secret;
    } else {
      const res = await mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.createWebSession(actor.id));
      secret = res.secret;
    }

    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    reply.header("Set-Cookie", `tandem_session=${encodeURIComponent(secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
    return { data: actor };
  });

  app.get("/v1/auth/session", async (request) => ({ data: requireActor(request) }));

  app.post("/v1/auth/logout", async (request, reply) => {
    const actor = requireActor(request, "human");
    const cookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("tandem_session="))?.slice("tandem_session=".length);
    if (cookie) {
      const token = decodeURIComponent(cookie);
      const providerIdentities = (effectiveAuth as any).identities;
      if (providerIdentities?.revokeWebSessionBySecret) {
        await providerIdentities.revokeWebSessionBySecret(token);
      } else {
        await mutateWithIdempotency(runtime, restIdempotency(request, actor, 204), (service) => service.revokeWebSessionBySecret(token));
      }
    }
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    reply.header("Set-Cookie", `tandem_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
    return reply.status(204).send();
  });

  // Human Identity Administration Endpoints
  app.get("/v1/human/principals", async (request) => {
    requireActor(request, "human", "identity:admin");
    return { data: runtime.read((service) => service.listPrincipals()) };
  });

  app.post("/v1/human/principals/humans", async (request, reply) => {
    const actor = requireActor(request, "human", "identity:admin");
    const input = createHumanInput.parse(request.body);
    const result = await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.createHuman(input, actor.id));
    return reply.status(201).send(result);
  });

  app.post("/v1/human/principals/agents", async (request, reply) => {
    const actor = requireActor(request, "human", "identity:admin");
    const input = createAgentInput.parse(request.body);
    const result = await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.createAgent(input, actor.id));
    return reply.status(201).send(result);
  });

  app.get<{ Params: { id: string } }>("/v1/human/principals/:id/credentials", async (request) => {
    requireActor(request, "human", "identity:admin");
    return { data: runtime.read((service) => service.listCredentials(request.params.id)) };
  });

  app.post<{ Params: { id: string } }>("/v1/human/principals/:id/password", async (request) => {
    const actor = requireActor(request, "human");
    if (actor.id !== request.params.id && !actor.capabilities.includes("identity:admin")) {
      throw new AuthenticationError(403, "AUTHORIZATION_DENIED", "Missing capability: identity:admin");
    }
    const { password } = setPasswordInput.parse(request.body);
    await mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.setHumanPassword(request.params.id, password, actor.id));
    return { status: "ok" };
  });

  app.post<{ Params: { id: string } }>("/v1/human/principals/:id/tokens", async (request, reply) => {
    const actor = requireActor(request, "human");
    if (actor.id !== request.params.id && !actor.capabilities.includes("identity:admin")) {
      throw new AuthenticationError(403, "AUTHORIZATION_DENIED", "Missing capability: identity:admin");
    }
    const input = issueTokenInput.parse(request.body);
    const result = await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.issueToken(request.params.id, input, actor.id));
    return reply.status(201).send(result);
  });

  app.delete<{ Params: { credentialId: string } }>("/v1/human/credentials/:credentialId", async (request, reply) => {
    const actor = requireActor(request, "human", "identity:admin");
    await mutateWithIdempotency(runtime, restIdempotency(request, actor, 204), (service) => service.revokeCredential(request.params.credentialId, actor.id));
    return reply.status(204).send();
  });

  app.patch<{ Params: { id: string } }>("/v1/human/principals/:id/status", async (request) => {
    const actor = requireActor(request, "human", "identity:admin");
    const { status } = z.object({ status: z.enum(["active", "deactivated"]) }).parse(request.body);
    return mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.updatePrincipalStatus(request.params.id, status, actor.id));
  });

  app.patch<{ Params: { id: string } }>("/v1/human/principals/:id", async (request) => {
    const actor = requireActor(request, "human", "identity:admin");
    const input = updatePrincipalInput.parse(request.body);
    return mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.updatePrincipal(request.params.id, input, actor.id));
  });
  app.post("/v1/integrations/github/webhook", async (request, reply) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return reply.status(503).send({ error: { code: "GITHUB_WEBHOOK_NOT_CONFIGURED", message: "GitHub webhook secret is not configured" } });
    const signature = request.headers["x-hub-signature-256"];
    const deliveryId = request.headers["x-github-delivery"];
    const eventName = request.headers["x-github-event"];
    if (typeof signature !== "string" || typeof deliveryId !== "string" || typeof eventName !== "string" || !request.rawBody) {
      return reply.status(400).send({ error: { code: "GITHUB_WEBHOOK_HEADERS_INVALID", message: "Signed GitHub delivery headers are required" } });
    }
    const expected = `sha256=${createHmac("sha256", secret).update(request.rawBody).digest("hex")}`;
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      return reply.status(401).send({ error: { code: "GITHUB_WEBHOOK_SIGNATURE_INVALID", message: "GitHub webhook signature is invalid" } });
    }
    const payload = request.body as Record<string, unknown>;
    const allowedIssueKeys = runtime.read((service) => service.listProjects().flatMap((project) => service.getProjectSnapshot(project.key).issues.map((issue) => issue.key)));
    const result = await events.ingestGitHub(deliveryId, eventName, createHash("sha256").update(request.rawBody).digest("hex"), payload, allowedIssueKeys);
    return reply.status(result.duplicate ? 200 : 202).send({ data: result });
  });
  app.route({
    method: ["GET", "POST", "DELETE"],
    url: "/mcp",
    handler: async (request, reply) => handleMcpRequest(runtime, requireActor(request, "agent"), request, reply),
  });

  app.get("/v1/projects", async (request) => {
    const actor = requireActor(request, undefined, "context:read");
    return { data: runtime.read((service) => service.listProjects()).filter((project) => actor.projectKeys.includes("*") || actor.projectKeys.includes(project.key)) };
  });
  app.get<{ Params: { projectKey: string } }>("/v1/projects/:projectKey/snapshot", async (request) => {
    const actor = requireActor(request, undefined, "context:read");
    requireProjectScope(actor, request.params.projectKey);
    const snapshot = runtime.read((service) => service.getProjectSnapshot(request.params.projectKey));
    return { data: { ...snapshot, gitArtifacts: await events.listGitArtifacts(snapshot.issues.map((issue) => issue.key)) } };
  });
  app.get<{ Params: { projectKey: string } }>("/v1/projects/:projectKey/git-artifacts", async (request) => {
    const actor = requireActor(request, undefined, "context:read");
    requireProjectScope(actor, request.params.projectKey);
    const issueKeys = runtime.read((service) => service.getProjectSnapshot(request.params.projectKey).issues.map((issue) => issue.key));
    return { data: await events.listGitArtifacts(issueKeys) };
  });
  app.get<{ Querystring: { after?: string } }>("/v1/events", async (request, reply) => {
    const actor = requireActor(request, undefined, "context:read");
    const visibleSubjects = runtime.read((service) => {
      const projects = service.listProjects().filter((project) => actor.projectKeys.includes("*") || actor.projectKeys.includes(project.key));
      return new Set(projects.flatMap((project) => [project.key, ...service.getProjectSnapshot(project.key).issues.map((issue) => issue.key)]));
    });
    const headerCursor = request.headers["last-event-id"];
    let cursor = Number(typeof headerCursor === "string" ? headerCursor : request.query.after ?? 0);
    if (!Number.isSafeInteger(cursor) || cursor < 0) cursor = 0;
    reply.hijack();
    reply.raw.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
    let closed = false;
    const flush = async () => {
      const pending = await events.eventsAfter(cursor);
      for (const event of pending) {
        cursor = event.id;
        const visibleSubjectIds = event.subjectIds.filter((subjectId) => visibleSubjects.has(subjectId));
        if (event.subjectIds.length && !visibleSubjectIds.length) continue;
        reply.raw.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify({ ...event, subjectIds: visibleSubjectIds })}\n\n`);
      }
    };
    await flush();
    const poll = setInterval(() => { if (!closed) void flush(); }, 1000);
    const heartbeat = setInterval(() => { if (!closed) reply.raw.write(": keep-alive\n\n"); }, 15000);
    request.raw.on("close", () => { closed = true; clearInterval(poll); clearInterval(heartbeat); });
  });
  app.get<{ Params: { projectKey: string } }>("/v1/projects/:projectKey/ready-issues", async (request) => {
    const actor = requireActor(request, undefined, "context:read");
    requireProjectScope(actor, request.params.projectKey);
    return { data: runtime.read((service) => service.listReadyIssues(request.params.projectKey)) };
  });
  app.get<{ Params: { issueKey: string } }>("/v1/issues/:issueKey", async (request) => {
    const actor = requireActor(request, undefined, "context:read");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(request.params.issueKey).key));
    return { data: runtime.read((service) => service.getIssue(request.params.issueKey)) };
  });
  app.get<{ Params: { sessionId: string } }>("/v1/sessions/:sessionId", async (request) => {
    const actor = requireActor(request, undefined, "context:read");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForSession(request.params.sessionId).key));
    return { data: runtime.read((service) => service.getSession(request.params.sessionId)) };
  });

  app.post("/v1/human/projects", async (request, reply) => {
    const actor = requireActor(request, "human", "planning:write");
    const input = projectBootstrapInput.parse(request.body);
    requireProjectScope(actor, input.key);
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.createProject({ ...input, actorId: actor.id, actorType: "human" })));
  });
  app.post("/v1/human/issues", async (request, reply) => {
    const actor = requireActor(request, "human", "planning:write");
    const input = createIssueInput.parse(request.body);
    requireProjectScope(actor, input.projectKey);
    if (input.deliveryPath !== "quick") throw new DomainError("HUMAN_QUICK_CAPTURE_ONLY", "This Human capture endpoint accepts Quick Work only", 400);
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.createIssue({ ...input, source: "human_web", actorId: actor.id, actorType: "human" })));
  });

  app.post("/v1/agent/sessions", async (request, reply) => {
    const actor = requireActor(request, "agent", "execution:write");
    const input = startSessionInput.parse(request.body);
    requireProjectScope(actor, runtime.read((service) => service.resolveProjectContext(input).key));
    const result = await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.startSession({ ...input, agentId: actor.id }));
    return reply.status(201).send(result);
  });
  app.post("/v1/agent/artifacts/drafts", async (request, reply) => {
    const actor = requireActor(request, "agent", "artifact:write");
    const input = artifactDraftInput.parse(request.body);
    requireProjectScope(actor, input.projectKey);
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.upsertArtifactDraft({ ...input, actorId: actor.id })));
  });
  app.post("/v1/agent/artifacts/checkpoints", async (request, reply) => {
    const actor = requireActor(request, "agent", "artifact:write");
    const input = artifactCheckpointInput.parse(request.body);
    requireProjectScope(actor, runtime.read((service) => service.getProjectForArtifact(input.artifactId).key));
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => ({
      data: service.checkpointArtifact({ artifactId: input.artifactId, content: input.content, state: input.state, actorType: "agent", actorId: actor.id }),
      permittedNextActions: input.state === "proposed" ? ["request_human_decision"] : ["checkpoint_artifact"],
      warnings: [],
      webUrl: `http://localhost:4311/artifacts/${input.artifactId}`,
    })));
  });
  app.post("/v1/agent/cycles/plan", async (request, reply) => {
    const actor = requireActor(request, "agent", "planning:write");
    const input = cyclePlanInput.parse(request.body);
    requireProjectScope(actor, input.projectKey);
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.planCycle({ ...input, actorId: actor.id })));
  });
  app.post("/v1/agent/issues", async (request, reply) => {
    const actor = requireActor(request, "agent", "planning:write");
    const input = createIssueInput.parse(request.body);
    requireProjectScope(actor, input.projectKey);
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.createIssue({ ...input, source: input.source === "human_web" ? "agent_conversation" : input.source, actorId: actor.id, actorType: "agent" })));
  });
  app.patch<{ Params: { issueKey: string } }>("/v1/agent/issues/:issueKey", async (request) => {
    const actor = requireActor(request, "agent", "planning:write");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(request.params.issueKey).key));
    const input = updateIssueInput.parse(request.body);
    return mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.updateIssue(request.params.issueKey, { ...input, actorId: actor.id, actorType: "agent" }));
  });
  app.post("/v1/agent/projects", async (request, reply) => {
    const actor = requireActor(request, "agent", "planning:write");
    const input = projectBootstrapInput.parse(request.body);
    requireProjectScope(actor, input.key);
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.createProject({ ...input, actorId: actor.id, actorType: "agent" })));
  });
  app.post("/v1/agent/issue-dependencies", async (request, reply) => {
    const actor = requireActor(request, "agent", "planning:write");
    const input = issueDependencyInput.parse(request.body);
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(input.blockerKey).key));
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(input.blockedKey).key));
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.addIssueDependency({ ...input, actorId: actor.id })));
  });
  app.post("/v1/agent/decision-requests", async (request, reply) => {
    const actor = requireActor(request, "agent", "decision:request");
    const input = decisionRequestInput.parse(request.body);
    requireProjectScope(actor, input.projectKey);
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.requestHumanDecision({ ...input, actorId: actor.id })));
  });
  app.post<{ Params: { sessionId: string } }>("/v1/agent/sessions/:sessionId/understanding", async (request) => {
    const actor = requireActor(request, "agent", "execution:write");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForSession(request.params.sessionId).key));
    if (runtime.read((service) => service.getSession(request.params.sessionId)).agentId !== actor.id) throw new AuthenticationError(403, "AUTHORIZATION_DENIED", "Agent Session belongs to another principal");
    const input = confirmUnderstandingInput.parse(request.body);
    return mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.confirmUnderstanding(request.params.sessionId, input));
  });
  app.post<{ Params: { issueKey: string } }>("/v1/agent/issues/:issueKey/claim", async (request) => {
    const actor = requireActor(request, "agent", "execution:write");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(request.params.issueKey).key));
    const input = claimIssueInput.parse(request.body);
    if (runtime.read((service) => service.getSession(input.sessionId)).agentId !== actor.id) throw new AuthenticationError(403, "AUTHORIZATION_DENIED", "Agent Session belongs to another principal");
    return mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.claimIssue(request.params.issueKey, input));
  });
  app.post<{ Params: { issueKey: string } }>("/v1/agent/issues/:issueKey/checkpoints", async (request, reply) => {
    const actor = requireActor(request, "agent", "execution:write");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(request.params.issueKey).key));
    const input = checkpointInput.parse(request.body);
    if (runtime.read((service) => service.getSession(input.sessionId)).agentId !== actor.id) throw new AuthenticationError(403, "AUTHORIZATION_DENIED", "Agent Session belongs to another principal");
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.recordCheckpoint(request.params.issueKey, input)));
  });
  app.post<{ Params: { issueKey: string } }>("/v1/agent/issues/:issueKey/evidence", async (request, reply) => {
    const actor = requireActor(request, "agent", "execution:write");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(request.params.issueKey).key));
    const input = evidenceInput.parse(request.body);
    if (runtime.read((service) => service.getSession(input.sessionId)).agentId !== actor.id) throw new AuthenticationError(403, "AUTHORIZATION_DENIED", "Agent Session belongs to another principal");
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.attachEvidence(request.params.issueKey, input)));
  });
  app.post<{ Params: { issueKey: string } }>("/v1/agent/issues/:issueKey/handoff", async (request, reply) => {
    const actor = requireActor(request, "agent", "execution:write");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(request.params.issueKey).key));
    const input = handoffInput.parse(request.body);
    if (runtime.read((service) => service.getSession(input.sessionId)).agentId !== actor.id) throw new AuthenticationError(403, "AUTHORIZATION_DENIED", "Agent Session belongs to another principal");
    return reply.status(201).send(await mutateWithIdempotency(runtime, restIdempotency(request, actor, 201), (service) => service.submitHandoff(request.params.issueKey, input)));
  });
  app.post<{ Params: { issueKey: string } }>("/v1/human/issues/:issueKey/verify", async (request) => {
    const actor = requireActor(request, "human", "decision:resolve");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(request.params.issueKey).key));
    verifyInput.parse(request.body);
    return mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.verifyIssue(request.params.issueKey, "human_decision", actor.id));
  });
  app.post<{ Params: { issueKey: string } }>("/v1/human/issues/:issueKey/review", async (request) => {
    const actor = requireActor(request, "human", "decision:resolve");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(request.params.issueKey).key));
    const input = issueReviewInput.parse(request.body);
    return mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.reviewIssue(request.params.issueKey, { ...input, humanId: actor.id }));
  });
  app.post<{ Params: { requestId: string } }>("/v1/human/decision-requests/:requestId", async (request) => {
    const actor = requireActor(request, "human", "decision:resolve");
    requireProjectScope(actor, runtime.read((service) => service.getProjectForDecision(request.params.requestId).key));
    const input = decisionInput.parse(request.body);
    return mutateWithIdempotency(runtime, restIdempotency(request, actor, 200), (service) => service.resolveDecision(request.params.requestId, { ...input, humanId: actor.id }));
  });

  const unsubscribe = runtime.onCommit(async (revision) => {
    const projectKeys = runtime.read((service) => service.listProjects().map((project) => project.key));
    await events.append("state.changed", projectKeys, { revision });
  });
  app.addHook("onSend", async (request, reply) => { reply.header("x-request-id", request.id); });
  app.addHook("onClose", async () => { unsubscribe(); await runtime.close(); await events.close?.(); });

  return app;
}
