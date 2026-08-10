# Iteration 0 Execution Summary

- Status: `VERIFIED`
- Completed: 2026-08-04
- Plan: [Iteration 0 — Executable Product Skeleton](../iterations/iteration-00-executable-skeleton.md)

## Outcome

Tandem now runs as a coherent Agent-first vertical slice. An external Coding Agent can discover the project over MCP, onboard from current Artifact and code context, claim dependency-safe work, record Evidence and a handoff, and cause the same state to appear in Human Web Attention. State survives a complete API/Web restart.

## Implemented

- TypeScript/pnpm monorepo with contracts, domain, storage, API, and React Web packages;
- Project/Milestone/Cycle, six Issue types, dependency-derived Ready/Blocked, and one active claim;
- Git-backed effective Artifact revisions plus explicit proposed revisions;
- Agent Session onboarding manifest, required-context acknowledgement, Context Digest, and stale policy;
- checkpoint, typed Evidence, handoff, Human/policy verification authority, and Activity;
- 14 MCP Tools and 2 MCP Resources over Streamable HTTP using the official TypeScript SDK;
- REST Agent workflow and baseline-first Human oversight pages;
- atomic `.tandem/state.json` persistence for the single-instance local slice;
- configuration runbook for Codex, Claude Code, Gemini CLI, and Cursor.

## Validation Evidence

### Automated

`pnpm check` passed:

- strict type-check: 5 workspace packages passed;
- unit/integration: 12 tests passed across Domain (8), persistence (1), and API (3);
- production build: contracts, domain, storage, API, and Web passed;
- Web output: 214.45 kB JavaScript (65.91 kB gzip) and 19.98 kB CSS (5.33 kB gzip).

### MCP compatibility

`pnpm demo:mcp` connected to `http://127.0.0.1:4310/mcp`, discovered all 14 Tools and both Resources, and called `list_ready_issues` without an MCP error.

### Conversation-to-plan workflow

`pnpm demo:planning` completed Project onboarding, created a Product Brief working draft and Proposal, planned proposed Cycle 1, created `TAN-5 -> TAN-6` without a cyclic dependency, and opened separate Human decisions for Artifact baseline and Cycle activation. Proposed-Cycle Issues remain non-Ready until a Human activates the Cycle.

### Real workflow

`pnpm demo:agent` completed:

1. Session start and six-item onboarding manifest;
2. required Artifact/repository/code/verification acknowledgement;
3. unique claim for `TAN-2`;
4. implementation checkpoint;
5. passed Evidence;
6. handoff and Human Attention.

After stopping and restarting API/Web, Session `6eeec6ef…` restored as `handed_off`; `TAN-2` restored as `review` with the same claim, one Evidence item, and one handoff.

### Human Web

Browser verification confirmed:

- Project overview shows current baselines, Cycle, dependency-aware work, and Attention;
- Agent Sessions shows the confirmed context digest and handed-off Session;
- TAN-2 detail shows acceptance, dependency, active claim, Evidence, and handoff;
- Artifact detail opens the Git-backed effective r1 first and marks r2 as a non-effective Proposal;
- compact responsive layout remains readable in the Codex in-app browser.

## Scope Decisions

- Tandem does not launch Agent processes; Humans start parallel CLIs against Ready Issues.
- There is no Tandem CLI or required Skill. Repository instructions plus remote MCP are sufficient.
- Raw conversations and private reasoning are not stored; only semantic checkpoints and delivery evidence are durable.
- File persistence is deliberately a single-instance adapter for this product slice, not the shared pilot database.

## Remaining Pilot Risks

The current local version must not be exposed to a team network because it has no Human login or Agent OAuth/scopes. Before a shared 3–5 person pilot, complete PostgreSQL transactional storage, idempotency/optimistic concurrency, identity and authorization, GitHub App/webhook projection, SSE, backup/restore, and deployment hardening.
