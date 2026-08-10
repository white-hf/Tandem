import { describe, expect, it } from "vitest";
import { createEmptyTandemService, createSeededTandemService, DomainError, TandemService } from "../src/index.js";

function bootstrapProject(service: TandemService, key = "ACME", repository = "delivery-app") {
  return service.createProject({
    key,
    name: `${key} Delivery`,
    goal: "Ship a real Agent-first delivery workflow for the pilot team.",
    owner: "Product Owner",
    targetDate: "2026-09-30",
    successMeasures: ["A real Issue completes with traceability"],
    nonGoals: ["Agent process launching"],
    repositories: [{ provider: "github", host: "github.com", owner: "acme", name: repository, defaultBranch: "main" }],
    artifacts: [{
      type: "product_spec",
      title: `${key} Product Guidance`,
      content: "# Product guidance\n\nAgents onboard from this confirmed Project context before implementation.",
      storageMode: "git_backed",
      git: { path: "docs/product.md", commit: "abc123", blob: "blob123" },
    }],
    actorType: "human",
    actorId: "product-owner",
  }).data;
}

function onboard(service: TandemService, issueKey: string, agentId: string) {
  const started = service.startSession({ issueKey, agentId });
  const session = started.data;
  const confirmed = service.confirmUnderstanding(session.id, {
    readContextItemIds: session.contextItems.filter((item) => item.required).map((item) => item.id),
    understanding: `I understand the current project baselines, dependency constraints, and acceptance criteria for ${issueKey}.`,
    intendedChanges: ["Implement only the bounded Issue scope", "Run the documented verification command"],
    openQuestions: [],
  });
  return confirmed.data;
}

