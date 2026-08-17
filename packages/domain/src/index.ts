import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt:v1:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
  const salt = parts[2]!;
  const hash = parts[3]!;
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derivedKey, "hex"));
}
import type {
  Activity,
  AgentSession,
  Artifact,
  ArtifactDraftInput,
  ArtifactRevision,
  ArtifactRevisionState,
  ArtifactType,
  AttentionItem,
  Checkpoint,
  CheckpointInput,
  ClaimIssueInput,
  CommandResult,
  ConfirmUnderstandingInput,
  ContextItem,
  Cycle,
  CyclePlanInput,
  CreateIssueInput,
  DecisionInput,
  DecisionRequest,
  DecisionRequestInput,
  DecisionAuthority,
  Evidence,
  EvidenceInput,
  Handoff,
  HandoffInput,
  Issue,
  IssueDependencyInput,
  IssueReviewInput,
  MaterialRiskFlag,
  Milestone,
  Project,
  ProjectBootstrapInput,
  ProjectBootstrapResult,
  ProjectSnapshot,
  QuickWorkDetails,
  RepositoryBinding,
  StartSessionInput,
  PrincipalCredentialRecord,
  PrincipalRecord,
  PrincipalStatus,
  WebSessionRecord,
  CreateHumanInput,
  CreateAgentInput,
  SetPasswordInput,
  IssueTokenInput,
  UpdateIssueInput,
  UpdatePrincipalInput,
  OneTimeCredentialResponse,
} from "@tandem/contracts";

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 409,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export interface TandemState {
  projects: Project[];
  milestones: Milestone[];
  cycles: Cycle[];
  issues: Issue[];
  artifacts: Artifact[];
  revisions: ArtifactRevision[];
  sessions: AgentSession[];
  checkpoints: Checkpoint[];
  evidence: Evidence[];
  handoffs: Handoff[];
  activities: Activity[];
  decisionRequests: DecisionRequest[];
  principals?: PrincipalRecord[];
  credentials?: PrincipalCredentialRecord[];
  webSessions?: WebSessionRecord[];
}

interface NewArtifactRevision {
  artifactId: string;
  content: string;
  state: Extract<ArtifactRevisionState, "working_draft" | "proposed" | "baselined">;
  actorType: "human" | "agent";
  actorId: string;
  storageMode?: "tandem_draft" | "git_backed" | "external";
  git?: ArtifactRevision["git"];
}

type CreateIssueCommandInput = Omit<CreateIssueInput, "deliveryPath" | "source" | "details" | "riskFlags"> &
  Partial<Pick<CreateIssueInput, "deliveryPath" | "source" | "details" | "riskFlags">>;

const now = () => new Date().toISOString();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const clone = <T>(value: T): T => structuredClone(value);

function repositoryIdentity(binding: RepositoryBinding): string {
  return `${binding.host.toLowerCase()}/${binding.owner.toLowerCase()}/${binding.name.toLowerCase().replace(/\.git$/, "")}`;
}

function normalizeRepositoryBinding(binding: RepositoryBinding): RepositoryBinding {
  const legacy = binding as RepositoryBinding & { provider?: RepositoryBinding["provider"]; host?: string; defaultBranch?: string };
  let inferredHost: string | undefined;
  if (legacy.remoteUrl) inferredHost = remoteIdentity(legacy.remoteUrl)?.split("/")[0];
  const host = legacy.host || inferredHost || "github.com";
  const provider = legacy.provider ?? (host === "github.com" ? "github" : host === "gitlab.com" ? "gitlab" : host === "bitbucket.org" ? "bitbucket" : "other");
  return { ...legacy, provider, host, defaultBranch: legacy.defaultBranch || "main" };
}

function remoteIdentity(remote: string): string | undefined {
  const trimmed = remote.trim().replace(/\.git\/?$/, "").replace(/\/$/, "");
  const ssh = trimmed.match(/^[^@]+@([^:]+):([^/]+)\/(.+)$/);
  if (ssh) return `${ssh[1]?.toLowerCase()}/${ssh[2]?.toLowerCase()}/${ssh[3]?.toLowerCase()}`;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const [owner, name] = url.pathname.replace(/^\//, "").split("/");
    if (!owner || !name) return undefined;
    return `${url.hostname.toLowerCase()}/${owner.toLowerCase()}/${name.toLowerCase()}`;
  } catch {
    return undefined;
  }
}

function projectRepositories(project: Project): RepositoryBinding[] {
  return project.repositories?.length ? project.repositories : [project.repository];
}

function quickWorkMissingFields(type: Issue["type"], details: QuickWorkDetails, acceptanceCriteria: string[]): string[] {
  if (type === "bug") {
    return [
      !details.observedBehavior && "observed behavior",
      !details.expectedBehavior && "expected behavior",
      !details.reproductionContext && "reproduction context",
      !details.verificationMethod && "regression verification method",
      acceptanceCriteria.length === 0 && "acceptance criteria",
    ].filter((item): item is string => Boolean(item));
  }
  if (type === "improvement") {
    return [
      !details.currentFriction && "current friction",
      !details.desiredOutcome && "desired outcome",
      !details.verificationMethod && "before/after verification method",
      acceptanceCriteria.length === 0 && "acceptance criteria",
    ].filter((item): item is string => Boolean(item));
  }
  if (type === "chore") {
    return [
      !details.maintenanceOutcome && "maintenance outcome",
      !details.verificationMethod && "verification method",
      acceptanceCriteria.length === 0 && "acceptance criteria",
    ].filter((item): item is string => Boolean(item));
  }
  return [];
}

function riskLabel(flag: MaterialRiskFlag): string {
  return flag.replaceAll("_", " ");
}

export class TandemService {
  listPrincipals(): PrincipalRecord[] {
    return clone(this.store.principals ?? []);
  }

  getPrincipal(id: string): PrincipalRecord {
    let p = (this.store.principals ?? []).find((item) => item.id === id || item.username?.toLowerCase() === id.toLowerCase());
    if (!p) {
      if (id === "pilot-owner" || id.toLowerCase() === "owner") {
        p = {
          id: "pilot-owner", type: "human", username: "owner", displayName: "Pilot Owner", status: "active",
          roles: ["owner"], projectKeys: ["*"],
          capabilities: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request", "decision:resolve", "identity:admin"],
          createdAt: "2026-08-04T14:00:00.000Z",
        };
      } else if (id === "pilot-agent") {
        p = {
          id: "pilot-agent", type: "agent", displayName: "Pilot Coding Agent", status: "active",
          roles: ["coding_agent"], projectKeys: ["*"],
          capabilities: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request"],
          createdAt: "2026-08-04T14:00:00.000Z",
        };
      }
      if (p) (this.store.principals ??= []).push(p);
    }
    if (!p) throw new DomainError("PRINCIPAL_NOT_FOUND", `Principal ${id} was not found`, 404);
    return clone(p);
  }

  listCredentials(principalId: string): PrincipalCredentialRecord[] {
    this.getPrincipal(principalId);
    const list = clone((this.store.credentials ?? []).filter((c) => c.principalId === principalId));
    for (const c of list) {
      delete (c as unknown as { tokenHash?: string }).tokenHash;
    }
    return list;
  }

  createHuman(input: CreateHumanInput, actorId: string): OneTimeCredentialResponse<PrincipalRecord> {
    const principals = this.store.principals ??= [];
    const credentials = this.store.credentials ??= [];
    const normalizedUsername = input.username.trim().toLowerCase();
    if (principals.some((p) => p.username?.toLowerCase() === normalizedUsername)) {
      throw new DomainError("USERNAME_CONFLICT", `Username ${normalizedUsername} is already taken`, 409);
    }
    const principal: PrincipalRecord = {
      id: randomUUID(),
      type: "human",
      username: normalizedUsername,
      displayName: input.displayName,
      status: "active",
      roles: clone(input.roles),
      projectKeys: clone(input.projectKeys),
      capabilities: clone(input.capabilities),
      createdAt: now(),
    };
    principals.push(principal);

    const credentialId = randomUUID();
    const tokenHash = digest(hashPassword(input.password));
    const cred: PrincipalCredentialRecord = {
      id: credentialId,
      principalId: principal.id,
      kind: "password",
      label: "Password",
      status: "active",
      createdAt: now(),
    };
    // Store password verifier in tokenHash field for file state storage consistency
    (cred as unknown as { tokenHash: string }).tokenHash = hashPassword(input.password);
    credentials.push(cred);

    this.record("human", actorId, "principal.created", "principal", principal.id, `Created Human ${principal.displayName} (${principal.username})`);
    return {
      data: clone(principal),
      secret: input.password,
      warning: "Copy password now. It will never be displayed again.",
    };
  }

