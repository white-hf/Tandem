import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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
  projectBootstrapInput,
  decisionRequestInput,
  finishSessionInput,
  refreshSessionInput,
  startSessionInput,
  updateIssueInput,
  type ActorContext,
  type Capability,
} from "@tandem/contracts";
import { TandemRuntime } from "@tandem/db";
import { DomainError } from "@tandem/domain";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuthenticationError, requireProjectScope } from "./auth.js";
import { mcpIdempotency, mutateWithIdempotency, type IdempotencyContext } from "./integrity.js";

const sessionUnderstandingInput = confirmUnderstandingInput.extend({ sessionId: z.string().min(1) });
const issueClaimInput = claimIssueInput.extend({ issueKey: z.string().min(2) });
const issueCheckpointInput = checkpointInput.extend({ issueKey: z.string().min(2) });
const issueEvidenceInput = evidenceInput.extend({ issueKey: z.string().min(2) });
const issueHandoffInput = handoffInput.extend({ issueKey: z.string().min(2) });
const issueUpdateInput = updateIssueInput.extend({ issueKey: z.string().min(2) });
const projectKeyInput = z.object({ projectKey: z.string().min(2) });

function toolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function toolError(error: unknown) {
  const code = error instanceof DomainError || error instanceof AuthenticationError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof Error ? error.message : "Unexpected tool failure";
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: { code, message } }) }],
    structuredContent: { error: { code, message } },
  };
}

function registerTool<T>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: z.ZodType<T>,
  handler: (input: T) => unknown | Promise<unknown>,
) {
  server.registerTool(name, { description, inputSchema }, async (input) => {
    try {
      return toolResult(await handler(input as T));
    } catch (error) {
      return toolError(error);
    }
  });
}

function requireCapability(actor: ActorContext, capability: Capability): void {
  if (!actor.capabilities.includes(capability)) throw new AuthenticationError(403, "AUTHORIZATION_DENIED", `Missing capability: ${capability}`);
}

function requireSessionOwner(runtime: TandemRuntime, actor: ActorContext, sessionId: string): void {
  requireProjectScope(actor, runtime.read((service) => service.getProjectForSession(sessionId).key));
  if (runtime.read((service) => service.getSession(sessionId)).agentId !== actor.id) {
    throw new AuthenticationError(403, "AUTHORIZATION_DENIED", "Agent Session belongs to another principal");
  }
}

function requireIssueScope(runtime: TandemRuntime, actor: ActorContext, issueKey: string): void {
  requireProjectScope(actor, runtime.read((service) => service.getProjectForIssue(issueKey).key));
}

