# Tandem MVP Information Architecture

## Document Information

- Status: `REVIEWED`
- Review date: 2026-08-08
- Depends on: [MVP PRD](../prd/tandem-mvp-prd.md)
- Audience: Human Builders using the Web oversight surface
- Revision: first-project setup, Project switching, and Quick Work capture

## 1. Experience Model

Tandem has two equal views of one domain:

- Coding Agents operate primarily through MCP resources and tools.
- Humans use Web to read effective baselines, understand delivery state, and make decisions.

The Web is not a chat client or a wall of Agent steps. It answers five questions quickly:

1. What outcome are we delivering?
2. What requirements and designs are effective now?
3. What work is Ready, active, blocked, or awaiting review?
4. What changed, what evidence exists, and what is at risk?
5. What specifically needs a Human decision?

## 2. Primary Navigation (5-Hub Agile Model)

```text
Tandem Workspace
├── Project switcher / Quick Add
├── 1. Attention (Inbox & Human Decisions)
├── 2. Board & Work (GitHub Projects 5-Column Kanban & Slices)
│   ├── Backlog
│   ├── Ready
│   ├── In Progress (Claimed by Agent)
│   ├── In Review (Awaiting Human Verification)
│   └── Done
├── 3. Baselines & Artifacts (PRDs, Architecture, Decisions)
├── 4. Activity & Sessions (Traceability & Agent Logs)
└── 5. People & Security (Team, Agents, Tokens, Settings)
```

`Attention` is the default landing page. The primary delivery surface is the 5-column GitHub Projects-style Kanban board under `Board & Work`.

The Project switcher selects the active Project context and never assumes the seeded example Project. `Quick Add` remains available from every authenticated page and opens a focused Bug, Improvement, or Chore capture surface.

## 3. First Project Setup

An empty Workspace opens a short setup flow rather than demo delivery data:

1. Project identity: name, short key, goal, and owner;
2. repository: provider and repository binding, with an optional verification result;
3. current knowledge: import existing repository paths or create minimal Product, Design, and Test guidance drafts;
4. access: confirm Human members and Agent Project scopes;
5. readiness: show what Agents can read now and which context requirements remain missing.

Milestone and Cycle creation are optional follow-up actions. The completion screen provides the MCP endpoint/configuration example, Project URL, and a first-session prompt such as “Familiarize yourself with this repository and show Ready work.”

## 4. Attention

The page is ordered by required Human attention, not event time:

1. product, architecture, security, experience, and release decisions;
2. blocked Issues with an explicit Human question;
3. proposed Artifact revisions and semantic changes;
4. stale Agent context and Git/Artifact drift;
5. incomplete evidence or handoffs.

Each card shows Project, Issue or Artifact, request type, risk, proposal, evidence summary, requester, wait time, and the smallest safe action. Human decisions require an explicit rationale and never share controls with Agent recommendations.

For an Issue ready for verification, `Review issue` opens a visibly focused Human Verification workspace rather than silently reselecting a generic drawer. The workspace keeps the Attention context visible through its heading and selected-Issue URL, presents acceptance, Git delivery, evidence, and handoff before the decision controls, and offers `Approve & complete` and `Request changes`. Both outcomes require deliberate Human action; requesting changes also requires a rationale.

## 5. Project Overview

```text
Project Header
  Goal · Owner · Health · Target · Repository

Outcome Summary
  Success measures · Non-goals · Current milestone

Current Baselines
  Product Spec · System Design · Data Dictionary · Test Plan

Delivery Now
  Active Cycle · Ready · Active · Blocked · Review

Attention and Risk
  Decisions · Drift · Stale sessions · Integration conflicts
```

Tabs: `Overview | Baselines | Milestones | Cycles | Work | Evidence | Activity`.

The overview does not expand Agent micro-steps. It shows last semantic checkpoint and links to a Session when detail is needed.

## 6. Artifacts and Baselines

### Artifact index

Group by product, architecture, data/API, quality, and delivery. Each row shows:

- effective revision and baseline state;
- source mode: Tandem draft, Git-backed, or external;
- author/provenance and last change;
- impacted Projects, Cycles, Issues, and Sessions;
- drift or pending proposal.

### Artifact reader

The default view opens the effective baseline, not the most recent unaccepted draft.

```text
Header: Type · Title · Effective revision · State · Source
Tabs: Current Baseline | Proposed Change | History | Impact
Body: rendered Markdown or structured JSON
Side rail: provenance · Git anchor · linked work · decisions
```

