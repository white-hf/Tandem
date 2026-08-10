import { createHmac } from "node:crypto";
import { MemoryEventStore } from "@tandem/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("GitHub webhook projection", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => { vi.unstubAllEnvs(); await app?.close(); });

  it("rejects invalid signatures and safely deduplicates linked pull requests", async () => {
    const secret = "github-webhook-test-secret";
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", secret);
    const events = new MemoryEventStore();
    app = await buildApp(undefined, undefined, events);
    const payload = {
      repository: { full_name: "whitetang/tandem" },
      pull_request: {
        number: 42,
        title: "Complete Agent API",
        body: "tandem-issue:TAN-2\ntandem-session:11111111-1111-4111-8111-111111111111",
        html_url: "https://github.com/whitetang/tandem/pull/42",
        state: "open",
        merged: false,
      },
    };
    const raw = JSON.stringify(payload);
    const headers = {
      "content-type": "application/json",
      "x-github-delivery": "delivery-42",
      "x-github-event": "pull_request",
      "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`,
    };

    const invalid = await app.inject({ method: "POST", url: "/v1/integrations/github/webhook", headers: { ...headers, "x-hub-signature-256": "sha256=invalid" }, payload: raw });
    expect(invalid.statusCode).toBe(401);

    const accepted = await app.inject({ method: "POST", url: "/v1/integrations/github/webhook", headers, payload: raw });
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json().data.artifacts[0]).toMatchObject({ kind: "pull_request", issueKey: "TAN-2", externalId: "42" });

    const duplicate = await app.inject({ method: "POST", url: "/v1/integrations/github/webhook", headers, payload: raw });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().data.duplicate).toBe(true);

    const snapshot = await app.inject({ method: "GET", url: "/v1/projects/TAN/snapshot" });
    expect(snapshot.json().data.gitArtifacts).toHaveLength(1);
    expect((await events.eventsAfter(0)).some((event) => event.type === "git.updated")).toBe(true);
  });
});
