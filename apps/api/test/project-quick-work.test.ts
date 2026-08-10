import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { TandemRuntime } from "@tandem/db";
import { createEmptyTandemService } from "@tandem/domain";
import { buildApp } from "../src/app.js";

let app: FastifyInstance | undefined;
let sequence = 0;
const idempotency = () => ({ "idempotency-key": `quick-work-${++sequence}` });

afterEach(async () => { await app?.close(); app = undefined; });

describe("first real Project and Quick Work API", () => {
  it("bootstraps a non-sample Project and captures Human Quick Work", async () => {
    app = await buildApp(TandemRuntime.ephemeral(createEmptyTandemService()));
    expect((await app.inject({ method: "GET", url: "/v1/projects" })).json().data).toEqual([]);

    const projectHeaders = idempotency();
    const projectRequest = {
      method: "POST",
      url: "/v1/human/projects",
      headers: projectHeaders,
      payload: {
        key: "SHIP",
        name: "Shipping Experience",
        goal: "Deliver a reliable checkout and shipment tracking experience.",
        owner: "Product Owner",
        targetDate: "2026-09-30",
        successMeasures: ["Quick Bugs complete with evidence"],
        nonGoals: ["Launch Coding Agents"],
        repositories: [{ provider: "github", host: "github.com", owner: "acme", name: "shipping", defaultBranch: "main" }],
        artifacts: [],
      },
    } as const;
    const project = await app.inject(structuredClone(projectRequest));
    expect(project.statusCode).toBe(201);
    expect(project.json().data).toMatchObject({ project: { key: "SHIP" }, readiness: { readyForAgentOnboarding: false } });
    const projectReplay = await app.inject(structuredClone(projectRequest));
    expect(projectReplay.statusCode, JSON.stringify(projectReplay.json())).toBe(201);
    expect(projectReplay.json().data.project.id).toBe(project.json().data.project.id);

    const quickHeaders = idempotency();
    const quickRequest = {
      method: "POST",
      url: "/v1/human/issues",
      headers: quickHeaders,
      payload: {
        projectKey: "SHIP",
        type: "bug",
        deliveryPath: "quick",
        source: "agent_conversation",
        title: "Tracking link opens twice",
        description: "One click sometimes opens two tracking tabs.",
        acceptanceCriteria: ["One click opens one tracking tab"],
        details: {
          observedBehavior: "One click sometimes opens two tabs.",
          expectedBehavior: "One click opens exactly one tab.",
          reproductionContext: "Mobile Safari on the shipment screen.",
          verificationMethod: "Run the tracking-link interaction regression.",
        },
        riskFlags: [],
        requiredArtifactIds: [],
        affectedModules: ["apps/web"],
      },
    } as const;
    const quick = await app.inject(structuredClone(quickRequest));
    expect(quick.statusCode).toBe(201);
    expect(quick.json().data).toMatchObject({ key: "SHIP-1", deliveryPath: "quick", displayState: "ready", intake: { source: "human_web", capturedBy: { actorType: "human", actorId: "development-human" } } });
    const quickReplay = await app.inject(structuredClone(quickRequest));
    expect(quickReplay.statusCode).toBe(201);
    expect(quickReplay.json().data.id).toBe(quick.json().data.id);

    const session = await app.inject({ method: "POST", url: "/v1/agent/sessions", headers: idempotency(), payload: { gitRemote: "git@github.com:acme/shipping.git", issueKey: "SHIP-1" } });
    expect(session.statusCode).toBe(201);
    expect(session.json().data).toMatchObject({ issueId: quick.json().data.id, agentId: "development-agent" });
  });

  it("promotes material Quick Work and exposes Human Attention", async () => {
    app = await buildApp(TandemRuntime.ephemeral(createEmptyTandemService()));
    await app.inject({
      method: "POST", url: "/v1/human/projects", headers: idempotency(), payload: {
        key: "SAFE", name: "Safe Delivery", goal: "Deliver secure operational improvements for the pilot.", owner: "Security Owner", targetDate: "2026-09-30",
        successMeasures: [], nonGoals: [], repositories: [{ provider: "github", host: "github.com", owner: "acme", name: "safe-delivery", defaultBranch: "main" }], artifacts: [],
      },
    });
    const quick = await app.inject({
      method: "POST", url: "/v1/human/issues", headers: idempotency(), payload: {
        projectKey: "SAFE", type: "chore", deliveryPath: "quick", source: "human_web", title: "Rotate production encryption keys",
        description: "Rotate production encryption keys without service interruption.", acceptanceCriteria: ["Existing encrypted data remains readable"],
        details: { maintenanceOutcome: "Production keys are rotated safely.", verificationMethod: "Run recovery and rollback rehearsal." },
        riskFlags: ["security", "destructive"], requiredArtifactIds: [], affectedModules: ["deploy"],
      },
    });
    expect(quick.json().data).toMatchObject({ deliveryPath: "planned", displayState: "blocked", risk: { class: "high" } });
    const snapshot = await app.inject({ method: "GET", url: "/v1/projects/SAFE/snapshot" });
    expect(snapshot.json().data.attention.some((item: { subjectId: string }) => item.subjectId === quick.json().data.risk.requiredDecisionId)).toBe(true);
  });
});