The proposed-change view is diff-first. Baselined content is immutable; edit creates a new revision.

## 7. Roadmap and Cycles

Roadmap is a view over Initiatives, Projects, and Milestones. It does not create another work hierarchy.

Cycle detail includes:

- goal, dates, Definition of Done, plan revision, and success criteria;
- dependency graph with Ready, Claimed, Active, Blocked, Review, and Done states;
- work grouped by milestone or Epic;
- detected module/branch conflicts;
- integration Issue and outstanding dependencies;
- proposed plan changes with impact diff.

Cycle is optional. Backlog Issues can exist and be completed without a Cycle.

## 8. Work and Issue Detail

Work supports list, grouped, and dependency views. Filters include Project, Cycle, Milestone, type, state, assignee, dependency, and context readiness.

### Quick Add

The initial form targets capture, not full planning:

- type: Bug, Improvement, or Chore;
- Project, preselected from current context;
- short title and plain-language observation/request;
- optional screenshot/link, affected area, urgency, and source reference.

Bug capture progressively asks observed behavior, expected behavior, and reproduction context. Improvement capture asks current friction and desired result. Chore capture asks maintenance outcome and verification. Missing structured details do not discard the report: the Issue enters `backlog` with an Agent-enrichment next action and clear warnings.

After capture, the result shows the calculated `quick` or `planned` path, why, what context/evidence is required, and a copyable Issue key. If policy promotes it, the UI explains the planning or Human decision required instead of silently turning the report into a large workflow.

Issue detail:

```text
Intent and Acceptance
  original intake · enriched description · acceptance criteria · non-goals

Delivery Path
  quick/planned · risk reason · source actor/reference · promotion history

Readiness
  blocking Issues · required Artifacts · context digest

Execution
  active claim · Agent Session · branch/worktree · affected modules

Evidence and Handoff
  tests · checks · PR/commit · result summary · risks · follow-up

Human Verification (review state only)
  acceptance/evidence/handoff summary · approve and complete · request changes with rationale

History
  semantic checkpoints and decisions, with raw activity secondary
```

The interface distinguishes `verified` from `done`: verification evidence can pass before a Human experience or policy gate completes.

## 9. Agent Sessions

Session detail makes onboarding and continuity visible:

- resolved Project, Issue, repository, and context digest;
- required Artifact revisions and repository paths;
- code anchors and verification commands;
- Agent understanding summary, intended changes, and open questions;
- current claim and structured checkpoints;
- evidence, handoff, stale-context warnings, and next actions.

It does not display private chain-of-thought or require raw CLI transcripts.

## 10. Activity

Activity is an append-only audit timeline, not the primary collaboration feed. Repeated low-value progress is grouped. Filters cover actor, object, action, result, Project, and time. Every entry links to its domain object and Git object when applicable.

## 11. State Presentation

### Cycle

`draft -> proposed -> active -> completed | cancelled`

### Issue

`backlog -> ready -> claimed -> in_progress -> review -> verified -> done`

Side states: `blocked`, `cancelled`. Ready is derived from dependency and context policy rather than set freely by a client.

`quick` and `planned` are delivery paths displayed alongside state, not additional states. Promotion keeps the same key and history.

### Artifact revision

`working_draft -> proposed -> baselined -> superseded | drifted | archived`

### Agent Session

`onboarding -> active -> waiting_human -> handed_off | finished`

## 12. Responsive MVP

- Desktop is optimized for Artifact diff, dependency graph, and evidence review.
- Tablet supports all Human decisions and reading.
- Mobile supports Attention triage and decision reading; graph editing is not a pilot requirement.
- Keyboard navigation, visible focus, semantic headings, and non-color state cues are required.

## 13. Usability Acceptance

- a Human finds the effective Product Spec and Cycle plan within 30 seconds;
- a reviewer understands a proposed Artifact change without reading an entire conversation;
- a builder can see why an Issue is blocked and which Issues are safely parallelizable;
- a reviewer can answer why, what changed, evidence, risk, and requested decision from one Issue page;
- Agent event volume does not increase the number of top-level Attention cards unless Human attention is actually required.
- an empty Workspace can create and open its first real Project without seeing or editing the `TAN` demo Project;
- a Human can capture a Quick Issue from any page in under 60 seconds and understand whether it stayed lightweight or was promoted.
