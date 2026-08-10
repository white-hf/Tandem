# TAN-7 Typography Readability Regression Checklist

Status: `AUTOMATED_CHECKS_COMPLETE_HUMAN_EXPERIENCE_PENDING`

## Before/after contract

| Surface | Before | Implemented target | Automated evidence |
|---|---:|---:|---|
| Primary body and reading text | 10–11px | 15px | `--text-body` contract |
| Navigation, tables, forms, buttons | 9–12px | 14px minimum | `--text-control` selector checks |
| Secondary metadata | 8–9px | 12px | `--text-meta` contract |
| Badges and uppercase labels | 7–8px | 11px minimum | `--text-label` selector checks |
| Reading line height | scattered 1.4–1.8 | shared 1.55/1.7 | line-height token checks |
| Effective viewport near 200% zoom | fixed left sidebar | sticky full-width top navigation below 700px | narrow-layout selector checks |

## Representative Human review

After the updated Web image is running, verify at 100% zoom and again at 200% zoom:

- Sign in: guidance, credential label, input, error, and Continue action are readable.
- Attention: risk metadata, decision question, proposal, and all decision buttons remain visible.
- Project: goal, status metrics, baselines, Cycle summary, dependency work, and exceptions remain legible.
- Work: Issue key/title, type/path, state, dependencies, and modules wrap without clipping.
- Artifact and Issue detail: tabs, baseline body, intake, acceptance, readiness, evidence, and handoff are readable.
- Quick Add: segmented type selector, all field labels/inputs, risk flags, and footer actions remain usable.

## Automated release checks

- `pnpm --filter @tandem/web test`
- `pnpm --filter @tandem/web typecheck`
- `pnpm --filter @tandem/web build`
- `pnpm check`

This checklist records the measurable before/after contract. Final visual comfort is intentionally a Human experience decision and is requested after the implementation handoff; no Agent records that decision on the Human's behalf.
