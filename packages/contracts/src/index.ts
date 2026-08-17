import { z } from "zod";

export const issueTypes = ["epic", "story", "task", "bug", "improvement", "spike", "chore"] as const;
export type IssueType = (typeof issueTypes)[number];

export const deliveryPaths = ["quick", "planned"] as const;
export type DeliveryPath = (typeof deliveryPaths)[number];

export const issueIntakeSources = ["agent_conversation", "human_web", "import", "integration"] as const;
export type IssueIntakeSource = (typeof issueIntakeSources)[number];

export const materialRiskFlags = [
  "product_scope",
  "public_contract",
  "database_migration",
  "security",
  "privacy",
  "permissions",
  "billing",
  "destructive",
  "release",
  "cross_project",
] as const;
export type MaterialRiskFlag = (typeof materialRiskFlags)[number];
export type RiskClass = "low" | "standard" | "high";

export const issueStates = [
  "backlog",
  "ready",
  "claimed",
  "in_progress",
  "review",
  "verified",
  "done",
  "blocked",
  "cancelled",
] as const;
export type IssueState = (typeof issueStates)[number];

export const artifactTypes = [
  "product_brief",
  "product_spec",
  "project_plan",
  "cycle_plan",
  "system_design",
  "adr",
  "api_contract",
  "data_dictionary",
  "test_plan",
  "e2e_report",
  "experience_review",
  "delivery_summary",
  "retrospective",
] as const;
export type ArtifactType = (typeof artifactTypes)[number];

export type ArtifactRevisionState =
  | "working_draft"
  | "proposed"
  | "baselined"
  | "superseded"
  | "drifted"
  | "archived";

export type SessionState = "onboarding" | "active" | "waiting_human" | "handed_off" | "finished" | "completed";
export type DecisionAuthority =
  | "human_decision"
  | "human_stated"
  | "policy_passed"
  | "agent_recommendation";

export const capabilities = [
  "context:read",
  "artifact:write",
  "planning:write",
  "execution:write",
  "decision:request",
  "decision:resolve",
  "identity:admin",
] as const;
export type Capability = (typeof capabilities)[number];

export interface ActorContext {
  id: string;
  type: "human" | "agent";
  displayName: string;
  roles: string[];
  projectKeys: string[];
  capabilities: Capability[];
  development: boolean;
}

export interface RepositoryBinding {
  provider: "github" | "gitlab" | "bitbucket" | "other";
  host: string;
  owner: string;
  name: string;
  defaultBranch: string;
  remoteUrl?: string | undefined;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  goal: string;
  successMeasures: string[];
  nonGoals: string[];
  owner: string;
  health: "on_track" | "at_risk" | "off_track";
  targetDate: string;
  repository: RepositoryBinding;
  repositories?: RepositoryBinding[];
  policyProfile?: "standard";
  currentMilestoneId?: string;
  activeCycleId?: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  targetDate: string;
  state: "planned" | "active" | "reached" | "cancelled";
}

export interface Cycle {
  id: string;
  projectId: string;
  number: number;
  name: string;
  goal: string;
  startsOn: string;
  endsOn: string;
  state: "draft" | "proposed" | "active" | "completed" | "cancelled";
  definitionOfDone: string[];
  planRevision: number;
  planDigest: string;
}

export interface Issue {
  id: string;
  key: string;
  projectId: string;
  cycleId?: string;
  milestoneId?: string;
  parentId?: string;
  type: IssueType;
  deliveryPath: DeliveryPath;
  intake: {
    source: IssueIntakeSource;
    sourceReference?: string;
    originalStatement: string;
    capturedBy: { actorType: "human" | "agent" | "system"; actorId: string };
    capturedAt: string;
    details: QuickWorkDetails;
  };
  risk: { class: RiskClass; flags: MaterialRiskFlag[]; requiredDecisionId?: string };
  promotion?: {
    promotedAt: string;
    promotedBy: { actorType: "human" | "agent" | "system"; actorId: string };
    reasons: string[];
    requiredDecisionId?: string;
  };
  title: string;
  description: string;
  acceptanceCriteria: string[];
  baseState: IssueState;
  displayState: IssueState;
  blockedBy: string[];
  readinessReasons: string[];
  requiredArtifactIds: string[];
  affectedModules: string[];
  version: number;
  activeClaim?: IssueClaim;
}

