import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { TandemService, type TandemState } from "@tandem/domain";

export interface LoadedState {
  state: TandemState;
  revision: number;
}

export interface TransactionalStateRepository {
  readonly storageKind: string;
  load(): LoadedState | undefined | Promise<LoadedState | undefined>;
  save(state: TandemState, expectedRevision: number): number | Promise<number>;
  findIdempotency?(principalId: string, key: string): IdempotencyRecord | undefined | Promise<IdempotencyRecord | undefined>;
  saveIdempotently?(state: TandemState, expectedRevision: number, record: IdempotencyRecord): IdempotentSaveResult | Promise<IdempotentSaveResult>;
  close?(): void | Promise<void>;
}

interface StateEnvelopeV1 {
  formatVersion: 1;
  savedAt: string;
  state: TandemState;
}

interface StateEnvelopeV2 {
  formatVersion: 2;
  revision: number;
  savedAt: string;
  state: TandemState;
}

interface StateEnvelopeV3 {
  formatVersion: 3;
  revision: number;
  savedAt: string;
  state: TandemState;
  idempotency: IdempotencyRecord[];
}

type StateEnvelope = StateEnvelopeV1 | StateEnvelopeV2 | StateEnvelopeV3;

export interface IdempotencyRecord {
  principalId: string;
  key: string;
  requestHash: string;
  response: unknown;
  statusCode: number;
  createdAt: string;
}

export interface IdempotentSaveResult {
  revision: number;
  replayed: boolean;
  response: unknown;
}

export class StateRevisionConflictError extends Error {
  readonly code = "STATE_REVISION_CONFLICT";

  constructor(readonly expectedRevision: number, readonly actualRevision: number) {
    super(`Tandem state revision conflict: expected ${expectedRevision}, actual ${actualRevision}`);
    this.name = "StateRevisionConflictError";
  }
}

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED";
  constructor(readonly principalId: string, readonly key: string) {
    super("Idempotency key was already used with a different request");
    this.name = "IdempotencyConflictError";
  }
}

export class FileStateRepository implements TransactionalStateRepository {
  readonly storageKind = "durable-file";

  constructor(readonly path: string) {}

  load(): LoadedState | undefined {
    if (!existsSync(this.path)) return undefined;
    const envelope = JSON.parse(readFileSync(this.path, "utf8")) as StateEnvelope;
    if (!envelope.state || ![1, 2, 3].includes(envelope.formatVersion)) throw new Error(`Unsupported Tandem state file: ${this.path}`);
    return { state: envelope.state, revision: envelope.formatVersion === 1 ? 1 : envelope.revision };
  }

