# Tandem MVP Product Requirements

## Document Information

- Product: Tandem
- Status: `REVIEWED`
- Target: MVP pilot for one 3–5 person software team
- Review date: 2026-08-08
- Primary market: North American software builders
- Revision: adds first-real-project onboarding and Quick Work delivery; clarifies TAN-8 Human delivery verification outcomes

## 1. Product Positioning

Tandem is an Agent-first software delivery memory and coordination layer.

Development normally starts in Codex, Claude Code, Gemini CLI, Cursor, or another MCP-capable coding agent. Tandem is the durable system those agents continuously read and update while they discover requirements, create artifacts, plan work, implement code, validate results, and hand work to another Agent or a Human.

Tandem is not where every conversation must happen. It is where the conclusions, effective baselines, work relationships, evidence, and decisions become durable and understandable.

Core loop:

```text
Human + Agent Conversation
  -> Versioned Artifact
  -> Project / Cycle / Issue Plan
  -> Agent Onboarding and Execution
  -> Evidence and Git Delivery
  -> Human Attention or Policy Decision
  -> Handoff / Next Cycle
```

## 2. Product Principles

1. **Agent-first interface**: MCP is the primary operating surface; Web is the Human oversight surface.
2. **Work begins anywhere**: a session may start from a conversation, an existing document, an Issue key, or an existing repository.
3. **Baseline over document dump**: Humans see the effective requirement/design first, proposed changes second, and history on demand.
4. **Progressive elaboration**: requirements, design, and plans evolve through revisions rather than a mandatory waterfall.
5. **Policy-driven autonomy**: Agents may continue automatically inside granted boundaries; they cannot impersonate a Human decision.
6. **Onboarding before implementation**: an Agent reads required documents and relevant code anchors before claiming implementation work.
7. **Evidence over activity volume**: store checkpoints, decisions, validation, and handoffs—not every shell command or private chain-of-thought.
8. **Git remains engineering truth**: accepted repository documents and code live in Git; Tandem stores workflow state, immutable snapshots, provenance, and links.

## 3. Users and Actors

### Coding Agent — primary user

- connects through remote MCP;
- opens an Agent Session from a repository, Project, Cycle, or Issue;
- receives an onboarding manifest;
- reads repository documents and code;
- creates and revises Artifacts;
- plans Projects, Milestones, Cycles, and Issues;
- creates dependency relationships;
- claims Ready Issues;
- records checkpoints, evidence, and handoffs;
- requests Human attention when ambiguity, policy, or risk requires it.

### Human Builder / Product Owner

- discusses intent in a Coding Agent CLI or provides existing documents;
- reviews current baselines, proposed changes, Cycle plans, risks, and evidence in Web;
- starts multiple Agents manually for parallel Ready Issues;
- makes product, risk, experience, release, and other policy-required decisions.

### Human Reviewer / Teammate

- reviews implementation, tests, experience, and delivery evidence;
- comments on or accepts proposed Artifact revisions;
- observes project state without reading every Agent event.

### System Actor

- evaluates dependency readiness and autonomy policies;
- projects GitHub events;
- marks context stale when baseline documents change;
- never represents itself as a Human.

## 4. North American Agile Work Model

```text
Workspace
└── Team
    ├── Initiative (optional)
    │   └── Project
    │       ├── Milestone
    │       ├── Artifact
    │       └── Issue
    │           └── Sub-issue
    ├── Backlog
    └── Cycle / Sprint (optional timebox across Issues)
```

- **Initiative**: optional long-running objective grouping Projects.
- **Project**: bounded delivery outcome with a goal, success measures, owner, and target.
- **Milestone**: meaningful Project checkpoint such as internal alpha, pilot, beta, or release.
- **Issue**: work item with type `epic`, `story`, `task`, `bug`, `spike`, or `chore`.
- **Sub-issue**: independently claimable child work.
- **Cycle**: optional timebox grouping Issues; it is not a release.
- **Roadmap**: a view over Initiatives, Projects, and Milestones, not a separate hierarchy level.

## 5. Entry Scenarios

### A. Conversation-first discovery

The Human discusses an idea in a Coding Agent CLI. The Agent opens a Tandem Session, records structured conclusions, creates a Product Spec Artifact, and iteratively refines it. Human review occurs only when requested or required by policy.

### B. Human-provided Spec or design

