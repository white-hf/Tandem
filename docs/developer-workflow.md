# Tandem 开发工作流

状态：`REVIEWED`。

## 交付顺序

```text
问题与目标
→ PRD
→ 系统设计
→ REVIEWED 迭代计划
→ 最小纵向实现
→ 自动与真实场景验证
→ 执行总结
→ 发布或回滚决定
```

## 每个迭代必须包含

- 要解决的用户或系统问题；
- 范围与非范围；
- 技术方法；
- 数据/API/UI 变化；
- 完成标准；
- 验证证据；
- 残余风险和下一步。

## 分支与提交

- 使用短生命周期分支；
- 一次提交尽量对应一个可验证切片；
- 数据库迁移只前向新增，不修改已经发布的迁移；
- 不把无关工作区变化混入提交；
- PR 必须链接 Tandem Issue、Agent Session 和有效 Artifact revision。

## 完成语义

- `claimed`：当前 Session 已在最新上下文上获得唯一执行权；
- `implemented`：实现存在并已记录 checkpoint；
- `review`：Agent 已提交 Evidence 和 handoff；
- `verified`：自动或真实证据通过；
- `done`：策略允许完成或要求的 Human decision 已完成；
- `merged`：Git 交付已合并；
- `released`：已进入目标环境。

这些状态不能被一个 `Done` 替代。

## Agent 开工规则

1. 通过 MCP `start_session` 解析 Project/Issue；
2. 读取 onboarding manifest 中的必读 Artifact、仓库文档、代码锚点和验证命令；
3. 用 `confirm_understanding` 提交已读内容、理解、计划修改和问题；
4. 仅当 Issue 为 Ready 且 Session context 未 stale 时执行 `claim_issue`；
5. 在语义边界记录 checkpoint，不上传原始聊天或私有推理；
6. 以 Evidence 和 handoff 结束本次工作。
