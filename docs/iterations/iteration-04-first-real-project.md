# Iteration 4 — First Real Project and Quick Work Pilot

## Document Information

- Status: `IMPLEMENTED_PENDING_PILOT_EVIDENCE`
- Source: [MVP PRD](../prd/tandem-mvp-prd.md), [System Design](../design/system-design.md), and [Information Architecture](../design/information-architecture.md)
- Sponsor decision: approved Quick Work approach and requested the minimum-usable-project plan
- Review date: 2026-08-08
- Target: one real repository used daily by one 3–5 person Agent-first Team
- Estimate: 6 focused build days plus 3–5 pilot days

## 1. Background

The executable Tandem slice proves Artifact baselines, optional Cycles, dependency-aware Issues, Agent onboarding/claims, evidence, handoff, Human decisions, PostgreSQL, identity, signed GitHub events, SSE, and a production-like container stack.

It is not yet the first-team release because the current experience still contains seeded `TAN` Project assumptions, does not provide a complete first-real-project setup flow, and treats all Issues as planned work in the Human experience. Shared-pilot operations also require final restart, backup/restore, hosted authentication, and end-to-end client evidence.

This iteration closes only those gaps needed to use Tandem on a real project. It does not add Agent launching, a Tandem CLI, workflow customization, reporting, billing, or enterprise administration.

## 2. Outcome

A Human creates and opens a real Project, binds its repository and current delivery documents, and configures scoped Agent access. A Coding Agent can discover the Project from the repository, onboard, create or execute planned work, and capture a small Bug/Improvement/Chore as Quick Work. Humans see the same progress and can quickly capture work from Web. Low-risk Quick Work remains lightweight; material work is promoted without losing identity or provenance.

The iteration is release-complete only after one planned Issue and one Quick Bug run end to end against PostgreSQL in production-like mode, survive restart/restore, and remain traceable in Web and Git delivery.

## 3. Critical-Path Order

```text
Close shared-pilot safety evidence
  -> Generic Project bootstrap and discovery
  -> Quick Work domain and policy
  -> Agent MCP workflow
  -> Human setup/capture/progress experience
  -> Production-like E2E and pilot release decision
```

Project bootstrap precedes Quick Work UI so no new flow depends on the seeded `TAN` Project. Domain policy precedes adapters so MCP and Web cannot implement different promotion or authority rules.

## 4. Slice A — Close Shared-Pilot Foundation

### Requirements

- verify PostgreSQL-backed state and Git projection through API/container restart;
- rehearse encrypted or access-controlled backup plus restore into a clean pilot database;
- complete production configuration validation, credential revocation, Project scopes, and negative authority tests;
- hosted remote MCP uses a real OAuth/OIDC access-token validation path; static bootstrap tokens remain local/controlled-pilot only and do not satisfy hosted release;
- verify idempotency namespace behavior across reconnecting MCP clients;
- record limitations for GitHub App installation/reconciliation that cannot be exercised against a real repository.

### Acceptance

- no state, audit, idempotency, identity, or Git correlation is lost after restart;
- restored state matches Project/Issue/Artifact/Session/Evidence/Decision counts and representative digests;
- revoked/out-of-scope Agent and Agent-as-Human attempts fail closed;
- two reconnecting clients cannot collide accidentally or duplicate a mutation;
- operational evidence and rollback steps are recorded.

## 5. Slice B — Generic Project Bootstrap and Discovery

### Requirements

- idempotent `create_project` application command and persistence projection;
- Project key, name, goal, owner, Team, policy profile, repository bindings, and optional Artifact imports;
- normalized repository identity and deterministic resolution by explicit Project, Issue key, or Git remote;
- remove production `TAN` defaults from MCP resources, Web queries/routes, SSE subjects, GitHub correlation, and runtime events;
- MCP resource templates and Human URLs parameterized by authorized Project key;
- Project listing/switching and empty-Workspace readiness result;
- Project, Milestone, and Cycle remain distinct; Milestone/Cycle are optional at bootstrap.