export function createMcpServer(runtime: TandemRuntime, actor: ActorContext, idempotency?: IdempotencyContext): McpServer {
  const server = new McpServer({ name: "tandem", version: "0.1.0" });

  const projectCompletions = () => runtime.read((service) => service.listProjects()
    .filter((project) => actor.projectKeys.includes("*") || actor.projectKeys.includes(project.key))
    .map((project) => project.key));
  server.registerResource(
    "tandem-project-baseline",
    new ResourceTemplate("tandem://projects/{projectKey}/baseline", {
      list: async () => ({ resources: projectCompletions().map((projectKey) => ({ uri: `tandem://projects/${projectKey}/baseline`, name: `${projectKey} baseline`, mimeType: "application/json" })) }),
      complete: { projectKey: projectCompletions },
    }),
    { title: "Project baseline", description: "Current effective Artifacts, optional active Cycle, and dependency-aware work", mimeType: "application/json" },
    async (uri, variables) => {
      const projectKey = String(variables.projectKey);
      requireCapability(actor, "context:read"); requireProjectScope(actor, projectKey);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(runtime.read((service) => service.getProjectSnapshot(projectKey)), null, 2) }] };
    },
  );
  server.registerResource(
    "tandem-ready-work",
    new ResourceTemplate("tandem://projects/{projectKey}/ready-issues", {
      list: async () => ({ resources: projectCompletions().map((projectKey) => ({ uri: `tandem://projects/${projectKey}/ready-issues`, name: `${projectKey} Ready Issues`, mimeType: "application/json" })) }),
      complete: { projectKey: projectCompletions },
    }),
    { title: "Ready Issues", description: "Issues whose dependencies and required context are satisfied", mimeType: "application/json" },
    async (uri, variables) => {
      const projectKey = String(variables.projectKey);
      requireCapability(actor, "context:read"); requireProjectScope(actor, projectKey);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(runtime.read((service) => service.listReadyIssues(projectKey)), null, 2) }] };
    },
  );

  registerTool(server, "get_project_context", "Read the effective Project baselines, active Cycle, Issues, Sessions, Evidence, and Human Attention. Use this before planning or changing work.", projectKeyInput, ({ projectKey }) => {
    requireCapability(actor, "context:read"); requireProjectScope(actor, projectKey);
    return { data: runtime.read((service) => service.getProjectSnapshot(projectKey)), webUrl: `http://127.0.0.1:4311/projects/${projectKey}` };
  });
  registerTool(server, "list_ready_issues", "List dependency-safe Issues that an onboarded Agent may claim. Ready is calculated by Tandem, not set by the caller.", projectKeyInput, ({ projectKey }) => {
    requireCapability(actor, "context:read"); requireProjectScope(actor, projectKey);
    return { data: runtime.read((service) => service.listReadyIssues(projectKey)), webUrl: `http://127.0.0.1:4311/projects/${projectKey}/work` };
  });
  registerTool(server, "start_session", "Start an Agent Session from an Issue key, Project key, or Git remote and return the mandatory onboarding manifest. Read every required item before confirm_understanding.", startSessionInput, (input) => {
    requireCapability(actor, "execution:write");
    requireProjectScope(actor, runtime.read((service) => service.resolveProjectContext(input).key));
    return mutateWithIdempotency(runtime, idempotency, (service) => service.startSession({ ...input, agentId: actor.id }));
  });
  registerTool(server, "create_project", "Bootstrap a real Project with repository bindings and optional imported delivery Artifacts. Agent imports become proposals until a Human baselines them.", projectBootstrapInput, (input) => {
    requireCapability(actor, "planning:write"); requireProjectScope(actor, input.key);
    return mutateWithIdempotency(runtime, idempotency, (service) => service.createProject({ ...input, actorId: actor.id, actorType: "agent" }));
  });
  registerTool(server, "upsert_artifact_draft", "Create or revise a Product, Design, Data, Test, or Delivery Artifact during a normal Coding Agent conversation. The result is a non-effective working draft.", artifactDraftInput, (input) => {
    requireCapability(actor, "artifact:write"); requireProjectScope(actor, input.projectKey);
    return mutateWithIdempotency(runtime, idempotency, (service) => service.upsertArtifactDraft({ ...input, actorId: actor.id }));
  });
  registerTool(server, "checkpoint_artifact", "Create an immutable semantic checkpoint or Proposal from Artifact content. An Agent cannot silently replace the effective baseline.", artifactCheckpointInput, (input) => {
    requireCapability(actor, "artifact:write"); requireProjectScope(actor, runtime.read((service) => service.getProjectForArtifact(input.artifactId).key));
    return mutateWithIdempotency(runtime, idempotency, (service) => ({
    data: service.checkpointArtifact({ artifactId: input.artifactId, content: input.content, state: input.state, actorType: "agent", actorId: actor.id }),
    permittedNextActions: input.state === "proposed" ? ["request_human_decision"] : ["checkpoint_artifact"],
    warnings: [],
    webUrl: `http://127.0.0.1:4311/artifacts/${input.artifactId}`,
  }));
  });
  registerTool(server, "plan_cycle", "Draft or revise an optional Agile Cycle. A Cycle is a timebox across Issues, not a release. Use request_human_decision for activation when policy requires it.", cyclePlanInput, (input) => { requireCapability(actor, "planning:write"); requireProjectScope(actor, input.projectKey); return mutateWithIdempotency(runtime, idempotency, (service) => service.planCycle({ ...input, actorId: actor.id })); });
  registerTool(server, "create_issue", "Create planned work or capture a Quick Bug, Improvement, or Chore. Tandem calculates missing intake, material-risk promotion, readiness, and Human gates.", createIssueInput, (input) => { requireCapability(actor, "planning:write"); requireProjectScope(actor, input.projectKey); return mutateWithIdempotency(runtime, idempotency, (service) => service.createIssue({ ...input, source: input.source === "human_web" ? "agent_conversation" : input.source, actorId: actor.id, actorType: "agent" })); });
  registerTool(server, "update_issue", "Enrich structured intake, acceptance, affected modules, required Artifacts, or risk flags without replacing the original captured statement.", issueUpdateInput, ({ issueKey, ...input }) => { requireCapability(actor, "planning:write"); requireIssueScope(runtime, actor, issueKey); return mutateWithIdempotency(runtime, idempotency, (service) => service.updateIssue(issueKey, { ...input, actorId: actor.id, actorType: "agent" })); });
  registerTool(server, "add_issue_dependency", "Add a blocker edge to the Issue dependency DAG. Cross-Project, self, and cyclic dependencies are rejected; Quick Work in a dependency plan is promoted.", issueDependencyInput, (input) => { requireCapability(actor, "planning:write"); requireIssueScope(runtime, actor, input.blockerKey); requireIssueScope(runtime, actor, input.blockedKey); return mutateWithIdempotency(runtime, idempotency, (service) => service.addIssueDependency({ ...input, actorId: actor.id })); });
  registerTool(server, "request_human_decision", "Request a material Human product, baseline, Cycle, architecture, risk, experience, or release decision with explicit proposal and risk. The Agent remains the requester, never the Human decision actor.", decisionRequestInput, (input) => { requireCapability(actor, "decision:request"); requireProjectScope(actor, input.projectKey); return mutateWithIdempotency(runtime, idempotency, (service) => service.requestHumanDecision({ ...input, actorId: actor.id })); });
  registerTool(server, "confirm_understanding", "Confirm which Artifact revisions, repository instructions, code anchors, and verification commands were read. This is required before implementation claim.", sessionUnderstandingInput, ({ sessionId, ...input }) => { requireCapability(actor, "execution:write"); requireSessionOwner(runtime, actor, sessionId); return mutateWithIdempotency(runtime, idempotency, (service) => service.confirmUnderstanding(sessionId, input)); });
  registerTool(server, "refresh_session_context", "Refresh session context digest to match the latest project baselines without losing onboarding state.", refreshSessionInput, ({ sessionId }) => { requireCapability(actor, "execution:write"); requireSessionOwner(runtime, actor, sessionId); return mutateWithIdempotency(runtime, idempotency, (service) => service.refreshSessionContext(sessionId)); });
  registerTool(server, "finish_session", "Cleanly complete and close an Agent session after handoff.", finishSessionInput, ({ sessionId, summary }) => { requireCapability(actor, "execution:write"); requireSessionOwner(runtime, actor, sessionId); return mutateWithIdempotency(runtime, idempotency, (service) => service.finishSession(sessionId, summary)); });
  registerTool(server, "claim_issue", "Acquire the one active claim for a Ready Issue after current-context onboarding. Tandem never launches the Agent process.", issueClaimInput, ({ issueKey, ...input }) => { requireCapability(actor, "execution:write"); requireIssueScope(runtime, actor, issueKey); requireSessionOwner(runtime, actor, input.sessionId); return mutateWithIdempotency(runtime, idempotency, (service) => service.claimIssue(issueKey, input)); });
  registerTool(server, "record_checkpoint", "Record a concise semantic implementation checkpoint with decisions and risks. Do not upload raw transcripts or private reasoning.", issueCheckpointInput, ({ issueKey, ...input }) => { requireCapability(actor, "execution:write"); requireIssueScope(runtime, actor, issueKey); requireSessionOwner(runtime, actor, input.sessionId); return mutateWithIdempotency(runtime, idempotency, (service) => service.recordCheckpoint(issueKey, input)); });
  registerTool(server, "attach_evidence", "Attach structured test, build, review, Git, experience, or document evidence to the claimed Issue.", issueEvidenceInput, ({ issueKey, ...input }) => { requireCapability(actor, "execution:write"); requireIssueScope(runtime, actor, issueKey); requireSessionOwner(runtime, actor, input.sessionId); return mutateWithIdempotency(runtime, idempotency, (service) => service.attachEvidence(issueKey, input)); });
  registerTool(server, "submit_handoff", "Submit the durable result summary, changes, validation, risks, and next steps. Quick Bugs require passed regression test evidence.", issueHandoffInput, ({ issueKey, ...input }) => { requireCapability(actor, "execution:write"); requireIssueScope(runtime, actor, issueKey); requireSessionOwner(runtime, actor, input.sessionId); return mutateWithIdempotency(runtime, idempotency, (service) => service.submitHandoff(issueKey, input)); });

  return server;
}

export async function handleMcpRequest(runtime: TandemRuntime, actor: ActorContext, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.method !== "POST") {
    return reply.status(405).send({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  }
  const server = createMcpServer(runtime, actor, mcpIdempotency(request, actor));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  reply.hijack();
  await server.connect(transport);
  try {
    await transport.handleRequest(request.raw, reply.raw, request.body);
  } finally {
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });
  }
}
