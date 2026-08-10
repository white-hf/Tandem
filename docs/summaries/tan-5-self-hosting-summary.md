# TAN-5 — Tandem Self-Hosting Summary

- Status: `AWAITING_HUMAN_VERIFICATION`
- Delivery path: `quick`
- Date: 2026-08-10
- Agent Session: `202bf679-ce86-44aa-92f7-a02073ed76a2`

## Outcome

Tandem Project `TAN` now governs subsequent Tandem requirements, Bugs, Improvements, and Chores. Repository configuration, Agent instructions, live MCP intake, onboarding, claim, Evidence, and handoff have been exercised against the running PostgreSQL Pilot.

## Formal local Pilot

- Human Web: `http://127.0.0.1:4311`
- Agent MCP: `http://127.0.0.1:4310/mcp`
- API health: `http://127.0.0.1:4310/health`
- Access boundary: current Mac only; no LAN/public exposure

The API and Web were rolled to the latest images without replacing the PostgreSQL volume. An upgrade backup exists at `/tmp/tandem-pre-iteration4-upgrade.dump` for the current machine session.

## Changes

- added repository `.mcp.json` using the `TANDEM_AGENT_TOKEN` environment variable rather than a committed credential;
- registered global Codex MCP server `tandem` with `--bearer-token-env-var TANDEM_AGENT_TOKEN`;
- placed the Agent token in the current macOS user-session launch environment so a restarted Codex can inherit it;
- made Tandem intake/onboarding/claim/Evidence/handoff mandatory in `AGENTS.md` for future state-changing work;
- documented the formal local Pilot address and self-hosting boundary;
- fixed backward compatibility for legacy repository bindings that lack `provider` and `host` and added regression coverage.

The compatibility defect was discovered when the first self-hosted MCP intake failed. The entry path was restored first, after which this request was backfilled as `TAN-5` and completed through the normal Agent workflow, matching the repository fallback policy.

## Evidence

- domain tests: 12/12 passed, including legacy Git repository discovery;
- API/MCP/auth tests: 14/14 passed;
- all TypeScript projects passed typecheck;
- Pilot API is healthy on the compatibility-fix image;
- Web returns HTTP 200;
- PostgreSQL migration `0004_project_bootstrap_quick_work.sql` is active;
- `TAN-5` is in `review`, its Session is `handed_off`, and three passed Evidence records plus a handoff are visible in the Human data model.

## Remaining Human Action

Open Human Web, review `TAN-5`, and make the explicit verification decision. The Agent has not impersonated this Human authority. Restart Codex before the next task so the newly registered MCP server inherits the user-session bearer token.
