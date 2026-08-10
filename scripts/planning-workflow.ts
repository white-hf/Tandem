const api = process.env.TANDEM_API_URL ?? "http://127.0.0.1:4310";
let commandSequence = 0;

async function command<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `planning-workflow-${++commandSequence}`,
      ...(process.env.TANDEM_AGENT_TOKEN ? { authorization: `Bearer ${process.env.TANDEM_AGENT_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const result = await response.json() as T & { error?: { code: string; message: string } };
  if (!response.ok) throw new Error(`${response.status} ${result.error?.code}: ${result.error?.message}`);
  return result;
}

console.log("Tandem conversation-to-plan workflow");
const started = await command<{ data: { id: string; contextItems: Array<{ id: string; required: boolean }> } }>("/v1/agent/sessions", {
  agentId: "codex-product-planner",
  projectKey: "TAN",
});
await command(`/v1/agent/sessions/${started.data.id}/understanding`, {
  readContextItemIds: started.data.contextItems.filter((item) => item.required).map((item) => item.id),
  understanding: "I understand the effective Product, System, and Test baselines and will propose, rather than silently replace, the next pilot scope.",
  intendedChanges: ["Create a Pilot Product Brief proposal", "Plan a dependency-safe Cycle", "Request explicit Human baseline and Cycle decisions"],
  openQuestions: [],
});
console.log("1. Planner Session onboarded from current baselines");

const draft = await command<{ data: { artifact: { id: string }; revision: { id: string } } }>("/v1/agent/artifacts/drafts", {
  projectKey: "TAN",
  type: "product_brief",
  title: "Tandem Local Pilot Brief",
  content: "# Local Pilot Brief\n\nValidate conversation-to-baseline planning, dependency-safe parallel execution, Human decisions, and durable handoffs with one 3–5 person builder team.",
  actorId: "codex-product-planner",
});
const proposal = await command<{ data: { id: string } }>("/v1/agent/artifacts/checkpoints", {
  artifactId: draft.data.artifact.id,
  content: "# Local Pilot Brief\n\nRun ten real delivery loops. Require current-context onboarding, evidence, and handoff; keep Agent launching and Git merge outside Tandem.",
  state: "proposed",
  actorId: "codex-product-planner",
});
console.log(`2. Product Brief proposed as revision ${proposal.data.id.slice(0, 8)}`);

const cycle = await command<{ data: { id: string; number: number; name: string } }>("/v1/agent/cycles/plan", {
  projectKey: "TAN",
  name: "Conversation-to-Delivery Pilot",
  goal: "Prove Agent-authored baselines and dependency-aware planning before parallel implementation begins.",
  startsOn: "2026-08-06",
  endsOn: "2026-08-12",
  definitionOfDone: ["Human baselines the Pilot Brief", "Two independent Issues can be started in parallel", "Integration work remains blocked until both finish"],
  state: "proposed",
  actorId: "codex-product-planner",
});
console.log(`3. Proposed Cycle ${cycle.data.number}: ${cycle.data.name}`);

const specIssue = await command<{ data: { key: string; id: string } }>("/v1/agent/issues", {
  projectKey: "TAN",
  cycleId: cycle.data.id,
  type: "story",
  title: "Baseline pilot requirements from Agent conversation",
  description: "Review and baseline the Product Brief produced through the Coding Agent planning conversation.",
  acceptanceCriteria: ["Effective baseline is visible in Human Web", "Decision has Human provenance"],
  requiredArtifactIds: ["artifact-prd"],
  affectedModules: ["docs/prd", "packages/domain"],
  actorId: "codex-product-planner",
});
const integrationIssue = await command<{ data: { key: string; id: string } }>("/v1/agent/issues", {
  projectKey: "TAN",
  cycleId: cycle.data.id,
  type: "task",
  title: "Integrate the approved pilot planning flow",
  description: "Verify that approved baselines, Cycle activation, Issues, dependencies, and Human Web remain synchronized.",
  acceptanceCriteria: ["Planning flow passes end to end", "Integration waits for the baseline Issue"],
  requiredArtifactIds: ["artifact-prd", "artifact-design"],
  affectedModules: ["apps/api", "apps/web", "packages/domain"],
  actorId: "codex-product-planner",
});
await command("/v1/agent/issue-dependencies", {
  blockerKey: specIssue.data.key,
  blockedKey: integrationIssue.data.key,
  actorId: "codex-product-planner",
});
console.log(`4. Planned ${specIssue.data.key} -> ${integrationIssue.data.key} without a cyclic dependency`);

await command("/v1/agent/decision-requests", {
  projectKey: "TAN",
  sessionId: started.data.id,
  subjectType: "artifact_revision",
  subjectId: proposal.data.id,
  kind: "artifact_baseline",
  question: "Baseline the Tandem Local Pilot Brief?",
  proposal: "Make the proposed ten-loop local pilot scope effective for subsequent Agent onboarding.",
  risk: "medium",
  actorId: "codex-product-planner",
});
await command("/v1/agent/decision-requests", {
  projectKey: "TAN",
  sessionId: started.data.id,
  subjectType: "cycle",
  subjectId: cycle.data.id,
  kind: "cycle_activation",
  question: "Activate the Conversation-to-Delivery Pilot Cycle?",
  proposal: "Complete Cycle 0 and make the proposed pilot Cycle the active team timebox.",
  risk: "medium",
  actorId: "codex-product-planner",
});
console.log("5. Two explicit Human decisions requested; no Human identity was impersonated");
console.log("Open http://127.0.0.1:4311, choose Attention, and review the proposals.");
