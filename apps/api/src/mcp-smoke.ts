import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = new URL(process.env.TANDEM_MCP_URL ?? "http://127.0.0.1:4310/mcp");
const projectKey = process.env.TANDEM_PROJECT_KEY ?? "TAN";
const client = new Client({ name: "tandem-smoke", version: "0.1.0" });
const transport = new StreamableHTTPClientTransport(endpoint, {
  requestInit: process.env.TANDEM_AGENT_TOKEN ? { headers: { authorization: `Bearer ${process.env.TANDEM_AGENT_TOKEN}` } } : undefined,
});

await client.connect(transport);
const tools = await client.listTools();
const resources = await client.listResources();
const templates = await client.listResourceTemplates();
const ready = await client.callTool({ name: "list_ready_issues", arguments: { projectKey } });

console.log(`Connected to ${endpoint}`);
console.log(`Tools (${tools.tools.length}): ${tools.tools.map((tool) => tool.name).join(", ")}`);
console.log(`Resources (${resources.resources.length}): ${resources.resources.map((resource) => resource.uri).join(", ")}`);
console.log(`Resource templates (${templates.resourceTemplates.length}): ${templates.resourceTemplates.map((template) => template.uriTemplate).join(", ")}`);
console.log(`list_ready_issues error: ${ready.isError === true ? "yes" : "no"}`);

if (tools.tools.length < 16) throw new Error("Expected all Tandem MVP MCP tools");
if (resources.resources.length < 2) throw new Error("Expected Tandem MCP resources");
if (templates.resourceTemplates.length < 2) throw new Error("Expected Project-scoped Tandem MCP resource templates");
if (ready.isError) throw new Error("list_ready_issues failed");

await client.close();
