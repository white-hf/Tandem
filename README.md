# Tandem

> **Agent-First Software Delivery Memory and Coordination Layer**
> An Agent-first software delivery memory and coordination layer designed for 3–5 person Human + Agent engineering teams.

Tandem is an Agent-first delivery coordination and memory layer. Coding Agents (such as Claude Code, Antigravity, Cursor, etc.) interact with it primarily through the **Model Context Protocol (MCP)** interface; Humans use the **Web oversight interface** for baseline reviews, cycle planning, attention inbox, evidence inspection, and authoritative decisions.

```text
Human + Agent Conversation
  ➔ Versioned Baseline Artifacts (PRD & System Design)
  ➔ 5-Hub Primary Navigation & 5-Column GitHub Projects Board
  ➔ Autonomous Agent Onboarding, Context Hash Digest & Claim Locks
  ➔ Executable Evidence (Tests & Builds) & Human Verification Gate
  ➔ Append-Only Audit Trail & PostgreSQL State Persistence
```

---

## 🌟 Key Features & Highlights

- **5-Hub Ergonomic Oversight Navigation**:
  1. `Attention`: Human decision inbox and review gates.
  2. `Board & Work`: 5-Column GitHub Projects style board (`Backlog` ➔ `Ready` ➔ `In Progress` [Claim Lock] ➔ `In Review` [Human Gate] ➔ `Done`), integrating List View, Scrum Cycles & Sprints, and Roadmap Milestones.
  3. `Baselines & Artifacts`: Immutable SHA-256 hashed baseline documents (PRD, System Design).
  4. `Activity & Sessions`: Complete agent session execution history and PostgreSQL append-only audit trail.
  5. `People & Security`: Team credentials, Human password authentication, and Agent Tokens.

- **Exclusive Agent Claim Locking**: Prevents multi-agent code collisions by allowing at most one active claim per issue.
- **Executable Evidence**: Requires Agents to attach reproducible test suites and build outputs before handoff.
- **Autonomous Continuous Mode**: Agents authorized by an overarching goal can autonomously plan cycles, create issues, execute, and auto-verify low-risk tasks inside policy.

---

## 🚀 Local Quick Start

Requires Node.js 22+, Corepack, and pnpm.

```bash
# Enable Corepack and install dependencies
corepack enable
pnpm install

# Start local development server
pnpm dev
```

### Local Access Endpoints

- **Human Web Oversight App**: [http://127.0.0.1:4311](http://127.0.0.1:4311)
- **Agent MCP Endpoint**: `http://127.0.0.1:4310/mcp`
- **REST API Health**: [http://127.0.0.1:4310/health](http://127.0.0.1:4310/health)

---

## 🐳 Docker Compose Deployment (Formal Local Pilot)

To deploy the production-like Docker Compose Pilot:

```bash
POSTGRES_PASSWORD=tandem_pilot_password \
TANDEM_HUMAN_TOKEN=0000000000000000000000000000000000000000 \
TANDEM_AGENT_TOKEN=tan_agent_00000000000000000000000000000000 \
docker compose -f compose.pilot.yaml up -d --build
```

---

## 🧪 Verification & Build Checks

```bash
# Run workspace test suites (API, Domain, Identity, Web)
pnpm test

# Build production Vite bundle for Web app
pnpm --filter @tandem/web build
```

---

## 📄 Core Product & Architecture Baselines

- [MVP PRD](docs/prd/tandem-mvp-prd.md)
- [Information Architecture](docs/design/information-architecture.md)
- [System Design](docs/design/system-design.md)
- [Repository Delivery Guidelines](AGENTS.md)
