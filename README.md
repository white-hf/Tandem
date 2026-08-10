# Tandem

> **Agent-First Software Delivery Memory and Coordination Layer**
> 面向 3–5 人 Human + Agent 研发团队的 Agent-first 研发协作与记忆层。

Tandem 是一个 Agent-first 的交付协调与记忆层。Coding Agents（如 Claude Code, Antigravity, Cursor 等）主要通过 **MCP (Model Context Protocol)** 接口与之交互；Humans 则通过 **Web 视图** 进行全局视角掌控、基线审核、时间盒规划与关键决策。

```text
Human + Agent Conversation
  ➔ Versioned Baseline Artifacts (PRD & Architecture)
  ➔ 5-Hub Primary Navigation & 5-Column GitHub Projects Board
  ➔ Autonomous Agent Onboarding, Context Hash Digest & Claim Locks
  ➔ Executable Evidence (Tests & Builds) & Human Verification Gate
  ➔ Append-Only Audit Trail & PostgreSQL State Persistence
```

---

## 🌟 核心功能与亮点

- **5-Hub 敏捷管理主导航**:
  1. `Attention`: 人工决策收件箱与关卡审核。
  2. `Board & Work`: 5 列 GitHub Projects 风格看板 (`Backlog` ➔ `Ready` ➔ `In Progress` [Claim 锁] ➔ `In Review` [Human 关卡] ➔ `Done`)，集成 List、Scrum Cycles & Sprints 与 Roadmap 里程碑切面。
  3. `Baselines & Artifacts`: PRD、架构设计等不可变 SHA-256 哈希版本基线。
  4. `Activity & Sessions`: 完整 Agent 领用轨迹与 PostgreSQL 追加审计日志。
  5. `People & Security`: 团队成员与 Agents 凭证 Token 管理。

- **Agent 独占锁 (Claim Lock)**: 任意 Issue 最多同时由一个 Agent 持有 `activeClaim`，防止多 Agent 协作修改冲突。
- **可复现证据 (Executable Evidence)**: Agent 声明完成前必须附带测试与打包构建等物理运行结果。
- **自动/自主运行模式 (Autonomous Continuous Mode)**: Agent 获得授权后可自主建立 Cycle、拆解 Issue 并通过策略自动校验归档。

---

## 🚀 本地快速启动

需要 Node.js 22+、Corepack 和 pnpm。

```bash
# 启用包管理器并安装依赖
corepack enable
pnpm install

# 启动本地开发服务
pnpm dev
```

### 服务入口

- **Human Web 管理界面**: [http://127.0.0.1:4311](http://127.0.0.1:4311)
- **Agent MCP Endpoint**: `http://127.0.0.1:4310/mcp`
- **REST API Health**: [http://127.0.0.1:4310/health](http://127.0.0.1:4310/health)

---

## 🐳 Docker Compose 容器部署 (Formal Pilot)

环境预置了 Docker Compose Pilot 部署规范：

```bash
POSTGRES_PASSWORD=tandem_pilot_password \
TANDEM_HUMAN_TOKEN=0000000000000000000000000000000000000000 \
TANDEM_AGENT_TOKEN=tan_agent_00000000000000000000000000000000 \
docker compose -f compose.pilot.yaml up -d --build
```

---

## 🧪 自动化测试与构建校验

```bash
# 运行全量测试套件 (API + Domain + Identity + Web)
pnpm test

# 运行 Vite 前端打包构建
pnpm --filter @tandem/web build
```

---

## 📄 产品与设计基线

- [MVP PRD](docs/prd/tandem-mvp-prd.md)
- [信息架构 (Information Architecture)](docs/design/information-architecture.md)
- [系统设计 (System Design)](docs/design/system-design.md)
- [仓库 Agent 交付规范](AGENTS.md)
