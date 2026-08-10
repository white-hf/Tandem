# TAN-6 — Human Password Login and Identity Administration Summary

- Status: `AWAITING_HUMAN_VERIFICATION`
- Delivery path: `planned`
- Date: 2026-08-10
- Agent Session: `695cca02-fec8-4170-97ad-8c1b229ca7a6`

## Outcome

Delivered full Human password login and identity administration across `packages/contracts`, `packages/db`, `packages/domain`, `apps/api`, and `apps/web`. Humans can now sign in using username and scrypt-hashed password or access tokens, manage Human and Coding Agent identities, and issue/revoke credentials with strict security invariants (last active owner protection, self-deactivation prevention, scrypt/SHA-256 verifiers, and secret non-leakage).

## Delivered Slices & Changes

### Slice A: Contracts, Schema & Storage Migration
- `packages/contracts`: Added `"identity:admin"` capability and Zod schemas for human/agent creation, password setting, token issuance, status updates, and credentials.
- `packages/db`: Updated `principals` with `username`, `principal_credentials` with `kind`/`label`/`last_used_at`, created `web_sessions` table, created migration `0005_human_identity_and_passwords.sql`, and upgraded `PostgresIdentityRepository` with Node `scrypt` hashing (N=16384, r=8, p=1) and SHA-256 token/session verifiers.
- `packages/domain`: Updated `TandemState` and `TandemService` to support in-memory/file-backed state identity administration and password verification.

### Slice B: API Routes & Auth System
- `apps/api/src/auth.ts`: Upgraded `TokenAuthProvider` to support web session cookies (`tandem_session`), access tokens, and state fallback.
- `apps/api/src/app.ts`: Implemented `/v1/auth/login` (username/password), `/v1/auth/login-token`, `/v1/auth/session`, `/v1/auth/logout` (revoking web session), and identity management endpoints (`/v1/human/principals/*`, `/v1/human/credentials/*`). Enforced `identity:admin` capability and owner protection.

### Slice C: Web Interface (React)
- `apps/web`: Added tabbed sign-in UI (Password vs. Access token) and created `Settings > People & Agents` view allowing Human owners to view principals, create Humans/Agents, copy one-time generated secrets/tokens, and activate/deactivate accounts.

### Slice D: Automated Testing & Evidence Verification
- Automated unit/integration tests: 21/21 API & Auth tests passed, 9/9 Web tests passed, all domain tests passed.
- Verified password login, token login, identity administration, one-time agent token display, scrypt verifiers, session revocation on logout, last-owner protection, and zero secret leakage in logs/audit trails.

## Evidence

- `evidence-unit-tests`: 21 API/MCP/Auth integration tests passed (including `identity-admin.test.ts`).
- `evidence-web-build`: `@tandem/web` production bundle compiled cleanly via `pnpm --filter @tandem/web build`.
- `evidence-security-audit`: Verified scrypt password hashing, SHA-256 token/session verifiers, non-retrieval of raw password/token hashes in listing APIs, and strict owner protection rules.

## Remaining Human Action

Open Human Web at `http://127.0.0.1:4311`, navigate to `Work > TAN-6 / Verify`, review the evidence and handoff, and submit your verification decision.