The Human points the Agent at existing repository documents. The Agent registers their paths and hashes, reads them, maps them to the Project, creates or updates Issues, and asks only about missing or conflicting context.

### C. Existing repository onboarding

The Agent starts from a repository and no Issue. It reads repository guidance, discovers the connected Tandem Project from Git remote, inspects current artifacts and code, creates a current-state summary, and proposes the next Project/Cycle work.

### D. Issue execution

The Human says, for example, “Familiarize yourself with the project and take ACME-142.” The Agent starts a Session, reads the returned onboarding manifest, confirms its understanding, claims the Issue if it is Ready, implements, validates, and submits a handoff.

### E. Manual parallel Agent work

One Agent plans a Cycle and Issue dependency graph. The Human starts multiple Coding Agent sessions for Ready Issues. Tandem prevents duplicate claims, exposes soft module/branch conflicts, and makes the final Integration Issue Ready after its dependencies complete. Tandem does not launch or schedule Agent processes.

### F. Quick Work from a conversation or Web

A Human or Agent notices a small Bug, Improvement, or Chore while discussing or using the product. The work is captured immediately as a Project Issue without requiring a Milestone, Cycle, PRD revision, or separate planning ceremony. An Agent enriches the Issue with acceptance and verification details, onboards from the current Project context, implements it, and attaches evidence. Low-risk work may complete under policy; material scope, contract, data, security, privacy, billing, or release impact promotes the same Issue into the planned delivery path and requests the required Human decision.

Quick Work is a delivery path, not a new hierarchy level and not a shortcut around onboarding, traceability, testing, or authority rules.

## 6. MVP Capabilities

### P0 — required for pilot

#### Workspace, Team, identity

- one Workspace and Team;
- invite-only Human membership administered by an active Human owner;
- Human and Agent actor identities remain distinct;
- Humans normally sign in to Web with a unique username and password;
- Humans may also use independently revocable personal access tokens for API, CLI, or recovery workflows;
- Agents normally authenticate with independently revocable, Project-scoped access tokens in the local pilot and OAuth in hosted remote MCP;
- creating an Agent shows the new token exactly once; Tandem never displays a stored password or token again;
- owners can list, create, activate/deactivate, reset credentials, and rotate tokens for Human and Agent identities from Web;
- deactivating an identity invalidates its credentials and Web sessions without deleting audit history;
- the last active owner cannot be deactivated or stripped of owner authority;
- OAuth-authenticated remote MCP sessions;
- project/repository access scopes.

#### Project, Milestone, Cycle

- first-real-project bootstrap from Web or MCP with Project key, name, goal, repository binding, owner, and optional initial Artifact imports;
- Project discovery by Issue key, explicit Project key, or normalized Git remote—never by a hard-coded sample Project;
- Project goal, success measures, non-goals, owner, status, health, and target date;
- Milestones and Roadmap view;
- Cycle goal, scope, success criteria, Definition of Done, status, and plan revisions;
- Cycle status: `draft -> proposed -> active -> completed/cancelled`.

#### Web Oversight Interface & 5-Hub Human Ergonomics

- 5 primary navigation hubs: **Attention (Inbox/Human Decisions)**, **Board & Work (GitHub Projects-style Kanban)**, **Baselines & Artifacts (PRDs & Architecture)**, **Activity & Sessions (Traceability)**, and **People & Security (Identity & Access)**;
- 5-column GitHub Projects Kanban mapping (`Backlog` -> `Ready` -> `In Progress` [Claim Lock] -> `In Review` [Human Verification Gate] -> `Done`);
- clear non-technical role visibility (PM, Designer, Ops, Tech Lead) without requiring direct git or terminal inspection;
- single-click Human verification and rationale entry for handoffs in `In Review`.

#### Issue and dependencies