  createAgent(input: CreateAgentInput, actorId: string): OneTimeCredentialResponse<PrincipalRecord> {
    const principals = this.store.principals ??= [];
    const credentials = this.store.credentials ??= [];
    const rawSecret = `tan_agent_${randomBytes(24).toString("hex")}`;

    const principal: PrincipalRecord = {
      id: randomUUID(),
      type: "agent",
      displayName: input.displayName,
      status: "active",
      roles: clone(input.roles),
      projectKeys: clone(input.projectKeys),
      capabilities: clone(input.capabilities),
      createdAt: now(),
    };
    principals.push(principal);

    const cred: PrincipalCredentialRecord = {
      id: randomUUID(),
      principalId: principal.id,
      kind: "access_token",
      label: input.tokenLabel,
      status: "active",
      ...(input.expiresInDays ? { expiresAt: new Date(Date.now() + input.expiresInDays * 86400 * 1000).toISOString() } : {}),
      createdAt: now(),
    };
    (cred as unknown as { tokenHash: string }).tokenHash = digest(rawSecret);
    credentials.push(cred);

    this.record("human", actorId, "principal.created", "principal", principal.id, `Created Agent ${principal.displayName}`);
    return {
      data: clone(principal),
      secret: rawSecret,
      warning: "Copy this Agent access token now. It will never be displayed again.",
    };
  }

  authenticatePassword(usernameInput: string, passwordInput: string): PrincipalRecord {
    const normalized = usernameInput.trim().toLowerCase();
    const principal = (this.store.principals ?? []).find((p) => p.username?.toLowerCase() === normalized && p.status === "active");
    if (!principal || principal.type !== "human") throw new DomainError("INVALID_CREDENTIALS", "Invalid username or password", 401);
    const cred = (this.store.credentials ?? []).find((c) => c.principalId === principal.id && c.kind === "password" && c.status === "active");
    if (!cred) throw new DomainError("INVALID_CREDENTIALS", "Invalid username or password", 401);
    const storedHash = (cred as unknown as { tokenHash: string }).tokenHash;
    if (!storedHash || !verifyPassword(passwordInput, storedHash)) throw new DomainError("INVALID_CREDENTIALS", "Invalid username or password", 401);
    return clone(principal);
  }

  authenticateTokenInState(tokenInput: string): PrincipalRecord | undefined {
    // Check web sessions first
    const sessionHash = digest(tokenInput);
    const session = (this.store.webSessions ?? []).find((s) => (s as unknown as { sessionHash: string }).sessionHash === sessionHash && s.expiresAt > now());
    if (session) {
      const principal = (this.store.principals ?? []).find((p) => p.id === session.principalId && p.status === "active");
      if (principal) return clone(principal);
    }
    // Check access tokens
    const tokenHash = digest(tokenInput);
    const cred = (this.store.credentials ?? []).find((c) => (c as unknown as { tokenHash: string }).tokenHash === tokenHash && c.kind === "access_token" && c.status === "active" && (!c.expiresAt || c.expiresAt > now()));
    if (!cred) return undefined;
    const principal = (this.store.principals ?? []).find((p) => p.id === cred.principalId && p.status === "active");
    return principal ? clone(principal) : undefined;
  }

  setHumanPassword(principalId: string, password: string, actorId: string): void {
    const principal = this.getPrincipal(principalId);
    if (principal.type !== "human") throw new DomainError("INVALID_PRINCIPAL_TYPE", "Only Human principals can have a password");
    const credentials = this.store.credentials ??= [];
    const existing = credentials.find((c) => c.principalId === principal.id && c.kind === "password");
    const hashedPassword = hashPassword(password);
    if (existing) {
      existing.status = "active";
      (existing as unknown as { tokenHash: string }).tokenHash = hashedPassword;
    } else {
      const cred: PrincipalCredentialRecord = {
        id: randomUUID(),
        principalId: principal.id,
        kind: "password",
        label: "Password",
        status: "active",
        createdAt: now(),
      };
      (cred as unknown as { tokenHash: string }).tokenHash = hashedPassword;
      credentials.push(cred);
    }
    this.record("human", actorId, "principal.password_set", "principal", principal.id, `Updated password for ${principal.displayName}`);
  }

  issueToken(principalId: string, input: IssueTokenInput, actorId: string): OneTimeCredentialResponse<PrincipalCredentialRecord> {
    const principal = this.getPrincipal(principalId);
    const credentials = this.store.credentials ??= [];
    const prefix = principal.type === "agent" ? "tan_agent_" : "tan_pat_";
    const rawSecret = `${prefix}${randomBytes(24).toString("hex")}`;
    const cred: PrincipalCredentialRecord = {
      id: randomUUID(),
      principalId: principal.id,
      kind: "access_token",
      label: input.label,
      status: "active",
      ...(input.expiresInDays ? { expiresAt: new Date(Date.now() + input.expiresInDays * 86400 * 1000).toISOString() } : {}),
      createdAt: now(),
    };
    (cred as unknown as { tokenHash: string }).tokenHash = digest(rawSecret);
    credentials.push(cred);

    this.record("human", actorId, "credential.issued", "principal", principal.id, `Issued token ${input.label} for ${principal.displayName}`);
    return {
      data: clone(cred),
      secret: rawSecret,
      warning: "Copy access token now. It will never be displayed again.",
    };
  }

  revokeCredential(credentialId: string, actorId: string): void {
    const credentials = this.store.credentials ??= [];
    const cred = credentials.find((c) => c.id === credentialId);
    if (!cred) throw new DomainError("CREDENTIAL_NOT_FOUND", "Credential not found", 404);
    cred.status = "revoked";
    this.record("human", actorId, "credential.revoked", "principal_credential", credentialId, `Revoked credential ${cred.label}`);
  }

  updatePrincipalStatus(principalId: string, status: PrincipalStatus, actorId: string): PrincipalRecord {
    const principal = this.getPrincipal(principalId);
    const principals = this.store.principals ?? [];
    const activeOwners = principals.filter((p) => p.status === "active" && p.roles.includes("owner"));

    if (principal.id === actorId && status === "deactivated") {
      throw new DomainError("SELF_DEACTIVATION_DENIED", "An active user cannot deactivate their own account", 403);
    }
    if (status === "deactivated" && principal.roles.includes("owner") && activeOwners.length <= 1) {
      throw new DomainError("LAST_OWNER_PROTECTION", "Cannot deactivate the last active owner", 403);
    }

    const target = (this.store.principals ?? []).find((p) => p.id === principal.id)!;
    target.status = status;
    if (status === "deactivated") {
      for (const cred of (this.store.credentials ?? []).filter((c) => c.principalId === principal.id)) {
        cred.status = "revoked";
      }
      this.store.webSessions = (this.store.webSessions ?? []).filter((s) => s.principalId !== principal.id);
    }

    this.record("human", actorId, `principal.${status}`, "principal", principal.id, `Updated status of ${principal.displayName} to ${status}`);
    return clone(target);
  }

  updatePrincipal(principalId: string, input: UpdatePrincipalInput, actorId: string): PrincipalRecord {
    const principal = this.getPrincipal(principalId);
    const target = (this.store.principals ?? []).find((p) => p.id === principal.id)!;

    if (input.roles && !input.roles.includes("owner") && principal.roles.includes("owner")) {
      const activeOwners = (this.store.principals ?? []).filter((p) => p.status === "active" && p.roles.includes("owner"));
      if (activeOwners.length <= 1) throw new DomainError("LAST_OWNER_PROTECTION", "Cannot remove owner role from the last active owner", 403);
    }

    if (input.displayName !== undefined) target.displayName = input.displayName;
    if (input.roles !== undefined) target.roles = clone(input.roles);
    if (input.projectKeys !== undefined) target.projectKeys = clone(input.projectKeys);
    if (input.capabilities !== undefined) target.capabilities = clone(input.capabilities);

    this.record("human", actorId, "principal.updated", "principal", principal.id, `Updated settings for ${principal.displayName}`);
    return clone(target);
  }

  // Web session management
  createWebSession(principalId: string): { session: WebSessionRecord; secret: string } {
    const principal = this.getPrincipal(principalId);
    if (principal.status !== "active") throw new DomainError("PRINCIPAL_DEACTIVATED", "Deactivated principal cannot open web session", 403);
    if (principal.type !== "human") throw new DomainError("HUMAN_SESSION_ONLY", "Only Human principals may open web sessions", 403);

    const webSessions = this.store.webSessions ??= [];
    const secret = `tan_sess_${randomBytes(32).toString("hex")}`;
    const sessionHash = digest(secret);
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString(); // 8 hours

    const session: WebSessionRecord = {
      id: randomUUID(),
      principalId: principal.id,
      createdAt: now(),
      expiresAt,
    };
    (session as unknown as { sessionHash: string }).sessionHash = sessionHash;
    webSessions.push(session);
    return { session: clone(session), secret };
  }

  revokeWebSessionBySecret(secret: string): void {
    const sessionHash = digest(secret);
    const webSessions = this.store.webSessions ?? [];
    this.store.webSessions = webSessions.filter((s) => (s as unknown as { sessionHash: string }).sessionHash !== sessionHash);
  }
  constructor(
    private readonly store: TandemState,
    private readonly onMutation?: (state: TandemState) => void,
  ) {
    const potentiallyOldState = this.store as TandemState & { decisionRequests?: DecisionRequest[]; principals?: PrincipalRecord[]; credentials?: PrincipalCredentialRecord[]; webSessions?: WebSessionRecord[] };
    if (!Array.isArray(potentiallyOldState.decisionRequests)) potentiallyOldState.decisionRequests = [];
    if (!Array.isArray(potentiallyOldState.principals)) potentiallyOldState.principals = [];
    if (!Array.isArray(potentiallyOldState.credentials)) potentiallyOldState.credentials = [];
    if (!Array.isArray(potentiallyOldState.webSessions)) potentiallyOldState.webSessions = [];
    for (const project of this.store.projects) {
      project.repository = normalizeRepositoryBinding(project.repository);
      project.repositories = (project.repositories?.length ? project.repositories : [project.repository]).map(normalizeRepositoryBinding);
      project.policyProfile ??= "standard";
    }
    for (const issue of this.store.issues) {
      issue.deliveryPath ??= "planned";
      issue.intake ??= {
        source: "import",
        originalStatement: issue.description,
        capturedBy: { actorType: "system", actorId: "state-migration" },
        capturedAt: now(),
        details: {},
      };
      issue.risk ??= { class: issue.deliveryPath === "quick" ? "low" : "standard", flags: [] };
    }
  }