export interface IssueClaim {
  sessionId: string;
  agentId: string;
  claimedAt: string;
  branch?: string;
  worktree?: string;
}

export interface QuickWorkDetails {
  observedBehavior?: string | undefined;
  expectedBehavior?: string | undefined;
  reproductionContext?: string | undefined;
  impact?: string | undefined;
  currentFriction?: string | undefined;
  desiredOutcome?: string | undefined;
  maintenanceOutcome?: string | undefined;
  verificationMethod?: string | undefined;
}

export interface Artifact {
  id: string;
  projectId: string;
  type: ArtifactType;
  title: string;
  effectiveRevisionId?: string;
  revisionIds: string[];
}

export interface ArtifactRevision {
  id: string;
  artifactId: string;
  revision: number;
  state: ArtifactRevisionState;
  content: string;
  digest: string;
  storageMode: "tandem_draft" | "git_backed" | "external";
  createdBy: { actorType: "human" | "agent" | "system"; actorId: string };
  createdAt: string;
  git?: { repository: string; path: string; commit: string; blob: string };
}

export interface ContextItem {
  id: string;
  kind: "artifact" | "repository_document" | "code_anchor" | "verification_command";
  label: string;
  locator: string;
  digest?: string;
  required: boolean;
}

export interface AgentSession {
  id: string;
  agentId: string;
  projectId: string;
  issueId?: string;
  state: SessionState;
  contextDigest: string;
  contextItems: ContextItem[];
  confirmedAt?: string;
  understanding?: string;
  intendedChanges?: string[];
  openQuestions?: string[];
  stale: boolean;
  startedAt: string;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  issueId: string;
  summary: string;
  decisions: string[];
  risks: string[];
  createdAt: string;
}

export interface Evidence {
  id: string;
  issueId: string;
  sessionId: string;
  type: "test" | "build" | "review" | "git" | "experience" | "document";
  title: string;
  result: "passed" | "failed" | "informational";
  uri?: string;
  summary: string;
  observedAt: string;
}

export interface Handoff {
  id: string;
  issueId: string;
  sessionId: string;
  summary: string;
  changes: string[];
  validation: string[];
  risks: string[];
  nextSteps: string[];
  createdAt: string;
}

export interface Activity {
  id: string;
  actorType: "human" | "agent" | "system";
  actorId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  summary: string;
  occurredAt: string;
}

export interface GitArtifact {
  id: string;
  repository: string;
  kind: "branch" | "commit" | "pull_request" | "check";
  externalId: string;
  issueKey: string;
  sessionId?: string;
  title: string;
  url?: string;
  state: string;
  updatedAt: string;
}

