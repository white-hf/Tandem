# Iteration 0 — Executable Product Skeleton

- Status: `VERIFIED`
- Start: 2026-08-04
- Target duration: 2 working days
- Parent plan: [MVP Delivery Plan](mvp-delivery-plan.md)

## Outcome

Run an end-to-end Tandem slice that demonstrates effective Artifact baselines, dependency-derived Issue readiness, Agent onboarding and claim, structured evidence/handoff, and Human oversight in Web.

## Included

- pnpm/TypeScript workspace with `web`, `api`, `contracts`, and `domain`;
- seeded Tandem Project, Product Spec/System Design baselines, active Cycle, parallel Issues, and Integration Issue;
- pure domain service with a restart-safe single-instance state repository port;
- REST queries plus Agent session/claim/checkpoint/evidence/handoff commands;
- Human Web project, baselines, Cycle graph, Issue, Session, and Attention views;
- unit tests and scripted Agent workflow;
- developer setup and validation summary.

## Not Included

- production PostgreSQL, OAuth, GitHub App, worker, or deployment;
- full MCP transport implementation beyond the first contract slice if it threatens domain/UI validation;
- editing every Project object through Web;
- Agent scheduler or Tandem CLI.

## Acceptance

1. `pnpm install` and documented commands run on Node.js 22+.
2. Human Web loads seeded Project state from the API.
3. Effective baselines are visually distinct from proposed revisions.
4. Ready status changes from dependency completion rather than arbitrary client status.
5. Agent cannot claim before current onboarding acknowledgement.
6. only one active claim is allowed.
7. completion requires evidence and handoff.
8. automated tests cover core invariants and the scripted workflow succeeds.
9. Session, claim, Evidence, and handoff survive an API/Web process restart.

## Evidence Plan

- unit test output for domain policies;
- API smoke/script output for the Agent workflow;
- production Web build and screenshot/browser check;
- implementation summary with incomplete pilot capabilities explicitly listed.

## Completion

Implemented and verified on 2026-08-04. See [Iteration 0 Summary](../summaries/iteration-00-summary.md).
