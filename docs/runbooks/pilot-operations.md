# Pilot Operations

- Status: `IMPLEMENTED_AND_REHEARSED_ON_TEST_POSTGRES`
- Scope: one 3–5 person Team deployment

## Configuration modes

Copy `.env.pilot.example` to an untracked `.env.pilot` and replace every placeholder with a generated secret.

- controlled localhost Pilot: `TANDEM_AUTH_MODE=tokens`, one Human and one Agent token at minimum;
- shared remote MCP: `TANDEM_AUTH_MODE=oauth`, `TANDEM_REQUIRE_REMOTE_OAUTH=true`, authorization-server URL, RFC 7662 introspection URL, client ID, and client secret;
- production-like storage: PostgreSQL only, with `TANDEM_SEED_DEMO=false`;
- GitHub: configure a webhook secret and accept only signed deliveries.

Use `TANDEM_BOOTSTRAP_IDENTITIES` for distinct people and Agents. Limit each principal to required Project keys and capabilities; revoke credentials in the identity store when a person or Agent leaves the Pilot.

## Start and health

```bash
docker compose --env-file .env.pilot -f compose.pilot.yaml up -d --build
curl -fsS http://127.0.0.1:4310/ready
```

The API and Web bind to localhost by default. Put an HTTPS reverse proxy in front before remote access. Do not expose PostgreSQL.

## Backup

```bash
./deploy/backup.sh ./backups
```

The script creates a PostgreSQL custom-format dump with owner-only file permissions. Store the result in access-controlled/encrypted storage and record its retention owner.

## Restore

Stop new Agent work, select the exact backup, and run:

```bash
./deploy/restore.sh ./backups/tandem-<timestamp>.dump
```

The command requires typing `RESTORE`, stops API/Web, restores PostgreSQL, and restarts services. Then verify `/ready`, Project/Issue/Artifact/Session/Evidence/Decision counts, a representative Artifact digest, and latest Activity before reopening work.

The 2026-08-08 rehearsal restored the test PostgreSQL database into a clean disposable database. Projects, repository bindings, Issues, Artifacts, Sessions, Evidence, Decisions, Activities, events, four migrations, and the canonical state digest matched exactly. The disposable database and dump were removed afterward. A deployment-specific restore rehearsal is still required after real Pilot infrastructure and encrypted backup storage exist.

## Rollback and incident boundaries

- stop Agent clients before database restore or schema rollback;
- prefer application rollback while keeping forward-compatible migrations; never edit immutable Artifact revisions or Activity history to simulate rollback;
- revoke a compromised credential before restarting clients;
- replay a GitHub delivery only through the idempotent event path;
- do not merge code, deploy production, or execute CI from Tandem—the corresponding systems remain authoritative.

## Pilot stop conditions

Pause the Pilot for data loss, cross-Project visibility, Human impersonation, duplicate mutation, wrong Git-to-Issue correlation, unverifiable restore, or any critical/high security defect. Record the event and recovery evidence before resuming.
