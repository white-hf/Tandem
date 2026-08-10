import postgres, { type JSONValue, type Sql, type TransactionSql } from "postgres";
import type { GitArtifact, StateEvent } from "@tandem/contracts";

const asJson = (value: unknown): JSONValue => value as JSONValue;
const issuePattern = /tandem-issue:([A-Z][A-Z0-9]+-\d+)/gi;
const sessionPattern = /tandem-session:([0-9a-f-]{36})/i;

export interface WebhookIngestResult {
  duplicate: boolean;
  artifacts: GitArtifact[];
}

export interface EventStore {
  append(type: string, subjectIds: string[], payload?: Record<string, unknown>): Promise<StateEvent>;
  eventsAfter(afterId: number, limit?: number): Promise<StateEvent[]>;
  listGitArtifacts(issueKeys?: string[]): Promise<GitArtifact[]>;
  ingestGitHub(deliveryId: string, eventName: string, payloadDigest: string, payload: Record<string, unknown>, allowedIssueKeys?: string[]): Promise<WebhookIngestResult>;
  close?(): Promise<void>;
}

interface CandidateArtifact extends Omit<GitArtifact, "id" | "updatedAt"> {}

const markers = (text: string): { issueKeys: string[]; sessionId?: string } => {
  const issueKeys = [...text.matchAll(issuePattern)].map((match) => match[1]!.toUpperCase());
  const sessionId = text.match(sessionPattern)?.[1];
  return { issueKeys: [...new Set(issueKeys)], ...(sessionId ? { sessionId } : {}) };
};

const repositoryName = (payload: Record<string, unknown>): string => {
  const repository = payload.repository as { full_name?: string } | undefined;
  return repository?.full_name ?? "unknown/unknown";
};

const candidatesFromWebhook = (eventName: string, payload: Record<string, unknown>): CandidateArtifact[] => {
  const repository = repositoryName(payload);
  if (eventName === "pull_request") {
    const pull = payload.pull_request as { number?: number; title?: string; body?: string; html_url?: string; state?: string; merged?: boolean; updated_at?: string } | undefined;
    if (!pull?.number) return [];
    const found = markers(`${pull.title ?? ""}\n${pull.body ?? ""}`);
    return found.issueKeys.map((issueKey) => ({ repository, kind: "pull_request", externalId: String(pull.number), issueKey, ...(found.sessionId ? { sessionId: found.sessionId } : {}), title: pull.title ?? `Pull request #${pull.number}`, ...(pull.html_url ? { url: pull.html_url } : {}), state: pull.merged ? "merged" : (pull.state ?? "unknown") }));
  }
  if (eventName === "push") {
    const commits = (payload.commits ?? []) as Array<{ id?: string; message?: string; url?: string }>;
    return commits.flatMap((commit) => {
      if (!commit.id) return [];
      const found = markers(commit.message ?? "");
      return found.issueKeys.map((issueKey) => ({ repository, kind: "commit" as const, externalId: commit.id!, issueKey, ...(found.sessionId ? { sessionId: found.sessionId } : {}), title: (commit.message ?? commit.id!).split("\n")[0]!, ...(commit.url ? { url: commit.url } : {}), state: "recorded" }));
    });
  }
  if (eventName === "create" && payload.ref_type === "branch") {
    const ref = String(payload.ref ?? "");
    const found = markers(ref);
    return found.issueKeys.map((issueKey) => ({ repository, kind: "branch", externalId: ref, issueKey, ...(found.sessionId ? { sessionId: found.sessionId } : {}), title: ref, state: "active" }));
  }
  const check = payload.check_run as { id?: number; name?: string; html_url?: string; status?: string; conclusion?: string; output?: { title?: string; summary?: string } } | undefined;
  if (eventName === "check_run" && check?.id) {
    const found = markers(`${check.name ?? ""}\n${check.output?.title ?? ""}\n${check.output?.summary ?? ""}`);
    return found.issueKeys.map((issueKey) => ({ repository, kind: "check", externalId: String(check.id), issueKey, ...(found.sessionId ? { sessionId: found.sessionId } : {}), title: check.name ?? `Check ${check.id}`, ...(check.html_url ? { url: check.html_url } : {}), state: check.conclusion ?? check.status ?? "unknown" }));
  }
  return [];
};

