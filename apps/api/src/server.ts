import { fileURLToPath } from "node:url";
import { FileStateRepository, MemoryEventStore, PostgresEventStore, PostgresIdentityRepository, PostgresStateRepository, TandemRuntime, type EventStore, type TransactionalStateRepository } from "@tandem/db";
import { createEmptyTandemService, createSeededTandemService } from "@tandem/domain";
import { buildApp } from "./app.js";
import { DevelopmentAuthProvider, HostedOAuthAuthProvider, OAuthIntrospectionAgentProvider, TokenAuthProvider, type AuthProvider } from "./auth.js";
import { z } from "zod";

const bootstrapIdentitiesSchema = z.array(z.object({
  id: z.string().min(1),
  type: z.enum(["human", "agent"]),
  displayName: z.string().min(1),
  roles: z.array(z.string()).min(1),
  projectKeys: z.array(z.string()).min(1),
  capabilities: z.array(z.enum(["context:read", "artifact:write", "planning:write", "execution:write", "decision:request", "decision:resolve", "identity:admin"])).min(1),
  token: z.string().min(32),
  expiresAt: z.iso.datetime().optional(),
}));

const port = Number(process.env.PORT ?? 4310);
const host = process.env.HOST ?? "127.0.0.1";
const defaultStatePath = fileURLToPath(new URL("../../../.tandem/state.json", import.meta.url));
const storageMode = process.env.TANDEM_STORAGE ?? (process.env.DATABASE_URL ? "postgres" : "file");
if (process.env.NODE_ENV === "production" && storageMode !== "postgres") {
  throw new Error("Production Tandem requires TANDEM_STORAGE=postgres and DATABASE_URL");
}
let stateRepository: TransactionalStateRepository;
if (storageMode === "postgres") {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required when TANDEM_STORAGE=postgres");
  stateRepository = new PostgresStateRepository(process.env.DATABASE_URL);
} else if (storageMode === "file") {
  stateRepository = new FileStateRepository(process.env.TANDEM_STATE_PATH ?? defaultStatePath);
} else {
  throw new Error(`Unsupported TANDEM_STORAGE value: ${storageMode}`);
}
const seedDemo = process.env.TANDEM_SEED_DEMO === "true" || (process.env.TANDEM_SEED_DEMO === undefined && process.env.NODE_ENV !== "production");
const runtime = await TandemRuntime.open(stateRepository, seedDemo ? createSeededTandemService : createEmptyTandemService);
const authMode = process.env.TANDEM_AUTH_MODE ?? (process.env.NODE_ENV === "production" ? "tokens" : "development");
if (process.env.NODE_ENV === "production" && !["tokens", "oauth"].includes(authMode)) throw new Error("Production Tandem requires TANDEM_AUTH_MODE=tokens or oauth");
if (process.env.TANDEM_REQUIRE_REMOTE_OAUTH === "true" && authMode !== "oauth") throw new Error("Hosted remote MCP requires TANDEM_AUTH_MODE=oauth");
let auth: AuthProvider;
let identities: PostgresIdentityRepository | undefined;
if (authMode === "development") {
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) throw new Error("Development authentication may only bind to localhost");
  auth = new DevelopmentAuthProvider();
} else if (authMode === "tokens") {
  if (!process.env.DATABASE_URL || storageMode !== "postgres") throw new Error("Token authentication requires PostgreSQL and DATABASE_URL");
  const bootstrapIdentities = process.env.TANDEM_BOOTSTRAP_IDENTITIES
    ? bootstrapIdentitiesSchema.parse(JSON.parse(process.env.TANDEM_BOOTSTRAP_IDENTITIES))
    : bootstrapIdentitiesSchema.parse([
      {
        id: "pilot-owner", type: "human", displayName: "Pilot Owner", roles: ["owner"], projectKeys: ["*"],
        capabilities: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request", "decision:resolve", "identity:admin"],
        token: process.env.TANDEM_HUMAN_TOKEN,
      },
      {
        id: "pilot-agent", type: "agent", displayName: "Pilot Coding Agent", roles: ["coding_agent"], projectKeys: ["*"],
        capabilities: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request"],
        token: process.env.TANDEM_AGENT_TOKEN,
      },
    ]);
  if (!bootstrapIdentities.some((identity) => identity.type === "human") || !bootstrapIdentities.some((identity) => identity.type === "agent")) {
    throw new Error("Token authentication requires at least one Human and one Agent identity");
  }
  identities = new PostgresIdentityRepository(process.env.DATABASE_URL);
  for (const identity of bootstrapIdentities) await identities.provision(identity);
  auth = new TokenAuthProvider(identities);
} else if (authMode === "oauth") {
  if (!process.env.DATABASE_URL || storageMode !== "postgres") throw new Error("OAuth authentication requires PostgreSQL and DATABASE_URL");
  if (!process.env.TANDEM_OAUTH_INTROSPECTION_URL || !process.env.TANDEM_OAUTH_CLIENT_ID || !process.env.TANDEM_OAUTH_CLIENT_SECRET || !process.env.TANDEM_AUTHORIZATION_SERVER) {
    throw new Error("OAuth mode requires TANDEM_AUTHORIZATION_SERVER, TANDEM_OAUTH_INTROSPECTION_URL, TANDEM_OAUTH_CLIENT_ID, and TANDEM_OAUTH_CLIENT_SECRET");
  }
  const bootstrapIdentities = process.env.TANDEM_BOOTSTRAP_IDENTITIES
    ? bootstrapIdentitiesSchema.parse(JSON.parse(process.env.TANDEM_BOOTSTRAP_IDENTITIES))
    : bootstrapIdentitiesSchema.parse([{
      id: "pilot-owner", type: "human", displayName: "Pilot Owner", roles: ["owner"], projectKeys: ["*"],
      capabilities: ["context:read", "artifact:write", "planning:write", "execution:write", "decision:request", "decision:resolve"],
      token: process.env.TANDEM_HUMAN_TOKEN,
    }]);
  if (!bootstrapIdentities.some((identity) => identity.type === "human")) throw new Error("OAuth mode requires at least one Human bootstrap identity");
  identities = new PostgresIdentityRepository(process.env.DATABASE_URL);
  for (const identity of bootstrapIdentities.filter((item) => item.type === "human")) await identities.provision(identity);
  const humanAuth = new TokenAuthProvider(identities);
  const agentAuth = new OAuthIntrospectionAgentProvider(
    process.env.TANDEM_OAUTH_INTROSPECTION_URL,
    process.env.TANDEM_OAUTH_CLIENT_ID,
    process.env.TANDEM_OAUTH_CLIENT_SECRET,
  );
  auth = new HostedOAuthAuthProvider(humanAuth, agentAuth);
} else {
  throw new Error(`Unsupported TANDEM_AUTH_MODE value: ${authMode}`);
}
const eventStore: EventStore = storageMode === "postgres" && process.env.DATABASE_URL
  ? new PostgresEventStore(process.env.DATABASE_URL)
  : new MemoryEventStore();
const app = await buildApp(runtime, auth, eventStore);
if (identities) app.addHook("onClose", async () => identities?.close());

try {
  await app.listen({ port, host });
  app.log.info(`Tandem API listening on http://${host}:${port}`);
  app.log.info(`Tandem storage: ${stateRepository.storageKind}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
