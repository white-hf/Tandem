# Iteration 3 — Shared Pilot Foundation

## Document Information

- Status: `REVIEWED`
- Source: [MVP Delivery Plan](mvp-delivery-plan.md), Iteration 3
- Start: 2026-08-04
- Target: shared deployment for one 3–5 person Team

## 1. Background

Iteration 0 proved the Agent-first product loop with an atomic local state file. That adapter is intentionally single-process and unauthenticated. It cannot safely support several Humans and Agent clients over a network because caller identity can be supplied in request bodies, writes have no cross-process transaction boundary, and Git state is manual.

This iteration replaces those development shortcuts without changing the domain vocabulary or MCP workflow.

## 2. Outcome

A 3–5 person Team can run one shared Tandem deployment where:

- PostgreSQL durably stores and constrains Project, Cycle, Issue, dependency, Artifact, Session, claim, Evidence, handoff, Decision, Activity, idempotency, and Git projection state;
- authenticated Human and Agent identities cannot impersonate each other;
- retried or concurrent Agent commands are safe;
- GitHub commits, pull requests, and checks appear on linked work through signed webhooks;
- Human Web receives low-volume state invalidations over SSE;
- backup, restore, deployment, and rollback are executable and tested.

## 3. Slice A — PostgreSQL and Transaction Runtime

### Requirements

- forward-only migrations for the complete MVP relational model;
- local Docker Compose PostgreSQL with health check;
- one transactional mutation coordinator shared by REST and MCP;
- optimistic workspace revision and serialization of concurrent writes;
- atomic relation projection and canonical recovery snapshot;
- no response success before the PostgreSQL transaction commits;
- file adapter remains available only for explicit local development.

### Acceptance

- migrations apply to an empty PostgreSQL database;
- seeded state persists through API and PostgreSQL container restart;
- two concurrent claims for one Issue produce one success and one stable conflict;
- a forced stale revision fails without partially updating relational tables;
- normalized Issue, dependency, Artifact revision, Session, claim, Evidence, Decision, and Activity rows agree with the canonical snapshot.

## 4. Slice B — Identity, Scope, Idempotency

### Requirements

- immutable `ActorContext` derived from authentication, never request fields;
- invite-only Human membership and role;
- Agent identity with Project/capability scopes and revocable credential;
- OAuth-compatible MCP resource protection for hosted mode;
- visibly isolated `development` principal available only on localhost;
- `Idempotency-Key` required for Agent mutations;
- stored request hash and replayed response; mismatched reuse rejected;
- expected aggregate/workspace revision on conflict-sensitive commands.

### Acceptance

- Agent cannot submit `human_decision` or choose another actor ID;
- missing, revoked, expired, or out-of-scope credentials fail closed;
- exact retry returns the original response and creates no duplicate Activity/Evidence;
- same idempotency key with different input is rejected;
- production configuration refuses to start with development auth enabled.

## 5. Slice C — GitHub and Live Human State

### Requirements

- read-only GitHub App installation/repository mapping;
- raw-body `X-Hub-Signature-256` validation;
- durable webhook inbox and delivery-ID dedupe;
- branch, commit, pull request, and check projection linked by Tandem markers;
- reconciliation job for missed events;
- SSE cursor stream for Attention/Project/Issue invalidation;
- Tandem has no merge or deploy permission.

### Acceptance

- invalid webhook signature is rejected and duplicate delivery is safe;
- a linked test PR and check appear on the Issue/Session;
- missed state is repairable by reconciliation;
- Web receives a projected update within two seconds under pilot load;
- permission audit confirms no write/merge/deploy capability.

## 6. Slice D — Pilot Operations

- Docker images and Compose production-like environment;
- environment validation and secret handling;
- PostgreSQL backup/restore rehearsal;
- health/readiness endpoints and structured correlation logging;
- security and accessibility regression;
- Codex plus one other MCP client full workflow;
- known limitations and rollback runbook.

## 7. Non-goals

- multi-region or multi-primary deployment;
- Kubernetes, Kafka, Redis, or Elasticsearch;
- enterprise SSO or organization provisioning;
- GitHub write, merge, release, or deployment permissions;
- Agent execution/scheduling or a Tandem CLI.

## 8. Definition of Done

- every acceptance item has automated or real-environment evidence;
- `pnpm check` and production-like E2E pass;
- migrations, backup, restore, and rollback are rehearsed;
- Human and Agent authority boundaries have negative tests;
- the shared deployment survives restart without traceability loss;
- residual critical/high data-loss, authority, or correlation risks are zero;
- an execution summary identifies any external pilot validation still requiring the real team.
