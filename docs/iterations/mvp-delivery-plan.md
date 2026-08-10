# Tandem MVP Delivery Plan

## Document Information

- Status: `REVIEWED`
- Target: usable pilot for one 3–5 person Agent-first team
- Original cadence: four build weeks plus one pilot week
- Remaining forecast from 2026-08-08: 6 focused build days plus 3–5 pilot days
- Review date: 2026-08-08

## 1. Delivery Objective

A Human can begin in a supported Coding Agent CLI, ask the Agent to understand a repository or take an Issue, and the Agent can use Tandem through MCP to read effective baselines, plan or claim dependency-safe work, record evidence and handoff, and request only the Human decisions required by policy. A Human or Agent can also capture a small Bug, Improvement, or Chore without planning ceremony. The Human can understand both planned and Quick Work in Web without reading raw Agent logs.

## 2. Scope Strategy

Build vertical slices through shared domain services. MCP and Web ship against the same object in the same iteration. The first slice uses an atomic local state adapter; PostgreSQL replaces it before pilot without changing commands.

Tandem coordinates external Agents but never launches them. A Human may start several CLIs against independently Ready Issues.

## 3. Iteration 0 — Executable Product Skeleton

Status: `VERIFIED`

Duration: 2 working days

### Outcome

The repository runs locally and demonstrates the Agent-first domain using seeded Tandem delivery data.

### Scope

- TypeScript/pnpm workspace, API, Web, contracts, and domain packages;
- Project, Cycle, Issue dependency, Artifact revision, and Agent Session types;
- derived readiness and onboarding/claim policies;
- seeded Project with parallel and integration work;
- REST queries/commands and Human Web shell;
- unit tests and one scripted Agent workflow.

### Acceptance

- one command runs API and Web;
- Human can view effective requirements, Cycle graph, Ready/Blocked Issues, and Session state;
- scripted Agent confirms context and claims a Ready Issue;
- blocked or duplicate claims fail with stable errors;
- tests cover baseline immutability, dependency readiness, onboarding, and stale context.

## 4. Iteration 1 — MCP-native Knowledge and Planning

Status: `VERIFIED_IN_VERTICAL_SLICE`

Duration: 4 working days

### Outcome

Codex and another remote-MCP client can naturally create and maintain delivery knowledge and plans.

### Scope

- MCP Streamable HTTP endpoint, resources, and core tools;
- Project/repository resolution from Issue key and Git remote;
- Artifact working draft, checkpoint, proposal, baseline, diff, and impact links;
- Milestones, Cycle plan revisions, Issues/Sub-issues, and dependency DAG;
- Agent Session onboarding manifest and context acknowledgement;
- repository instruction templates for AGENTS.md, CLAUDE.md, and GEMINI.md;
- Human Web Artifact, Cycle, Issue, and Session detail.

### Acceptance

- `start_session` returns current Artifact revisions, repository paths, code anchors, decisions, risks, and verification commands;
- a Codex task can create a Product Spec revision and plan a Cycle without Web data entry;
- a baseline change marks previous context stale;
- dependency cycles are rejected and parallel Ready Issues are visible;
- one Agent cannot claim the same Issue as another.

## 5. Iteration 2 — Evidence, Handoff, and Human Attention

Status: `PARTIALLY_VERIFIED` — Evidence, handoff, Decision, and Attention are implemented; idempotency, optimistic concurrency, SSE, and shared identity remain in Iteration 3.

Duration: 5 working days

### Outcome

Implementation and review continue across multiple external Agent sessions with concise durable evidence.

### Scope

- structured checkpoints, evidence, handoff, and completion policy;
- decision requests and authority types;
- Attention page and decision composer;
- Experience Review flow;
- drift, incomplete evidence, and conflict warnings;
- activity grouping and SSE updates;
- idempotent Agent mutations and optimistic concurrency.

### Acceptance

- completed Issues trace to baseline digest, Session, evidence, handoff, and decision/policy;
- a reviewer can decide from one Issue page;
- Human-only decisions reject Agent actors;
- no raw transcript or chain-of-thought is required;
- two Agents deliver parallel Issues and unblock an Integration Issue.

## 6. Iteration 3 — Persistence, Identity, and GitHub

Status: `IN_PROGRESS` — core PostgreSQL, identity/scope, idempotency, signed webhook, SSE, and container implementation exists; restart/restore, hosted OAuth, multi-client, and final operational evidence remain. See [Shared Pilot Foundation](iteration-03-shared-pilot-foundation.md).

Duration: 5 working days

### Outcome

State survives deployment and correlates automatically with repository delivery.

### Scope

- PostgreSQL schema, migrations, repositories, and durable job queue;
- invite-only Human auth and OAuth-authenticated MCP Agent identities;
- project/repository scopes and credential rotation;
- read-only GitHub App installation;
- signed webhook inbox and branch/commit/PR/check projection;
- Artifact Git anchors and drift detection;
- reconciliation and backup/restore runbooks.

