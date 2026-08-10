# TAN-8 — Human Verification Delivery Summary

- Status: `HUMAN_VERIFIED_DONE`
- Date: 2026-08-10
- Agent Session: `bd0865fa-9492-4054-be68-1ac4306d56aa`
- Human scope decision: `58758c06-466b-42ca-9f21-19e1e6fdf5e0`

## Outcome

Attention now opens review-state Issues in a clearly identified Human Verification workspace instead of silently reselecting generic Issue detail. The workspace presents accepted intent, Git delivery, Evidence, and Handoff before an authenticated Human records `Approve & complete` or `Request changes` with a rationale.

## Delivered

- added a shared `approved | changes_requested` delivery-review contract with required rationale;
- added a Human-only, idempotent `/v1/human/issues/:issueKey/review` API while retaining the legacy approve-only `/verify` adapter;
- implemented the domain transition so approval completes delivery and requested changes release the old claim, preserve Session/Evidence/Handoff, and return the Issue to calculated readiness;
- records `issue.completed` or `issue.changes_requested` with authenticated Human identity and rationale in append-only Activity;
- added a focused `/projects/:projectKey/work/:issueKey/verify` Web state, browser history behavior, visible Human Verification banner, pending/error feedback, and authority explanation;
- added the reviewed TAN-8 execution plan and aligned Product Requirements, System Design, and Information Architecture;
- added an executable Web contract regression and a Human experience checklist.

## Automated Evidence

- domain: 13/13 passed, including requested changes, evidence/handoff preservation, new claim, approval, and invalid-state rejection;
- API/MCP/auth/webhook: 17/17 passed, including Human review approval, requested changes, idempotent replay, conflicting replay, and Agent denial;
- Web: 9/9 passed, including four Human Verification contract checks and five typography checks;
- file-state persistence: 2/2 passed;
- TypeScript checks/builds passed for Contracts, Domain, DB, API, and Web;
- Web production build passed (`231.11 kB` JavaScript and `29.55 kB` CSS before gzip).

The PostgreSQL integration suite remained skipped because a separate `TEST_DATABASE_URL` was not configured. The deployed Pilot still exercised PostgreSQL continuity: API, Web, and PostgreSQL containers are healthy, state revision reached 40, and TAN-8 retained its active Session/claim after API/Web image replacement.

## Deployed Evidence

- the local Pilot API and Web images were rebuilt and replaced without recreating PostgreSQL;
- deployed Web assets contain the Human Verification workspace, `Approve & complete`, and verification styling;
- a live Agent-token call to the Human review endpoint returned `403 AUTHORIZATION_DENIED` and did not mutate TAN-8.

## Human Verification

The Product Owner used the deployed Human Verification workflow and approved TAN-8 as `pilot-owner` on 2026-08-10. Tandem recorded `issue.completed` with Human authority after the Agent Handoff, changed TAN-8 to `done`, cleared its active claim, and removed its review Attention item. The Agent did not submit or impersonate this decision.

The [TAN-8 Human Verification checklist](../../tests/regression/tan-8-human-verification-checklist.md) remains the reusable regression procedure for future approve and request-changes exercises.
