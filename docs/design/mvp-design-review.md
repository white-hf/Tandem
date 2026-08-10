# Tandem MVP Design Review Record

- Status: `APPROVED_WITH_REVISIONS`
- Decision owner: Product sponsor
- Original decision date: 2026-08-04
- Follow-up decision date: 2026-08-08

## Approved Positioning

Tandem is an Agent-first software delivery memory and coordination layer for 3–5 person teams. Supported Coding Agent CLIs operate it primarily through remote MCP. Humans use Web to read effective baselines, dependencies, evidence, risk, and decisions.

The approved delivery chain is:

```text
Conversation or existing repository context
  -> Versioned Artifact baseline
  -> Project / optional Cycle / Issue dependency plan
  -> Agent onboarding, claim, implementation, and validation
  -> Evidence, handoff, Human/policy decision, and Git delivery
```

## Review Revisions

The sponsor rejected the original Human-first `Outcome -> approved Spec -> Agent Run` framing and approved these corrections:

1. use North American Agile concepts: Initiative, Project, Milestone, optional Cycle/Sprint, Epic/Story/Task/Bug/Spike/Chore, and Sub-issue;
2. Agents may create and maintain requirements, designs, plans, and work through MCP during a normal Coding Agent conversation;
3. Humans are not required to create every object or approve every step; policy identifies material Human gates;
4. an Agent must onboard from current documents and relevant code before implementation claims;
5. parallel work uses dependency-aware Issues and one active claim, while Humans launch external Agent processes themselves;
6. the MVP has no Tandem CLI compatibility layer and no Agent scheduler/runtime;
7. drafts and workflow provenance live in Tandem; baselined engineering documents are Git-backed and immutable by revision;
8. Human Web is baseline-first, decision-first, and diff-first rather than a high-volume Agent activity board.

## Follow-up Approved Revisions

The sponsor approved the first-real-project and Quick Work plan with these product decisions:

1. a Human or Agent may capture a bounded Bug, Improvement, or Chore without first creating a Milestone, Cycle, PRD revision, or full plan;
2. Quick Work is a delivery path on the normal Issue, not a third hierarchy level or separate state machine;
3. lightweight handling does not bypass Agent onboarding, one-active-claim, evidence, handoff, authority, idempotency, or audit rules;
4. material scope, contract, migration, security/privacy, billing, destructive, release, or dependency impact promotes the same Issue into planned handling without losing its key or provenance;
5. the first real pilot must bootstrap a non-sample Project and remove production reliance on the seeded `TAN` Project;
6. Humans receive a global Quick Add and Project setup/switching experience while Agents continue to use standard MCP as the primary interface;
7. Iteration 4 is the reviewed minimum-usable-project plan; implementation remains gated by its release evidence.

## Approved Boundary

- one 3–5 person Team and up to five active Projects;
- remote MCP plus Human Web over shared domain services;
- versioned Artifacts, Projects/Milestones/Cycles, Issues/dependencies, Sessions/onboarding, Evidence/handoffs/decisions;
- read-only GitHub integration before pilot;
- four build weeks plus one pilot week target;
- no built-in chat, model execution, sandbox, Agent launching, automatic merge/deploy, story-point accounting, or full Jira replacement.

Detailed requirements, information architecture, system design, and delivery plan are now `REVIEWED`; implementation is authorized.
