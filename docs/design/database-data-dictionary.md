# Tandem 数据库设计与数据字典 (Database Data Dictionary)

## 文档信息 (Document Metadata)

- 状态: `REVIEWED`
- 所属系统: `Tandem Engine`
- 数据库类型: PostgreSQL 17+
- 驱动/持久化层: `@tandem/db` (Postgres Repository + SQL Migrations)
- 关联文档: [系统设计说明书](system-design.md), [物理部署架构设计](physical-deployment-architecture.md)

---

## 1. 自动化初始化与迁移机制 (Auto-Initialization & Migrations)

Tandem 具备**开箱即用（Zero-Config）自动建表与增量迁移能力**：

- **自动建表 (Auto-Bootstrap)**：当 API 容器首次启动连接到空数据库时，`PostgresRepository.applyMigrations()` 会自动按顺序执行 `packages/db/migrations/*.sql` 迁移脚本，完成表结构、主外键、索引与初始状态的创建。
- **并发锁与幂等性保障 (Advisory Lock)**：迁移过程使用 PostgreSQL 事务级建议锁 `pg_advisory_xact_lock` 与 `tandem_schema_migrations` 版本表，支持多实例并发启动不冲突。
- **增量演进**：后续新增功能只需在 `migrations/` 增加递增编号的 `.sql` 文件，部署重启时自动执行未应用的部分。

---

## 2. 混合持久化架构 (Hybrid Storage Architecture)

Tandem 采用 **“原子状态快照 (State Snapshots) + 规范化投影表 (Relational Projections) + Append-Only 审计流水 (Event Log)”** 的混合架构：

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                tandem_states (核心快照树)                   │
 │  • workspace_id (PK)                                        │
 │  • revision (乐观并发版本锁)                                  │
 │  • state_json (全量内存级 DDD 聚合根 JSON)                  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ 原子提交时自动投影同步 (Projection Replace)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                规范化关系表 (Relational Projection)          │
 │  • projects, cycles, issues, issue_claims, checkpoints...  │
 │  • 用于支持复杂 SQL 查询、统计分析与外部系统只读集成          │
 └─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心表结构与数据字典 (Tables & Data Dictionary)

### 3.1 核心状态与迁移表

#### 1. `tandem_schema_migrations` (版本迁移记录表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `name` | `text` | `PRIMARY KEY` | 迁移脚本文件名（如 `0001_shared_pilot.sql`） |
| `applied_at` | `timestamptz` | `NOT NULL, DEFAULT now()` | 应用时间 |

#### 2. `tandem_states` (全局工作区状态快照表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `workspace_id` | `text` | `PRIMARY KEY` | 工作区标识（默认 `default`） |
| `revision` | `bigint` | `NOT NULL, DEFAULT 0` | 状态变更版本号（乐观锁） |
| `state_json` | `jsonb` | `NOT NULL` | 聚合根完整 JSON 快照 |
| `created_at` | `timestamptz` | `NOT NULL, DEFAULT now()` | 创建时间 |
| `updated_at` | `timestamptz` | `NOT NULL, DEFAULT now()` | 最后更新时间 |

---

### 3.2 敏捷交付与项目域 (Agile Delivery & Projects)

#### 3. `projects` (项目主表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 项目全局唯一 UUID |
| `workspace_id` | `text` | `NOT NULL` | 所属工作区 |
| `key` | `text` | `NOT NULL, UNIQUE` | 项目大写业务代号（如 `TAN`, `EASYDEL`） |
| `name` | `text` | `NOT NULL` | 项目名称 |
| `target_date` | `text` | `NULLABLE` | 目标交付截止日期 |
| `payload` | `jsonb` | `NOT NULL` | 项目完整配置元数据 |

#### 4. `cycles` (敏捷迭代/Sprint 表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 迭代全局唯一 UUID |
| `project_id` | `text` | `FK -> projects(id)` | 关联项目 ID |
| `number` | `integer` | `NOT NULL` | 迭代序号（从 0 开始） |
| `state` | `text` | `NOT NULL` | 状态：`draft`, `proposed`, `active`, `completed`, `cancelled` |
| `plan_revision` | `integer` | `NOT NULL` | 关联迭代规划文档的版本号 |
| `payload` | `jsonb` | `NOT NULL` | 包含目标（Goal）、DoD 验收标准、起止日期等 |

#### 5. `issues` (任务/工作项表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 工作项全局唯一 UUID |
| `project_id` | `text` | `FK -> projects(id)` | 关联项目 ID |
| `key` | `text` | `NOT NULL, UNIQUE` | 业务编号（如 `TAN-34`, `EASYDEL-5`） |
| `parent_id` | `text` | `NULLABLE` | 父级 Issue ID（支持 Epic/Subtask 拆解） |
| `cycle_id` | `text` | `NULLABLE` | 所属迭代 ID |
| `state` | `text` | `NOT NULL` | 状态：`backlog`, `ready`, `in_progress`, `review`, `done`, `cancelled` |
| `version` | `integer` | `NOT NULL, CHECK (version >= 1)` | 变更版本号 |
| `issue_type` | `text` | `NOT NULL` | 类型：`feature`, `bug`, `improvement`, `chore` |
| `delivery_path` | `text` | `NOT NULL` | 交付路径：`quick` (轻量快道) 或 `planned` (规划主道) |
| `intake_source` | `text` | `NOT NULL` | 来源：`agent_conversation`, `human_web`, `github_issue` 等 |
| `risk_class` | `text` | `NOT NULL` | 风险等级：`low`, `medium`, `high`, `critical` |
| `payload` | `jsonb` | `NOT NULL` | 包含原始陈述、验收条件、受影响模块等 |

