import { describe, expect, it } from "vitest";
import { createEmptyTandemService, createSeededTandemService } from "@tandem/domain";
import { PostgresEventStore, PostgresIdentityRepository, PostgresStateRepository, StateRevisionConflictError, TandemRuntime } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgresStateRepository", () => {
  it("projects first-real-project bindings and Quick Work across restart", async () => {
    const workspaceId = `test-${randomUUID()}`;
    const repository = new PostgresStateRepository(databaseUrl!, workspaceId);
    const runtime = await TandemRuntime.open(repository, createEmptyTandemService);
    const project = (await runtime.mutate((service) => service.createProject({
      key: "OPS",
      name: "Operations Delivery",
      goal: "Deliver a real repository through Agent-first planning and execution.",
      owner: "Operations Owner",
      targetDate: "2026-09-30",
      successMeasures: [],
      nonGoals: [],
      repositories: [{ provider: "github", host: "github.com", owner: "acme", name: "operations", defaultBranch: "main" }],
      artifacts: [],
      actorType: "human",
      actorId: "operations-owner",
    }))).data.project;
    const issue = (await runtime.mutate((service) => service.createIssue({
      projectKey: project.key,
      type: "chore",
      deliveryPath: "quick",
      source: "human_web",
      title: "Refresh local development certificate",
      description: "Replace the expired local development certificate.",
      acceptanceCriteria: ["Local HTTPS starts without certificate errors"],
      details: { maintenanceOutcome: "Local certificate is current.", verificationMethod: "Start the local HTTPS health check." },
      riskFlags: [],
      requiredArtifactIds: [],
      affectedModules: ["deploy"],
      actorType: "human",
      actorId: "operations-owner",
    }))).data;
    expect(await repository.projectionCounts()).toMatchObject({ projects: 1, repositories: 1, issues: 1 });
    await runtime.close();

    const restarted = await TandemRuntime.open(new PostgresStateRepository(databaseUrl!, workspaceId), createEmptyTandemService);
    expect(restarted.read((service) => service.getIssue(issue.key))).toMatchObject({ deliveryPath: "quick", intake: { source: "human_web" }, risk: { class: "low" } });
    expect((await restarted.mutate((service) => service.startSession({ gitRemote: "https://github.com/acme/operations.git", agentId: "restart-agent" }))).data.projectId).toBe(project.id);
    await restarted.close();
  });

  it("commits snapshot and relational projection with optimistic concurrency", async () => {
    const workspaceId = `test-${randomUUID()}`;
    const firstRepository = new PostgresStateRepository(databaseUrl!, workspaceId);
    const first = await TandemRuntime.open(firstRepository, createSeededTandemService);
    const staleRepository = new PostgresStateRepository(databaseUrl!, workspaceId);
    const stale = await TandemRuntime.open(staleRepository, createSeededTandemService);

    const session = (await first.mutate((service) => service.startSession({ issueKey: "TAN-2", agentId: "postgres-agent" }))).data;
    await first.mutate((service) => service.confirmUnderstanding(session.id, {
      readContextItemIds: session.contextItems.map((item) => item.id),
      understanding: "I read all current product, system, test, repository, code, and verification context.",
      intendedChanges: ["Verify PostgreSQL transactional projection"],
      openQuestions: [],
    }));
    await first.mutate((service) => service.claimIssue("TAN-2", { sessionId: session.id }));

    await expect(stale.mutate((service) => service.startSession({ issueKey: "TAN-3", agentId: "stale-agent" }))).rejects.toBeInstanceOf(StateRevisionConflictError);
    expect(stale.read((service) => service.getProjectSnapshot("TAN").sessions)).toHaveLength(0);

    const counts = await firstRepository.projectionCounts();
    expect(counts).toMatchObject({ projects: 1, cycles: 1, issues: 4, dependencies: 4, artifacts: 3, revisions: 4, sessions: 1, claims: 1 });

    await stale.close();
    await first.close();
    const restarted = await TandemRuntime.open(new PostgresStateRepository(databaseUrl!, workspaceId), createSeededTandemService);
    expect(restarted.read((service) => service.getIssue("TAN-2")).activeClaim?.agentId).toBe("postgres-agent");
    await restarted.close();
  });

  it("authenticates scoped principals by hashed credential and revokes them", async () => {
    const stateRepository = new PostgresStateRepository(databaseUrl!);
    await stateRepository.migrate();
    const identities = new PostgresIdentityRepository(databaseUrl!);
    const token = "integration-agent-token-that-is-longer-than-thirty-two-characters";
    await identities.provision({
      id: "integration-agent",
      type: "agent",
      displayName: "Integration Agent",
      roles: ["coding_agent"],
      projectKeys: ["TAN"],
      capabilities: ["context:read", "execution:write"],
      token,
    });
    const actor = await identities.authenticate(token);
    expect(actor).toMatchObject({ id: "integration-agent", type: "agent", projectKeys: ["TAN"], development: false });
    await identities.revoke("integration-agent");
    await expect(identities.authenticate(token)).resolves.toBeUndefined();
    await identities.close();
    await stateRepository.close();
  });

  it("serializes concurrent identical retries into one committed mutation", async () => {
    const workspaceId = `test-${randomUUID()}`;
    const runtime = await TandemRuntime.open(new PostgresStateRepository(databaseUrl!, workspaceId), createSeededTandemService);
    const context = { principalId: "retry-agent", key: `retry-${randomUUID()}`, requestHash: "same-request-hash", statusCode: 201 };
    const [first, second] = await Promise.all([
      runtime.mutateIdempotently((service) => service.startSession({ issueKey: "TAN-2", agentId: "retry-agent" }), context),
      runtime.mutateIdempotently((service) => service.startSession({ issueKey: "TAN-2", agentId: "retry-agent" }), context),
    ]);
    expect(second.data.id).toBe(first.data.id);
    expect(runtime.read((service) => service.getProjectSnapshot("TAN").sessions)).toHaveLength(1);
    await runtime.close();
  });

  it("deduplicates GitHub deliveries and links checks through pull requests", async () => {
    const migrations = new PostgresStateRepository(databaseUrl!, `test-${randomUUID()}`);
    await migrations.migrate();
    const events = new PostgresEventStore(databaseUrl!);
    const deliveryId = `delivery-${randomUUID()}`;
    const pull = {
      repository: { full_name: "whitetang/tandem" },
      pull_request: { number: 4242, title: "Pilot PR", body: "tandem-issue:TAN-2", html_url: "https://github.com/whitetang/tandem/pull/4242", state: "open" },
    };
    const accepted = await events.ingestGitHub(deliveryId, "pull_request", "pull-digest", pull, ["TAN-2"]);
    expect(accepted.artifacts[0]).toMatchObject({ kind: "pull_request", issueKey: "TAN-2", externalId: "4242" });
    await expect(events.ingestGitHub(deliveryId, "pull_request", "pull-digest", pull, ["TAN-2"])).resolves.toMatchObject({ duplicate: true });

    const check = await events.ingestGitHub(`delivery-${randomUUID()}`, "check_run", "check-digest", {
      repository: { full_name: "whitetang/tandem" },
      check_run: { id: 9898, name: "test", status: "completed", conclusion: "success", pull_requests: [{ number: 4242 }] },
    }, ["TAN-2"]);
    expect(check.artifacts[0]).toMatchObject({ kind: "check", issueKey: "TAN-2", state: "success" });
    expect((await events.eventsAfter(0)).some((event) => event.type === "git.updated")).toBe(true);
    await events.close();
    await migrations.close();
  });
});
import { randomUUID } from "node:crypto";