  exportState(): TandemState {
    return clone(this.store);
  }

  listProjects(): Project[] {
    return clone(this.store.projects);
  }

  resolveProjectContext(input: StartSessionInput): Project {
    const issue = input.issueKey ? this.requireIssue(input.issueKey) : undefined;
    const issueProject = issue ? this.store.projects.find((item) => item.id === issue.projectId) : undefined;
    const explicitProject = input.projectKey ? this.requireProject(input.projectKey) : undefined;
    const remoteProject = input.gitRemote ? this.resolveProject({ gitRemote: input.gitRemote }) : undefined;
    if (input.gitRemote && !remoteProject) throw new DomainError("PROJECT_NOT_FOUND", "No Tandem Project is bound to this Git remote", 404);
    const candidates = [issueProject, explicitProject, remoteProject].filter((item): item is Project => Boolean(item));
    const projectIds = new Set(candidates.map((item) => item.id));
    if (projectIds.size > 1) throw new DomainError("PROJECT_CONTEXT_CONFLICT", "Issue, explicit Project, and Git remote must resolve to the same Project", 409);
    const project = candidates[0];
    if (!project) throw new DomainError("PROJECT_NOT_FOUND", "No Tandem Project matches this context", 404);
    return clone(project);
  }

  getProjectForIssue(issueKey: string): Project {
    const issue = this.requireIssue(issueKey);
    const project = this.store.projects.find((item) => item.id === issue.projectId);
    if (!project) throw new DomainError("PROJECT_NOT_FOUND", "Issue Project was not found", 404);
    return clone(project);
  }

  getProjectForSession(sessionId: string): Project {
    const session = this.requireSession(sessionId);
    const project = this.store.projects.find((item) => item.id === session.projectId);
    if (!project) throw new DomainError("PROJECT_NOT_FOUND", "Session Project was not found", 404);
    return clone(project);
  }

  getProjectForArtifact(artifactId: string): Project {
    const artifact = this.store.artifacts.find((item) => item.id === artifactId);
    if (!artifact) throw new DomainError("ARTIFACT_NOT_FOUND", "Artifact was not found", 404);
    const project = this.store.projects.find((item) => item.id === artifact.projectId);
    if (!project) throw new DomainError("PROJECT_NOT_FOUND", "Artifact Project was not found", 404);
    return clone(project);
  }

  getProjectForDecision(requestId: string): Project {
    const request = this.store.decisionRequests.find((item) => item.id === requestId);
    if (!request) throw new DomainError("DECISION_REQUEST_NOT_FOUND", "Decision request was not found", 404);
    const project = this.store.projects.find((item) => item.id === request.projectId);
    if (!project) throw new DomainError("PROJECT_NOT_FOUND", "Decision Project was not found", 404);
    return clone(project);
  }

  getProjectSnapshot(projectKey: string): ProjectSnapshot {
    const project = this.requireProject(projectKey);
    const milestone = project.currentMilestoneId
      ? this.store.milestones.find((item) => item.id === project.currentMilestoneId)
      : undefined;
    const cycle = project.activeCycleId
      ? this.store.cycles.find((item) => item.id === project.activeCycleId)
      : undefined;
    if (project.currentMilestoneId && !milestone) throw new DomainError("PROJECT_CONFIGURATION_INVALID", "Configured Project milestone is missing", 500);
    if (project.activeCycleId && !cycle) throw new DomainError("PROJECT_CONFIGURATION_INVALID", "Configured active Cycle is missing", 500);

    const issues = this.store.issues
      .filter((item) => item.projectId === project.id)
      .map((item) => this.issueView(item));
    const artifacts = this.store.artifacts
      .filter((item) => item.projectId === project.id)
      .map((artifact) => {
        const effectiveRevision = artifact.effectiveRevisionId
          ? this.store.revisions.find((revision) => revision.id === artifact.effectiveRevisionId)
          : undefined;
        const proposedRevision = [...this.store.revisions]
          .reverse()
          .find((revision) => revision.artifactId === artifact.id && revision.state === "proposed");
        return {
          ...clone(artifact),
          ...(effectiveRevision ? { effectiveRevision: clone(effectiveRevision) } : {}),
          ...(proposedRevision ? { proposedRevision: clone(proposedRevision) } : {}),
        };
      });

    const sessions = this.store.sessions
      .filter((item) => item.projectId === project.id)
      .map((session) => ({ ...clone(session), stale: session.contextDigest !== this.projectContextDigest(project.id) }));

    return {
      project: clone(project),
      ...(milestone ? { milestone: clone(milestone) } : {}),
      ...(cycle ? { cycle: clone(cycle) } : {}),
      cycles: clone(this.store.cycles.filter((item) => item.projectId === project.id)),
      artifacts,
      issues,
      sessions,
      evidence: clone(this.store.evidence.filter((item) => issues.some((issue) => issue.id === item.issueId))),
      handoffs: clone(this.store.handoffs.filter((item) => issues.some((issue) => issue.id === item.issueId))),
      decisionRequests: clone(this.store.decisionRequests.filter((item) => item.projectId === project.id)),
      attention: this.getAttention(project.id, issues, sessions),
      activities: clone(this.store.activities.filter((item) => item.subjectId === project.id || issues.some((issue) => issue.id === item.subjectId)).slice(-30).reverse()),
    };
  }

  getIssue(issueKey: string): Issue {
    return clone(this.issueView(this.requireIssue(issueKey)));
  }

  getSession(sessionId: string): AgentSession {
    const session = this.requireSession(sessionId);
    return clone({ ...session, stale: session.contextDigest !== this.projectContextDigest(session.projectId) });
  }

  listReadyIssues(projectKey: string): Issue[] {
    const project = this.requireProject(projectKey);
    return this.store.issues
      .filter((item) => item.projectId === project.id)
      .map((item) => this.issueView(item))
      .filter((item) => item.displayState === "ready")
      .map(clone);
  }

  createProject(
    input: ProjectBootstrapInput & { actorId: string; actorType: "human" | "agent" },
  ): CommandResult<ProjectBootstrapResult> {
    if (this.store.projects.some((item) => item.key === input.key)) {
      throw new DomainError("PROJECT_KEY_CONFLICT", `Project key ${input.key} already exists`);
    }
    const repositoryIdentities = new Set(input.repositories.map(repositoryIdentity));
    for (const existing of this.store.projects) {
      const duplicate = projectRepositories(existing).some((binding) => repositoryIdentities.has(repositoryIdentity(binding)));
      if (duplicate) throw new DomainError("REPOSITORY_ALREADY_BOUND", "A repository can belong to only one Project in the pilot Team");
    }

    const project: Project = {
      id: randomUUID(),
      key: input.key,
      name: input.name,
      goal: input.goal,
      successMeasures: input.successMeasures,
      nonGoals: input.nonGoals,
      owner: input.owner,
      health: "on_track",
      targetDate: input.targetDate,
      repository: clone(input.repositories[0]!),
      repositories: clone(input.repositories),
      policyProfile: "standard",
    };
    this.store.projects.push(project);

    const createdArtifacts: Artifact[] = [];
    for (const imported of input.artifacts) {
      const artifact: Artifact = {
        id: randomUUID(),
        projectId: project.id,
        type: imported.type,
        title: imported.title,
        revisionIds: [],
      };
      this.store.artifacts.push(artifact);
      const primary = project.repository;
      this.checkpointArtifact({
        artifactId: artifact.id,
        content: imported.content,
        state: input.actorType === "human" ? "baselined" : "proposed",
        actorType: input.actorType,
        actorId: input.actorId,
        storageMode: imported.storageMode,
        ...(imported.git ? {
          git: {
            repository: `${primary.owner}/${primary.name}`,
            path: imported.git.path,
            commit: imported.git.commit,
            blob: imported.git.blob,
          },
        } : {}),
      });
      createdArtifacts.push(clone(artifact));
    }

    this.record(input.actorType, input.actorId, "project.created", "project", project.id, `Created ${project.key}: ${project.name}`);
    const effectiveArtifacts = createdArtifacts.filter((artifact) => Boolean(artifact.effectiveRevisionId));
    const warnings: string[] = [];
    if (!createdArtifacts.length) warnings.push("No current Product, Design, or Test guidance was imported");
    else if (!effectiveArtifacts.length) warnings.push("Imported Agent proposals require a Human baseline decision before they become effective context");
    return this.result({
      project: clone(project),
      artifacts: createdArtifacts,
      readiness: { readyForAgentOnboarding: effectiveArtifacts.length > 0, warnings },
    }, ["start_session", "upsert_artifact_draft", "create_issue"], warnings, `/projects/${project.key}`);
  }

