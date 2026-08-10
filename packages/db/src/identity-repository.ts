import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import postgres, { type JSONValue, type Sql } from "postgres";
import type {
  ActorContext,
  Capability,
  CredentialKind,
  PrincipalCredentialRecord,
  PrincipalRecord,
  PrincipalStatus,
  WebSessionRecord,
} from "@tandem/contracts";

const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");
const asJson = (value: unknown): JSONValue => value as JSONValue;

// Password hashing: scrypt with 32-byte salt and standard parameters (N=16384, r=8, p=1)
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt:v1:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
  const salt = parts[2];
  const hash = parts[3];
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derivedKey, "hex"));
}

interface PrincipalRow {
  id: string;
  type: "human" | "agent";
  username: string | null;
  display_name: string;
  status: PrincipalStatus;
  roles: string[];
  project_keys: string[];
  capabilities: Capability[];
  created_at: string;
}

interface CredentialRow {
  id: string;
  principal_id: string;
  kind: CredentialKind;
  label: string;
  token_hash: string;
  status: "active" | "revoked";
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface PrincipalProvisioning {
  id: string;
  type: "human" | "agent";
  username?: string;
  displayName: string;
  roles: string[];
  projectKeys: string[];
  capabilities: Capability[];
  token: string;
  expiresAt?: string;
}

export class PostgresIdentityRepository {
  private readonly sql: Sql;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, { max: 5, idle_timeout: 20, connect_timeout: 10 });
  }

  async provision(input: PrincipalProvisioning): Promise<void> {
    if (input.token.length < 32) throw new Error(`Credential for ${input.id} must contain at least 32 characters`);
    const normalizedUsername = input.username ? input.username.trim().toLowerCase() : null;
    await this.sql.begin(async (tx) => {
      await tx`
        INSERT INTO principals (id, type, username, display_name, status, roles, project_keys, capabilities)
        VALUES (${input.id}, ${input.type}, ${normalizedUsername}, ${input.displayName}, 'active', ${tx.json(asJson(input.roles))}, ${tx.json(asJson(input.projectKeys))}, ${tx.json(asJson(input.capabilities))})
        ON CONFLICT (id) DO UPDATE SET
          type = excluded.type,
          username = COALESCE(excluded.username, principals.username),
          display_name = excluded.display_name,
          status = 'active',
          roles = excluded.roles,
          project_keys = excluded.project_keys,
          capabilities = excluded.capabilities
      `;
      await tx`
        INSERT INTO principal_credentials (id, principal_id, kind, label, token_hash, status, expires_at)
        VALUES (${`credential-${input.id}`}, ${input.id}, 'access_token', 'Legacy Bootstrap Token', ${hashSecret(input.token)}, 'active', ${input.expiresAt ?? null})
        ON CONFLICT (id) DO UPDATE SET token_hash = excluded.token_hash, status = 'active', expires_at = excluded.expires_at
      `;
    });
  }

  async authenticate(tokenOrSessionSecret: string): Promise<ActorContext | undefined> {
    const hash = hashSecret(tokenOrSessionSecret);
    const now = new Date().toISOString();

    // 1. Try web session
    const [sessionRow] = await this.sql<Array<{ principal_id: string }>>`
      SELECT principal_id FROM web_sessions WHERE session_hash = ${hash} AND expires_at > now()
    `;
    if (sessionRow) {
      const [principal] = await this.sql<PrincipalRow[]>`
        SELECT id, type, username, display_name, status, roles, project_keys, capabilities, created_at
        FROM principals WHERE id = ${sessionRow.principal_id} AND status = 'active'
      `;
      if (!principal) return undefined;
      return {
        id: principal.id,
        type: principal.type,
        displayName: principal.display_name,
        roles: principal.roles,
        projectKeys: principal.project_keys,
        capabilities: principal.capabilities,
        development: false,
      };
    }

    // 2. Try access token
    const [credRow] = await this.sql<Array<{ id: string; principal_id: string }>>`
      SELECT c.id, c.principal_id
      FROM principal_credentials c
      JOIN principals p ON p.id = c.principal_id
      WHERE c.token_hash = ${hash}
        AND c.kind = 'access_token'
        AND c.status = 'active'
        AND p.status = 'active'
        AND (c.expires_at IS NULL OR c.expires_at > now())
    `;
    if (!credRow) return undefined;

    await this.sql`UPDATE principal_credentials SET last_used_at = ${now} WHERE id = ${credRow.id}`;

    const [principal] = await this.sql<PrincipalRow[]>`
      SELECT id, type, display_name, roles, project_keys, capabilities
      FROM principals WHERE id = ${credRow.principal_id}
    `;
    if (!principal) return undefined;

    return {
      id: principal.id,
      type: principal.type,
      displayName: principal.display_name,
      roles: principal.roles,
      projectKeys: principal.project_keys,
      capabilities: principal.capabilities,
      development: false,
    };
  }

  async authenticateByPassword(usernameInput: string, passwordInput: string): Promise<ActorContext | undefined> {
    const normalized = usernameInput.trim().toLowerCase();
    const [principal] = await this.sql<PrincipalRow[]>`
      SELECT id, type, username, display_name, status, roles, project_keys, capabilities, created_at
      FROM principals WHERE lower(username) = ${normalized} AND status = 'active'
    `;
    if (!principal || principal.type !== "human") return undefined;

    const [credRow] = await this.sql<Array<{ token_hash: string }>>`
      SELECT token_hash FROM principal_credentials
      WHERE principal_id = ${principal.id} AND kind = 'password' AND status = 'active'
    `;
    if (!credRow || !verifyPassword(passwordInput, credRow.token_hash)) return undefined;

    return {
      id: principal.id,
      type: principal.type,
      displayName: principal.display_name,
      roles: principal.roles,
      projectKeys: principal.project_keys,
      capabilities: principal.capabilities,
      development: false,
    };
  }

  async createWebSession(principalId: string): Promise<{ session: WebSessionRecord; secret: string }> {
    const secret = `tan_sess_${randomBytes(32).toString("hex")}`;
    const sessionHash = hashSecret(secret);
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
    const id = randomUUID();
    await this.sql`
      INSERT INTO web_sessions (id, principal_id, session_hash, expires_at)
      VALUES (${id}, ${principalId}, ${sessionHash}, ${expiresAt})
    `;
    return {
      session: { id, principalId, createdAt: new Date().toISOString(), expiresAt },
      secret,
    };
  }

  async revokeWebSessionBySecret(secret: string): Promise<void> {
    const sessionHash = hashSecret(secret);
    await this.sql`DELETE FROM web_sessions WHERE session_hash = ${sessionHash}`;
  }

  async revoke(principalId: string): Promise<void> {
    await this.sql`UPDATE principal_credentials SET status = 'revoked' WHERE principal_id = ${principalId}`;
    await this.sql`DELETE FROM web_sessions WHERE principal_id = ${principalId}`;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