#### 6. `issue_claims` (Agent 任务独占认领表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `issue_id` | `text` | `PRIMARY KEY, FK -> issues(id)` | 认领的工作项 ID |
| `session_id` | `text` | `NOT NULL` | 认领该任务的 Agent Session ID |
| `agent_id` | `text` | `NOT NULL` | 认领的 Agent 标识（如 `pilot-agent`） |
| `claimed_at` | `timestamptz` | `NOT NULL` | 认领时间戳 |
| `payload` | `jsonb` | `NOT NULL` | 认领扩展信息 |

---

### 3.3 文档基线与规约域 (Artifacts & Baselines)

#### 7. `artifacts` (基线文档主表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 文档唯一 UUID |
| `project_id` | `text` | `FK -> projects(id)` | 所属项目 ID |
| `type` | `text` | `NOT NULL` | 类型：`prd`, `system_design`, `iteration_plan`, `test_plan`, `summary` |
| `effective_revision_id` | `text` | `NULLABLE` | 当前生效基线的版本 ID |
| `payload` | `jsonb` | `NOT NULL` | 文档元数据 |

#### 8. `artifact_revisions` (文档版本变更表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 版本唯一 UUID |
| `artifact_id` | `text` | `FK -> artifacts(id)` | 关联文档 ID |
| `revision` | `integer` | `NOT NULL` | 递增版本序号（如 `1, 2, 3`） |
| `state` | `text` | `NOT NULL` | 状态：`draft`, `proposed`, `approved`, `superseded` |
| `digest` | `text` | `NOT NULL` | 内容 SHA-256 哈希指纹（防篡改校验） |
| `payload` | `jsonb` | `NOT NULL` | 包含 Markdown 正文、作者与签署元数据 |

---

### 3.4 交付凭据与会话域 (Evidence & Sessions)

#### 9. `agent_sessions` (Agent 执行会话表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 会话唯一 UUID |
| `project_id` | `text` | `FK -> projects(id)` | 关联项目 ID |
| `issue_id` | `text` | `NULLABLE, FK -> issues(id)` | 关联处理的 Issue ID |
| `agent_id` | `text` | `NOT NULL` | 接入的 Agent 标识 |
| `state` | `text` | `NOT NULL` | 会话状态：`onboarding`, `in_progress`, `completed`, `stale` |
| `context_digest` | `text` | `NOT NULL` | 入职时锁定的基线上下文 SHA-256 指纹 |
| `payload` | `jsonb` | `NOT NULL` | 会话上下文清单及交付总结 |

#### 10. `evidence` (可执行交付凭证表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 凭证唯一 UUID |
| `issue_id` | `text` | `FK -> issues(id)` | 挂载的工作项 ID |
| `session_id` | `text` | `NOT NULL` | 产出该凭证的 Session ID |
| `result` | `text` | `NOT NULL` | 验证结论：`passed`, `failed`, `inconclusive` |
| `payload` | `jsonb` | `NOT NULL` | 测试输出、构建日志、APK 哈希等机器证据 |

#### 11. `handoffs` (交付移交总结表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 移交记录 UUID |
| `issue_id` | `text` | `FK -> issues(id)` | 关联工作项 ID |
| `session_id` | `text` | `NOT NULL` | 提交该移交的 Session ID |
| `payload` | `jsonb` | `NOT NULL` | 包含代码变更清单、验证总结、后续建议等 |

---

### 3.5 决策与安全域 (Decisions, Auth & Audit)

#### 12. `decision_requests` (人类审查与注意力表)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 决策单 UUID |
| `project_id` | `text` | `FK -> projects(id)` | 关联项目 ID |
| `session_id` | `text` | `NULLABLE` | 发起请求的 Session ID |
| `status` | `text` | `NOT NULL` | 决策状态：`pending`, `approved`, `changes_requested` |
| `risk` | `text` | `NOT NULL` | 风险等级 |
| `payload` | `jsonb` | `NOT NULL` | 决策理由、签署者信息、被驳回修改意见等 |

#### 13. `principals` 与 `credentials` (主体身份与凭证表)
| 表名 | 关键字段 | 说明 |
| :--- | :--- | :--- |
| `principals` | `id, type (human/agent), name, status` | 记录人类管理员与 Agent 身份主体 |
| `credentials` | `id, principal_id, type (token/password_hash), secret_hash` | 存储加密后的密码哈希与 Bearer Token |

#### 14. `activities` (不可篡改审计流水表 - Append Only)
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `text` | `PRIMARY KEY` | 审计日志 UUID |
| `actor_type` | `text` | `NOT NULL` | 操作者类型：`human`, `agent`, `system` |
| `actor_id` | `text` | `NOT NULL` | 操作者唯一标识 |
| `action` | `text` | `NOT NULL` | 动作名称（如 `issue.claim`, `cycle.activate`） |
| `subject_type`| `text` | `NOT NULL` | 操作对象类型（`issue`, `artifact`, `decision`） |
| `subject_id`  | `text` | `NOT NULL` | 操作对象 ID |
| `occurred_at` | `timestamptz` | `NOT NULL, DEFAULT now()` | 发生时间戳 |
| `payload`     | `jsonb` | `NOT NULL` | 完整的现场快照与 Diff |