  upsertArtifactDraft(input: ArtifactDraftInput & { actorId: string }): CommandResult<{ artifact: Artifact; revision: ArtifactRevision }> {
    const project = this.requireProject(input.projectKey);
    let artifact = input.artifactId ? this.store.artifacts.find((item) => item.id === input.artifactId) : undefined;
    if (artifact && artifact.projectId !== project.id) throw new DomainError("ARTIFACT_SCOPE_MISMATCH", "Artifact does not belong to this Project");
    if (!artifact) {
      artifact = {
        id: randomUUID(),
        projectId: project.id,
        type: input.type,
        title: input.title,
        revisionIds: [],
      };
      this.store.artifacts.push(artifact);
    } else {
      artifact.title = input.title;
      artifact.type = input.type;
    }
    const revision = this.checkpointArtifact({
      artifactId: artifact.id,
      content: input.content,
      state: "working_draft",
      actorType: "agent",
      actorId: input.actorId,
    });
    return this.result({ artifact: clone(artifact), revision }, ["checkpoint_artifact", "request_human_decision"], [], `/artifacts/${artifact.id}`);
  }

  planCycle(input: CyclePlanInput & { actorId: string }): CommandResult<Cycle> {
    const project = this.requireProject(input.projectKey);
    if (input.endsOn < input.startsOn) throw new DomainError("CYCLE_DATE_INVALID", "Cycle end date must be on or after the start date", 400);
    let cycle = this.store.cycles.find((item) => item.projectId === project.id && item.name === input.name && ["draft", "proposed"].includes(item.state));
    if (cycle) {
      cycle.goal = input.goal;
      cycle.startsOn = input.startsOn;
      cycle.endsOn = input.endsOn;
      cycle.definitionOfDone = input.definitionOfDone;
      cycle.state = input.state;
      cycle.planRevision += 1;
      cycle.planDigest = digest(JSON.stringify(input));
    } else {
      cycle = {
        id: randomUUID(),
        projectId: project.id,
        number: Math.max(...this.store.cycles.filter((item) => item.projectId === project.id).map((item) => item.number), -1) + 1,
        name: input.name,
        goal: input.goal,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        state: input.state,
        definitionOfDone: input.definitionOfDone,
        planRevision: 1,
        planDigest: digest(JSON.stringify(input)),
      };
      this.store.cycles.push(cycle);
    }
    if (input.state === "active") {
      const existingActive = this.store.cycles.find((item) => item.projectId === project.id && item.state === "active");
      if (existingActive && existingActive.id !== cycle.id) existingActive.state = "completed";
      project.activeCycleId = cycle.id;
    }
    this.record("agent", input.actorId, "cycle.planned", "cycle", cycle.id, `${cycle.name} plan revision ${cycle.planRevision}`);
    return this.result(clone(cycle), ["create_issue", "request_human_decision"], [], `/cycles/${cycle.id}`);
  }

  createIssue(input: CreateIssueCommandInput & { actorId: string; actorType?: "human" | "agent" }): CommandResult<Issue> {
    const project = this.requireProject(input.projectKey);
    const actorType = input.actorType ?? "agent";
    const deliveryPath = input.deliveryPath ?? "planned";
    const source = input.source ?? "agent_conversation";
    const details = input.details ?? {};
    const riskFlags = input.riskFlags ?? [];
    const parent = input.parentKey ? this.requireIssue(input.parentKey) : undefined;
    if (parent && parent.projectId !== project.id) throw new DomainError("PARENT_SCOPE_MISMATCH", "Parent Issue belongs to another Project");
    if (input.cycleId && !this.store.cycles.some((item) => item.id === input.cycleId && item.projectId === project.id)) {
      throw new DomainError("CYCLE_SCOPE_MISMATCH", "Cycle does not belong to this Project");
    }
    if (input.milestoneId && !this.store.milestones.some((item) => item.id === input.milestoneId && item.projectId === project.id)) {
      throw new DomainError("MILESTONE_SCOPE_MISMATCH", "Milestone does not belong to this Project");
    }
    const maxNumber = Math.max(...this.store.issues.filter((item) => item.projectId === project.id).map((item) => Number(item.key.split("-")[1]) || 0), 0);
    const issue: Issue = {
      id: randomUUID(),
      key: `${project.key}-${maxNumber + 1}`,
      projectId: project.id,
      ...(input.cycleId ? { cycleId: input.cycleId } : {}),
      ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
      ...(parent ? { parentId: parent.id } : {}),
      type: input.type,
      deliveryPath,
      intake: {
        source: actorType === "human" ? "human_web" : source === "human_web" ? "agent_conversation" : source,
        ...(input.sourceReference ? { sourceReference: input.sourceReference } : {}),
        originalStatement: input.originalStatement ?? input.description,
        capturedBy: { actorType, actorId: input.actorId },
        capturedAt: now(),
        details: clone(details),
      },
      risk: {
        class: riskFlags.length ? "high" : deliveryPath === "quick" ? "low" : "standard",
        flags: clone(riskFlags),
      },
      title: input.title,
      description: input.description,
      acceptanceCriteria: input.acceptanceCriteria,
      baseState: "backlog",
      displayState: "backlog",
      blockedBy: [],
      readinessReasons: [],
      requiredArtifactIds: input.requiredArtifactIds,
      affectedModules: input.affectedModules,
      version: 1,
    };
    this.store.issues.push(issue);
    this.record(actorType, input.actorId, "issue.created", "issue", issue.id, `Created ${issue.key}: ${issue.title}`);
    const warnings: string[] = [];
    if (issue.deliveryPath === "quick" && issue.risk.flags.length) {
      warnings.push(...this.promoteIssue(issue, { actorType, actorId: input.actorId }, issue.risk.flags.map((flag) => `Material ${riskLabel(flag)} impact`), true));
    } else if (issue.risk.flags.length) {
      this.ensureMaterialDecision(issue, { actorType, actorId: input.actorId });
      warnings.push("Material risk requires a Human decision before implementation");
    }
    const view = this.issueView(issue);
    return this.result(view, view.displayState === "ready" ? ["start_session"] : ["update_issue", "request_human_decision"], [...warnings, ...view.readinessReasons], `/projects/${project.key}/work/${issue.key}`);
  }

  updateIssue(
    issueKey: string,
    input: UpdateIssueInput & { actorId: string; actorType?: "human" | "agent" },
  ): CommandResult<Issue> {
    const issue = this.requireIssue(issueKey);
    if (["done", "cancelled"].includes(issue.baseState)) throw new DomainError("ISSUE_NOT_EDITABLE", `Issue in ${issue.baseState} cannot be enriched`);
    const actorType = input.actorType ?? "agent";
    if (input.cycleId !== undefined) {
      if (input.cycleId === null) {
        delete issue.cycleId;
      } else {
        const cycle = this.store.cycles.find((item) => item.id === input.cycleId && item.projectId === issue.projectId);
        if (!cycle) throw new DomainError("CYCLE_NOT_FOUND", "Specified Cycle does not exist in this Project");
        issue.cycleId = input.cycleId;
      }
    }
    if (input.description !== undefined) issue.description = input.description;
    if (input.acceptanceCriteria !== undefined) issue.acceptanceCriteria = clone(input.acceptanceCriteria);
    if (input.details !== undefined) issue.intake.details = { ...issue.intake.details, ...clone(input.details) };
    if (input.requiredArtifactIds !== undefined) issue.requiredArtifactIds = clone(input.requiredArtifactIds);
    if (input.affectedModules !== undefined) issue.affectedModules = clone(input.affectedModules);
    if (input.riskFlags !== undefined) {
      issue.risk.flags = clone(input.riskFlags);
      issue.risk.class = input.riskFlags.length ? "high" : issue.deliveryPath === "quick" ? "low" : "standard";
    }
    issue.version += 1;
    this.record(actorType, input.actorId, "issue.enriched", "issue", issue.id, `Updated structured intake and delivery context for ${issue.key}`);
    const warnings: string[] = [];
    if (issue.deliveryPath === "quick" && issue.risk.flags.length) {
      warnings.push(...this.promoteIssue(issue, { actorType, actorId: input.actorId }, issue.risk.flags.map((flag) => `Material ${riskLabel(flag)} impact`), true));
    } else if (issue.risk.flags.length) {
      this.ensureMaterialDecision(issue, { actorType, actorId: input.actorId });
      warnings.push("Material risk requires a Human decision before implementation");
    }
    const view = this.issueView(issue);
    return this.result(view, view.displayState === "ready" ? ["start_session"] : ["update_issue", "request_human_decision"], [...warnings, ...view.readinessReasons], `/work/${issue.key}`);
  }

  addIssueDependency(input: IssueDependencyInput & { actorId: string }): CommandResult<Issue> {
    const blocker = this.requireIssue(input.blockerKey);
    const blocked = this.requireIssue(input.blockedKey);
    if (blocker.projectId !== blocked.projectId) throw new DomainError("DEPENDENCY_SCOPE_MISMATCH", "Issue dependencies cannot cross Projects");
    if (blocker.id === blocked.id) throw new DomainError("DEPENDENCY_SELF_REFERENCE", "An Issue cannot block itself");
    if (blocked.blockedBy.includes(blocker.id)) return this.result(this.issueView(blocked), ["start_session"], ["Dependency already existed"], `/work/${blocked.key}`);
    if (this.hasDownstreamPath(blocked.id, blocker.id)) throw new DomainError("DEPENDENCY_CYCLE", `Adding ${blocker.key} -> ${blocked.key} would create a dependency cycle`);
    blocked.blockedBy.push(blocker.id);
    blocked.version += 1;
    this.record("agent", input.actorId, "issue.dependency_added", "issue", blocked.id, `${blocked.key} is blocked by ${blocker.key}`);
    const warnings = [
      ...this.promoteIssue(blocker, { actorType: "agent", actorId: input.actorId }, ["Participates in a dependency plan"], false),
      ...this.promoteIssue(blocked, { actorType: "agent", actorId: input.actorId }, ["Participates in a dependency plan"], false),
    ];
    return this.result(this.issueView(blocked), ["add_issue_dependency", "list_ready_issues"], warnings, `/work/${blocked.key}`);
  }