- types: Epic, Story, Task, Bug, Improvement, Spike, Chore;
- delivery path: `quick` or `planned`; both use the same Issue identity, state machine, claim, evidence, and audit rules;
- Human Web and Agent MCP may both capture Quick Work; actor identity and source provenance are always retained;
- Project is required while Milestone, parent, and Cycle remain optional;
- Quick Bug captures observed behavior, expected behavior, reproduction context, impact, and regression verification;
- Quick Improvement captures current friction, desired outcome, affected surface, and before/after acceptance;
- Quick Chore captures the maintenance outcome, affected surface, and verification method;
- an Agent may enrich incomplete Quick Work, but may not fabricate a Human decision or silently broaden the accepted outcome;
- deterministic policy promotes Quick Work to the planned path when it gains dependent work or has material product scope, public contract, migration, security/privacy, billing, destructive, release, or cross-project impact;
- parent/sub-issue hierarchy;
- `blocks` and `blocked_by` relationships;
- states: `backlog -> ready -> claimed -> in_progress -> review -> verified -> done`, plus `blocked/cancelled`;
- Ready is calculated from dependencies and required context;
- one active claim per Issue;
- branch/worktree and affected-module metadata;
- dependency graph and parallel conflict warnings.

#### Versioned Artifacts

- types: Product Brief, Product Spec, Project Plan, Cycle Plan, System Design, ADR, API Contract, Data Dictionary, Test Plan, E2E Report, Experience Review, Delivery Summary, Retrospective;
- mutable working draft plus immutable semantic checkpoints;
- states: `working_draft`, `proposed`, `baselined`, `superseded`, `drifted`, `archived`;
- authorship: Human, Agent, coauthored, imported;
- storage modes: Tandem draft, Git-backed, external;
- Markdown/JSON snapshot, digest, source Session, linked work, Git path/commit/blob;
- baseline-first reader, semantic diff, revision history, and impact links.

#### Agent Onboarding Session

- `start_session` resolves Project/Issue from Issue key or Git remote;
- returns required Artifact revisions, repository paths, code anchors, recent decisions, constraints, risks, and verification commands;
- `confirm_understanding` records documents read, code areas inspected, summary, intended changes, and open questions;
- baseline digest changes mark older Session context stale;
- Session lifecycle: `onboarding -> active -> waiting_human -> handed_off/finished`.

#### Agent-native MCP

Resources:

- current workspace/project guidance;
- Project baseline and Artifact index;
- current Cycle and Ready Issues;
- Issue context and prior handoff.

Tools:

- `start_session`, `confirm_understanding`;
- `create_project`, `upsert_artifact_draft`, `checkpoint_artifact`;
- `plan_cycle`, `create_issue`, `add_issue_dependency`;
- `list_ready_issues`, `claim_issue`, `update_issue`;
- `record_checkpoint`, `attach_evidence`;
- `request_human_decision`, `submit_handoff`, `complete_issue`, `finish_session`.

`create_issue` supports both Quick Work and planned work. MCP responses explain missing intake fields, calculated delivery path/risk, required onboarding context, permitted next actions, and the corresponding Human Web URL.

#### Human Web

- username/password sign-in as the default Human path, with access-token sign-in available as an explicit alternative;
- Workspace Project picker and first-project setup;
- persistent Quick Add for Bug, Improvement, and Chore capture in under one minute;
- Attention page for decisions, stale context, blockers, drift, and experience review;
- Project overview with goal, health, milestone, active Cycle, success measures, and current baselines;
- Requirements/Baselines reader;
- Artifact revision and diff view;
- Roadmap and Milestone view;
- Cycle plan, dependency graph, Ready/Blocked/Active work;
- Issue detail with Agent Session, branch, evidence, and handoff;
- Human Verification workspace opened from Attention, with acceptance, delivery evidence, Git context, handoff, and explicit `Approve & complete` or `Request changes` outcomes;
- Experience Review and Human Decision;
- Settings > People & Agents for identity status, role, Project scope, credential issuance/revocation, and password reset;
- Account settings for the signed-in Human to change their own password and manage personal access tokens;
- append-only Activity timeline as secondary detail.

#### GitHub integration

- connect selected repositories through a read-only GitHub App;
- ingest push, pull request, and check events;
- correlate branches, commits, PRs, checks, and Git-backed Artifact revisions;
- detect Git/Tandem Artifact drift;
- no automatic merge or deployment.

### P1 — after pilot

- email invitations, password-recovery email, MFA, enterprise SSO, SCIM, and organization-wide identity federation;

- multiple Teams/Workspaces;
- richer Roadmap analytics;
- Slack/email notification;
- GitLab/Bitbucket;
- provider-specific Skills/Plugins/Extensions;
- object storage for large artifacts;
- cost and usage metering;
- configurable workflow designer;
- automated Agent launching and sandbox orchestration.