const linkedCheckCandidate = (payload: Record<string, unknown>, issueKey: string, sessionId?: string): CandidateArtifact | undefined => {
  const check = payload.check_run as { id?: number; name?: string; html_url?: string; status?: string; conclusion?: string } | undefined;
  if (!check?.id) return undefined;
  return {
    repository: repositoryName(payload), kind: "check", externalId: String(check.id), issueKey, ...(sessionId ? { sessionId } : {}),
    title: check.name ?? `Check ${check.id}`, ...(check.html_url ? { url: check.html_url } : {}), state: check.conclusion ?? check.status ?? "unknown",
  };
};

export class MemoryEventStore implements EventStore {
  private sequence = 0;
  private readonly events: StateEvent[] = [];
  private readonly artifacts = new Map<string, GitArtifact>();
  private readonly deliveries = new Set<string>();

  async append(type: string, subjectIds: string[], payload: Record<string, unknown> = {}): Promise<StateEvent> {
    const event = { id: ++this.sequence, type, subjectIds, payload, createdAt: new Date().toISOString() };
    this.events.push(event);
    return structuredClone(event);
  }

  async eventsAfter(afterId: number, limit = 100): Promise<StateEvent[]> {
    return structuredClone(this.events.filter((event) => event.id > afterId).slice(0, limit));
  }

  async listGitArtifacts(issueKeys?: string[]): Promise<GitArtifact[]> {
    return structuredClone([...this.artifacts.values()].filter((artifact) => !issueKeys || issueKeys.includes(artifact.issueKey)));
  }

  async ingestGitHub(deliveryId: string, eventName: string, _payloadDigest: string, payload: Record<string, unknown>, allowedIssueKeys?: string[]): Promise<WebhookIngestResult> {
    if (this.deliveries.has(deliveryId)) return { duplicate: true, artifacts: [] };
    this.deliveries.add(deliveryId);
    const candidates = candidatesFromWebhook(eventName, payload);
    if (eventName === "check_run" && candidates.length === 0) {
      const pullNumbers = ((payload.check_run as { pull_requests?: Array<{ number?: number }> } | undefined)?.pull_requests ?? []).flatMap((pull) => pull.number ? [String(pull.number)] : []);
      for (const artifact of this.artifacts.values()) {
        if (artifact.kind === "pull_request" && pullNumbers.includes(artifact.externalId)) {
          const candidate = linkedCheckCandidate(payload, artifact.issueKey, artifact.sessionId);
          if (candidate) candidates.push(candidate);
        }
      }
    }
    const allowedCandidates = candidates.filter((candidate) => !allowedIssueKeys || allowedIssueKeys.includes(candidate.issueKey));
    const artifacts = allowedCandidates.map((candidate) => {
      const key = `${candidate.repository}:${candidate.kind}:${candidate.externalId}:${candidate.issueKey}`;
      const prior = this.artifacts.get(key);
      const artifact: GitArtifact = { ...candidate, id: prior?.id ?? `git-${this.artifacts.size + 1}`, updatedAt: new Date().toISOString() };
      this.artifacts.set(key, artifact);
      return artifact;
    });
    await this.append("git.updated", artifacts.map((artifact) => artifact.issueKey), { deliveryId, eventName });
    return { duplicate: false, artifacts: structuredClone(artifacts) };
  }
}

export class PostgresEventStore implements EventStore {
  private readonly sql: Sql;
  constructor(databaseUrl: string) { this.sql = postgres(databaseUrl, { max: 5, idle_timeout: 20, connect_timeout: 10 }); }

  async append(type: string, subjectIds: string[], payload: Record<string, unknown> = {}): Promise<StateEvent> {
    const [row] = await this.sql<{ id: string; created_at: string }[]>`
      INSERT INTO state_events (event_type, subject_ids, payload)
      VALUES (${type}, ${this.sql.json(asJson(subjectIds))}, ${this.sql.json(asJson(payload))})
      RETURNING id, created_at
    `;
    if (!row) throw new Error("Could not append Tandem state event");
    return { id: Number(row.id), type, subjectIds, payload, createdAt: row.created_at };
  }

  async eventsAfter(afterId: number, limit = 100): Promise<StateEvent[]> {
    const rows = await this.sql<Array<{ id: string; event_type: string; subject_ids: string[]; payload: Record<string, unknown>; created_at: string }>>`
      SELECT id, event_type, subject_ids, payload, created_at FROM state_events WHERE id > ${afterId} ORDER BY id ASC LIMIT ${limit}
    `;
    return rows.map((row) => ({ id: Number(row.id), type: row.event_type, subjectIds: row.subject_ids, payload: row.payload, createdAt: row.created_at }));
  }

