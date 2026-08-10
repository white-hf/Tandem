import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = new URL(process.env.TANDEM_MCP_URL ?? "http://127.0.0.1:4310/mcp");
const api = process.env.TANDEM_API_URL ?? `${endpoint.protocol}//${endpoint.host}`;
const projectKey = (process.env.TANDEM_PROJECT_KEY ?? "QWK").toUpperCase();
const repository = process.env.TANDEM_GIT_REPOSITORY ?? "acme/quick-work-demo";
const [repositoryOwner, repositoryName] = repository.split("/");
if (!repositoryOwner || !repositoryName) throw new Error("TANDEM_GIT_REPOSITORY must be owner/repository");

const headers: Record<string, string> = {};
if (process.env.TANDEM_AGENT_TOKEN) headers.authorization = `Bearer ${process.env.TANDEM_AGENT_TOKEN}`;
const transport = new StreamableHTTPClientTransport(endpoint, { requestInit: { headers } });
const client = new Client({ name: "tandem-quick-work-demo", version: "1.0.0" });

function data<T>(result: { isError?: boolean; structuredContent?: unknown }): T {
  if (result.isError) throw new Error(JSON.stringify(result.structuredContent));
  const content = result.structuredContent as { data?: T } | undefined;
  if (!content?.data) throw new Error(`MCP result did not contain data: ${JSON.stringify(result.structuredContent)}`);
  return content.data;
}

const call = async <T>(name: string, arguments_: Record<string, unknown>) => data<T>(
  await client.callTool({ name, arguments: arguments_ }) as { isError?: boolean; structuredContent?: unknown },
);

await client.connect(transport);
try {
  const resources = await client.listResources();
  const projectExists = resources.resources.some((resource) => resource.uri === `tandem://projects/${projectKey}/baseline`);
  if (!projectExists) {
    await call("create_project", {
      key: projectKey,
      name: "Quick Work MCP Demo",
      goal: "Prove conversation-to-Quick-Bug delivery through standard remote MCP.",
      owner: "Product Owner",
      targetDate: "2026-09-30",
      successMeasures: ["A Quick Bug completes with regression evidence"],
      nonGoals: ["Launch or schedule Coding Agents"],
      repositories: [{ provider: "github", host: "github.com", owner: repositoryOwner, name: repositoryName, defaultBranch: "main" }],
      artifacts: [],
    });
    console.log(`1. Created real Project ${projectKey} and bound ${repository}`);
  } else {
    console.log(`1. Reusing Project ${projectKey}`);
  }

  const issue = await call<{ id: string; key: string }>("create_issue", {
    projectKey,
    type: "bug",
    deliveryPath: "quick",
    source: "agent_conversation",
    sourceReference: "demo:mcp-quick-workflow",
    title: "Quick Add keyboard shortcut opens twice",
    description: "The Quick Add shortcut sometimes opens two capture dialogs.",
    originalStatement: "Please fix the Quick Add shortcut opening twice.",
    acceptanceCriteria: ["One shortcut press opens exactly one Quick Add dialog"],
    details: {
      observedBehavior: "One shortcut press sometimes opens two dialogs.",
      expectedBehavior: "One shortcut press opens exactly one dialog.",
      reproductionContext: "Desktop browser after an SSE reconnect.",
      verificationMethod: "Run the Quick Add keyboard interaction regression.",
    },
    riskFlags: [],
    requiredArtifactIds: [],
    affectedModules: ["apps/web"],
  });
  console.log(`2. Agent captured ${issue.key} as Quick Work`);

  const session = await call<{ id: string; contextItems: Array<{ id: string; required: boolean }> }>("start_session", { issueKey: issue.key, gitRemote: `git@github.com:${repository}.git` });
  await call("confirm_understanding", {
    sessionId: session.id,
    readContextItemIds: session.contextItems.filter((item) => item.required).map((item) => item.id),
    understanding: "I read the repository instructions, affected code boundary, Issue intake, acceptance, and verification command.",
    intendedChanges: ["Fix only the duplicate Quick Add shortcut behavior", "Run the interaction regression"],
    openQuestions: [],
  });
  await call("claim_issue", { issueKey: issue.key, sessionId: session.id, branch: `codex/${issue.key.toLowerCase()}-quick-add` });
  console.log("3. Agent onboarded and acquired the unique claim");

  await call("record_checkpoint", { issueKey: issue.key, sessionId: session.id, summary: "Made the Quick Add shortcut listener idempotent across reconnects.", decisions: ["Keep event ownership inside the Web shell"], risks: [] });
  await call("attach_evidence", { issueKey: issue.key, sessionId: session.id, type: "test", title: "Quick Add regression", result: "passed", summary: "Repeated reconnect and shortcut interaction tests open one dialog." });
  await call("submit_handoff", {
    issueKey: issue.key,
    sessionId: session.id,
    summary: "The bounded Quick Bug is complete with passed regression evidence.",
    changes: ["Deduplicated the shortcut listener"],
    validation: ["Quick Add regression passed"],
    risks: [],
    nextSteps: ["Human or policy verifies delivery"],
  });
  console.log("4. Agent attached regression evidence and submitted the handoff");

  const humanHeaders: Record<string, string> = { "content-type": "application/json", "idempotency-key": `quick-demo-verify-${issue.key}` };
  if (process.env.TANDEM_HUMAN_TOKEN) humanHeaders.authorization = `Bearer ${process.env.TANDEM_HUMAN_TOKEN}`;
  const verified = await fetch(`${api}/v1/human/issues/${issue.key}/verify`, { method: "POST", headers: humanHeaders, body: "{}" });
  if (!verified.ok) throw new Error(`Human verification failed: ${verified.status} ${await verified.text()}`);
  console.log(`5. ${issue.key} completed and remains traceable in Human Web`);
} finally {
  await client.close();
}
