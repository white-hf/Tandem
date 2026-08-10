import type { ActorContext } from "@tandem/contracts";
import { TandemRuntime } from "@tandem/db";
import { createSeededTandemService, type TandemService } from "@tandem/domain";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AuthProvider } from "../src/auth.js";

const human: ActorContext = {
  id: "delivery-reviewer",
  type: "human",
  displayName: "Delivery Reviewer",
  roles: ["owner"],
  projectKeys: ["TAN"],
  capabilities: ["context:read", "decision:resolve"],
  development: false,
};

const agent: ActorContext = {
  id: "delivery-agent",
  type: "agent",
  displayName: "Delivery Agent",
  roles: ["coding_agent"],
  projectKeys: ["TAN"],
  capabilities: ["context:read", "execution:write"],
  development: false,
};

class FixedAuth implements AuthProvider {
  readonly mode = "tokens" as const;
  constructor(private readonly actor: ActorContext) {}
  async authenticate(_request: FastifyRequest): Promise<ActorContext> { return this.actor; }
}

function prepareReview(): TandemService {
  const service = createSeededTandemService();
  const session = service.startSession({ issueKey: "TAN-2", agentId: "implementation-agent" }).data;
  service.confirmUnderstanding(session.id, {
    readContextItemIds: session.contextItems.map((item) => item.id),
    understanding: "I read the required baselines and understand the delivery review API test fixture.",
    intendedChanges: ["Prepare one review-state Issue"],
    openQuestions: [],
  });
  service.claimIssue("TAN-2", { sessionId: session.id });
  service.attachEvidence("TAN-2", { sessionId: session.id, type: "test", title: "API fixture tests", result: "passed", summary: "The review fixture passed." });
  service.submitHandoff("TAN-2", {
    sessionId: session.id,
    summary: "The API fixture delivery is ready for Human review.",
    changes: ["Prepared the review fixture"],
    validation: ["Fixture test passed"],
    risks: [],
    nextSteps: ["Resolve Human review"],
  });
  return service;
}

describe("Human Issue delivery review API", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });

  it("records requested changes idempotently and rejects a conflicting replay", async () => {
    app = await buildApp(TandemRuntime.ephemeral(prepareReview()), new FixedAuth(human));
    const request = {
      method: "POST" as const,
      url: "/v1/human/issues/TAN-2/review",
      headers: { "idempotency-key": "review-changes-001" },
      payload: { outcome: "changes_requested", rationale: "Clarify the evidence summary before this delivery is complete." },
    };
    const first = await app.inject(structuredClone(request));
    const replay = await app.inject(structuredClone(request));
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().data.displayState).toBe("ready");
    expect(first.json().data.activeClaim).toBeUndefined();
    expect(replay.statusCode).toBe(200);
    expect(replay.json().data.version).toBe(first.json().data.version);

    const snapshot = await app.inject({ method: "GET", url: "/v1/projects/TAN/snapshot" });
    expect(snapshot.json().data.activities.filter((item: { action: string }) => item.action === "issue.changes_requested")).toHaveLength(1);

    const conflict = await app.inject({
      ...request,
      payload: { outcome: "approved", rationale: "This is a different command using the same idempotency key." },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("approves and completes delivery with authenticated Human authority", async () => {
    app = await buildApp(TandemRuntime.ephemeral(prepareReview()), new FixedAuth(human));
    const response = await app.inject({
      method: "POST",
      url: "/v1/human/issues/TAN-2/review",
      headers: { "idempotency-key": "review-approve-001" },
      payload: { outcome: "approved", rationale: "The accepted outcome and delivery evidence are complete." },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().data.displayState).toBe("done");
    expect(response.json().data.activeClaim).toBeUndefined();
  });

  it("rejects an Agent before mutating a Human delivery decision", async () => {
    app = await buildApp(TandemRuntime.ephemeral(prepareReview()), new FixedAuth(agent));
    const response = await app.inject({
      method: "POST",
      url: "/v1/human/issues/TAN-2/review",
      headers: { "idempotency-key": "review-agent-denied-001" },
      payload: { outcome: "approved", rationale: "An Agent must not approve Human delivery review." },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("AUTHORIZATION_DENIED");
    const issue = await app.inject({ method: "GET", url: "/v1/issues/TAN-2" });
    expect(issue.json().data.displayState).toBe("review");
  });
});