  requestHumanDecision(input: DecisionRequestInput & { actorId: string }): CommandResult<DecisionRequest> {
    const project = this.requireProject(input.projectKey);
    if (input.sessionId) this.requireSession(input.sessionId);
    const request: DecisionRequest = {
      id: randomUUID(),
      projectId: project.id,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      kind: input.kind,
      question: input.question,
      proposal: input.proposal,
      risk: input.risk,
      status: "pending",
      requestedBy: { actorType: "agent", actorId: input.actorId },
      requestedAt: now(),
    };
    this.store.decisionRequests.push(request);
    this.record("agent", input.actorId, "decision.requested", "decision_request", request.id, input.question);
    return this.result(clone(request), ["wait_for_human_decision"], [], `/attention`);
  }

  resolveDecision(requestId: string, input: DecisionInput & { humanId: string }): CommandResult<DecisionRequest> {
    const request = this.store.decisionRequests.find((item) => item.id === requestId);
    if (!request) throw new DomainError("DECISION_REQUEST_NOT_FOUND", "Decision request was not found", 404);
    if (request.status !== "pending") throw new DomainError("DECISION_ALREADY_RESOLVED", "Decision request is already resolved");
    request.status = input.outcome;
    request.decidedBy = input.humanId;
    request.rationale = input.rationale;
    request.decidedAt = now();

    if (input.outcome === "approved" && request.subjectType === "artifact_revision") this.baselineExistingRevision(request.subjectId);
    if (input.outcome === "approved" && request.subjectType === "cycle" && request.kind === "cycle_activation") {
      const cycle = this.store.cycles.find((item) => item.id === request.subjectId);
      if (!cycle) throw new DomainError("CYCLE_NOT_FOUND", "Decision Cycle was not found", 404);
      const project = this.store.projects.find((item) => item.id === cycle.projectId);
      if (!project) throw new DomainError("PROJECT_NOT_FOUND", "Decision Project was not found", 404);
      const active = this.store.cycles.find((item) => item.id === project.activeCycleId);
      if (active && active.id !== cycle.id) active.state = "completed";
      cycle.state = "active";
      project.activeCycleId = cycle.id;
    }
    if (request.subjectType === "issue") {
      const issue = this.store.issues.find((item) => item.id === request.subjectId);
      if (issue) issue.version += 1;
    }
    this.record("human", input.humanId, `decision.${input.outcome}`, "decision_request", request.id, input.rationale);
    return this.result(clone(request), [], [], `/attention`);
  }

  startSession(input: StartSessionInput & { agentId: string }): CommandResult<AgentSession> {
    const issue = input.issueKey ? this.requireIssue(input.issueKey) : undefined;
    const project = this.resolveProjectContext(input);

    const artifactIds = issue?.requiredArtifactIds.length
      ? issue.requiredArtifactIds
      : this.store.artifacts.filter((item) => item.projectId === project.id).map((item) => item.id);
    const contextItems: ContextItem[] = artifactIds.map((artifactId) => {
      const artifact = this.store.artifacts.find((item) => item.id === artifactId);
      const revision = artifact?.effectiveRevisionId
        ? this.store.revisions.find((item) => item.id === artifact.effectiveRevisionId)
        : undefined;
      if (!artifact || !revision) throw new DomainError("CONTEXT_INCOMPLETE", `Required Artifact ${artifactId} has no effective baseline`);
      return {
        id: `context-${revision.id}`,
        kind: "artifact" as const,
        label: `${artifact.title} · r${revision.revision}`,
        locator: revision.git?.path ?? `tandem://artifacts/${artifact.id}/revisions/${revision.id}`,
        digest: revision.digest,
        required: true,
      };
    });
    contextItems.push(
      {
        id: "context-agents-md",
        kind: "repository_document",
        label: "Repository delivery instructions",
        locator: "AGENTS.md",
        required: true,
      },
      {
        id: "context-code-domain",
        kind: "code_anchor",
        label: "Relevant implementation boundary",
        locator: issue?.affectedModules.join(", ") || "apps/, packages/",
        required: true,
      },
      {
        id: "context-verify",
        kind: "verification_command",
        label: "Repository verification",
        locator: "pnpm check",
        required: true,
      },
    );

    const session: AgentSession = {
      id: randomUUID(),
      agentId: input.agentId,
      projectId: project.id,
      ...(issue ? { issueId: issue.id } : {}),
      state: "onboarding",
      contextDigest: this.projectContextDigest(project.id),
      contextItems,
      stale: false,
      startedAt: now(),
    };
    this.store.sessions.push(session);
    this.record("agent", input.agentId, "session.started", "agent_session", session.id, `Started onboarding for ${issue?.key ?? project.key}`);
    return this.result(clone(session), ["confirm_understanding"], [], `/sessions/${session.id}`);
  }

  confirmUnderstanding(sessionId: string, input: ConfirmUnderstandingInput): CommandResult<AgentSession> {
    const session = this.requireSession(sessionId);
    if (session.state !== "onboarding") throw new DomainError("SESSION_NOT_ONBOARDING", "Understanding can only be confirmed during onboarding");
    if (session.contextDigest !== this.projectContextDigest(session.projectId)) {
      throw new DomainError("SESSION_CONTEXT_STALE", "Project baselines changed; start or refresh onboarding before confirmation");
    }
    const missing = session.contextItems
      .filter((item) => item.required && !input.readContextItemIds.includes(item.id))
      .map((item) => item.label);
    if (missing.length) throw new DomainError("REQUIRED_CONTEXT_NOT_READ", `Required context not acknowledged: ${missing.join(", ")}`);

    session.state = "active";
    session.confirmedAt = now();
    session.understanding = input.understanding;
    session.intendedChanges = input.intendedChanges;
    session.openQuestions = input.openQuestions;
    this.record("agent", session.agentId, "session.context_confirmed", "agent_session", session.id, "Confirmed current Artifact and code context");
    const next = session.issueId ? ["claim_issue", "request_human_decision"] : ["plan_cycle", "create_issue", "upsert_artifact_draft"];
    return this.result(clone(session), next, input.openQuestions.length ? ["Open questions should be resolved before risky changes"] : [], `/sessions/${session.id}`);
  }

  refreshSessionContext(sessionId: string): CommandResult<AgentSession> {
    const session = this.requireSession(sessionId);
    session.contextDigest = this.projectContextDigest(session.projectId);
    session.stale = false;
    this.record("agent", session.agentId, "session.refreshed", "agent_session", session.id, "Refreshed session context digest to latest project state");
    return this.result(clone(session), ["claim_issue", "record_checkpoint", "submit_handoff"], [], `/sessions/${session.id}`);
  }

  finishSession(sessionId: string, summary?: string): CommandResult<AgentSession> {
    const session = this.requireSession(sessionId);
    session.state = "completed";
    if (session.issueId) {
      const issue = this.store.issues.find((item) => item.id === session.issueId);
      if (issue && issue.activeClaim?.sessionId === session.id) {
        delete issue.activeClaim;
        issue.version += 1;
      }
    }
    this.record("agent", session.agentId, "session.finished", "agent_session", session.id, summary ?? "Session completed cleanly");
    return this.result(clone(session), [], [], `/sessions/${session.id}`);
  }

  claimIssue(issueKey: string, input: ClaimIssueInput): CommandResult<Issue> {
    const issue = this.requireIssue(issueKey);
    const session = this.requireSession(input.sessionId);
    if (session.issueId !== issue.id) throw new DomainError("SESSION_ISSUE_MISMATCH", "Session was not onboarded for this Issue");
    if (session.state !== "active" || !session.confirmedAt) throw new DomainError("ONBOARDING_REQUIRED", "Confirm current project and code understanding before claiming implementation work");
    if (session.contextDigest !== this.projectContextDigest(session.projectId)) throw new DomainError("SESSION_CONTEXT_STALE", "Required Artifact baseline changed; refresh context before claiming");
    if (issue.activeClaim) throw new DomainError("ISSUE_ALREADY_CLAIMED", `${issue.key} is already claimed by ${issue.activeClaim.agentId}`);
    const view = this.issueView(issue);
    if (view.displayState !== "ready") throw new DomainError("ISSUE_NOT_READY", `${issue.key} is not Ready: ${view.readinessReasons.join("; ")}`);

    issue.activeClaim = {
      sessionId: session.id,
      agentId: session.agentId,
      claimedAt: now(),
      ...(input.branch ? { branch: input.branch } : {}),
      ...(input.worktree ? { worktree: input.worktree } : {}),
    };
    issue.baseState = "claimed";
    issue.version += 1;
    this.record("agent", session.agentId, "issue.claimed", "issue", issue.id, `Claimed ${issue.key}`);
    return this.result(this.issueView(issue), ["record_checkpoint", "attach_evidence", "submit_handoff"], [], `/work/${issue.key}`);
  }