  async listGitArtifacts(issueKeys?: string[]): Promise<GitArtifact[]> {
    const rows = issueKeys?.length
      ? await this.sql<Array<Record<string, unknown>>>`SELECT * FROM git_artifacts WHERE issue_key IN ${this.sql(issueKeys)} ORDER BY updated_at DESC`
      : await this.sql<Array<Record<string, unknown>>>`SELECT * FROM git_artifacts ORDER BY updated_at DESC`;
    return rows.map((row) => this.gitArtifact(row));
  }

  async ingestGitHub(deliveryId: string, eventName: string, payloadDigest: string, payload: Record<string, unknown>, allowedIssueKeys?: string[]): Promise<WebhookIngestResult> {
    return this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext('github-delivery'), hashtext(${deliveryId}))`;
      const [prior] = await tx<{ delivery_id: string }[]>`SELECT delivery_id FROM github_webhook_deliveries WHERE delivery_id = ${deliveryId}`;
      if (prior) return { duplicate: true, artifacts: [] };
      await tx`
        INSERT INTO github_webhook_deliveries (delivery_id, event_name, payload_digest, status)
        VALUES (${deliveryId}, ${eventName}, ${payloadDigest}, 'processing')
      `;
      const candidates = candidatesFromWebhook(eventName, payload);
      if (eventName === "check_run" && candidates.length === 0) {
        const pullNumbers = ((payload.check_run as { pull_requests?: Array<{ number?: number }> } | undefined)?.pull_requests ?? []).flatMap((pull) => pull.number ? [String(pull.number)] : []);
        if (pullNumbers.length) {
          const linked = await tx<Array<{ issue_key: string; session_id: string | null }>>`
            SELECT DISTINCT issue_key, session_id FROM git_artifacts
            WHERE repository = ${repositoryName(payload)} AND kind = 'pull_request' AND external_id IN ${tx(pullNumbers)}
          `;
          for (const row of linked) {
            const candidate = linkedCheckCandidate(payload, row.issue_key, row.session_id ?? undefined);
            if (candidate) candidates.push(candidate);
          }
        }
      }
      const allowedCandidates = candidates.filter((candidate) => !allowedIssueKeys || allowedIssueKeys.includes(candidate.issueKey));
      const artifacts: GitArtifact[] = [];
      for (const candidate of allowedCandidates) artifacts.push(await this.upsertArtifact(tx, candidate, payload));
      const [event] = await tx<{ id: string }[]>`
        INSERT INTO state_events (event_type, subject_ids, payload)
        VALUES ('git.updated', ${tx.json(asJson(artifacts.map((artifact) => artifact.issueKey)))}, ${tx.json(asJson({ deliveryId, eventName }))})
        RETURNING id
      `;
      await tx`UPDATE github_webhook_deliveries SET status = 'processed', processed_at = now() WHERE delivery_id = ${deliveryId}`;
      if (!event) throw new Error("Could not append GitHub projection event");
      return { duplicate: false, artifacts };
    });
  }

  async close(): Promise<void> { await this.sql.end({ timeout: 5 }); }

  private async upsertArtifact(tx: TransactionSql, candidate: CandidateArtifact, payload: Record<string, unknown>): Promise<GitArtifact> {
    const [row] = await tx<Array<Record<string, unknown>>>`
      INSERT INTO git_artifacts (repository, kind, external_id, issue_key, session_id, title, url, state, payload)
      VALUES (${candidate.repository}, ${candidate.kind}, ${candidate.externalId}, ${candidate.issueKey}, ${candidate.sessionId ?? null}, ${candidate.title}, ${candidate.url ?? null}, ${candidate.state}, ${tx.json(asJson(payload))})
      ON CONFLICT (repository, kind, external_id, issue_key) DO UPDATE SET
        session_id = excluded.session_id, title = excluded.title, url = excluded.url, state = excluded.state, payload = excluded.payload, updated_at = now()
      RETURNING *
    `;
    if (!row) throw new Error("Could not project GitHub artifact");
    return this.gitArtifact(row);
  }

  private gitArtifact(row: Record<string, unknown>): GitArtifact {
    return {
      id: String(row.id), repository: String(row.repository), kind: row.kind as GitArtifact["kind"], externalId: String(row.external_id),
      issueKey: String(row.issue_key), ...(row.session_id ? { sessionId: String(row.session_id) } : {}), title: String(row.title),
      ...(row.url ? { url: String(row.url) } : {}), state: String(row.state), updatedAt: String(row.updated_at),
    };
  }
}