## 7. Autonomy and Decision Model

Every transition records one of:

- `human_decision`: explicit authenticated Human action;
- `human_stated`: an Agent-reported conversation decision with provenance, not a hard approval;
- `policy_passed`: system policy and evidence allow automatic continuation;
- `agent_recommendation`: advice without authority.

Agents may automatically create/revise documents, plan work, claim authorized Issues, implement, test, attach evidence, and complete low-risk work. Human decision is required by default for material Product Goal/scope changes, incompatible contracts or migrations, security/privacy risk, destructive actions, production release, model promotion, and ambiguity with material trade-offs.

When an Issue is in `review`, only an explicitly authenticated Human or an allowed system policy may resolve the delivery review. `Approve & complete` completes the Issue. `Request changes` requires a rationale, releases the completed Agent claim, preserves the prior Session, evidence, and handoff, returns the Issue to calculated readiness, and records the Human outcome in append-only Activity. An Agent cannot submit either Human outcome.

Quick Work follows the same authority model. Its reduced ceremony removes unnecessary planning objects; it does not lower evidence or Human-decision requirements. A normal code-only Bug does not require an Artifact revision. If the accepted requirement, design, API/data contract, test policy, or other effective baseline changes, the Agent must create a new Artifact revision and link it to the Issue.

## 8. Artifact Storage Rules

- Before Git publication, Tandem is the content source for a working draft.
- After Git publication, the Git path at a commit/blob is the engineering content source; Tandem keeps an immutable snapshot and provenance.
- Editing a baselined Artifact creates a new revision.
- Accepted content never changes in place.
- Raw CLI transcripts and hidden reasoning are not required or stored.
- Agents record structured decisions, constraints, open questions, rejected options, evidence, and handoffs at semantic boundaries.

## 9. Non-goals

- no built-in coding chat;
- no local `tandem` CLI in MVP;
- no Agent scheduler, runtime, or sandbox;
- no automatic Agent process launch;
- no mandatory Sprint methodology;
- no story points, time sheets, or capacity optimization;
- no full Jira replacement;
- no requirement that every small Bug, Improvement, or Chore belong to a Cycle or create a PRD/System Design revision;
- no raw chain-of-thought storage;
- no automatic merge, deploy, or production promotion;
- no support guarantee for Coding Agents without remote MCP.

## 10. Success Metrics

- a Human can connect Codex and complete first authentication in under 10 minutes;
- a new Agent can locate and summarize required project context in under 5 minutes;
- a Human can find the current effective requirements and Cycle plan in under 30 seconds;
- at least 90% of implementation Sessions confirm onboarding before a claim;
- 100% of completed Issues have a baseline context digest, evidence, and handoff;
- blocked Issues are not presented as Ready;
- two Agents can claim different independent Issues without duplicate ownership;
- all accepted changes trace to Artifact revision, Issue, Session, Evidence, Human/policy decision, and Git object when applicable;
- less than five minutes per person per day spent manually maintaining status;
- at least 10 real Issue delivery loops during the pilot.
- a Human or Agent can capture a well-formed Quick Issue in under 60 seconds;
- at least three pilot loops are Quick Work, including one Bug with regression evidence and one policy-promoted Issue;

## 11. MVP Capacity

- 5 Human users;
- 10 Agent identities;
- 10 concurrent Agent Sessions;
- 5 active Projects;
- 1–5 GitHub repositories;
- 10,000 Activity records per month.

## 12. Minimum Usable Project Release Gate

Tandem is usable by the first real 3–5 person team only when all of the following are true:

1. a Human can create a non-sample Project, bind its repository, and import or create the minimum current Product/Design/Test guidance;
2. a Coding Agent can resolve that Project from its Git remote or Issue key, read the onboarding manifest, confirm understanding, and claim Ready work;
3. a Human or Agent can capture Quick Work, and the system can keep it lightweight or promote it using explicit policy;
4. a Human can see Project progress, effective baselines, current/blocked/review work, Agent Sessions, evidence, Git delivery, and required decisions in Web;
5. one planned Issue and one Quick Bug complete end to end with identity, idempotency, evidence, handoff, and Git traceability;
6. production-like deployment survives restart, and backup/restore plus authority-boundary tests pass;
7. setup and recovery limitations are documented, with no critical/high data-loss or Human-impersonation defect open.
