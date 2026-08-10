import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSeededTandemService } from "@tandem/domain";
import { FileStateRepository, TandemRuntime } from "../src/index.js";

describe("FileStateRepository", () => {
  it("atomically restores Agent workflow state", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tandem-state-"));
    const repository = new FileStateRepository(join(directory, "state.json"));
    const runtime = await TandemRuntime.open(repository, createSeededTandemService);

    const session = (await runtime.mutate((service) => service.startSession({ issueKey: "TAN-2", agentId: "persistent-agent" }))).data;
    await runtime.mutate((service) => service.confirmUnderstanding(session.id, {
      readContextItemIds: session.contextItems.map((item) => item.id),
      understanding: "I understand the current baselines, relevant modules, dependency state, and repository verification commands.",
      intendedChanges: ["Prove restored state"],
      openQuestions: [],
    }));
    await runtime.mutate((service) => service.claimIssue("TAN-2", { sessionId: session.id }));

    const envelope = JSON.parse(readFileSync(repository.path, "utf8"));
    expect(envelope.formatVersion).toBe(3);
    expect(envelope.revision).toBe(4);
    expect(envelope.savedAt).toBeTruthy();

    const restarted = await TandemRuntime.open(new FileStateRepository(repository.path), createSeededTandemService);
    expect(restarted.read((service) => service.getIssue("TAN-2")).activeClaim?.agentId).toBe("persistent-agent");
    expect(restarted.read((service) => service.getSession(session.id)).state).toBe("active");
  });

  it("replays a persisted idempotent result before re-running a non-repeatable command", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tandem-idempotency-"));
    const repository = new FileStateRepository(join(directory, "state.json"));
    const runtime = await TandemRuntime.open(repository, createSeededTandemService);
    const context = { principalId: "project-owner", key: "create-acme-001", requestHash: "create-acme-request", statusCode: 201 };
    const command = (service: Parameters<Parameters<typeof runtime.mutateIdempotently>[0]>[0]) => service.createProject({
      key: "ACME",
      name: "ACME Delivery",
      goal: "Deliver ACME through an Agent-first collaboration workflow.",
      owner: "Product Owner",
      targetDate: "2026-09-30",
      successMeasures: [],
      nonGoals: [],
      repositories: [{ provider: "github" as const, host: "github.com", owner: "acme", name: "delivery", defaultBranch: "main" }],
      artifacts: [],
      actorType: "human" as const,
      actorId: "project-owner",
    });

    const first = await runtime.mutateIdempotently(command, context);
    const replay = await runtime.mutateIdempotently(command, context);
    expect(replay.data.project.id).toBe(first.data.project.id);
    expect(runtime.read((service) => service.listProjects().filter((project) => project.key === "ACME"))).toHaveLength(1);

    await runtime.close();
    const restarted = await TandemRuntime.open(new FileStateRepository(repository.path), createSeededTandemService);
    const afterRestart = await restarted.mutateIdempotently(command, context);
    expect(afterRestart.data.project.id).toBe(first.data.project.id);
    await restarted.close();
  });
});
