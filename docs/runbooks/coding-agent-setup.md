# Connect Coding Agents to Tandem

- Status: `IMPLEMENTED_LOCAL_AND_HOSTED_CONFIGURATION`
- Local MCP endpoint: `http://127.0.0.1:4310/mcp`
- Local Human Web: `http://127.0.0.1:4311`

Tandem has no CLI compatibility layer. A Coding Agent connects through standard Streamable HTTP MCP and uses the same domain services as Human Web. No Tandem-specific CLI or mandatory Skill is required.

## 1. Choose the deployment mode

Local development binds to localhost, stores state in `.tandem/state.json`, and supplies a development principal. It must not be exposed to another machine.

A controlled localhost Pilot can use PostgreSQL plus individually scoped static tokens. A shared remote MCP endpoint must use HTTPS, `TANDEM_AUTH_MODE=oauth`, `TANDEM_REQUIRE_REMOTE_OAUTH=true`, and a standards-based RFC 7662 introspection endpoint. The issuer must return an active Agent subject, MCP capability scopes, and one or more `project_keys`/`tandem_projects`; Tandem rejects inactive, Human, unscoped, or context-less tokens.

## 2. Configure the MCP client

### Codex CLI

```bash
codex mcp add tandem \
  --url http://127.0.0.1:4310/mcp \
  --bearer-token-env-var TANDEM_AGENT_TOKEN
```

The local token Pilot requires `TANDEM_AGENT_TOKEN` in the environment that launches Codex. The configured token value must never be committed. Restart Codex after changing its launch environment. A hosted OAuth deployment replaces this bootstrap step with the client's MCP login flow.

For a hosted OAuth endpoint, add the HTTPS URL and then authenticate with the client's MCP login flow. Tandem publishes `/.well-known/oauth-protected-resource` and an OAuth `WWW-Authenticate` challenge.

### Claude Code

```bash
claude mcp add --transport http tandem http://127.0.0.1:4310/mcp --scope project
```

### Gemini CLI

```bash
gemini mcp add --transport http tandem http://127.0.0.1:4310/mcp
```

### Cursor

Copy [.mcp.json.example](../../.mcp.json.example) to the project MCP configuration supported by the installed Cursor version, replace the URL if needed, and enable `tandem` in Cursor settings.

Provider command syntax can change; verify the installed client's help before team rollout. The protocol contract is simply an authenticated Streamable HTTP MCP endpoint.

## 3. Add repository behavior

Copy or adapt [tandem-repository-instructions.md](../../templates/tandem-repository-instructions.md):

- Codex and Cursor: merge it into `AGENTS.md`;
- Claude Code: reference it from `CLAUDE.md`;
- Gemini CLI: reference it from `GEMINI.md` or include `AGENTS.md` in its context configuration.

Repository instructions make onboarding behavior persistent. MCP supplies current Project state and mutations. A provider-specific Skill may improve prompting, but cannot replace Tandem's domain policies.

## 4. Use natural prompts

When an Issue already exists:

```text
Familiarize yourself with this repository, then take ACME-12.
Use Tandem for onboarding, claim, checkpoints, evidence, and handoff.
```

The authenticated Agent should call:

```text
start_session(issueKey=ACME-12, gitRemote=<current origin>)
  -> read required baselines, repository instructions, code anchors, verification commands
confirm_understanding(...)
  -> claim_issue(ACME-12)
  -> implement and record_checkpoint(...)
  -> attach_evidence(...)
  -> submit_handoff(...)
```

When a conversation discovers a small problem:

```text
Record this as a Quick Bug in Tandem, complete any missing reproduction and
acceptance details with me, then onboard and fix it if policy allows.
```

The Agent uses `create_issue(deliveryPath=quick)`, and may use `update_issue` to enrich it. A material scope, public contract, migration, security/privacy, billing, destructive, release, cross-project, or dependency impact promotes the same Issue to Planned and creates Human Attention. The Agent must not bypass that decision.

When the Human starts from an idea rather than an Issue, the Agent first reads `get_project_context`, creates or revises Product/Design Artifacts, checkpoints proposals, plans an optional Cycle and dependency graph, and presents independently Ready Issue keys. Humans may then start several external Coding Agents on those independent Issues.

## 5. Implemented MCP surface

Resource templates:

- `tandem://projects/{projectKey}/baseline`
- `tandem://projects/{projectKey}/ready-issues`

Tools:

- `get_project_context`
- `list_ready_issues`
- `start_session`
- `create_project`
- `upsert_artifact_draft`
- `checkpoint_artifact`
- `plan_cycle`
- `create_issue`
- `update_issue`
- `add_issue_dependency`
- `request_human_decision`
- `confirm_understanding`
- `claim_issue`
- `record_checkpoint`
- `attach_evidence`
- `submit_handoff`

Run `pnpm demo:mcp` for discovery, `pnpm demo:planning` for Artifact/Cycle/dependency planning, `pnpm demo:agent` for planned execution, and `pnpm demo:quick:mcp` for the full Quick Bug loop.
