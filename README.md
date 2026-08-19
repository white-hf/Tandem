# Tandem

> **Agent-First Software Delivery Memory and Coordination Layer**
> An Agent-first software delivery memory and coordination layer built for the AI Agent coding era, designed for 3–5 person Human + Agent engineering teams and solo builders.

---

## 💡 Why Tandem? Software Engineering in the AI Agent Era

In the era of LLMs and autonomous Coding Agents (Claude Code, Cursor, Antigravity, Windsurf, etc.), **the central bottleneck of software engineering has shifted from *writing code* to *governing and coordinating Agent delivery***.

Without a dedicated coordination layer, AI-native software engineering suffers from 4 fundamental failure modes:

| AI Era Engineering Challenge | Industry Root Cause | How Tandem Solves It (Core Value) |
| :--- | :--- | :--- |
| **1. Context Drift & Alignment Loss** | Long conversations lead to memory decay, spec erosion, and architectural entropy. | **Immutable Baseline Memory**: Tandem anchors PRDs, System Designs, and DoD as SHA-256 hashed baselines. Agents must verify baseline hashes via MCP before coding. |
| **2. Multi-Agent Swarm Chaos** | Multiple Agents operating concurrently collide, overwrite code, or duplicate work. | **Agent-First Coordination Layer**: Exclusive claim locks (`claim_issue`) prevent multi-agent collisions. Agents autonomously discover, claim, and unblock issues via MCP. |
| **3. Review Exhaustion & Trust Crisis** | Humans cannot manually review thousands of lines of generated code. | **Evidence-Based Governance**: Replaces code-line nitpicking with *Executable Evidence* (test & build outputs). Humans inspect high-level evidence in the **Attention Inbox**. |
| **4. Auditability & Memory Deficit** | Agent chat sessions leave no structured engineering history or decision trail. | **Append-Only Delivery Audit**: All human decisions, agent sessions, test evidence, and commits form an immutable, auditable delivery history in PostgreSQL. |

---

## 🎯 Target Audience & Team Configurations

- **Solo Founders & Builders with Agents**: Solopreneurs steering 1–3 autonomous Coding Agents, acting as Product Owner while Agents execute tasks.
- **3–5 Person Hybrid Human + Agent Engineering Teams**: Human engineers focus on architecture baselines, high-risk reviews, and strategic decisions; Coding Agents execute routine tasks and feature slices.
- **Agent-Native Enterprise R&D**: Teams adopting Model Context Protocol (MCP) to standardize AI agent delivery workflows across GitHub repositories.

---

## 🌟 Latest Product Features & Architecture

Tandem provides an **Agent-First MCP Protocol Interface** for Coding Agents and an **Ergonomic Web Interface** for Human Oversight.

```text
Human + Agent Conversation
  ➔ Versioned Baseline Artifacts (PRD & System Design)
  ➔ Project Switcher Dropdown & On-Demand + Create Project Modal
  ➔ 5-Hub Primary Navigation & 5-Column GitHub Projects Board
  ➔ Scalable Cycle Selector Dropdown & Dependency-Aware List View
  ➔ Autonomous Agent Onboarding, Context Hash Digest & Claim Locks
  ➔ Executable Evidence (Tests & Builds) & Human Verification Gate
  ➔ Session Sign-Out & Append-Only PostgreSQL Audit Trail
```

### 1. 5-Hub Ergonomic Oversight Navigation (Web Interface)
- **`Attention`**: Human decision inbox and review gates. Filters out non-critical noise and highlights items requiring human approval.
- **`Board & Work`**: 
  - **5-Column GitHub Projects Board**: `Backlog` ➔ `Ready` ➔ `In Progress` [Claim Lock] ➔ `In Review` [Human Gate] ➔ `Done`.
  - **Dependency-Aware List View**: Scalable structured table displaying *Blocked By (Upstream)* and *Blocks (Downstream)* relations, gracefully supporting 100+ issues without canvas visual clutter.
  - **Scalable Cycle Selector**: Dropdown selector supporting hundreds of Scrum Sprints & Cycles.
  - **Roadmap & Milestones**: High-level timeline for release milestones.
- **`Baselines & Artifacts`**: Hashed baseline documents (PRD, System Design) with immutable revision histories.
- **`Activity & Sessions`**: Complete agent session execution history and PostgreSQL append-only audit log.
- **`People & Security`**: Team credentials, Human password authentication, Agent tokens, and session **Sign Out** security.

### 2. Multi-Project & Workspace Flexibility
- **Project Switcher & Creator**: Seamlessly switch between multiple projects in the sidebar or trigger the `Project Setup` modal to bootstrap a new project with GitHub repository bindings.