export interface StateEvent {
  id: number;
  type: string;
  subjectIds: string[];
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AttentionItem {
  id: string;
  projectId: string;
  kind: "decision" | "blocked" | "stale_context" | "drift" | "evidence";
  severity: "info" | "warning" | "critical";
  title: string;
  summary: string;
  subjectType: string;
  subjectId: string;
}

export interface DecisionRequest {
  id: string;
  projectId: string;
  sessionId?: string;
  subjectType: "project" | "cycle" | "issue" | "artifact_revision" | "experience" | "release";
  subjectId: string;
  kind: "product_scope" | "artifact_baseline" | "cycle_activation" | "architecture" | "risk" | "experience" | "release";
  question: string;
  proposal: string;
  risk: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "changes_requested" | "cancelled";
  requestedBy: { actorType: "agent" | "human"; actorId: string };
  requestedAt: string;
  decidedBy?: string;
  rationale?: string;
  decidedAt?: string;
}

export interface ProjectSnapshot {
  project: Project;
  milestone?: Milestone;
  cycle?: Cycle;
  cycles: Cycle[];
  artifacts: Array<Artifact & { effectiveRevision?: ArtifactRevision; proposedRevision?: ArtifactRevision }>;
  issues: Issue[];
  sessions: AgentSession[];
  evidence: Evidence[];
  handoffs: Handoff[];
  decisionRequests: DecisionRequest[];
  attention: AttentionItem[];
  activities: Activity[];
  gitArtifacts?: GitArtifact[];
}

export const startSessionInput = z.object({
  issueKey: z.string().min(2).optional(),
  projectKey: z.string().min(2).optional(),
  gitRemote: z.string().min(3).optional(),
}).refine((value) => value.issueKey || value.projectKey || value.gitRemote, {
  message: "Provide issueKey, projectKey, or gitRemote",
});
export type StartSessionInput = z.infer<typeof startSessionInput>;

export const confirmUnderstandingInput = z.object({
  readContextItemIds: z.array(z.string()).min(1),
  understanding: z.string().min(20),
  intendedChanges: z.array(z.string()).min(1),
  openQuestions: z.array(z.string()).default([]),
});
export type ConfirmUnderstandingInput = z.infer<typeof confirmUnderstandingInput>;

export const claimIssueInput = z.object({
  sessionId: z.string().min(1),
  branch: z.string().min(1).optional(),
  worktree: z.string().min(1).optional(),
});
export type ClaimIssueInput = z.infer<typeof claimIssueInput>;

export const checkpointInput = z.object({
  sessionId: z.string().min(1),
  summary: z.string().min(10),
  decisions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});
export type CheckpointInput = z.infer<typeof checkpointInput>;

export const evidenceInput = z.object({
  sessionId: z.string().min(1),
  type: z.enum(["test", "build", "review", "git", "experience", "document"]),
  title: z.string().min(3),
  result: z.enum(["passed", "failed", "informational"]),
  uri: z.string().url().optional(),
  summary: z.string().min(5),
});
export type EvidenceInput = z.infer<typeof evidenceInput>;

export const handoffInput = z.object({
  sessionId: z.string().min(1),
  summary: z.string().min(20),
  changes: z.array(z.string()).min(1),
  validation: z.array(z.string()).min(1),
  risks: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
});
export type HandoffInput = z.infer<typeof handoffInput>;

export const artifactDraftInput = z.object({
  projectKey: z.string().min(2),
  artifactId: z.string().min(1).optional(),
  type: z.enum(artifactTypes),
  title: z.string().min(3),
  content: z.string().min(20),
});
export type ArtifactDraftInput = z.infer<typeof artifactDraftInput>;

export const artifactCheckpointInput = z.object({
  artifactId: z.string().min(1),
  content: z.string().min(20),
  state: z.enum(["working_draft", "proposed"]),
});
export type ArtifactCheckpointInput = z.infer<typeof artifactCheckpointInput>;

export const refreshSessionInput = z.object({
  sessionId: z.string().min(1),
});
export type RefreshSessionInput = z.infer<typeof refreshSessionInput>;

export const finishSessionInput = z.object({
  sessionId: z.string().min(1),
  summary: z.string().min(5).optional(),
});
export type FinishSessionInput = z.infer<typeof finishSessionInput>;

export const cyclePlanInput = z.object({
  projectKey: z.string().min(2),
  name: z.string().min(3),
  goal: z.string().min(10),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  definitionOfDone: z.array(z.string().min(3)).min(1),
  state: z.enum(["draft", "proposed", "active"]).default("proposed"),
});
export type CyclePlanInput = z.infer<typeof cyclePlanInput>;

export const quickWorkDetailsInput = z.object({
  observedBehavior: z.string().min(3).optional(),
  expectedBehavior: z.string().min(3).optional(),
  reproductionContext: z.string().min(3).optional(),
  impact: z.string().min(3).optional(),
  currentFriction: z.string().min(3).optional(),
  desiredOutcome: z.string().min(3).optional(),
  maintenanceOutcome: z.string().min(3).optional(),
  verificationMethod: z.string().min(3).optional(),
});

export const createIssueInput = z.object({
  projectKey: z.string().min(2),
  cycleId: z.string().min(1).optional(),
  milestoneId: z.string().min(1).optional(),
  parentKey: z.string().min(2).optional(),
  type: z.enum(issueTypes),
  deliveryPath: z.enum(deliveryPaths).default("planned"),
  source: z.enum(issueIntakeSources).default("agent_conversation"),
  sourceReference: z.string().min(3).optional(),
  originalStatement: z.string().min(3).optional(),
  details: quickWorkDetailsInput.default({}),
  riskFlags: z.array(z.enum(materialRiskFlags)).default([]),
  title: z.string().min(3),
  description: z.string().min(3),
  acceptanceCriteria: z.array(z.string().min(3)).default([]),
  requiredArtifactIds: z.array(z.string()).default([]),
  affectedModules: z.array(z.string()).default([]),
}).superRefine((value, context) => {
  if (value.deliveryPath === "quick" && !(["bug", "improvement", "chore"] as IssueType[]).includes(value.type)) {
    context.addIssue({ code: "custom", path: ["type"], message: "Quick Work type must be Bug, Improvement, or Chore" });
  }
  if (value.deliveryPath === "planned" && value.acceptanceCriteria.length === 0) {
    context.addIssue({ code: "custom", path: ["acceptanceCriteria"], message: "Planned work requires at least one acceptance criterion" });
  }
});
export type CreateIssueInput = z.infer<typeof createIssueInput>;

export const updateIssueInput = z.object({
  description: z.string().min(3).optional(),
  acceptanceCriteria: z.array(z.string().min(3)).optional(),
  details: quickWorkDetailsInput.optional(),
  riskFlags: z.array(z.enum(materialRiskFlags)).optional(),
  requiredArtifactIds: z.array(z.string()).optional(),
  affectedModules: z.array(z.string()).optional(),
});
export type UpdateIssueInput = z.infer<typeof updateIssueInput>;

export const issueDependencyInput = z.object({
  blockerKey: z.string().min(2),
  blockedKey: z.string().min(2),
});
export type IssueDependencyInput = z.infer<typeof issueDependencyInput>;

export const decisionRequestInput = z.object({
  projectKey: z.string().min(2),
  sessionId: z.string().min(1).optional(),
  subjectType: z.enum(["project", "cycle", "issue", "artifact_revision", "experience", "release"]),
  subjectId: z.string().min(1),
  kind: z.enum(["product_scope", "artifact_baseline", "cycle_activation", "architecture", "risk", "experience", "release"]),
  question: z.string().min(10),
  proposal: z.string().min(10),
  risk: z.enum(["low", "medium", "high", "critical"]),
});
export type DecisionRequestInput = z.infer<typeof decisionRequestInput>;

export const decisionInput = z.object({
  outcome: z.enum(["approved", "rejected", "changes_requested"]),
  rationale: z.string().min(5),
});
export type DecisionInput = z.infer<typeof decisionInput>;

export const issueReviewInput = z.object({
  outcome: z.enum(["approved", "changes_requested"]),
  rationale: z.string().min(5),
});
export type IssueReviewInput = z.infer<typeof issueReviewInput>;

export const repositoryBindingInput = z.object({
  provider: z.enum(["github", "gitlab", "bitbucket", "other"]).default("github"),
  host: z.string().min(3).default("github.com"),
  owner: z.string().min(1),
  name: z.string().min(1),
  defaultBranch: z.string().min(1).default("main"),
  remoteUrl: z.string().min(3).optional(),
});

const projectArtifactImportInput = z.object({
  type: z.enum(artifactTypes),
  title: z.string().min(3),
  content: z.string().min(20),
  storageMode: z.enum(["tandem_draft", "git_backed", "external"]).default("tandem_draft"),
  git: z.object({ path: z.string().min(1), commit: z.string().min(1), blob: z.string().min(1) }).optional(),
}).superRefine((value, context) => {
  if (value.storageMode === "git_backed" && !value.git) {
    context.addIssue({ code: "custom", path: ["git"], message: "Git-backed imports require path, commit, and blob" });
  }
});

export const projectBootstrapInput = z.object({
  key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,7}$/, "Use 2–8 uppercase letters or numbers, starting with a letter"),
  name: z.string().min(3),
  goal: z.string().min(10),
  owner: z.string().min(2),
  targetDate: z.iso.date(),
  successMeasures: z.array(z.string().min(3)).default([]),
  nonGoals: z.array(z.string().min(3)).default([]),
  repositories: z.array(repositoryBindingInput).min(1),
  artifacts: z.array(projectArtifactImportInput).default([]),
});
export type ProjectBootstrapInput = z.infer<typeof projectBootstrapInput>;

