# Repository Guidelines

## Product Boundary

Tandem is an Agent-first software delivery memory and coordination layer. Coding agents use it primarily through MCP; Humans use the Web application for baselines, plans, attention, evidence, and decisions. Tandem does not run models, launch Agent processes, provide sandboxes, replace Git, execute CI, merge code, or deploy production.

## Required Delivery Order

For product or architecture changes, update artifacts in this order:

1. `docs/prd/`
2. `docs/design/`
3. `docs/iterations/`
4. implementation and tests
5. `docs/summaries/`

Do not start implementation from an unreviewed product or architecture change. Iteration plans must be `REVIEWED` before coding.

## Project Structure

- `apps/web`: React Human oversight interface
- `apps/api`: REST, SSE, webhook, auth, and MCP entry points
- `apps/worker`: asynchronous integration processing
- `packages/domain`: framework-free domain rules and transitions
- `packages/contracts`: Zod schemas and shared API/MCP types
- `packages/db`: PostgreSQL schema, migrations, and repositories
- `packages/ui`: reusable UI components
- `docs/`: product, design, iteration, summary, and runbook artifacts
- `tests/unit|integration|regression`: layered tests

## Agent Onboarding

Before substantive implementation:

1. read the current PRD, relevant design, active iteration, and latest summary;
2. inspect the code areas named by the work item and their tests;
3. state the understood goal, constraints, intended change, and open questions;
4. do not start a dependency-blocked Issue;
5. update the correct Artifact before making a material undocumented design change.

## Tandem Delivery Enforcement

- This repository is managed by the live Tandem Project `TAN` at `http://127.0.0.1:4310/mcp`.
- Every new requirement, Bug, Improvement, or Chore that changes repository or delivery state must exist as a Tandem Issue before substantive implementation. Use Quick Work for bounded Bug/Improvement/Chore work and Planned Work when scope, dependencies, baselines, or material risk require planning.
- If the Human provides an existing Issue key, use it. Otherwise read `get_project_context`, capture the request with `create_issue`, and retain the Human's original statement and source provenance.
- Start a Session with the Issue key and current Git remote, read all required context, call `confirm_understanding`, and acquire the unique claim before editing implementation files.
- Record semantic checkpoints, attach reproducible Evidence, and submit a handoff for every completed slice. Never mark a Human decision on the Human's behalf.
- If Tandem is unavailable or a Tandem defect itself prevents intake, implementation is limited to restoring the intake path. Record the fallback in the active summary and backfill the Issue, Session, Evidence, and handoff immediately after recovery.

## Core Invariants

- MCP is the primary Agent interface; Web is the primary Human interface.
- A Human may begin from conversation or existing documents; Tandem does not require work to originate in Web.
- Initiative is optional; Project, Milestone, Cycle, Issue/Sub-issue, and dependency are distinct concepts.
- Cycles are optional timeboxes and are not releases.
- Autonomous Continuous Mode: When granted an overarching goal by Human in conversation, Agents are authorized to autonomously plan Cycles (`plan_cycle`), create structured Issues (`create_issue`), claim (`claim_issue`), execute, attach Evidence (`attach_evidence`), and auto-verify non-material tasks without human chat prompting.
- Agents may plan and execute inside policy but cannot impersonate a Human decision.
- One Issue has at most one active claim.
- An Issue is Ready only when dependencies and context requirements are satisfied.
- Baselined Artifact revisions are immutable; changes create a new revision.
- Git-backed content is bound to repository, path, commit, blob, and digest.
- Agent onboarding is bound to Artifact digests and becomes stale when required baselines change.
- External events and Human/Agent mutations must be idempotent.
- Activity is append-only audit history, not a substitute for domain validation.
- Raw hidden chain-of-thought is never required or stored.
- GitHub and MCP are adapters; domain rules do not live in adapter handlers.

## Validation

Every meaningful slice requires domain tests plus user-visible or artifact evidence. Compilation alone is not completion. Record limitations when an external integration cannot be exercised.

## Security

Do not commit secrets. Use OAuth for remote MCP, scope Agent capabilities to Projects, validate all actor transitions in application services, verify webhook signatures, and keep high-risk Human decisions distinct from Agent-reported conversation statements.