  recordCheckpoint(issueKey: string, input: CheckpointInput): CommandResult<Checkpoint> {
    const { issue, session } = this.requireActiveClaim(issueKey, input.sessionId);
    const checkpoint: Checkpoint = {
      id: randomUUID(),
      sessionId: session.id,
      issueId: issue.id,
      summary: input.summary,
      decisions: input.decisions,
      risks: input.risks,
      createdAt: now(),
    };
    this.store.checkpoints.push(checkpoint);
    issue.baseState = "in_progress";
    issue.version += 1;
    this.record("agent", session.agentId, "issue.checkpointed", "issue", issue.id, input.summary);
    return this.result(clone(checkpoint), ["record_checkpoint", "attach_evidence", "submit_handoff"], input.risks, `/work/${issue.key}`);
  }

  attachEvidence(issueKey: string, input: EvidenceInput): CommandResult<Evidence> {
    const { issue, session } = this.requireActiveClaim(issueKey, input.sessionId);
    const evidence: Evidence = {
      id: randomUUID(),
      issueId: issue.id,
      sessionId: session.id,
      type: input.type,
      title: input.title,
      result: input.result,
      ...(input.uri ? { uri: input.uri } : {}),
      summary: input.summary,
      observedAt: now(),
    };
    this.store.evidence.push(evidence);
    this.record("agent", session.agentId, "evidence.attached", "issue", issue.id, `${input.title}: ${input.result}`);
    return this.result(clone(evidence), ["attach_evidence", "submit_handoff"], input.result === "failed" ? ["Failed evidence must be addressed or explained"] : [], `/work/${issue.key}`);
  }

  submitHandoff(issueKey: string, input: HandoffInput): CommandResult<Handoff> {
    const { issue, session } = this.requireActiveClaim(issueKey, input.sessionId);
    const evidence = this.store.evidence.filter((item) => item.issueId === issue.id && item.sessionId === session.id);
    if (!evidence.length) throw new DomainError("EVIDENCE_REQUIRED", "Attach validation evidence before handoff");
    if (issue.deliveryPath === "quick" && issue.type === "bug" && !evidence.some((item) => item.type === "test" && item.result === "passed")) {
      throw new DomainError("REGRESSION_EVIDENCE_REQUIRED", "A Quick Bug requires passed regression test evidence before handoff");
    }
    if (issue.deliveryPath === "quick" && issue.type === "improvement" && !evidence.some((item) => ["test", "review", "experience"].includes(item.type) && item.result === "passed")) {
      throw new DomainError("BEFORE_AFTER_EVIDENCE_REQUIRED", "A Quick Improvement requires passed test, review, or experience evidence before handoff");
    }
    if (evidence.some((item) => item.result === "failed") && !input.risks.length) {
      throw new DomainError("FAILED_EVIDENCE_UNEXPLAINED", "A handoff with failed evidence must record the residual risk");
    }
    const handoff: Handoff = {
      id: randomUUID(),
      issueId: issue.id,
      sessionId: session.id,
      summary: input.summary,
      changes: input.changes,
      validation: input.validation,
      risks: input.risks,
      nextSteps: input.nextSteps,
      createdAt: now(),
    };
    this.store.handoffs.push(handoff);
    issue.baseState = "review";
    delete issue.activeClaim;
    issue.version += 1;
    session.state = "handed_off";
    this.record("agent", session.agentId, "issue.handed_off", "issue", issue.id, input.summary);
    return this.result(clone(handoff), ["human_or_policy_verify"], input.risks, `/work/${issue.key}`);
  }

  verifyIssue(issueKey: string, authority: DecisionAuthority, actorId: string): CommandResult<Issue> {
    const issue = this.requireIssue(issueKey);
    if (issue.baseState !== "review") throw new DomainError("ISSUE_NOT_IN_REVIEW", "Only an Issue in review can be verified");
    if (authority === "agent_recommendation" || authority === "human_stated") {
      throw new DomainError("INSUFFICIENT_AUTHORITY", `${authority} cannot verify delivery`);
    }
    if (authority === "human_decision") {
      return this.reviewIssue(issueKey, {
        outcome: "approved",
        rationale: "The Human reviewer approved and completed this delivery.",
        humanId: actorId,
      });
    }
    issue.baseState = "done";
    delete issue.activeClaim;
    issue.version += 1;
    this.record("system", actorId, "issue.completed", "issue", issue.id, `${issue.key} completed via ${authority}`);
    return this.result(this.issueView(issue), [], [], `/work/${issue.key}`);
  }

  reviewIssue(issueKey: string, input: IssueReviewInput & { humanId: string }): CommandResult<Issue> {
    const issue = this.requireIssue(issueKey);
    if (issue.baseState !== "review") throw new DomainError("ISSUE_NOT_IN_REVIEW", "Only an Issue in review can receive a Human delivery decision");

    delete issue.activeClaim;
    issue.baseState = input.outcome === "approved" ? "done" : "ready";
    issue.version += 1;

    const action = input.outcome === "approved" ? "issue.completed" : "issue.changes_requested";
    const summary = input.outcome === "approved"
      ? `${issue.key} approved and completed: ${input.rationale}`
      : `${issue.key} changes requested: ${input.rationale}`;
    this.record("human", input.humanId, action, "issue", issue.id, summary);

    const view = this.issueView(issue);
    return this.result(
      view,
      input.outcome === "approved" ? [] : view.displayState === "ready" ? ["start_session"] : ["resolve_blockers"],
      view.readinessReasons,
      `/work/${issue.key}`,
    );
  }

  checkpointArtifact(input: NewArtifactRevision): ArtifactRevision {
    const artifact = this.store.artifacts.find((item) => item.id === input.artifactId);
    if (!artifact) throw new DomainError("ARTIFACT_NOT_FOUND", "Artifact not found", 404);
    const revisionNo = artifact.revisionIds.length + 1;
    const revision: ArtifactRevision = {
      id: randomUUID(),
      artifactId: artifact.id,
      revision: revisionNo,
      state: input.state,
      content: input.content,
      digest: digest(input.content),
      storageMode: input.storageMode ?? "tandem_draft",
      createdBy: { actorType: input.actorType, actorId: input.actorId },
      createdAt: now(),
      ...(input.git ? { git: clone(input.git) } : {}),
    };
    if (input.state === "baselined") {
      const previous = artifact.effectiveRevisionId
        ? this.store.revisions.find((item) => item.id === artifact.effectiveRevisionId)
        : undefined;
      if (previous) previous.state = "superseded";
      artifact.effectiveRevisionId = revision.id;
    }
    artifact.revisionIds.push(revision.id);
    this.store.revisions.push(revision);
    this.record(input.actorType, input.actorId, `artifact.${input.state}`, "artifact", artifact.id, `${artifact.title} revision ${revisionNo}`);
    return clone(revision);
  }

  private baselineExistingRevision(revisionId: string): void {
    const revision = this.store.revisions.find((item) => item.id === revisionId);
    if (!revision) throw new DomainError("ARTIFACT_REVISION_NOT_FOUND", "Artifact revision was not found", 404);
    if (!(["working_draft", "proposed"] as ArtifactRevisionState[]).includes(revision.state)) {
      throw new DomainError("ARTIFACT_REVISION_NOT_PROPOSABLE", `Revision in ${revision.state} cannot be baselined`);
    }
    const artifact = this.store.artifacts.find((item) => item.id === revision.artifactId);
    if (!artifact) throw new DomainError("ARTIFACT_NOT_FOUND", "Artifact was not found", 404);
    const previous = artifact.effectiveRevisionId ? this.store.revisions.find((item) => item.id === artifact.effectiveRevisionId) : undefined;
    if (previous) previous.state = "superseded";
    revision.state = "baselined";
    artifact.effectiveRevisionId = revision.id;
  }

  private hasDownstreamPath(fromIssueId: string, targetIssueId: string): boolean {
    const seen = new Set<string>();
    const pending = [fromIssueId];
    while (pending.length) {
      const current = pending.pop();
      if (!current || seen.has(current)) continue;
      if (current === targetIssueId) return true;
      seen.add(current);
      for (const child of this.store.issues.filter((item) => item.blockedBy.includes(current))) pending.push(child.id);
    }
    return false;
  }

  private promoteIssue(
    issue: Issue,
    actor: { actorType: "human" | "agent" | "system"; actorId: string },
    reasons: string[],
    requireDecision: boolean,
  ): string[] {
    if (issue.deliveryPath === "planned") {
      if (requireDecision) this.ensureMaterialDecision(issue, actor);
      return [];
    }
    issue.deliveryPath = "planned";
    issue.risk.class = issue.risk.flags.length ? "high" : "standard";
    issue.promotion = {
      promotedAt: now(),
      promotedBy: clone(actor),
      reasons: clone(reasons),
    };
    issue.version += 1;
    if (requireDecision) {
      const decision = this.ensureMaterialDecision(issue, actor);
      issue.promotion.requiredDecisionId = decision.id;
    }
    this.record(actor.actorType, actor.actorId, "issue.promoted", "issue", issue.id, `${issue.key} promoted to planned delivery: ${reasons.join("; ")}`);
    return [`Quick Work was promoted to planned delivery: ${reasons.join("; ")}`];
  }

