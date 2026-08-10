# TAN-7 — Web Typography Readability Summary

- Status: `AWAITING_HUMAN_EXPERIENCE_VERIFICATION`
- Delivery path: `quick`
- Date: 2026-08-10
- Agent Session: `808100b6-e1cf-498e-99df-ce96135ef51b`

## Outcome

Tandem Web now uses a shared readable type scale instead of scattered 7–11px declarations. Primary controls and dense work tables have a 14px floor, normal reading content uses 15px, secondary metadata uses 12px, and deliberately compact badges/uppercase labels use 11px.

## Changes

- added `--text-label`, `--text-meta`, `--text-control`, and `--text-body` CSS tokens;
- added shared normal and relaxed reading line-height tokens;
- migrated navigation, cards, tables, forms, Attention, Artifacts, Sessions, Activity, Issue detail, setup, sign-in, and Quick Add typography to the shared scale;
- added overflow wrapping for long Issue/module/source values;
- added a 700px effective-viewport layout that converts the fixed sidebar to sticky horizontal navigation, expands the detail panel, and preserves Work/Quick Add usability near 200% desktop zoom;
- added five automated Web typography regression checks and a representative Human review checklist;
- rebuilt and replaced only the local Pilot Web container; API and PostgreSQL were not recreated.

## Evidence

- Web typography contract: 5/5 passed;
- domain tests: 12/12 passed;
- file state repository tests: 2/2 passed;
- API/MCP/auth tests: 14/14 passed;
- TypeScript typechecks and all production builds passed;
- local Pilot Web and CSS asset return HTTP 200;
- deployed CSS contains the 11/12/14/15px scale and the 700px zoom/reflow breakpoint;
- API remains healthy on PostgreSQL state revision 34 after Evidence and Handoff persistence.

PostgreSQL integration tests remained skipped because `TEST_DATABASE_URL` was not configured; TAN-7 changes only static Web styling and adds no database behavior.

## Remaining Human Action

Refresh `http://127.0.0.1:4311`, inspect the Project, Work, Attention, Artifact/Issue detail, sign-in, and Quick Add surfaces at normal zoom, and optionally check 200% zoom using the [TAN-7 regression checklist](../../tests/regression/tan-7-typography-checklist.md). Human visual comfort is the final experience decision and is not recorded by the Agent.
