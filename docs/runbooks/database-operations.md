# Tandem 数据库运维与查询指南 (Database Operations & Query Guide)

## 文档信息

- 状态: `REVIEWED`
- 所属系统: `Tandem Pilot / Production`
- 关联文档: [数据库设计与数据字典](../design/database-data-dictionary.md), [运维手册](pilot-operations.md)

---

## 1. 快速连接进入数据库 (Fast Connection)

因为 Tandem 遵循最小暴露原则，PostgreSQL（5432端口）不对宿主机公网开放，运维人员可通过 Docker 命令行一键接入：

```bash
# 1. 直接进入交互式 psql 控制台
docker exec -it tandem-pilot-postgres-1 psql -U tandem -d tandem

# 2. 或者在宿主机执行单条查询命令
docker exec -i tandem-pilot-postgres-1 psql -U tandem -d tandem -c "SELECT key, name, health FROM projects;"
```

---

## 2. 常用基础运维命令 (Basic Commands)

在 `psql` 交互式控制台中常用命令：

```sql
\dt             -- 查看当前所有数据表清单
\d+ issues      -- 查看 issues 表的详细字段、主外键约束与索引
\d+ evidence    -- 查看 evidence 凭证表的详细结构
\q              -- 退出 psql 控制台
```

---

## 3. 核心业务数据实用查询模版 (Useful Query Templates)

### 3.1 查看所有项目及其关联的 Git 仓库
```sql
SELECT 
    p.key AS project_key, 
    p.name AS project_name, 
    p.payload->>'health' AS health,
    b.repository_owner || '/' || b.repository_name AS github_repo,
    b.default_branch
FROM projects p
LEFT JOIN project_repository_bindings b ON p.id = b.project_id;
```

### 3.2 查看各个敏捷迭代 (Cycles / Sprints) 状态与时间
```sql
SELECT 
    c.id,
    p.key AS project,
    c.number AS cycle_num,
    c.payload->>'name' AS cycle_name,
    c.state,
    c.payload->>'startsOn' AS starts_on,
    c.payload->>'endsOn' AS ends_on
FROM cycles c
JOIN projects p ON c.project_id = p.id
ORDER BY p.key, c.number;
```

### 3.3 查看所有工作项 (Issues) 及其当前状态与认领 Agent
```sql
SELECT 
    i.key AS issue_key,
    i.issue_type,
    i.state AS status,
    i.delivery_path,
    i.payload->>'title' AS title,
    ic.agent_id AS claimed_by,
    ic.claimed_at
FROM issues i
LEFT JOIN issue_claims ic ON i.id = ic.issue_id
ORDER BY i.key;
```

### 3.4 查看当前正在运行的 Agent Sessions 会话
```sql
SELECT 
    s.id AS session_id,
    p.key AS project,
    i.key AS issue_key,
    s.agent_id,
    s.state AS session_state,
    s.payload->>'startedAt' AS started_at
FROM agent_sessions s
JOIN projects p ON s.project_id = p.id
LEFT JOIN issues i ON s.issue_id = i.id
ORDER BY s.payload->>'startedAt' DESC;
```

### 3.5 查看待审批的人类决策请求 (Attention Items)
```sql
SELECT 
    d.id AS decision_id,
    p.key AS project,
    d.risk,
    d.status,
    d.payload->>'title' AS decision_title,
    d.payload->>'summary' AS summary
FROM decision_requests d
JOIN projects p ON d.project_id = p.id
WHERE d.status = 'pending';
```

### 3.6 查看最近的不可篡改审计日志 (Audit Activity Log)
```sql
SELECT 
    occurred_at,
    actor_type,
    actor_id,
    action,
    subject_type,
    subject_id
FROM activities
ORDER BY occurred_at DESC
LIMIT 20;
```

---

## 4. 图形化工具连接方法 (GUI Client Access: DBeaver, DataGrip, Navicat)

如果运维人员需要使用 GUI 图形化工具（如 DBeaver / Navicat / pgAdmin）连接数据库：

### 方案 A：SSH 隧道 / 本地临时端口映射 (推荐)
通过 Docker 命令临时将容器端口端口映射到本地：
```bash
# 本地端口转发至 PostgreSQL 容器
docker run -d --name pg-proxy --network tandem-pilot_default -p 15432:5432 alpine/socat tcp-listen:15432,fork,reuseaddr tcp-connect:postgres:5432
```
然后在 DBeaver / DataGrip 中输入：
* **Host**: `127.0.0.1`
* **Port**: `15432`
* **Database**: `tandem`
* **Username**: `tandem`
* **Password**: `tandem_pilot_password` (或 `.env.pilot` 中配置的值)
