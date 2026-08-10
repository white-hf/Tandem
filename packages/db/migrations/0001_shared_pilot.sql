CREATE TABLE IF NOT EXISTS tandem_states (
  workspace_id text PRIMARY KEY,
  revision bigint NOT NULL CHECK (revision >= 1),
  state_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  target_date date NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT projects_workspace_key_uq UNIQUE (workspace_id, key)
);

CREATE TABLE IF NOT EXISTS milestones (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  state text NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS milestones_project_idx ON milestones(project_id);

CREATE TABLE IF NOT EXISTS cycles (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number integer NOT NULL,
  state text NOT NULL,
  plan_revision integer NOT NULL CHECK (plan_revision >= 1),
  payload jsonb NOT NULL,
  CONSTRAINT cycles_project_number_uq UNIQUE (project_id, number)
);

CREATE TABLE IF NOT EXISTS issues (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  parent_id text,
  cycle_id text,
  state text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS issues_project_state_idx ON issues(project_id, state);

CREATE TABLE IF NOT EXISTS issue_dependencies (
  blocker_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  blocked_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  effective_revision_id text,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS artifacts_project_idx ON artifacts(project_id);

CREATE TABLE IF NOT EXISTS artifact_revisions (
  id text PRIMARY KEY,
  artifact_id text NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision >= 1),
  state text NOT NULL,
  digest text NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT artifact_revisions_number_uq UNIQUE (artifact_id, revision)
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_id text REFERENCES issues(id) ON DELETE SET NULL,
  agent_id text NOT NULL,
  state text NOT NULL,
  context_digest text NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_sessions_project_state_idx ON agent_sessions(project_id, state);

CREATE TABLE IF NOT EXISTS issue_claims (
  issue_id text PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  session_id text NOT NULL UNIQUE REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  claimed_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS checkpoints (
  id text PRIMARY KEY,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id text PRIMARY KEY,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  result text NOT NULL,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS handoffs (
  id text PRIMARY KEY,
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_requests (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id text,
  status text NOT NULL,
  risk text NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS decision_requests_project_status_idx ON decision_requests(project_id, status);

CREATE TABLE IF NOT EXISTS activities (
  id text PRIMARY KEY,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS activities_occurred_idx ON activities(occurred_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  principal_id text NOT NULL,
  key text NOT NULL,
  request_hash text NOT NULL,
  status_code integer NOT NULL,
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (principal_id, key)
);
