# Iteration 5 — Human and Agent Identity Administration

Status: `REVIEWED`

Tandem Issue: `TAN-6`

Required Human Decision: `b85f4df5-b2da-46c3-92e1-5cf0b63f37fb`

Product baseline decision: `4b01e8b0-4af4-44c3-803a-d09ca9cf62f8`

Design baseline decision: `1a2175c9-6374-467d-b90b-63cea7d102ba`

Proposed duration: 4 focused build days plus 1 pilot validation day

## 1. Outcome

A 3–5 person team can enter Tandem naturally and administer its own members: Humans normally use username/password in Web, Agents normally use Project-scoped tokens through MCP, and either identity type may hold independently revocable access tokens without blurring Human and Agent authority.

## 2. Product Decisions

- Human default: username/password Web login.
- Human alternative: personal access token login/API use.
- Agent default in the local pilot: scoped access token; hosted remote MCP remains OAuth-first.
- Principal type is immutable. A token carries the authority of its owning principal and cannot turn an Agent into a Human.
- The existing bootstrap Human token remains valid during upgrade so the owner can set the first username/password without database surgery.
- Secrets are displayed only at creation/reset, stored only as one-way verifiers, and excluded from audit payloads.
- Only an active Human with `identity:admin` can administer identities.

## 3. Scope

### Slice A — contracts, storage, and security rules

- add `identity:admin` capability and typed public identity/credential contracts;
- migrate principals to support normalized unique Human usernames;
- generalize credentials for password and access-token metadata;
- add revocable, expiring Web sessions;
- implement password hashing/verification, token generation/verification, and last-owner/deactivation invariants;
- preserve existing bootstrap principals and tokens during migration.

### Slice B — authentication and Human administration API

- password and Human-token login create an opaque Web session cookie;
- logout revokes the active session;
- authenticated session query returns the current actor without secret material;
- owner routes list/create Humans and Agents, set/reset Human password, issue/revoke tokens, update status, and update Project scopes;
- every state-changing route is idempotent and writes secret-free Activity history;
- Agent, inactive, missing-capability, cross-scope, and last-owner operations fail closed.

### Slice C — Human Web

- replace token-only sign-in with default username/password and secondary access-token modes;
- add `Settings > People & Agents` with clear Human/Agent separation, status, role, and Project access;
- add create Human and create Agent flows;
- show generated Agent/Human token once with copy warning;
- add password reset/change and token revoke actions;
- prompt the legacy bootstrap owner to set username/password after token sign-in;
- provide loading, empty, success, validation, conflict, and authorization states.

### Slice D — validation and pilot upgrade

- run migration against empty and copied current pilot databases;
- validate password login, Human token login, Agent MCP token, session logout/revocation, identity deactivation, token rotation, scope rejection, and last-owner protection;
- build API/Web images, back up the current PostgreSQL pilot, deploy the migration, and verify health without losing Project `TAN` history;
- record Evidence and Handoff on `TAN-6`, then request Human experience verification.

## 4. Acceptance

1. A Human owner signed in by the current Human token can set username/password, log out, and sign back in with that password.
2. An owner can create another Human who can sign in with username/password and change their own password.
3. An owner can create an Agent and receives one Project-scoped token exactly once; that token authenticates MCP but is rejected by Human administration routes.
4. Human and Agent access tokens can be independently issued and revoked without deactivating the principal.
5. Deactivation immediately invalidates credentials and Web sessions while preserving Activity attribution.
6. The last active owner and the currently authenticated owner cannot be accidentally deactivated.
7. Database rows, logs, API errors, Activity, Evidence, and Web state expose no plaintext password, access token, or session secret after the one-time response.
8. Empty-database migration, current-pilot upgrade migration, database integration tests, API authorization tests, Web production build, and critical UI flow regression all pass.

## 5. Explicit Non-goals

- email invitation or password-recovery email;
- MFA, enterprise SSO, SCIM, or external directory sync;
- Agent OAuth issuer implementation;
- organization/multi-Team role designer;
- long-lived browser sessions, trusted-device UX, or advanced security analytics.

## 6. Execution Gate

This iteration is not `REVIEWED` and no implementation claim may start until the high-risk Issue decision plus the Product and Design baseline decisions above are approved in Tandem. Approval accepts the product decisions and safeguards above; changes requested return the iteration to product/design revision before code.
