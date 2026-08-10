# Iteration 4 Implementation Summary

## Document Information

- Status: `IMPLEMENTED_PENDING_PILOT_EVIDENCE`
- Date: 2026-08-08
- Plan: [Iteration 4 — First Real Project and Quick Work Pilot](../iterations/iteration-04-first-real-project.md)
- Release decision: `NOT_YET_PILOT_READY`

## Outcome

Tandem now supports the minimum product flow required to introduce a real, non-demo repository and let Human/Agent conversations drive both planned delivery and lightweight Bug/Improvement/Chore work. MCP remains the Agent interface and Web remains the Human oversight interface. Tandem still does not launch Agents, execute CI, merge, or deploy.

## Delivered

### First real Project

- empty-Workspace Project creation from Human Web and Agent MCP;
- non-`TAN` Project keys, normalized repository bindings, Git remote resolution, and explicit conflict rejection;
- optional Human-baselined guidance import and Agent-authored Proposal import;
- optional Milestone/Cycle at bootstrap and dynamic Project switching/routes;
- production starts empty unless demo seeding is explicitly enabled.

### Quick Work

- `Improvement` Issue type and orthogonal `quick|planned` delivery path;
- immutable intake source/original statement/actor/time plus structured Bug, Improvement, and Chore fields;
- incomplete capture retained in Backlog for Agent enrichment;
- deterministic material-risk and dependency promotion without changing Issue identity;
- automatic Human Decision request for promoted risk;
- regression evidence gate for Quick Bugs and appropriate evidence gate for Improvements;
- global Human Quick Add and full intake/risk/evidence/handoff/Git detail.

### Agent and Human interfaces

- dynamic MCP resource templates for each authorized Project;
- `create_project` and `update_issue`, bringing the MCP surface to 16 tools;
- full Quick Bug MCP loop through create, Git discovery, onboarding, understanding, unique claim, checkpoint, evidence, handoff, and Human completion;
- REST and SSE Project scoping, subject redaction, and no production fallback to the demo Project;
- standard repository instruction template; no required Tandem CLI or Skill;
- first-project, Coding Agent, backup/restore, and Pilot operations runbooks.

### Shared-Pilot safety

- PostgreSQL migration for repository bindings and Quick Work fields;
- backward normalization of earlier stored Issues;
- reconnect-safe MCP idempotency namespace based on canonical request identity, plus pre-command replay for non-repeatable Human/Agent mutations;
- OAuth RFC 7662 introspection for remote Agent tokens, including capability and Project claims;
- Human token Web login remains separate from Agent OAuth authority;
- hosted mode fails closed unless all OAuth configuration is present;
- compose configuration carries token/OAuth deployment settings and keeps demo seeding off.

## Validation Evidence

- domain: 11/11 tests passed, including bootstrap, Git resolution, optional Cycle, Quick intake/enrichment, regression evidence, promotion, and Human authority;
- API/MCP/auth: 14/14 tests passed across five files, including scope denial, Human impersonation denial, OAuth claim mapping/fail-closed behavior, signed GitHub webhook, reconnect idempotency, Human Project/Quick capture replay, Project bootstrap, Quick Work, and dynamic resources;
- storage/PostgreSQL: 7/7 tests passed against the file adapter and PostgreSQL 17, including persisted pre-command replay, migration 0004, restart projection, identity revocation, concurrent retry serialization, GitHub deduplication, first-real-project binding, and Quick Work persistence;
- all TypeScript package/application typechecks passed;
- Human Web production build passed (`227.94 kB` JavaScript, `24.71 kB` CSS before gzip), and updated Pilot API/Web container images built successfully;
- standard MCP SDK workflow completed a real `QWK` Project and Quick Bug through Human completion, then survived API restart with intake, Session, evidence, handoff, and Activity intact;
- backup/restore rehearsal restored the test database into a clean disposable database. Projects `1`, repository bindings `1`, Issues `4`, Artifacts `3`, Sessions `1`, Evidence `1`, Decisions `0`, Activities `2`, state events `8`, migrations `4`, and the canonical state digest matched exactly. The disposable restore database and dump were removed;
- Pilot compose configuration validates with both static-token and OAuth environment fields.

No visual browser or screen-recording capability was used. Web evidence in this iteration is TypeScript/build plus API-domain behavior, not a claimed Human usability pass.

## Residual Limitations and Release Blockers

The implementation is a Pilot candidate, not a Pilot release. `PILOT_READY` requires:

1. a real OAuth/OIDC issuer and HTTPS endpoint completing remote MCP login/introspection;
2. a second supported external MCP client completing planned and Quick workflows;
3. a real GitHub App/repository installation and webhook/reconciliation exercise;
4. automated browser coverage for first setup, Quick Add, keyboard/responsive states, live progress, and Human decision review;
5. a deployment-specific encrypted backup destination and restore rehearsal;
6. Product Owner review of the Web experience and explicit `PILOT_READY` decision;
7. 10 real delivery loops during the 3–5 day Pilot, including three Quick Work cases and one promotion.

## Next Execution

The next iteration is validation rather than feature expansion: deploy the current candidate behind HTTPS with a real issuer, connect Codex and one additional MCP client, bind one real repository, run the seven first-day acceptance scenarios, fix only release-blocking defects, and ask the Product Owner for the explicit Pilot decision. Reporting, configurable workflows, Agent scheduling, Tandem CLI, and enterprise administration remain deferred.