  private ensureMaterialDecision(
    issue: Issue,
    actor: { actorType: "human" | "agent" | "system"; actorId: string },
  ): DecisionRequest {
    const existing = issue.risk.requiredDecisionId
      ? this.store.decisionRequests.find((item) => item.id === issue.risk.requiredDecisionId)
      : undefined;
    if (existing) return existing;
    const project = this.store.projects.find((item) => item.id === issue.projectId);
    if (!project) throw new DomainError("PROJECT_NOT_FOUND", "Issue Project was not found", 404);
    const flags = issue.risk.flags;
    const kind: DecisionRequest["kind"] = flags.includes("release")
      ? "release"
      : flags.includes("product_scope")
        ? "product_scope"
        : flags.includes("public_contract") || flags.includes("database_migration")
          ? "architecture"
          : "risk";
    const request: DecisionRequest = {
      id: randomUUID(),
      projectId: project.id,
      subjectType: "issue",
      subjectId: issue.id,
      kind,
      question: `Should ${issue.key} proceed with its material ${flags.map(riskLabel).join(", ")} impact?`,
      proposal: `Review the accepted outcome and safeguards before ${issue.key} can be claimed for implementation.`,
      risk: "high",
      status: "pending",
      requestedBy: { actorType: actor.actorType === "system" ? "agent" : actor.actorType, actorId: actor.actorId },
      requestedAt: now(),
    };
    this.store.decisionRequests.push(request);
    issue.risk.requiredDecisionId = request.id;
    this.record(actor.actorType, actor.actorId, "decision.requested", "decision_request", request.id, request.question);
    return request;
  }

  private issueView(issue: Issue): Issue {
    const reasons: string[] = [];
    if (issue.deliveryPath === "quick") {
      const missing = quickWorkMissingFields(issue.type, issue.intake.details, issue.acceptanceCriteria);
      if (missing.length) reasons.push(`Quick Work intake needs ${missing.join(", ")}`);
    }
    for (const blockerId of issue.blockedBy) {
      const blocker = this.store.issues.find((item) => item.id === blockerId);
      if (!blocker || blocker.baseState !== "done") reasons.push(`Blocked by ${blocker?.key ?? blockerId}`);
    }
    for (const artifactId of issue.requiredArtifactIds) {
      const artifact = this.store.artifacts.find((item) => item.id === artifactId);
      if (!artifact?.effectiveRevisionId) reasons.push(`Required Artifact ${artifact?.title ?? artifactId} is not baselined`);
    }
    if (issue.cycleId) {
      const cycle = this.store.cycles.find((item) => item.id === issue.cycleId);
      if (!cycle) reasons.push("Assigned Cycle does not exist");
      else if (cycle.state !== "active") reasons.push(`Cycle ${cycle.name} is not active`);
    }
    if (issue.risk.requiredDecisionId) {
      const decision = this.store.decisionRequests.find((item) => item.id === issue.risk.requiredDecisionId);
      if (!decision) reasons.push("Required material-risk decision is missing");
      else if (decision.status === "pending") reasons.push("Awaiting Human material-risk decision");
      else if (decision.status !== "approved") reasons.push(`Human material-risk decision is ${decision.status.replaceAll("_", " ")}`);
    }

    let displayState = issue.baseState;
    if (["backlog", "ready", "blocked"].includes(issue.baseState)) displayState = reasons.length ? "blocked" : "ready";
    if (issue.activeClaim && displayState === "ready") displayState = "claimed";
    return clone({ ...issue, displayState, readinessReasons: reasons });
  }

  private projectContextDigest(projectId: string): string {
    const artifacts = this.store.artifacts
      .filter((item) => item.projectId === projectId && item.effectiveRevisionId)
      .map((item) => this.store.revisions.find((revision) => revision.id === item.effectiveRevisionId)?.digest ?? "missing")
      .sort();
    const cycle = this.store.cycles.find((item) => item.projectId === projectId && item.state === "active");
    return digest(JSON.stringify({ artifacts, cycle: cycle?.planDigest ?? "no-cycle" }));
  }

  private getAttention(projectId: string, issues: Issue[], sessions: AgentSession[]): AttentionItem[] {
    const attention: AttentionItem[] = [];
    for (const request of this.store.decisionRequests.filter((item) => item.projectId === projectId && item.status === "pending")) {
      attention.push({
        id: `attention-decision-${request.id}`,
        projectId,
        kind: "decision",
        severity: request.risk === "high" || request.risk === "critical" ? "critical" : "warning",
        title: request.question,
        summary: request.proposal,
        subjectType: "decision_request",
        subjectId: request.id,
      });
    }
    for (const issue of issues.filter((item) => item.displayState === "review")) {
      attention.push({
        id: `attention-review-${issue.id}`,
        projectId,
        kind: "decision",
        severity: "warning",
        title: `${issue.key} is ready for verification`,
        summary: "Review the handoff and evidence, then make the required Human or policy decision.",
        subjectType: "issue",
        subjectId: issue.id,
      });
    }
    for (const session of sessions.filter((item) => item.stale)) {
      attention.push({
        id: `attention-stale-${session.id}`,
        projectId,
        kind: "stale_context",
        severity: "warning",
        title: "Agent Session context is stale",
        summary: "A required Artifact baseline changed after onboarding.",
        subjectType: "agent_session",
        subjectId: session.id,
      });
    }
    for (const issue of issues.filter((item) => item.displayState === "blocked")) {
      attention.push({
        id: `attention-blocked-${issue.id}`,
        projectId,
        kind: "blocked",
        severity: "info",
        title: `${issue.key} is blocked`,
        summary: issue.readinessReasons.join(" · "),
        subjectType: "issue",
        subjectId: issue.id,
      });
    }
    return attention;
  }

  private resolveProject(input: StartSessionInput): Project | undefined {
    if (input.projectKey) return this.store.projects.find((item) => item.key.toLowerCase() === input.projectKey?.toLowerCase());
    if (input.gitRemote) {
      const identity = remoteIdentity(input.gitRemote);
      if (!identity) throw new DomainError("GIT_REMOTE_INVALID", "Git remote could not be normalized", 400);
      const matches = this.store.projects.filter((project) => projectRepositories(project).some((binding) => repositoryIdentity(binding) === identity));
      if (matches.length > 1) throw new DomainError("PROJECT_RESOLUTION_AMBIGUOUS", "Git remote is bound to more than one Project");
      return matches[0];
    }
    return undefined;
  }

  private requireProject(projectKey: string): Project {
    const project = this.store.projects.find((item) => item.key.toLowerCase() === projectKey.toLowerCase() || item.id === projectKey);
    if (!project) throw new DomainError("PROJECT_NOT_FOUND", `Project ${projectKey} was not found`, 404);
    return project;
  }

  private requireIssue(issueKey: string): Issue {
    const issue = this.store.issues.find((item) => item.key.toLowerCase() === issueKey.toLowerCase() || item.id === issueKey);
    if (!issue) throw new DomainError("ISSUE_NOT_FOUND", `Issue ${issueKey} was not found`, 404);
    return issue;
  }

  private requireSession(sessionId: string): AgentSession {
    const session = this.store.sessions.find((item) => item.id === sessionId);
    if (!session) throw new DomainError("SESSION_NOT_FOUND", `Session ${sessionId} was not found`, 404);
    return session;
  }

  private requireActiveClaim(issueKey: string, sessionId: string): { issue: Issue; session: AgentSession } {
    const issue = this.requireIssue(issueKey);
    const session = this.requireSession(sessionId);
    if (issue.activeClaim?.sessionId !== session.id) throw new DomainError("ACTIVE_CLAIM_REQUIRED", `Session does not hold the active claim for ${issue.key}`);
    if (session.state !== "active") throw new DomainError("SESSION_NOT_ACTIVE", "Agent Session is not active");
    return { issue, session };
  }

  private record(
    actorType: Activity["actorType"],
    actorId: string,
    action: string,
    subjectType: string,
    subjectId: string,
    summary: string,
  ): void {
    this.store.activities.push({ id: randomUUID(), actorType, actorId, action, subjectType, subjectId, summary, occurredAt: now() });
    this.onMutation?.(this.exportState());
  }

  private result<T>(data: T, permittedNextActions: string[], warnings: string[], webPath: string): CommandResult<T> {
    return { data, permittedNextActions, warnings, webUrl: `http://localhost:4311${webPath}` };
  }
}

function createArtifact(
  projectId: string,
  id: string,
  type: ArtifactType,
  title: string,
  baselineContent: string,
  path: string,
  proposedContent?: string,
): { artifact: Artifact; revisions: ArtifactRevision[] } {
  const baselineId = `${id}-r1`;
  const baseline: ArtifactRevision = {
    id: baselineId,
    artifactId: id,
    revision: 1,
    state: "baselined",
    content: baselineContent,
    digest: digest(baselineContent),
    storageMode: "git_backed",
    createdBy: { actorType: "agent", actorId: "agent-planner" },
    createdAt: "2026-08-04T12:00:00.000Z",
    git: { repository: "whitetang/tandem", path, commit: "working-tree", blob: digest(baselineContent) },
  };
  const revisions = [baseline];
  const revisionIds = [baselineId];
  if (proposedContent) {
    const proposedId = `${id}-r2`;
    revisions.push({
      id: proposedId,
      artifactId: id,
      revision: 2,
      state: "proposed",
      content: proposedContent,
      digest: digest(proposedContent),
      storageMode: "tandem_draft",
      createdBy: { actorType: "agent", actorId: "agent-designer" },
      createdAt: "2026-08-04T13:30:00.000Z",
    });
    revisionIds.push(proposedId);
  }
  return {
    artifact: { id, projectId, type, title, effectiveRevisionId: baselineId, revisionIds },
    revisions,
  };
}

