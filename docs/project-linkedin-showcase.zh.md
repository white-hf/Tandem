# Tandem — 项目亮点与技术叙事 (中文版)

## 项目名称
**Tandem: 面向人机协作（Human-Agent）团队的轻量敏捷协同与交付层**

## 开源仓库
- GitHub: `https://github.com/white-hf/Tandem`
- 状态: 开源 / 持续维护

---

## 1. 项目背景与解决的痛点

在主导物流配送与供应链核心系统研发过程中（涵盖运营管理、仓储协同与司机调度），**超过 90% 的业务代码均由 AI Coding Agent（如 Claude, Cursor, Codex）自主生成**。然而，随着代码生成速度的成倍提升，软件工程遇到了新的瓶颈：**代码生成速度远超人类的工程治理能力**。

传统的“聊天式编码 (Vibing Code)”在面对真实工业级业务时暴露了三大核心失效场景：
1. **零散聊天驱动的失控 (Fragmented Chat-Driven Chaos)**：运营、仓库、司机等不同角色的业务诉求分散在各大即时通讯软件中，导致需求随意变更、规格失真，且缺乏敏捷 Sprint 迭代规划。
2. **Agent 研发的“黑盒问题” (The "Black-Box" Agent Problem)**：Agent 在孤岛中写代码、重构和跑测试。技术负责人无法实时掌握 Agent 到底改了哪些文件、单元测试是否真实通过、架构设计是否走偏，直到线上出现问题才被动排查。
3. **缺乏工业级工程纪律 (Lack of Industrial-Grade Rigor)**：散漫的 LLM 聊天对话缺少软件工程的核心基准——不可篡改的 PRD 需求基线、结构化迭代周期、可复现的验证链条以及全流程审计记录。

为了解决这一矛盾，我设计并开源了 **Tandem**——一个专为 **1–10 人小团队（人类工程师 + AI Agent）** 打造的轻量敏捷协同与交付中枢，将不可控的黑盒聊天式编码升维为标准化、白盒化、质量可靠的工业级软件工程闭环。

---

## 2. 核心架构与功能矩阵

### 1. 多角色需求轻量捕捉与规格基线 (Multi-Stakeholder Intake & Spec Baselining)
- **痛点**：聊天中的碎片化需求导致上下文丢失与架构漂移。
- **方案**：构建 Quick Capture 快速捕获界面，将运营/仓储/司机非技术诉求结构化为带有明确验收条件的 Issue。将 PRD 与架构设计绑定为 **SHA-256 加密哈希基线**，Agent 编写代码前必须通过 MCP 校验当前基线。

### 2. 轻量敏捷 Sprint 与端到端生命周期管理 (Agile Sprint & Lifecycle Orchestration)
- **痛点**：AI 生成代码随意无序，缺少迭代节奏与交付边界。
- **方案**：在 React 19 / Fastify 中实现高密度 5 列看板（`Backlog` ➔ `Ready` ➔ `In Progress` ➔ `In Review` ➔ `Done`）与 Scrum Cycle 规划器。支持 Sprint 动态调度、Definition of Done (DoD) 验收跟踪与状态机，将随意的聊天编码固化为敏捷迭代。

### 3. 白盒化 Agent 执行与可复现机器凭证链 (White-Box Execution & Evidence Chain)
- **痛点**：Agent 开发与测试过程完全黑盒，人工无法验证测试真实性。
- **方案**：通过自定义 **MCP Streamable HTTP** 协议制定机器可验证交付流程。Agent 必须记录语义检查点 (`record_checkpoint`)、挂载可复现的测试/构建证据 (`attach_evidence`，如单元测试日志、APK 哈希) 并提交结构化交接单 (`submit_handoff`)，让 Agent 开发过程 100% 透明可审计。

### 4. 人类极简治理与注意力工作台 (Human Attention & Decision Inbox)
- **痛点**：人类精力有限，面对海量 Agent 输出产生审核疲劳。
- **方案**：开发专门的 **Attention Inbox** 过滤日常无害的 Agent 噪音，只将高风险架构变更（如需求基线修改、Sprint 激活、最终交付验收）提升给人类一键决策。

### 5. 极简单机生产级容器架构 (Zero-Ops Production Architecture)
- **痛点**：小团队基础设施运维成本高昂。
- **方案**：采用单机 Docker Compose 容器化编排（Fastify API, Nginx SPA, 隔离的 PostgreSQL 17），提供只读安全文件系统、数据库自动迁移和一键式运维脚本，开箱即用。

---

## 3. 技术栈与核心协议

- **Agent 通信协议**: Model Context Protocol (MCP v1.x, Streamable HTTP)
- **后端与领域引擎**: Node.js 22 LTS, Fastify, TypeScript (Strict Mode), Zod, 领域驱动设计 (DDD)
- **前端工作台**: React 19, Vite, TanStack Query, 自定义高密度 CSS
- **持久化与审计**: PostgreSQL 17, 混合存储模型 (JSONB 快照树 + 规范化投影表), Append-Only 审计流水
- **容器与运维**: Docker Compose, Nginx 多阶段构建, Shell 自动化运维
- **自动化测试**: Vitest, Testcontainers, E2E 端到端集成测试套件