  save(state: TandemState, expectedRevision: number): number {
    const loaded = this.load();
    const actualRevision = loaded?.revision ?? 0;
    if (actualRevision !== expectedRevision) throw new StateRevisionConflictError(expectedRevision, actualRevision);

    mkdirSync(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.next`;
    const revision = actualRevision + 1;
    const idempotency = existsSync(this.path) && (JSON.parse(readFileSync(this.path, "utf8")) as StateEnvelope).formatVersion === 3
      ? ((JSON.parse(readFileSync(this.path, "utf8")) as StateEnvelopeV3).idempotency ?? [])
      : [];
    const envelope: StateEnvelopeV3 = { formatVersion: 3, revision, savedAt: new Date().toISOString(), state, idempotency };
    writeFileSync(tempPath, `${JSON.stringify(envelope, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(tempPath, this.path);
    return revision;
  }

  findIdempotency(principalId: string, key: string): IdempotencyRecord | undefined {
    if (!existsSync(this.path)) return undefined;
    const envelope = JSON.parse(readFileSync(this.path, "utf8")) as StateEnvelope;
    if (envelope.formatVersion !== 3) return undefined;
    const prior = envelope.idempotency.find((item) => item.principalId === principalId && item.key === key);
    return prior ? structuredClone(prior) : undefined;
  }

  saveIdempotently(state: TandemState, expectedRevision: number, record: IdempotencyRecord): IdempotentSaveResult {
    const envelope = existsSync(this.path) ? JSON.parse(readFileSync(this.path, "utf8")) as StateEnvelope : undefined;
    const idempotency = envelope?.formatVersion === 3 ? envelope.idempotency : [];
    const prior = idempotency.find((item) => item.principalId === record.principalId && item.key === record.key);
    if (prior) {
      if (prior.requestHash !== record.requestHash) throw new IdempotencyConflictError(record.principalId, record.key);
      const revision = envelope?.formatVersion === 1 ? 1 : envelope?.revision ?? 0;
      return { revision, replayed: true, response: structuredClone(prior.response) };
    }
    const revision = this.save(state, expectedRevision);
    const current = JSON.parse(readFileSync(this.path, "utf8")) as StateEnvelopeV3;
    current.idempotency.push(structuredClone(record));
    const tempPath = `${this.path}.next`;
    writeFileSync(tempPath, `${JSON.stringify(current, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(tempPath, this.path);
    return { revision, replayed: false, response: record.response };
  }
}

export class MemoryStateRepository implements TransactionalStateRepository {
  readonly storageKind = "memory";
  private loaded?: LoadedState;
  private readonly idempotency = new Map<string, IdempotencyRecord>();

  constructor(initial?: TandemState) {
    if (initial) this.loaded = { state: structuredClone(initial), revision: 1 };
  }

  load(): LoadedState | undefined {
    return this.loaded ? structuredClone(this.loaded) : undefined;
  }

  save(state: TandemState, expectedRevision: number): number {
    const actualRevision = this.loaded?.revision ?? 0;
    if (actualRevision !== expectedRevision) throw new StateRevisionConflictError(expectedRevision, actualRevision);
    const revision = actualRevision + 1;
    this.loaded = { state: structuredClone(state), revision };
    return revision;
  }

  findIdempotency(principalId: string, key: string): IdempotencyRecord | undefined {
    const prior = this.idempotency.get(`${principalId}:${key}`);
    return prior ? structuredClone(prior) : undefined;
  }

  saveIdempotently(state: TandemState, expectedRevision: number, record: IdempotencyRecord): IdempotentSaveResult {
    const mapKey = `${record.principalId}:${record.key}`;
    const prior = this.idempotency.get(mapKey);
    if (prior) {
      if (prior.requestHash !== record.requestHash) throw new IdempotencyConflictError(record.principalId, record.key);
      return { revision: this.loaded?.revision ?? 0, replayed: true, response: structuredClone(prior.response) };
    }
    const revision = this.save(state, expectedRevision);
    this.idempotency.set(mapKey, structuredClone(record));
    return { revision, replayed: false, response: record.response };
  }
}

export class TandemRuntime {
  private service: TandemService;
  private revision: number;
  private mutationTail: Promise<void> = Promise.resolve();
  private readonly commitListeners = new Set<(revision: number) => void | Promise<void>>();

  private constructor(
    private readonly repository: TransactionalStateRepository,
    service: TandemService,
    revision: number,
  ) {
    this.service = service;
    this.revision = revision;
  }

  static async open(repository: TransactionalStateRepository, seed: () => TandemService): Promise<TandemRuntime> {
    const loaded = await repository.load();
    if (loaded) return new TandemRuntime(repository, new TandemService(loaded.state), loaded.revision);

    const service = seed();
    const revision = await repository.save(service.exportState(), 0);
    return new TandemRuntime(repository, service, revision);
  }

  static ephemeral(service: TandemService): TandemRuntime {
    const repository = new MemoryStateRepository(service.exportState());
    return new TandemRuntime(repository, service, 1);
  }

  get storageKind(): string {
    return this.repository.storageKind;
  }

  get stateRevision(): number {
    return this.revision;
  }

  read<T>(query: (service: TandemService) => T): T {
    return query(this.service);
  }

  onCommit(listener: (revision: number) => void | Promise<void>): () => void {
    this.commitListeners.add(listener);
    return () => this.commitListeners.delete(listener);
  }

  async mutate<T>(command: (service: TandemService) => T | Promise<T>): Promise<T> {
    return this.enqueueMutation(command);
  }

  async mutateIdempotently<T>(
    command: (service: TandemService) => T | Promise<T>,
    context: Omit<IdempotencyRecord, "response" | "createdAt">,
  ): Promise<T> {
    if (!this.repository.saveIdempotently) throw new Error(`Storage adapter ${this.storageKind} does not support idempotency`);
    return this.enqueueMutation(command, context);
  }

  private async enqueueMutation<T>(
    command: (service: TandemService) => T | Promise<T>,
    idempotency?: Omit<IdempotencyRecord, "response" | "createdAt">,
  ): Promise<T> {
    let resolveResult!: (value: T | PromiseLike<T>) => void;
    let rejectResult!: (reason?: unknown) => void;
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    this.mutationTail = this.mutationTail.then(async () => {
      try {
        if (idempotency && this.repository.findIdempotency) {
          const prior = await this.repository.findIdempotency(idempotency.principalId, idempotency.key);
          if (prior) {
            if (prior.requestHash !== idempotency.requestHash) throw new IdempotencyConflictError(idempotency.principalId, idempotency.key);
            resolveResult(structuredClone(prior.response) as T);
            return;
          }
        }
        const candidate = new TandemService(this.service.exportState());
        const value = await command(candidate);
        if (idempotency && this.repository.saveIdempotently) {
          const saved = await this.repository.saveIdempotently(candidate.exportState(), this.revision, { ...idempotency, response: value, createdAt: new Date().toISOString() });
          if (!saved.replayed) {
            this.service = candidate;
            await this.notifyCommitted(saved.revision);
          }
          this.revision = saved.revision;
          resolveResult(saved.response as T);
        } else {
          const nextRevision = await this.repository.save(candidate.exportState(), this.revision);
          this.service = candidate;
          this.revision = nextRevision;
          await this.notifyCommitted(nextRevision);
          resolveResult(value);
        }
      } catch (error) {
        rejectResult(error);
      }
    });
    await this.mutationTail;
    return result;
  }

  async close(): Promise<void> {
    await this.mutationTail;
    await this.repository.close?.();
  }

  private async notifyCommitted(revision: number): Promise<void> {
    await Promise.all([...this.commitListeners].map((listener) => listener(revision)));
  }
}

export { PostgresStateRepository, type ProjectionCounts } from "./postgres-repository.js";
export { PostgresIdentityRepository, type PrincipalProvisioning } from "./identity-repository.js";
export { MemoryEventStore, PostgresEventStore, type EventStore, type WebhookIngestResult } from "./event-store.js";
export * from "./schema.js";
