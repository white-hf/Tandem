import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres, { type JSONValue, type Sql, type TransactionSql } from "postgres";
import type { TandemState } from "@tandem/domain";
import { IdempotencyConflictError, StateRevisionConflictError, type IdempotencyRecord, type IdempotentSaveResult, type LoadedState, type TransactionalStateRepository } from "./index.js";

const DEFAULT_WORKSPACE_ID = "default";
const jsonValue = (value: unknown): JSONValue => value as JSONValue;

interface StateRow {
  revision: string;
  state_json: TandemState;
}

export interface ProjectionCounts {
  projects: number;
  repositories: number;
  cycles: number;
  issues: number;
  dependencies: number;
  artifacts: number;
  revisions: number;
  sessions: number;
  claims: number;
  evidence: number;
  decisions: number;
  activities: number;
}

export class PostgresStateRepository implements TransactionalStateRepository {
  readonly storageKind = "postgres";
  private readonly sql: Sql;
  private migrationPromise?: Promise<void>;

  constructor(
    databaseUrl: string,
    private readonly workspaceId = DEFAULT_WORKSPACE_ID,
  ) {
    this.sql = postgres(databaseUrl, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  }

  async migrate(): Promise<void> {
    this.migrationPromise ??= this.applyMigrations();
    await this.migrationPromise;
  }

  async load(): Promise<LoadedState | undefined> {
    await this.migrate();
    const [row] = await this.sql<StateRow[]>`
      SELECT revision, state_json
      FROM tandem_states
      WHERE workspace_id = ${this.workspaceId}
    `;
    if (!row) return undefined;
    return { state: row.state_json, revision: Number(row.revision) };
  }

  async save(state: TandemState, expectedRevision: number): Promise<number> {
    await this.migrate();
    return this.sql.begin((tx) => this.commitState(tx, state, expectedRevision));
  }

  async findIdempotency(principalId: string, key: string): Promise<IdempotencyRecord | undefined> {
    await this.migrate();
    const [prior] = await this.sql<{
      request_hash: string;
      response_json: unknown;
      status_code: number;
      created_at: Date | string;
    }[]>`
      SELECT request_hash, response_json, status_code, created_at
      FROM idempotency_keys
      WHERE principal_id = ${principalId} AND key = ${key}
    `;
    if (!prior) return undefined;
    return {
      principalId,
      key,
      requestHash: prior.request_hash,
      response: prior.response_json,
      statusCode: prior.status_code,
      createdAt: prior.created_at instanceof Date ? prior.created_at.toISOString() : String(prior.created_at),
    };
  }

  async saveIdempotently(state: TandemState, expectedRevision: number, record: IdempotencyRecord): Promise<IdempotentSaveResult> {
    await this.migrate();
    return this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${record.principalId}), hashtext(${record.key}))`;
      const [prior] = await tx<{ request_hash: string; response_json: unknown }[]>`
        SELECT request_hash, response_json
        FROM idempotency_keys
        WHERE principal_id = ${record.principalId} AND key = ${record.key}
        FOR UPDATE
      `;
      if (prior) {
        if (prior.request_hash !== record.requestHash) throw new IdempotencyConflictError(record.principalId, record.key);
        const [current] = await tx<{ revision: string }[]>`SELECT revision FROM tandem_states WHERE workspace_id = ${this.workspaceId}`;
        return { revision: current ? Number(current.revision) : expectedRevision, replayed: true, response: prior.response_json };
      }

      const revision = await this.commitState(tx, state, expectedRevision);
      await tx`
        INSERT INTO idempotency_keys (principal_id, key, request_hash, status_code, response_json, created_at)
        VALUES (${record.principalId}, ${record.key}, ${record.requestHash}, ${record.statusCode}, ${tx.json(jsonValue(record.response))}, ${record.createdAt})
      `;
      return { revision, replayed: false, response: record.response };
    });
  }

  async projectionCounts(): Promise<ProjectionCounts> {
    await this.migrate();
    const [row] = await this.sql<Array<Record<keyof ProjectionCounts, string>>>`
      SELECT
        (SELECT count(*) FROM projects) AS projects,
        (SELECT count(*) FROM project_repository_bindings) AS repositories,
        (SELECT count(*) FROM cycles) AS cycles,
        (SELECT count(*) FROM issues) AS issues,
        (SELECT count(*) FROM issue_dependencies) AS dependencies,
        (SELECT count(*) FROM artifacts) AS artifacts,
        (SELECT count(*) FROM artifact_revisions) AS revisions,
        (SELECT count(*) FROM agent_sessions) AS sessions,
        (SELECT count(*) FROM issue_claims) AS claims,
        (SELECT count(*) FROM evidence) AS evidence,
        (SELECT count(*) FROM decision_requests) AS decisions,
        (SELECT count(*) FROM activities) AS activities
    `;
    if (!row) throw new Error("PostgreSQL projection count query returned no row");
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])) as unknown as ProjectionCounts;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }

  private async applyMigrations(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS tandem_schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));
    const names = readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql")).sort();
    for (const name of names) {
      const migration = readFileSync(fileURLToPath(new URL(`../migrations/${name}`, import.meta.url)), "utf8");
      await this.sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtext('tandem-schema-migrations'))`;
        const [applied] = await tx<{ name: string }[]>`SELECT name FROM tandem_schema_migrations WHERE name = ${name}`;
        if (applied) return;
        await tx.unsafe(migration);
        await tx`INSERT INTO tandem_schema_migrations (name) VALUES (${name})`;
      });
    }
  }

  private async commitState(tx: TransactionSql, state: TandemState, expectedRevision: number): Promise<number> {
    const [locked] = await tx<{ revision: string }[]>`
      SELECT revision
      FROM tandem_states
      WHERE workspace_id = ${this.workspaceId}
      FOR UPDATE
    `;
    const actualRevision = locked ? Number(locked.revision) : 0;
    if (actualRevision !== expectedRevision) throw new StateRevisionConflictError(expectedRevision, actualRevision);

    const nextRevision = actualRevision + 1;
    if (locked) {
      await tx`
        UPDATE tandem_states
        SET revision = ${nextRevision}, state_json = ${tx.json(jsonValue(state))}, updated_at = now()
        WHERE workspace_id = ${this.workspaceId}
      `;
    } else {
      await tx`
        INSERT INTO tandem_states (workspace_id, revision, state_json)
        VALUES (${this.workspaceId}, ${nextRevision}, ${tx.json(jsonValue(state))})
      `;
    }
    await this.replaceProjection(tx, state);
    return nextRevision;
  }

  private async replaceProjection(tx: TransactionSql, state: TandemState): Promise<void> {
    await tx`TRUNCATE issue_claims, issue_dependencies, artifact_revisions, checkpoints, evidence, handoffs, agent_sessions, decision_requests, activities, issues, artifacts, cycles, milestones, project_repository_bindings, projects`;

    for (const project of state.projects) {
      await tx`
        INSERT INTO projects (id, workspace_id, key, name, target_date, payload)
        VALUES (${project.id}, ${this.workspaceId}, ${project.key}, ${project.name}, ${project.targetDate}, ${tx.json(jsonValue(project))})
      `;
      for (const repository of project.repositories?.length ? project.repositories : [project.repository]) {
        await tx`
          INSERT INTO project_repository_bindings (project_id, provider, host, repository_owner, repository_name, default_branch, remote_url, payload)
          VALUES (${project.id}, ${repository.provider}, ${repository.host.toLowerCase()}, ${repository.owner.toLowerCase()}, ${repository.name.toLowerCase().replace(/\.git$/, "")}, ${repository.defaultBranch}, ${repository.remoteUrl ?? null}, ${tx.json(jsonValue(repository))})
        `;
      }
    }
    for (const milestone of state.milestones) {
      await tx`
        INSERT INTO milestones (id, project_id, state, payload)
        VALUES (${milestone.id}, ${milestone.projectId}, ${milestone.state}, ${tx.json(jsonValue(milestone))})
      `;
    }
    for (const cycle of state.cycles) {
      await tx`
        INSERT INTO cycles (id, project_id, number, state, plan_revision, payload)
        VALUES (${cycle.id}, ${cycle.projectId}, ${cycle.number}, ${cycle.state}, ${cycle.planRevision}, ${tx.json(jsonValue(cycle))})
      `;
    }
    for (const issue of state.issues) {
      await tx`
        INSERT INTO issues (id, project_id, key, parent_id, cycle_id, issue_type, delivery_path, intake_source, risk_class, state, version, payload)
        VALUES (${issue.id}, ${issue.projectId}, ${issue.key}, ${issue.parentId ?? null}, ${issue.cycleId ?? null}, ${issue.type}, ${issue.deliveryPath}, ${issue.intake.source}, ${issue.risk.class}, ${issue.displayState}, ${issue.version}, ${tx.json(jsonValue(issue))})
      `;
    }
    for (const blocked of state.issues) {
      for (const blockerId of blocked.blockedBy) {
        await tx`INSERT INTO issue_dependencies (blocker_id, blocked_id) VALUES (${blockerId}, ${blocked.id})`;
      }
    }
    for (const artifact of state.artifacts) {
      await tx`
        INSERT INTO artifacts (id, project_id, type, effective_revision_id, payload)
        VALUES (${artifact.id}, ${artifact.projectId}, ${artifact.type}, ${artifact.effectiveRevisionId ?? null}, ${tx.json(jsonValue(artifact))})
      `;
    }
    for (const revision of state.revisions) {
      await tx`
        INSERT INTO artifact_revisions (id, artifact_id, revision, state, digest, payload)
        VALUES (${revision.id}, ${revision.artifactId}, ${revision.revision}, ${revision.state}, ${revision.digest}, ${tx.json(jsonValue(revision))})
      `;
    }
    for (const session of state.sessions) {
      await tx`
        INSERT INTO agent_sessions (id, project_id, issue_id, agent_id, state, context_digest, payload)
        VALUES (${session.id}, ${session.projectId}, ${session.issueId ?? null}, ${session.agentId}, ${session.state}, ${session.contextDigest}, ${tx.json(jsonValue(session))})
      `;
    }
    for (const issue of state.issues) {
      if (!issue.activeClaim) continue;
      await tx`
        INSERT INTO issue_claims (issue_id, session_id, agent_id, claimed_at, payload)
        VALUES (${issue.id}, ${issue.activeClaim.sessionId}, ${issue.activeClaim.agentId}, ${issue.activeClaim.claimedAt}, ${tx.json(jsonValue(issue.activeClaim))})
      `;
    }
    for (const checkpoint of state.checkpoints) {
      await tx`INSERT INTO checkpoints (id, issue_id, session_id, payload) VALUES (${checkpoint.id}, ${checkpoint.issueId}, ${checkpoint.sessionId}, ${tx.json(jsonValue(checkpoint))})`;
    }
    for (const item of state.evidence) {
      await tx`INSERT INTO evidence (id, issue_id, session_id, result, payload) VALUES (${item.id}, ${item.issueId}, ${item.sessionId}, ${item.result}, ${tx.json(jsonValue(item))})`;
    }
    for (const handoff of state.handoffs) {
      await tx`INSERT INTO handoffs (id, issue_id, session_id, payload) VALUES (${handoff.id}, ${handoff.issueId}, ${handoff.sessionId}, ${tx.json(jsonValue(handoff))})`;
    }
    for (const decision of state.decisionRequests) {
      await tx`
        INSERT INTO decision_requests (id, project_id, session_id, status, risk, payload)
        VALUES (${decision.id}, ${decision.projectId}, ${decision.sessionId ?? null}, ${decision.status}, ${decision.risk}, ${tx.json(jsonValue(decision))})
      `;
    }
    for (const activity of state.activities) {
      await tx`
        INSERT INTO activities (id, actor_type, actor_id, action, subject_type, subject_id, occurred_at, payload)
        VALUES (${activity.id}, ${activity.actorType}, ${activity.actorId}, ${activity.action}, ${activity.subjectType}, ${activity.subjectId}, ${activity.occurredAt}, ${tx.json(jsonValue(activity))})
      `;
    }
  }
}