### 3. Agent-First MCP Delivery Protocol & 100% Autonomous Continuous Mode
- **Zero-Prompt Agent Onboarding**: Agents connect to `http://127.0.0.1:4310/mcp` via standard MCP config (`.mcp.json` / Codex `config.toml`) and call `get_project_context`, `confirm_understanding`, and `claim_issue` autonomously.
- **100% Autonomous Continuous Execution**: When granted an overarching goal by Human in conversation, Agents are authorized to plan cycles (`plan_cycle`), create structured issues (`create_issue`), claim (`claim_issue`), execute code, attach evidence (`attach_evidence`), and auto-verify non-material tasks without human chat prompting.
- **Expanded MCP Toolset**: Includes `refresh_session_context` (hot-refresh baseline context digests without interrupting agent sessions) and `finish_session` (cleanly release claim locks and close completed sessions).
- **Streamlined High-Density UI**: Compact page headers and single-line active Cycle banners maximize screen space, allowing 100% of Kanban columns, Sprints, and Work Items to render above the fold.
- **Human Oversight Sprint Control**: Issue detail drawer features an instant `Iteration / Cycle` dropdown selector allowing humans to assign or move issues across cycles (with automatic audit-trail lock on `done` and `cancelled` issues). Cycle header includes an `✏️ Edit Cycle` modal for quick goal and DoD adjustments.

---

## 🚀 Quick Start

### 1. Local Development Mode

Requires Node.js 22+, Corepack, and pnpm.

```bash
# Enable Corepack and install dependencies
corepack enable
pnpm install

# Start local development server (API on 4310, Web on 4311)
pnpm dev
```

#### Access Endpoints
- **Human Web Interface**: [http://127.0.0.1:4311](http://127.0.0.1:4311)
- **Agent MCP Endpoint**: `http://127.0.0.1:4310/mcp`
- **REST API Health**: [http://127.0.0.1:4310/health](http://127.0.0.1:4310/health)

### 2. Connecting Coding Agents via MCP

Add Tandem to your agent's MCP configuration (e.g. `.mcp.json` or Claude Code CLI):

```json
{
  "mcpServers": {
    "tandem": {
      "url": "http://127.0.0.1:4310/mcp",
      "headers": {
        "Authorization": "Bearer tan_agent_00000000000000000000000000000000"
      }
    }
  }
}
```

Or via Claude Code CLI:
```bash
claude mcp add tandem http://127.0.0.1:4310/mcp --header "Authorization: Bearer tan_agent_00000000000000000000000000000000"
```

---

## ⚡️ One-Click Startup & Management Script (`tandem.sh`)

Tandem provides an out-of-the-box shell script for one-click setup, launch, and management:

```bash
# 1. One-click build and launch (Docker Pilot stack with PostgreSQL)
./tandem.sh up

# 2. Inspect container status & API health
./tandem.sh status

# 3. View real-time logs
./tandem.sh logs api    # View API/MCP service logs
./tandem.sh logs web    # View Web UI logs

# 4. Restart or stop
./tandem.sh restart
./tandem.sh down
```

---

## 🐳 Docker Compose Deployment (Manual Command)

Alternatively, launch the Docker Compose Pilot stack directly:

```bash
POSTGRES_PASSWORD=tandem_pilot_password \
TANDEM_HUMAN_TOKEN=0000000000000000000000000000000000000000 \
TANDEM_AGENT_TOKEN=tan_agent_00000000000000000000000000000000 \
docker compose -f compose.pilot.yaml up -d --build
```

---

## 🧪 Verification & Workspace Checks

```bash
# Run workspace test suites (API, Domain, Identity, Web)
pnpm test

# Build production Vite bundle for Web app
pnpm --filter @tandem/web build
```

---

## 📄 Core Documentation Baselines & Runbooks

### 1. Architecture & Design Baselines
- [MVP PRD](docs/prd/tandem-mvp-prd.md) — Product requirements and boundary definitions.
- [Information Architecture](docs/design/information-architecture.md) — 5-Hub navigation and state taxonomy.
- [System Design](docs/design/system-design.md) — Core domain rules, MCP protocols, and execution lifecycle.
- [Physical Deployment Architecture](docs/design/physical-deployment-architecture.md) — Container topology, network routing, and security.
- [Database Data Dictionary](docs/design/database-data-dictionary.md) — PostgreSQL hybrid schema, tables, fields, and auto-migration mechanisms.
- [Repository Delivery Guidelines](AGENTS.md) — Rules of engagement for autonomous AI agents.

### 2. Operations & Engineering Runbooks
- [Pilot Operations Runbook](docs/runbooks/pilot-operations.md) — Database backup, restore drill, and health monitoring.
- [Coding Agent Setup Guide](docs/runbooks/coding-agent-setup.md) — MCP configuration for Codex CLI, Claude, and IDE agents.
- [First Project Setup](docs/runbooks/first-project-setup.md) — Multi-project onboarding and GitHub repository binding.
- [Developer Workflow](docs/developer-workflow.md) — Local development, iteration lifecycle, and release processes.
