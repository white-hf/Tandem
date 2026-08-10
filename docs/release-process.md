# Tandem 发布流程

状态：`PROPOSED`。

## 发布阶段

```text
Local Development
→ Internal Demo
→ 3–5 Person Pilot
→ MVP Stable
```

## Pilot 进入条件

- 完整 E2E 闭环通过；
- 备份与恢复验证通过；
- GitHub webhook 可重放且幂等；
- Agent token 可撤销；
- 审批操作具有人类身份和审计记录；
- 已有一套真实项目导入或人工建立的试点数据。

## 回滚

- 应用镜像保留上一稳定版本；
- 数据库使用 expand/migrate/contract，MVP 阶段不做自动破坏性 contract；
- 发布失败优先回滚应用，不回滚已经成功提交的不可逆迁移；
- GitHub webhook 暂停时保留 delivery ID，恢复后可重放。

## 发布决定

发布总结必须记录版本、migration、验证结果、已知风险、回滚方式和批准人。Agent 可以准备报告，不能代替人类批准 Pilot 或 Stable 发布。
