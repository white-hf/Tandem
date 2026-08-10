# TAN-8 — Complete Human Verification from Attention

## Document Information

- Status: `REVIEWED`
- Tandem Issue: `TAN-8`
- Human material-risk decision: `58758c06-466b-42ca-9f21-19e1e6fdf5e0` (`approved` by `pilot-owner` on 2026-08-10)
- Source: [MVP PRD](../prd/tandem-mvp-prd.md), [System Design](../design/system-design.md), and [Information Architecture](../design/information-architecture.md)
- Delivery shape: one vertical Bug-fix slice

## 1. Problem

Attention correctly reports that an Issue is ready for verification, but `Review issue` only selects the generic Issue drawer. It does not create a clear visual transition and the drawer exposes no Human delivery-review action. When the same Issue is already selected, the click appears to do nothing, and the Human cannot complete or return the delivery from the primary oversight workflow.

## 2. Outcome

A Human can open a decision-ready verification workspace from Attention, understand accepted intent and delivery evidence without reading Agent logs, and explicitly approve completion or request changes. Tandem records the authenticated Human outcome, updates canonical Issue/Attention state, and preserves prior delivery evidence.

## 3. Domain and API Slice

- add a delivery-review input contract with `approved | changes_requested` and a required rationale;
- resolve review in the domain/application service, never in the REST or Web adapter;
- approve completes the Issue and clears the active claim;
- request changes clears the handed-off claim, preserves Session/Evidence/Handoff, and returns the Issue to calculated readiness;
- record the Human outcome and rationale in append-only Activity;
- add the Human-only idempotent review route and keep the legacy approve-only verify route compatible;
- reject Agent authority, invalid state, and conflicting idempotency replay without mutation.

## 4. Human Web Slice

- make `Review issue` visibly open and focus a verification workspace;
- expose a stable Issue-specific URL/history state so repeated selection remains understandable;
- show acceptance criteria, Git delivery, evidence, and handoff before actions;
- provide `Approve & complete` and `Request changes` controls only in review state;
- require a rationale for requested changes;
- show pending/error feedback, refetch canonical Project state after success, close the resolved panel, and remove the resolved Attention item.

## 5. Validation

- domain tests cover approve, request changes, evidence preservation, claim release, readiness recalculation, rationale Activity, and invalid-state rejection;
- API tests cover Human authority, Agent denial, idempotent replay, and conflicting replay;
- Web contract/regression tests cover the focused verification UI, decision payloads, state refresh, and error feedback;
- production typecheck/build passes;
- the deployed local Pilot is exercised with a review-state Issue without recording a Human outcome on the Agent's behalf.

## 6. Non-goals

- comments or threaded review discussion;
- editing acceptance criteria during verification;
- automatic Agent relaunch after changes are requested;
- Git merge, CI execution, deployment, or release approval;
- configurable workflow states.

## 7. Definition of Done

- every TAN-8 acceptance criterion has automated evidence;
- Human and Agent authority remain distinct;
- Attention and Work reflect the canonical result without manual status entry;
- documentation, implementation, tests, Tandem Evidence, and Handoff are aligned;
- final experience acceptance remains an explicit Human action.