### Acceptance

- an empty Workspace creates a Project with a non-`TAN` key and no sample data leakage;
- an Agent started inside its bound repository resolves the correct Project and onboarding context;
- an explicit Project/Issue that conflicts with repository scope fails clearly;
- two Projects in one Team remain isolated in Web, MCP queries, SSE, Git correlation, and authorization tests;
- setup reports missing context instead of inventing baselines or making blocked work Ready.

## 6. Slice C — Quick Work Domain and Policy

### Requirements

- add Issue type `Improvement` and `delivery_path=quick|planned`;
- store authenticated intake actor, source kind/reference, original statement, structured enrichment, and risk classification;
- type-specific intake/verification contracts for Bug, Improvement, and Chore;
- deterministic promotion policy implemented in domain/application services;
- promotion preserves Issue key, original intake, revisions, Activity, and links;
- readiness remains derived; one active claim, onboarding, evidence, handoff, and authority invariants remain unchanged;
- baseline-changing work creates/links an Artifact proposal; code-only work is not forced to revise PRD/design;
- PostgreSQL migration and backward-compatible read behavior for existing Issues.

### Acceptance

- Human and Agent intake produce the same domain result for equivalent commands;
- incomplete intake is retained in `backlog` with explicit missing fields and an Agent-enrichment next action;
- a bounded code-only Bug stays Quick and needs regression evidence to complete;
- a migration/security/public-contract example is promoted before implementation claim;
- retrying capture or promotion creates neither a duplicate Issue nor duplicate Activity;
- policy tests cover every material-risk trigger and ensure an Agent cannot self-approve a Human gate.

## 7. Slice D — Agent MCP Delivery Loop

### Requirements

- extend `create_issue` for Quick Work without creating a separate Agent protocol;
- return calculated path, risk/promotion reasons, missing intake/context, next actions, and Human Web URL;
- allow an Agent to capture work during a normal Coding Agent conversation, then start/refresh onboarding before claim;
- preserve distinct sessions and claims when Humans start several external Coding Agents;
- provide repository instruction/configuration examples for Codex and at least one other MCP-capable Coding Agent;
- keep Tandem free of model execution, CLI compatibility, scheduler, sandbox, merge, or deployment behavior.

### Acceptance

- a Coding Agent can connect using standard remote MCP configuration without a required Tandem Skill;
- Agent conversation -> Quick Bug -> enrichment -> onboarding -> claim -> checkpoint -> regression evidence -> handoff -> completion succeeds;
- planned dependency flow continues to work unchanged;
- stale context, duplicate claim, missing evidence, and prohibited Human decision fail with stable actionable errors;
- MCP contract regression covers reconnect/retry and more than one Project.

## 8. Slice E — Human Setup, Capture, and Progress

### Requirements

- first-Project setup for identity, repository, current documents, access, and readiness;
- Project switcher and Project-key routes;
- global Quick Add for Bug, Improvement, and Chore;
- Issue detail shows original intake, enrichment, Quick/Planned path, risk/promotion reason, evidence, handoff, and Git delivery;
- Project Overview, Work, Attention, Artifacts, Cycles, Sessions, and Activity remain the progress surfaces;
- progress is derived from Agent actions and integrations rather than requiring Humans to maintain duplicate status;
- loading, empty, validation, authorization, reconnect, and recovery states are understandable without technical logs.

### Acceptance

- an empty Workspace reaches a usable real Project without editing demo data;
- a Human captures a well-formed Quick Issue from any page in under 60 seconds;
- a Human can tell within 30 seconds what is Ready, active, blocked, in review, awaiting a decision, and delivered;
- promoted work explains why it needs more planning or Human authority;
- keyboard and responsive checks cover setup, Quick Add, Attention, and Issue review.

## 9. Slice F — Release Evidence and Pilot