describe("TandemService", () => {
  it("normalizes legacy repository bindings before Git-based Project discovery", () => {
    const state = createSeededTandemService().exportState();
    const legacy = state.projects[0]!.repository as RepositoryBindingWithLegacyFields;
    delete legacy.provider;
    delete legacy.host;
    state.projects[0]!.repositories = [legacy as unknown as NonNullable<typeof state.projects[0]>["repository"]];

    const service = new TandemService(state);
    expect(service.startSession({ gitRemote: "git@github.com:whitetang/tandem.git", agentId: "legacy-repo-agent" }).data.projectId).toBe("project-tandem");
    expect(service.exportState().projects[0]!.repositories?.[0]).toMatchObject({ provider: "github", host: "github.com", defaultBranch: "main" });
  });

  it("bootstraps a real Project and resolves it from a normalized Git remote without a Cycle", () => {
    const service = createEmptyTandemService();
    const created = bootstrapProject(service);
    expect(created.project.key).toBe("ACME");
    expect(created.readiness.readyForAgentOnboarding).toBe(true);
    expect(service.getProjectSnapshot("ACME")).toMatchObject({ project: { key: "ACME" }, cycles: [] });
    expect(service.getProjectSnapshot("ACME").cycle).toBeUndefined();
    expect(service.startSession({ gitRemote: "git@github.com:acme/delivery-app.git", agentId: "repo-agent" }).data.projectId).toBe(created.project.id);
    expect(() => bootstrapProject(service, "OTHER", "delivery-app")).toThrowError(expect.objectContaining({ code: "REPOSITORY_ALREADY_BOUND" }));
    bootstrapProject(service, "OTHER", "other-app");
    expect(() => service.startSession({ projectKey: "ACME", gitRemote: "https://github.com/acme/other-app.git", agentId: "confused-agent" })).toThrowError(
      expect.objectContaining({ code: "PROJECT_CONTEXT_CONFLICT" }),
    );
  });

  it("keeps incomplete Quick Work in backlog, then delivers a Quick Bug with regression evidence", () => {
    const service = createEmptyTandemService();
    const project = bootstrapProject(service);
    const bug = service.createIssue({
      projectKey: project.project.key,
      type: "bug",
      deliveryPath: "quick",
      source: "agent_conversation",
      title: "Login button needs two clicks",
      description: "The login button sometimes ignores the first click.",
      acceptanceCriteria: [],
      details: {},
      riskFlags: [],
      requiredArtifactIds: [project.artifacts[0]!.id],
      affectedModules: ["apps/web"],
      actorId: "capture-agent",
    }).data;
    expect(bug.displayState).toBe("blocked");
    expect(bug.readinessReasons[0]).toContain("observed behavior");

    const enriched = service.updateIssue(bug.key, {
      acceptanceCriteria: ["One click starts exactly one login request"],
      details: {
        observedBehavior: "The first click sometimes sends no request.",
        expectedBehavior: "One click sends exactly one login request.",
        reproductionContext: "Safari after returning from an expired session.",
        verificationMethod: "Run the login interaction regression test.",
      },
      actorId: "capture-agent",
    }).data;
    expect(enriched).toMatchObject({ deliveryPath: "quick", displayState: "ready" });

    const session = onboard(service, bug.key, "fix-agent");
    service.claimIssue(bug.key, { sessionId: session.id });
    service.attachEvidence(bug.key, { sessionId: session.id, type: "build", title: "Web build", result: "passed", summary: "The production Web build passed." });
    expect(() => service.submitHandoff(bug.key, {
      sessionId: session.id,
      summary: "The click handler is fixed and ready for policy verification.",
      changes: ["Made login submission idempotent"],
      validation: ["Web build passed"],
      risks: [],
      nextSteps: [],
    })).toThrowError(expect.objectContaining({ code: "REGRESSION_EVIDENCE_REQUIRED" }));
    service.attachEvidence(bug.key, { sessionId: session.id, type: "test", title: "Login regression", result: "passed", summary: "Single-click login regression passed." });
    service.submitHandoff(bug.key, {
      sessionId: session.id,
      summary: "The click handler is fixed with regression evidence and ready for verification.",
      changes: ["Made login submission idempotent"],
      validation: ["Login regression passed"],
      risks: [],
      nextSteps: [],
    });
    expect(service.verifyIssue(bug.key, "policy_passed", "quick-work-policy").data.displayState).toBe("done");
  });

  it("promotes risky Quick Work and blocks it on an explicit Human decision", () => {
    const service = createEmptyTandemService();
    const project = bootstrapProject(service);
    const result = service.createIssue({
      projectKey: project.project.key,
      type: "improvement",
      deliveryPath: "quick",
      source: "human_web",
      title: "Expose customer tokens in diagnostics",
      description: "Make authentication debugging easier for support.",
      acceptanceCriteria: ["Support can diagnose authentication failures"],
      details: {
        currentFriction: "Support cannot see why authentication failed.",
        desiredOutcome: "Support can diagnose failures without exposing secrets.",
        verificationMethod: "Review redaction behavior with security tests.",
      },
      riskFlags: ["security", "privacy"],
      requiredArtifactIds: [project.artifacts[0]!.id],
      affectedModules: ["apps/api"],
      actorType: "human",
      actorId: "product-owner",
    });
    expect(result.data).toMatchObject({ deliveryPath: "planned", displayState: "blocked", risk: { class: "high" } });
    expect(result.data.promotion?.reasons).toContain("Material security impact");
    const snapshot = service.getProjectSnapshot(project.project.key);
    const decision = snapshot.decisionRequests.find((item) => item.subjectId === result.data.id);
    expect(decision).toMatchObject({ status: "pending", kind: "risk" });
    service.resolveDecision(decision!.id, { outcome: "approved", rationale: "Proceed only with redacted diagnostic metadata.", humanId: "security-owner" });
    expect(service.getIssue(result.data.key).displayState).toBe("ready");
  });

  it("derives Ready work from completed dependencies", () => {
    const service = createSeededTandemService();
    expect(service.listReadyIssues("TAN").map((issue) => issue.key)).toEqual(["TAN-2", "TAN-3"]);
    expect(service.getIssue("TAN-4")).toMatchObject({
      displayState: "blocked",
      readinessReasons: ["Blocked by TAN-2", "Blocked by TAN-3"],
    });
  });

  it("requires complete onboarding before a claim", () => {
    const service = createSeededTandemService();
    const session = service.startSession({ issueKey: "TAN-2", agentId: "agent-api" }).data;
    expect(() => service.claimIssue("TAN-2", { sessionId: session.id })).toThrowError(
      expect.objectContaining({ code: "ONBOARDING_REQUIRED" }),
    );
  });

  it("allows only one active claim", () => {
    const service = createSeededTandemService();
    const first = onboard(service, "TAN-2", "agent-api-a");
    const second = onboard(service, "TAN-2", "agent-api-b");
    service.claimIssue("TAN-2", { sessionId: first.id, branch: "codex/tan-2" });
    expect(() => service.claimIssue("TAN-2", { sessionId: second.id })).toThrowError(
      expect.objectContaining({ code: "ISSUE_ALREADY_CLAIMED" }),
    );
  });

  it("marks acknowledged context stale after a new Artifact baseline", () => {
    const service = createSeededTandemService();
    const session = onboard(service, "TAN-2", "agent-api");
    const artifact = service.getProjectSnapshot("TAN").artifacts[0];
    if (!artifact) throw new Error("Seed Artifact is missing");
    const previous = artifact.effectiveRevision;
    service.checkpointArtifact({
      artifactId: artifact.id,
      content: "# New effective product baseline\n\nRepository discovery is required during onboarding.",
      state: "baselined",
      actorType: "human",
      actorId: "product-owner",
    });
    expect(service.getSession(session.id).stale).toBe(true);
    expect(previous?.content).toContain("Agent-first delivery memory");
    expect(service.getProjectSnapshot("TAN").artifacts[0]?.effectiveRevision?.content).toContain("Repository discovery");
  });

  it("requires evidence before handoff and accepts policy verification", () => {
    const service = createSeededTandemService();
    const session = onboard(service, "TAN-2", "agent-api");
    service.claimIssue("TAN-2", { sessionId: session.id });
    service.recordCheckpoint("TAN-2", {
      sessionId: session.id,
      summary: "Implemented the structured onboarding response and stable domain errors.",
      decisions: ["Keep MCP as a thin adapter"],
      risks: [],
    });
    expect(() => service.submitHandoff("TAN-2", {
      sessionId: session.id,
      summary: "The Agent-facing API slice is implemented and ready for verification.",
      changes: ["Added onboarding and claim commands"],
      validation: ["pnpm test"],
      risks: [],
      nextSteps: [],
    })).toThrowError(expect.objectContaining({ code: "EVIDENCE_REQUIRED" }));

    service.attachEvidence("TAN-2", {
      sessionId: session.id,
      type: "test",
      title: "Domain tests",
      result: "passed",
      summary: "All Agent workflow domain tests passed.",
    });
    service.submitHandoff("TAN-2", {
      sessionId: session.id,
      summary: "The Agent-facing API slice is implemented and ready for verification.",
      changes: ["Added onboarding and claim commands"],
      validation: ["pnpm test passed"],
      risks: [],
      nextSteps: ["Connect MCP transport"],
    });
    expect(service.verifyIssue("TAN-2", "policy_passed", "delivery-policy").data.displayState).toBe("done");
    expect(service.getIssue("TAN-4").readinessReasons).toEqual(["Blocked by TAN-3"]);
  });

  it("lets a Human request changes without losing delivery evidence, then approve a later handoff", () => {
    const service = createSeededTandemService();
    const firstSession = onboard(service, "TAN-2", "first-delivery-agent");
    service.claimIssue("TAN-2", { sessionId: firstSession.id });
    service.attachEvidence("TAN-2", {
      sessionId: firstSession.id,
      type: "test",
      title: "First delivery tests",
      result: "passed",
      summary: "The first delivery passed its automated tests.",
    });
    service.submitHandoff("TAN-2", {
      sessionId: firstSession.id,
      summary: "The first delivery is ready for Human verification.",
      changes: ["Implemented the first delivery"],
      validation: ["Automated tests passed"],
      risks: [],
      nextSteps: ["Human experience review"],
    });

    const requested = service.reviewIssue("TAN-2", {
      outcome: "changes_requested",
      rationale: "Keep the evidence visible and clarify the empty state before approval.",
      humanId: "human-reviewer",
    });
    expect(requested.data.displayState).toBe("ready");
    expect(requested.data.activeClaim).toBeUndefined();
    expect(requested.permittedNextActions).toEqual(["start_session"]);
    let snapshot = service.getProjectSnapshot("TAN");
    expect(snapshot.evidence.filter((item) => item.issueId === requested.data.id)).toHaveLength(1);
    expect(snapshot.handoffs.filter((item) => item.issueId === requested.data.id)).toHaveLength(1);
    expect(snapshot.activities).toContainEqual(expect.objectContaining({
      actorType: "human",
      actorId: "human-reviewer",
      action: "issue.changes_requested",
      summary: expect.stringContaining("clarify the empty state"),
    }));

    const secondSession = onboard(service, "TAN-2", "revision-agent");
    service.claimIssue("TAN-2", { sessionId: secondSession.id });
    service.attachEvidence("TAN-2", {
      sessionId: secondSession.id,
      type: "test",
      title: "Revision tests",
      result: "passed",
      summary: "The requested empty-state revision passed its tests.",
    });
    service.submitHandoff("TAN-2", {
      sessionId: secondSession.id,
      summary: "The requested revision is ready for a second Human verification.",
      changes: ["Clarified the empty state"],
      validation: ["Revision tests passed"],
      risks: [],
      nextSteps: ["Human approval"],
    });
    const approved = service.reviewIssue("TAN-2", {
      outcome: "approved",
      rationale: "The revised experience and evidence satisfy the accepted outcome.",
      humanId: "human-reviewer",
    });
    expect(approved.data.displayState).toBe("done");
    expect(approved.data.activeClaim).toBeUndefined();
    snapshot = service.getProjectSnapshot("TAN");
    expect(snapshot.activities).toContainEqual(expect.objectContaining({ action: "issue.completed", actorType: "human" }));
    expect(() => service.reviewIssue("TAN-2", {
      outcome: "changes_requested",
      rationale: "A completed Issue cannot be reviewed again.",
      humanId: "human-reviewer",
    })).toThrowError(expect.objectContaining({ code: "ISSUE_NOT_IN_REVIEW" }));
  });

  it("does not let an Agent recommendation impersonate a decision", () => {
    const service = createSeededTandemService();
    expect(() => service.verifyIssue("TAN-2", "agent_recommendation", "agent-api")).toThrow(DomainError);
  });

  it("turns an Agent Artifact proposal into a Human-approved baseline", () => {
    const service = createSeededTandemService();
    const session = service.startSession({ projectKey: "TAN", agentId: "agent-product" }).data;
    service.confirmUnderstanding(session.id, {
      readContextItemIds: session.contextItems.map((item) => item.id),
      understanding: "I understand the existing Product, System, and Test baselines before proposing a new data contract.",
      intendedChanges: ["Draft and propose an API Contract Artifact"],
      openQuestions: [],
    });
    const draft = service.upsertArtifactDraft({
      projectKey: "TAN",
      type: "api_contract",
      title: "Tandem Agent Planning Contract",
      content: "# Agent planning contract\n\nAgents may draft Artifacts, plan Cycles, create Issues, and request explicit Human decisions.",
      actorId: "agent-product",
    }).data;
    const proposal = service.checkpointArtifact({
      artifactId: draft.artifact.id,
      content: "# Agent planning contract\n\nAgents draft Artifacts and dependency-safe plans; Humans decide material baseline changes.",
      state: "proposed",
      actorType: "agent",
      actorId: "agent-product",
    });
    const decision = service.requestHumanDecision({
      projectKey: "TAN",
      sessionId: session.id,
      subjectType: "artifact_revision",
      subjectId: proposal.id,
      kind: "artifact_baseline",
      question: "Should the Agent planning contract become the effective baseline?",
      proposal: "Baseline the proposed API Contract and mark older Agent context stale.",
      risk: "medium",
      actorId: "agent-product",
    }).data;
    expect(service.getProjectSnapshot("TAN").attention.some((item) => item.subjectId === decision.id)).toBe(true);
    service.resolveDecision(decision.id, { outcome: "approved", rationale: "The contract matches the reviewed Agent-first product boundary.", humanId: "product-owner" });
    const artifact = service.getProjectSnapshot("TAN").artifacts.find((item) => item.id === draft.artifact.id);
    expect(artifact?.effectiveRevision?.id).toBe(proposal.id);
    expect(service.getSession(session.id).stale).toBe(true);
  });

  it("lets an Agent plan work but rejects dependency cycles", () => {
    const service = createSeededTandemService();
    const cycle = service.planCycle({
      projectKey: "TAN",
      name: "Planning Workflow",
      goal: "Prove Agent-authored Cycle and dependency planning through the shared domain service.",
      startsOn: "2026-08-06",
      endsOn: "2026-08-08",
      definitionOfDone: ["Planning tools pass domain tests"],
      state: "proposed",
      actorId: "agent-planner",
    }).data;
    const first = service.createIssue({
      projectKey: "TAN",
      cycleId: cycle.id,
      type: "story",
      title: "Draft requirements through MCP",
      description: "Create a versioned Product Spec from the Coding Agent conversation.",
      acceptanceCriteria: ["Proposal appears in Human Web"],
      requiredArtifactIds: ["artifact-prd"],
      affectedModules: ["packages/domain"],
      actorId: "agent-planner",
    }).data;
    const second = service.createIssue({
      projectKey: "TAN",
      cycleId: cycle.id,
      type: "task",
      title: "Review planning dependencies",
      description: "Validate that the resulting dependency graph remains acyclic.",
      acceptanceCriteria: ["Cyclic dependency is rejected"],
      requiredArtifactIds: ["artifact-prd"],
      affectedModules: ["packages/domain"],
      actorId: "agent-planner",
    }).data;
    service.addIssueDependency({ blockerKey: first.key, blockedKey: second.key, actorId: "agent-planner" });
    expect(service.getIssue(first.key).readinessReasons).toContain("Cycle Planning Workflow is not active");
    expect(() => service.addIssueDependency({ blockerKey: second.key, blockedKey: first.key, actorId: "agent-planner" })).toThrowError(
      expect.objectContaining({ code: "DEPENDENCY_CYCLE" }),
    );
    const activation = service.requestHumanDecision({
      projectKey: "TAN",
      subjectType: "cycle",
      subjectId: cycle.id,
      kind: "cycle_activation",
      question: "Activate the Agent-authored Planning Workflow Cycle?",
      proposal: "Make the reviewed Cycle plan active and expose its dependency-safe Issues.",
      risk: "medium",
      actorId: "agent-planner",
    }).data;
    service.resolveDecision(activation.id, { outcome: "approved", rationale: "The Cycle goal and dependency plan are ready for execution.", humanId: "product-owner" });
    expect(service.getIssue(first.key).displayState).toBe("ready");
    expect(service.getIssue(second.key).readinessReasons).toContain(`Blocked by ${first.key}`);
  });
});

type RepositoryBindingWithLegacyFields = {
  provider?: "github" | "gitlab" | "bitbucket" | "other";
  host?: string;
  owner: string;
  name: string;
  defaultBranch: string;
  remoteUrl?: string;
};
