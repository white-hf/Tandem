# Tandem 测试策略

状态：`REVIEWED`。

## 测试层次

### Unit

覆盖依赖图、Ready 推导、唯一 claim、Artifact revision 不可变、context digest/stale、权限、幂等键和状态漂移判断。领域包不得依赖 HTTP、数据库或 GitHub SDK。

### Integration

使用真实 PostgreSQL 测试：

- 事务和并发；
- migration；
- webhook 去重；
- worker 重试；
- agent token scope；
- SSE 游标恢复；
- Artifact revision/baseline 的不可变绑定；
- 两个 Agent 并发 claim 同一 Issue 时仅一个成功。

### Regression

固化来自 EasyDelivery 和 AddressForge 的场景：

- 文档显示完成但 Git 尚未提交；
- 主计划仍 Proposed，但子 Run 已完成；
- Agent 完成自动验证但仍等待人工 Gold/发布审批；
- webhook 重放不得创建重复 Evidence；
- Agent 不得批准自己的权限或结果。

### End-to-End

首个发布 Gate 必须完成：

1. Human 在 Coding Agent CLI 中给出目标或现有文档；
2. Agent 通过 MCP 创建/读取 Artifact baseline 并规划 Cycle/Issue dependency；
3. 新 Agent 启动 Session、完成 onboarding 并 claim Ready Issue；
4. Agent 提交 checkpoint、Evidence 和 handoff；
5. 策略自动完成低风险工作或请求 Human 决策；
6. GitHub PR/Checks 绑定到同一 Issue/Session；
7. Human Web 可查看有效基线、依赖状态和完整追溯。

## 发布门槛

- 目标 unit/integration/regression 全部通过；
- 核心 E2E 通过；
- 无 P0/P1 已知缺陷；
- migration 在空库和升级库都可执行；
- 回滚步骤已验证；
- 文档和实际状态一致。