export interface ProjectBootstrapResult {
  project: Project;
  artifacts: Artifact[];
  readiness: {
    readyForAgentOnboarding: boolean;
    warnings: string[];
  };
}

export interface CommandResult<T> {
  data: T;
  permittedNextActions: string[];
  warnings: string[];
  webUrl: string;
}

export type CredentialKind = "password" | "access_token" | "web_session";
export type PrincipalStatus = "active" | "deactivated";
export type CredentialStatus = "active" | "revoked" | "expired";

export interface PrincipalRecord {
  id: string;
  type: "human" | "agent";
  username?: string;
  displayName: string;
  status: PrincipalStatus;
  roles: string[];
  projectKeys: string[];
  capabilities: Capability[];
  createdAt: string;
}

export interface PrincipalCredentialRecord {
  id: string;
  principalId: string;
  kind: CredentialKind;
  label: string;
  status: CredentialStatus;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface WebSessionRecord {
  id: string;
  principalId: string;
  createdAt: string;
  expiresAt: string;
}

export const createHumanInput = z.object({
  username: z.string().trim().toLowerCase().min(3).max(32).regex(/^[a-z0-9_.-]+$/, "Username must contain only lowercase letters, numbers, underscores, dots, or hyphens"),
  displayName: z.string().min(2),
  password: z.string().min(12).max(128),
  roles: z.array(z.string()).default(["team_member"]),
  projectKeys: z.array(z.string()).min(1).default(["*"]),
  capabilities: z.array(z.enum(capabilities)).default(["context:read", "artifact:write", "planning:write", "execution:write", "decision:request"]),
});
export type CreateHumanInput = z.infer<typeof createHumanInput>;

export const createAgentInput = z.object({
  displayName: z.string().min(2),
  roles: z.array(z.string()).default(["coding_agent"]),
  projectKeys: z.array(z.string()).min(1),
  capabilities: z.array(z.enum(capabilities)).default(["context:read", "artifact:write", "planning:write", "execution:write", "decision:request"]),
  tokenLabel: z.string().min(1).default("Primary Agent Token"),
  expiresInDays: z.number().positive().optional(),
});
export type CreateAgentInput = z.infer<typeof createAgentInput>;

export const setPasswordInput = z.object({
  password: z.string().min(12).max(128),
});
export type SetPasswordInput = z.infer<typeof setPasswordInput>;

export const issueTokenInput = z.object({
  label: z.string().min(1),
  expiresInDays: z.number().positive().optional(),
});
export type IssueTokenInput = z.infer<typeof issueTokenInput>;

export const updatePrincipalInput = z.object({
  displayName: z.string().min(2).optional(),
  roles: z.array(z.string()).optional(),
  projectKeys: z.array(z.string()).optional(),
  capabilities: z.array(z.enum(capabilities)).optional(),
});
export type UpdatePrincipalInput = z.infer<typeof updatePrincipalInput>;

export const loginPasswordInput = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});
export type LoginPasswordInput = z.infer<typeof loginPasswordInput>;

export const loginTokenInput = z.object({
  token: z.string().min(1),
});
export type LoginTokenInput = z.infer<typeof loginTokenInput>;

export interface OneTimeCredentialResponse<T> {
  data: T;
  secret: string;
  warning: string;
}