export function createSeededTandemService(onMutation?: (state: TandemState) => void): TandemService {
  const projectId = "project-tandem";
  const milestoneId = "milestone-alpha";
  const cycleId = "cycle-0";
  const prd = createArtifact(
    projectId,
    "artifact-prd",
    "product_spec",
    "Tandem MVP Product Requirements",
    "# Product baseline\n\nTandem is an Agent-first delivery memory and coordination layer for 3–5 person teams.\n\n## Pilot success\n\nAgents onboard before claiming work; Humans can find current baselines and required decisions in under 30 seconds.",
    "docs/prd/tandem-mvp-prd.md",
    "# Proposed product revision\n\nAdd repository discovery and impact summaries to the first MCP onboarding response.\n\nThis proposal is not effective until baselined.",
  );
  const design = createArtifact(
    projectId,
    "artifact-design",
    "system_design",
    "Tandem MVP System Design",
    "# System baseline\n\nMCP and Human Web use the same domain services. Ready is dependency-derived, Artifact revisions are immutable, and Agent claims require current onboarding context.",
    "docs/design/system-design.md",
  );
  const testPlan = createArtifact(
    projectId,
    "artifact-test",
    "test_plan",
    "Tandem Test Strategy",
    "# Test baseline\n\nVerify dependency readiness, unique claims, onboarding digest, evidence, handoff, and Human authority through unit, integration, and E2E layers.",
    "docs/testing-strategy.md",
  );

  const seededIssueContext = (description: string): Pick<Issue, "deliveryPath" | "intake" | "risk"> => ({
    deliveryPath: "planned",
    intake: {
      source: "import",
      originalStatement: description,
      capturedBy: { actorType: "system", actorId: "seed" },
      capturedAt: "2026-08-04T12:00:00.000Z",
      details: {},
    },
    risk: { class: "standard", flags: [] },
  });

  const issues: Issue[] = [
    {
      id: "issue-1",
      key: "TAN-1",
      projectId,
      cycleId,
      milestoneId,
      type: "task",
      title: "Establish domain contracts and invariants",
      description: "Define the executable product language shared by MCP, API, and Web.",
      ...seededIssueContext("Define the executable product language shared by MCP, API, and Web."),
      acceptanceCriteria: ["Dependency readiness is derived", "Artifact baselines are immutable", "Agent claims require onboarding"],
      baseState: "done",
      displayState: "done",
      blockedBy: [],
      readinessReasons: [],
      requiredArtifactIds: [prd.artifact.id, design.artifact.id],
      affectedModules: ["packages/contracts", "packages/domain"],
      version: 3,
    },
    {
      id: "issue-2",
      key: "TAN-2",
      projectId,
      cycleId,
      milestoneId,
      type: "story",
      title: "Expose the Agent onboarding and delivery API",
      description: "Let a Coding Agent onboard, claim, checkpoint, attach evidence, and hand off through structured commands.",
      ...seededIssueContext("Let a Coding Agent onboard, claim, checkpoint, attach evidence, and hand off through structured commands."),
      acceptanceCriteria: ["Start Session returns an onboarding manifest", "Only a current confirmed Session can claim", "Commands return stable next actions"],
      baseState: "backlog",
      displayState: "ready",
      blockedBy: ["issue-1"],
      readinessReasons: [],
      requiredArtifactIds: [prd.artifact.id, design.artifact.id, testPlan.artifact.id],
      affectedModules: ["apps/api", "packages/domain"],
      version: 1,
    },
    {
      id: "issue-3",
      key: "TAN-3",
      projectId,
      cycleId,
      milestoneId,
      type: "story",
      title: "Build the Human oversight workspace",
      description: "Show effective baselines, dependency-safe work, Session context, evidence, and Attention.",
      ...seededIssueContext("Show effective baselines, dependency-safe work, Session context, evidence, and Attention."),
      acceptanceCriteria: ["Baseline is shown before proposals", "Cycle exposes Ready and blocked work", "Human can inspect Agent onboarding"],
      baseState: "backlog",
      displayState: "ready",
      blockedBy: ["issue-1"],
      readinessReasons: [],
      requiredArtifactIds: [prd.artifact.id, design.artifact.id],
      affectedModules: ["apps/web"],
      version: 1,
    },
    {
      id: "issue-4",
      key: "TAN-4",
      projectId,
      cycleId,
      milestoneId,
      type: "task",
      title: "Integrate and verify the vertical slice",
      description: "Run the Agent workflow and Human Web against the same domain state.",
      ...seededIssueContext("Run the Agent workflow and Human Web against the same domain state."),
      acceptanceCriteria: ["Agent script succeeds", "Production Web build succeeds", "Core domain tests pass"],
      baseState: "backlog",
      displayState: "blocked",
      blockedBy: ["issue-2", "issue-3"],
      readinessReasons: ["Blocked by TAN-2", "Blocked by TAN-3"],
      requiredArtifactIds: [prd.artifact.id, design.artifact.id, testPlan.artifact.id],
      affectedModules: ["apps/api", "apps/web", "scripts"],
      version: 1,
    },
  ];

  const store: TandemState = {
    projects: [{
      id: projectId,
      key: "TAN",
      name: "Tandem MVP",
      goal: "Make Agent-first software delivery understandable, dependency-safe, and traceable for a 3–5 person team.",
      successMeasures: ["Agent onboarding before 90% of implementation claims", "Current baseline discoverable in 30 seconds", "Every completed Issue has evidence and handoff"],
      nonGoals: ["Launch or schedule Coding Agents", "Replace GitHub or the Coding Agent CLI", "Implement story points or time tracking"],
      owner: "Product Sponsor",
      health: "on_track",
      targetDate: "2026-09-11",
      repository: { provider: "github", host: "github.com", owner: "whitetang", name: "tandem", defaultBranch: "main" },
      repositories: [{ provider: "github", host: "github.com", owner: "whitetang", name: "tandem", defaultBranch: "main" }],
      policyProfile: "standard",
      currentMilestoneId: milestoneId,
      activeCycleId: cycleId,
    }],
    milestones: [{ id: milestoneId, projectId, name: "Internal Alpha", targetDate: "2026-08-07", state: "active" }],
    cycles: [{
      id: cycleId,
      projectId,
      number: 0,
      name: "Executable Skeleton",
      goal: "Prove baselines, dependency-safe work, Agent onboarding, evidence, handoff, and Human oversight in one slice.",
      startsOn: "2026-08-04",
      endsOn: "2026-08-05",
      state: "active",
      definitionOfDone: ["Domain tests pass", "Agent workflow script passes", "Human Web production build passes"],
      planRevision: 1,
      planDigest: digest("iteration-0-reviewed-plan"),
    }],
    issues,
    artifacts: [prd.artifact, design.artifact, testPlan.artifact],
    revisions: [...prd.revisions, ...design.revisions, ...testPlan.revisions],
    sessions: [],
    checkpoints: [],
    evidence: [{
      id: "evidence-domain-tests",
      issueId: "issue-1",
      sessionId: "seed-session",
      type: "test",
      title: "Domain contract review",
      result: "passed",
      summary: "Reviewed Agent-first invariants and approved Iteration 0 baseline.",
      observedAt: "2026-08-04T14:00:00.000Z",
    }],
    handoffs: [],
    activities: [{
      id: "activity-baseline",
      actorType: "human",
      actorId: "product-sponsor",
      action: "design.approved_with_revisions",
      subjectType: "project",
      subjectId: projectId,
      summary: "Approved Agent-first product, system, information architecture, and Iteration 0 baselines.",
      occurredAt: "2026-08-04T14:00:00.000Z",
    }],
    decisionRequests: [],
    principals: [{
      id: "development-human",
      type: "human",
      username: "owner",
      displayName: "Product Sponsor",
      status: "active",
      roles: ["owner"],
      projectKeys: ["*"],
      capabilities: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request", "decision:resolve", "identity:admin"],
      createdAt: "2026-08-04T14:00:00.000Z",
    }],
    credentials: [{
      id: "development-human-password",
      principalId: "development-human",
      kind: "password",
      label: "Initial Password",
      status: "active",
      createdAt: "2026-08-04T14:00:00.000Z",
      tokenHash: hashPassword("TandemOwnerPassword123!"),
    } as any],
    webSessions: [],
  };
  return new TandemService(store, onMutation);
}

export function createEmptyTandemService(onMutation?: (state: TandemState) => void): TandemService {
  return new TandemService({
    projects: [],
    milestones: [],
    cycles: [],
    issues: [],
    artifacts: [],
    revisions: [],
    sessions: [],
    checkpoints: [],
    evidence: [],
    handoffs: [],
    activities: [],
    decisionRequests: [],
    principals: [],
    credentials: [],
    webSessions: [],
  }, onMutation);
}
