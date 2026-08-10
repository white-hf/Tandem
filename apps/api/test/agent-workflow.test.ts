import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

let app: FastifyInstance | undefined;
let idempotencySequence = 0;
const mutationHeaders = () => ({ "idempotency-key": `api-test-${++idempotencySequence}` });
afterEach(async () => { await app?.close(); app = undefined; });

describe("Agent REST workflow", () => {
  it("exposes health and calculated Ready work", async () => {
    app = await buildApp();
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ status: "ok", product: "tandem", storage: "memory" });

    const ready = await app.inject({ method: "GET", url: "/v1/projects/TAN/ready-issues" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json().data.map((issue: { key: string }) => issue.key)).toEqual(["TAN-2", "TAN-3"]);
  });

  it("onboards, claims, records evidence, and hands off", async () => {
    app = await buildApp();
    const started = await app.inject({
      method: "POST",
      url: "/v1/agent/sessions",
      headers: mutationHeaders(),
      payload: { agentId: "api-test-agent", issueKey: "TAN-2" },
    });
    expect(started.statusCode).toBe(201);
    const session = started.json().data as { id: string; contextItems: Array<{ id: string; required: boolean }> };

    const earlyClaim = await app.inject({
      method: "POST",
      url: "/v1/agent/issues/TAN-2/claim",
      headers: mutationHeaders(),
      payload: { sessionId: session.id },
    });
    expect(earlyClaim.statusCode).toBe(409);
    expect(earlyClaim.json().error.code).toBe("ONBOARDING_REQUIRED");

    const confirmed = await app.inject({
      method: "POST",
      url: `/v1/agent/sessions/${session.id}/understanding`,
      headers: mutationHeaders(),
      payload: {
        readContextItemIds: session.contextItems.filter((item) => item.required).map((item) => item.id),
        understanding: "I understand the current Artifact baselines, Issue acceptance criteria, code boundary, and verification command.",
        intendedChanges: ["Implement only the tested API slice"],
        openQuestions: [],
      },
    });
    expect(confirmed.statusCode).toBe(200);

    expect((await app.inject({ method: "POST", url: "/v1/agent/issues/TAN-2/claim", headers: mutationHeaders(), payload: { sessionId: session.id } })).statusCode).toBe(200);
    expect((await app.inject({
      method: "POST",
      url: "/v1/agent/issues/TAN-2/evidence",
      headers: mutationHeaders(),
      payload: { sessionId: session.id, type: "test", title: "API integration", result: "passed", summary: "The full Agent API workflow passed." },
    })).statusCode).toBe(201);
    expect((await app.inject({
      method: "POST",
      url: "/v1/agent/issues/TAN-2/handoff",
      headers: mutationHeaders(),
      payload: {
        sessionId: session.id,
        summary: "The API workflow is complete and ready for Human or policy verification.",
        changes: ["Added and validated the Agent API workflow"],
        validation: ["Vitest API integration passed"],
        risks: [],
        nextSteps: ["Review attached evidence"],
      },
    })).statusCode).toBe(201);

    const snapshot = await app.inject({ method: "GET", url: "/v1/projects/TAN/snapshot" });
    const tan2 = snapshot.json().data.issues.find((issue: { key: string }) => issue.key === "TAN-2");
    expect(tan2.displayState).toBe("review");
    expect(snapshot.json().data.attention.some((item: { subjectId: string }) => item.subjectId === tan2.id)).toBe(true);
  });

  it("lets an Agent propose an Artifact and a Human baseline it", async () => {
    app = await buildApp();
    const draft = await app.inject({
      method: "POST",
      url: "/v1/agent/artifacts/drafts",
      headers: mutationHeaders(),
      payload: {
        projectKey: "TAN",
        type: "product_brief",
        title: "API Planning Proposal",
        content: "# API Planning Proposal\n\nAgents create proposals; authenticated Humans decide whether they become effective.",
        actorId: "api-planner",
      },
    });
    expect(draft.statusCode).toBe(201);
    const artifactId = draft.json().data.artifact.id as string;
    const proposal = await app.inject({
      method: "POST",
      url: "/v1/agent/artifacts/checkpoints",
      headers: mutationHeaders(),
      payload: {
        artifactId,
        content: "# API Planning Proposal\n\nAgents create auditable proposals and Human approval makes a revision effective.",
        state: "proposed",
        actorId: "api-planner",
      },
    });
    expect(proposal.statusCode).toBe(201);
    const revisionId = proposal.json().data.id as string;
    const requested = await app.inject({
      method: "POST",
      url: "/v1/agent/decision-requests",
      headers: mutationHeaders(),
      payload: {
        projectKey: "TAN",
        subjectType: "artifact_revision",
        subjectId: revisionId,
        kind: "artifact_baseline",
        question: "Should this planning proposal become effective?",
        proposal: "Baseline the proposed Product Brief for subsequent Agent onboarding.",
        risk: "medium",
        actorId: "api-planner",
      },
    });
    expect(requested.statusCode).toBe(201);
    const requestId = requested.json().data.id as string;

    const decided = await app.inject({
      method: "POST",
      url: `/v1/human/decision-requests/${requestId}`,
      headers: mutationHeaders(),
      payload: { outcome: "approved", rationale: "The proposal matches the reviewed Product boundary.", humanId: "product-owner" },
    });
    expect(decided.statusCode).toBe(200);
    expect(decided.json().data).toMatchObject({ status: "approved", decidedBy: "development-human" });

    const snapshot = await app.inject({ method: "GET", url: "/v1/projects/TAN/snapshot" });
    const artifact = snapshot.json().data.artifacts.find((item: { id: string }) => item.id === artifactId);
    expect(artifact.effectiveRevision.id).toBe(revisionId);
    expect(snapshot.json().data.attention.some((item: { subjectId: string }) => item.subjectId === requestId)).toBe(false);
  });
});
