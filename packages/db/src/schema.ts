import { bigint, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const tandemStates = pgTable("tandem_states", {
  workspaceId: text("workspace_id").primaryKey(),
  revision: bigint("revision", { mode: "number" }).notNull(),
  state: jsonb("state_json").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  targetDate: date("target_date", { mode: "string" }).notNull(),
  payload: jsonb("payload").notNull(),
}, (table) => [uniqueIndex("projects_workspace_key_uq").on(table.workspaceId, table.key)]);

export const projectRepositoryBindings = pgTable("project_repository_bindings", {
  projectId: text("project_id").notNull(),
  provider: text("provider").notNull(),
  host: text("host").notNull(),
  owner: text("repository_owner").notNull(),
  name: text("repository_name").notNull(),
  defaultBranch: text("default_branch").notNull(),
  remoteUrl: text("remote_url"),
  payload: jsonb("payload").notNull(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.host, table.owner, table.name] }),
  uniqueIndex("project_repository_identity_uq").on(table.host, table.owner, table.name),
  index("project_repository_project_idx").on(table.projectId),
]);

export const milestones = pgTable("milestones", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), state: text("state").notNull(), payload: jsonb("payload").notNull(),
}, (table) => [index("milestones_project_idx").on(table.projectId)]);

export const cycles = pgTable("cycles", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), number: integer("number").notNull(), state: text("state").notNull(), planRevision: integer("plan_revision").notNull(), payload: jsonb("payload").notNull(),
}, (table) => [uniqueIndex("cycles_project_number_uq").on(table.projectId, table.number)]);

export const issues = pgTable("issues", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), key: text("key").notNull().unique(), parentId: text("parent_id"), cycleId: text("cycle_id"), type: text("issue_type").notNull(), deliveryPath: text("delivery_path").notNull(), intakeSource: text("intake_source").notNull(), riskClass: text("risk_class").notNull(), state: text("state").notNull(), version: integer("version").notNull(), payload: jsonb("payload").notNull(),
}, (table) => [index("issues_project_state_idx").on(table.projectId, table.state)]);

export const issueDependencies = pgTable("issue_dependencies", {
  blockerId: text("blocker_id").notNull(), blockedId: text("blocked_id").notNull(),
}, (table) => [primaryKey({ columns: [table.blockerId, table.blockedId] })]);

export const artifacts = pgTable("artifacts", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), type: text("type").notNull(), effectiveRevisionId: text("effective_revision_id"), payload: jsonb("payload").notNull(),
}, (table) => [index("artifacts_project_idx").on(table.projectId)]);

export const artifactRevisions = pgTable("artifact_revisions", {
  id: text("id").primaryKey(), artifactId: text("artifact_id").notNull(), revision: integer("revision").notNull(), state: text("state").notNull(), digest: text("digest").notNull(), payload: jsonb("payload").notNull(),
}, (table) => [uniqueIndex("artifact_revisions_number_uq").on(table.artifactId, table.revision)]);

export const agentSessions = pgTable("agent_sessions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), issueId: text("issue_id"), agentId: text("agent_id").notNull(), state: text("state").notNull(), contextDigest: text("context_digest").notNull(), payload: jsonb("payload").notNull(),
}, (table) => [index("agent_sessions_project_state_idx").on(table.projectId, table.state)]);

export const issueClaims = pgTable("issue_claims", {
  issueId: text("issue_id").primaryKey(), sessionId: text("session_id").notNull().unique(), agentId: text("agent_id").notNull(), claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "string" }).notNull(), payload: jsonb("payload").notNull(),
});

export const checkpoints = pgTable("checkpoints", {
  id: text("id").primaryKey(), issueId: text("issue_id").notNull(), sessionId: text("session_id").notNull(), payload: jsonb("payload").notNull(),
});

export const evidence = pgTable("evidence", {
  id: text("id").primaryKey(), issueId: text("issue_id").notNull(), sessionId: text("session_id").notNull(), result: text("result").notNull(), payload: jsonb("payload").notNull(),
});

export const handoffs = pgTable("handoffs", {
  id: text("id").primaryKey(), issueId: text("issue_id").notNull(), sessionId: text("session_id").notNull(), payload: jsonb("payload").notNull(),
});

export const decisionRequests = pgTable("decision_requests", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull(), sessionId: text("session_id"), status: text("status").notNull(), risk: text("risk").notNull(), payload: jsonb("payload").notNull(),
}, (table) => [index("decision_requests_project_status_idx").on(table.projectId, table.status)]);

export const activities = pgTable("activities", {
  id: text("id").primaryKey(), actorType: text("actor_type").notNull(), actorId: text("actor_id").notNull(), action: text("action").notNull(), subjectType: text("subject_type").notNull(), subjectId: text("subject_id").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).notNull(), payload: jsonb("payload").notNull(),
}, (table) => [index("activities_occurred_idx").on(table.occurredAt)]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  principalId: text("principal_id").notNull(), key: text("key").notNull(), requestHash: text("request_hash").notNull(), statusCode: integer("status_code").notNull(), response: jsonb("response_json").notNull(), createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [primaryKey({ columns: [table.principalId, table.key] })]);

export const principals = pgTable("principals", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  username: text("username").unique(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull(),
  roles: jsonb("roles").notNull(),
  projectKeys: jsonb("project_keys").notNull(),
  capabilities: jsonb("capabilities").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const principalCredentials = pgTable("principal_credentials", {
  id: text("id").primaryKey(),
  principalId: text("principal_id").notNull(),
  kind: text("kind").notNull().default("access_token"),
  label: text("label").notNull().default("Token"),
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [index("principal_credentials_principal_idx").on(table.principalId)]);

export const webSessions = pgTable("web_sessions", {
  id: text("id").primaryKey(),
  principalId: text("principal_id").notNull(),
  sessionHash: text("session_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [index("web_sessions_principal_idx").on(table.principalId)]);

export const stateEvents = pgTable("state_events", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  eventType: text("event_type").notNull(),
  subjectIds: jsonb("subject_ids").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const githubWebhookDeliveries = pgTable("github_webhook_deliveries", {
  deliveryId: text("delivery_id").primaryKey(),
  eventName: text("event_name").notNull(),
  payloadDigest: text("payload_digest").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true, mode: "string" }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),
  status: text("status").notNull(),
  error: text("error"),
});

export const gitArtifacts = pgTable("git_artifacts", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  repository: text("repository").notNull(),
  kind: text("kind").notNull(),
  externalId: text("external_id").notNull(),
  issueKey: text("issue_key").notNull(),
  sessionId: text("session_id"),
  title: text("title").notNull(),
  url: text("url"),
  state: text("state").notNull(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [uniqueIndex("git_artifacts_correlation_uq").on(table.repository, table.kind, table.externalId, table.issueKey), index("git_artifacts_issue_idx").on(table.issueKey, table.updatedAt)]);
