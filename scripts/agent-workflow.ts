const api = process.env.TANDEM_API_URL ?? "http://127.0.0.1:4310";
let commandSequence = 0;

async function command<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? {
      "content-type": "application/json",
      "idempotency-key": `agent-workflow-${++commandSequence}`,
      ...(process.env.TANDEM_AGENT_TOKEN ? { authorization: `Bearer ${process.env.TANDEM_AGENT_TOKEN}` } : {}),
    } : process.env.TANDEM_AGENT_TOKEN ? { authorization: `Bearer ${process.env.TANDEM_AGENT_TOKEN}` } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as T & { error?: { code: string; message: string } };
  if (!response.ok) throw new Error(`${response.status} ${result.error?.code}: ${result.error?.message}`);
  return result;
}

console.log("Tandem Agent workflow · TAN-2");
const started = await command<{ data: { id: string; contextItems: Array<{ id: string; label: string; locator: string; required: boolean }> }; permittedNextActions: string[] }>(
  "/v1/agent/sessions",
  { agentId: "codex-demo", issueKey: "TAN-2" },
);
console.log(`1. Session ${started.data.id.slice(0, 8)} started; read ${started.data.contextItems.length} context items`);
for (const item of started.data.contextItems) console.log(`   - ${item.label}: ${item.locator}`);

await command(`/v1/agent/sessions/${started.data.id}/understanding`, {
  readContextItemIds: started.data.contextItems.filter((item) => item.required).map((item) => item.id),
  understanding: "I understand Tandem's Agent-first boundaries, current Product and System baselines, the TAN-2 acceptance criteria, and the API/domain modules I must change.",
  intendedChanges: ["Implement structured Agent endpoints", "Keep authority and readiness rules inside the shared domain service"],
  openQuestions: [],
});
console.log("2. Current Artifact and code context confirmed");

await command("/v1/agent/issues/TAN-2/claim", { sessionId: started.data.id, branch: "codex/tan-2-agent-api" });
console.log("3. TAN-2 claimed with a unique active claim");

await command("/v1/agent/issues/TAN-2/checkpoints", {
  sessionId: started.data.id,
  summary: "Implemented structured onboarding, claim, checkpoint, evidence, and handoff endpoints over the shared domain service.",
  decisions: ["Return permitted next actions and Human Web links from every Agent command"],
  risks: ["Iteration 0 uses process-local state until PostgreSQL lands"],
});
console.log("4. Semantic implementation checkpoint recorded");

await command("/v1/agent/issues/TAN-2/evidence", {
  sessionId: started.data.id,
  type: "test",
  title: "Agent workflow smoke test",
  result: "passed",
  summary: "Onboarding and claim policies accepted the complete current-context workflow.",
});
console.log("5. Validation evidence attached");

await command("/v1/agent/issues/TAN-2/handoff", {
  sessionId: started.data.id,
  summary: "The Agent-facing vertical API is implemented and handed off with structured evidence for policy or Human verification.",
  changes: ["Agent Session onboarding API", "Dependency-safe Issue claim", "Checkpoint, evidence, and handoff commands"],
  validation: ["Agent workflow smoke test passed"],
  risks: ["State is reset when the development API restarts"],
  nextSteps: ["Connect MCP transport", "Replace the in-memory repository with PostgreSQL"],
});
console.log("6. Handoff submitted; Human Web Attention now contains TAN-2");
console.log("Open http://127.0.0.1:4311 and refresh to review the same state.");
