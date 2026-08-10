# First Real Project Setup

- Status: `IMPLEMENTED`
- Audience: Product Owner / Human Builder and Coding Agents
- Goal: reach a usable non-demo Project without first creating a Milestone or Cycle

## 1. Prepare the repository

Choose a 2–8 character uppercase Project key such as `ACME`, identify the canonical Git repository, and locate the current confirmed product/design guidance. Add [Tandem Delivery Instructions](../../templates/tandem-repository-instructions.md) to the repository instruction file used by the team's Coding Agents.

Do not copy raw chat transcripts or hidden reasoning into Tandem. Import accepted conclusions, constraints, decisions, and links to source evidence.

## 2. Create the Project

Open Human Web. In a token-authenticated deployment, sign in with the individually issued Human token. An empty Workspace shows **First real Project** setup.

Enter:

- Project key, name, delivery goal, owner, and target date;
- primary GitHub organization/owner and repository name;
- optional current product guidance.

The optional guidance becomes a Human-baselined Product Artifact. If the documents already live in Git, an Agent can import them after setup with repository path, commit, blob, and digest binding. An Agent-created import starts as a Proposal; it does not impersonate Human confirmation.

Milestone and Cycle are optional. Create them only when the work needs a release target or timebox.

An Agent may also bootstrap through `create_project`. Supply at least one normalized repository binding. Repository owner/name/host identity must be unique so `start_session(gitRemote=...)` resolves deterministically.

## 3. Check Project readiness

Open **Artifacts**, **Work**, and **Attention**. Missing context remains visible as a warning; Tandem does not invent baselines or mark blocked work Ready.

The minimum useful context for implementation is:

- repository delivery instructions;
- accepted outcome and acceptance criteria on the Issue;
- required Product/Design/Data/Test baseline revisions, when applicable;
- affected code anchors and verification commands.

## 4. Connect each Coding Agent

Follow [Coding Agent setup](coding-agent-setup.md). Each Agent client receives its own credential and Project scopes. The first prompt can be:

```text
Use Tandem to resolve this Project from the current Git remote. Read the current
baselines and repository instructions, explain your understanding, then list the
Ready Issues. Do not start dependency-blocked work.
```

For planned work, ask the planning Agent to record Artifact proposals, an optional Cycle, Issues, and dependencies. Start separate external Agent sessions only for Issues returned as Ready. Tandem enforces one active claim per Issue but does not launch the processes.

## 5. Capture small work

Use **Quick Add** from any Human Web page, or tell a connected Agent to call `create_issue` with `deliveryPath=quick`.

- Bug: observed behavior, expected behavior, reproduction context, acceptance, and regression verification;
- Improvement: current friction, desired outcome, before/after acceptance, and verification;
- Chore: maintenance outcome and verification.

Incomplete intake is retained in Backlog for enrichment. A material risk flag or participation in a dependency plan promotes the existing Issue to Planned, preserves its original statement/history, and requests the needed Human decision.

## 6. Read progress

- **Overview**: outcome, delivery state, current Cycle if one exists, recent active work;
- **Attention**: Human decisions, blockers, stale onboarding, evidence gaps, and drift;
- **Work**: Quick/Planned path, Ready/active/review/done and dependency state;
- **Artifacts**: effective baseline and pending Proposal;
- **Agent Sessions**: who onboarded, claimed, and handed off;
- **Activity**: append-only audit trail;
- Issue detail: original intake, risk/promotion, acceptance, evidence, handoff, and Git delivery.

Humans do not manually mirror Agent progress. MCP mutations, Human decisions, and signed Git events update these views through the shared domain model and SSE.

## 7. First-day acceptance

Before relying on Tandem for the Project, complete:

1. one Planned Issue through onboarding, claim, evidence, and handoff;
2. one Quick Bug with passed regression evidence;
3. one risky Quick request that visibly promotes and requests Human Attention;
4. two independent Ready Issues claimed by separate Agent sessions;
5. restart/reconnect and confirm Project, Issue, Session, Evidence, and Activity continuity.

For a shared remote Pilot, also complete the remaining release checks in [Iteration 4](../iterations/iteration-04-first-real-project.md).