### Acceptance

- migrations apply to empty and existing pilot databases;
- invalid scope/signature/identity is rejected;
- duplicate commands and webhooks do not duplicate state;
- a real PR/check appears on the linked Issue;
- Tandem has no merge or deploy permission;
- backup restore succeeds.

## 7. Iteration 4 — First Real Project and Quick Work Pilot

Status: `IMPLEMENTED_PENDING_PILOT_EVIDENCE` — core product slices are implemented; external issuer/client/GitHub/browser/Product Owner release evidence remains. See [First Real Project and Quick Work Pilot](iteration-04-first-real-project.md) and [Iteration 4 Implementation Summary](../summaries/iteration-04-summary.md).

Duration: 6 focused build days plus 3–5 pilot days

### Outcome

The pilot team can bootstrap a non-sample Project, use Tandem daily from supported Coding Agent CLIs, capture small work without unnecessary ceremony, and inspect trustworthy progress in Web.

### Scope

- close Iteration 3 restart, backup/restore, hosted OAuth, idempotency namespace, and multi-client evidence;
- generic Project bootstrap, repository binding/discovery, Project switching, and removal of production `TAN` assumptions;
- Quick Work domain path for Bug, Improvement, and Chore with deterministic promotion policy;
- Agent MCP conversation-to-Quick-Issue delivery loop;
- Human first-Project setup, global Quick Add, path/risk display, and progress views;
- onboarding guides and provider configuration examples;
- empty/error/recovery and accessible keyboard states;
- security, authorization, redaction, and audit verification;
- production-like performance and reconnect tests;
- headless-browser critical flows and Agent contract regression suite;
- deployment, monitoring, known limitations, and seeded demo.

### Acceptance

- Codex plus at least one of Claude Code/Gemini CLI/Cursor completes planned and Quick Work core MCP workflows;
- an empty Workspace creates and uses a non-`TAN` Project resolved from its repository;
- one code-only Quick Bug remains lightweight and completes with regression evidence;
- one material-risk Quick request is promoted without losing identity or audit history;
- release checks pass and no critical/high authority, traceability, or data-loss defect remains;
- local setup takes under 15 minutes and MCP connection under 10 minutes;
- Product Owner signs off on pilot readiness.

## 8. Iteration 5 — Human and Agent Identity Administration

Status: `PROPOSED_WAITING_HUMAN_DECISION` — tracked by `TAN-6`; database migration, security, and permission changes require the pending Human decision before implementation. See [Human and Agent Identity Administration](iteration-05-human-and-agent-identity.md).

Duration: 4 focused build days plus 1 pilot validation day

### Outcome

Humans use username/password by default, Agents use scoped tokens by default, both may hold independently revocable access tokens, and an owner can administer People & Agents from Web without exposing secrets or crossing Human/Agent authority.

### Acceptance

- existing bootstrap-token access upgrades without losing Project state;
- password and token login create revocable Web sessions rather than storing long-lived credentials in cookies;
- owner identity management, password reset/change, token issue/revoke, scope, status, and last-owner protection pass integration tests;
- a newly created Agent token works through MCP and cannot access Human administration;
- the upgraded local pilot passes migration, API, Web build, authorization, and secret-redaction checks.

## 9. Pilot Week

- 3–5 Humans, 1–3 Agent identities, one active repository;
- at least 10 real Issue delivery loops;
- at least one conversation-first Spec, one existing-doc onboarding, and one two-Agent parallel delivery;
- at least three Quick Work loops: a Bug, an Improvement/Chore, and one policy-promoted request;
- daily review of missing context, unnecessary Human gates, stale state, and evidence quality.

Exit requires 90% onboarding compliance, 100% completed-Issue traceability, no authority escape, less than five minutes daily manual maintenance per Human, and team agreement to continue.

## 10. Scope Guard

Do not add during MVP:

- a Tandem CLI compatibility layer;
- Agent launching, scheduling, model inference, or sandboxes;
- mandatory Sprints, story points, timesheets, or capacity optimization;
- full Jira workflow configuration;
- separate micro-task hierarchy or a second state machine for Quick Work;
- Slack/Teams, billing, enterprise SSO, or organization analytics;
- arbitrary file hosting, vector search, automatic merge, deployment, or promotion.

## 11. Definition of Done

- reviewed requirement and design are linked;
- domain transition and authority rules have automated tests;
- MCP/REST contract and errors are documented and validated;
- Web includes loading, empty, success, and failure behavior;
- machine mutations are retry-safe and version checked;
- meaningful state changes append Activity with actor provenance;
- logs/evidence contain no secret or private reasoning;
- demo data, runbook, validation evidence, and iteration summary are current.
