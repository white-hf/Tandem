import { createHash } from "node:crypto";
import type { ActorContext } from "@tandem/contracts";
import type { IdempotencyRecord, TandemRuntime } from "@tandem/db";
import { DomainError, type TandemService } from "@tandem/domain";
import type { FastifyRequest } from "fastify";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
};

export const requestHash = (value: unknown): string => createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");

export interface IdempotencyContext extends Omit<IdempotencyRecord, "response" | "createdAt"> {}

export function restIdempotency(request: FastifyRequest, actor: ActorContext, statusCode: number): IdempotencyContext {
  const header = request.headers["idempotency-key"];
  if (typeof header !== "string" || header.length < 8 || header.length > 200) {
    throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "Mutations require an Idempotency-Key header between 8 and 200 characters", 428);
  }
  return {
    principalId: actor.id,
    key: `rest:${header}`,
    requestHash: requestHash({ method: request.method, url: request.url, body: request.body }),
    statusCode,
  };
}

export function mcpIdempotency(request: FastifyRequest, actor: ActorContext): IdempotencyContext | undefined {
  const body = request.body as { id?: string | number; method?: string } | undefined;
  if (body?.method !== "tools/call") return undefined;
  const header = request.headers["idempotency-key"];
  const bodyHash = requestHash(request.body);
  const key = typeof header === "string" && header.length >= 8 && header.length <= 200
    ? `mcp:${header}`
    : body.id !== undefined
      ? `mcp-jsonrpc:${String(body.id)}:${bodyHash}`
      : undefined;
  if (!key) throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "MCP tool calls require an Idempotency-Key header or JSON-RPC request id", 428);
  return { principalId: actor.id, key, requestHash: bodyHash, statusCode: 200 };
}

export function mutateWithIdempotency<T>(
  runtime: TandemRuntime,
  context: IdempotencyContext | undefined,
  command: (service: TandemService) => T | Promise<T>,
): Promise<T> {
  if (!context) throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "Mutation has no idempotency context", 428);
  return runtime.mutateIdempotently(command, context);
}