### Automated evidence

- domain tests for bootstrap, repository resolution, Quick Work, promotion, readiness, evidence, and authority;
- PostgreSQL migration/projection/concurrency/idempotency integration tests;
- REST/MCP contract and authorization regression;
- signed GitHub webhook/SSE correlation regression for a non-`TAN` Project;
- headless browser E2E for first setup, Quick Add, Agent-delivered progress, and Human review;
- production builds, container health/restart, backup/restore, and rollback rehearsal.

### Real workflow evidence

1. connect a supported Coding Agent to a production-like Tandem instance;
2. bootstrap one real repository and import its current guidance;
3. execute one planned Issue with onboarding, evidence, handoff, and Git correlation;
4. capture and complete one Quick Bug with regression evidence;
5. capture one risky Quick request and verify policy promotion/Human Attention;
6. start two external Agents on independent Ready Issues and verify isolated claims;
7. restart and restore, then verify Web and MCP continuity.

## 10. Minimum Release Gate

Release to the 3–5 person pilot requires:

- all seven PRD Minimum Usable Project gates pass;
- no hard-coded sample Project participates in production behavior;
- no critical/high data-loss, cross-Project access, Human impersonation, duplicate mutation, or Git mis-correlation defect remains;
- hosted remote access meets OAuth/OIDC and webhook-signature requirements;
- Codex and one other supported MCP client complete the core flow;
- setup, Agent configuration, backup, restore, rollback, and known-limitations runbooks are current;
- the Product Owner reviews Web progress, Quick Work behavior, and authority gates and records `PILOT_READY`.

## 11. Estimate and Daily Sequence

| Day | Target |
|---|---|
| 1 | close shared-pilot restart/auth/idempotency/backup evidence |
| 2 | Project bootstrap, repository binding, and Project-scoped routing |
| 3 | multi-Project regression and Quick Work domain/migration |
| 4 | MCP Quick Work loop and promotion/evidence policies |
| 5 | Human setup, Project switcher, Quick Add, and progress detail |
| 6 | full production-like E2E, runbooks, release evidence, and fixes |
| Pilot days 1–5 | 10 real loops, daily issue review, and go/no-go decision |

The estimate assumes the existing PostgreSQL/auth/GitHub/SSE implementation passes Slice A verification without architectural rework. OAuth issuer integration, backup restore, or real GitHub App findings may consume the pilot buffer; they do not lower the release gate.

## 12. Explicitly Deferred

- Agent process launching, orchestration, scheduling, or sandbox management;
- Tandem CLI and mandatory provider-specific Skill;
- configurable workflow/state-machine designer;
- Slack/Teams/email notifications and scheduled reports;
- time tracking, story points, capacity optimization, or full Jira parity;
- Git write/merge/deploy and CI execution;
- organization analytics, billing, enterprise SSO, or multi-region deployment.

## 13. Definition of Done

- reviewed PRD/design/iteration remain aligned with implemented contracts and UI;
- every slice has automated plus user-visible or operational evidence;
- a summary records what actually shipped, exact validation results, and residual limitations;
- deployment is recoverable, authority boundaries are enforced, and first-project/Quick Work runbooks are usable by someone other than the implementer;
- the pilot release decision and next iteration are explicit.

## 14. Execution Status — 2026-08-08

Slices B–E are implemented. Slice A is implemented and verified for PostgreSQL restart, scoped authorization, reconnect-safe idempotency, OAuth introspection behavior, and clean-database backup/restore. Automated domain, API, MCP, PostgreSQL, typecheck, and Web production-build evidence passes.

The release decision remains `NOT_YET_PILOT_READY`. The remaining Slice F evidence requires external systems or Human review: a real OAuth issuer, a second supported MCP client, a real GitHub App/repository delivery, automated browser accessibility/keyboard coverage, and Product Owner experience approval. See [Iteration 4 Implementation Summary](../summaries/iteration-04-summary.md).
