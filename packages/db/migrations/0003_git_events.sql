CREATE TABLE IF NOT EXISTS state_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  subject_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS state_events_created_idx ON state_events(id);

CREATE TABLE IF NOT EXISTS github_webhook_deliveries (
  delivery_id text PRIMARY KEY,
  event_name text NOT NULL,
  payload_digest text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL,
  error text
);

CREATE TABLE IF NOT EXISTS git_artifacts (
  id bigserial PRIMARY KEY,
  repository text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('branch', 'commit', 'pull_request', 'check')),
  external_id text NOT NULL,
  issue_key text NOT NULL,
  session_id text,
  title text NOT NULL,
  url text,
  state text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT git_artifacts_correlation_uq UNIQUE (repository, kind, external_id, issue_key)
);
CREATE INDEX IF NOT EXISTS git_artifacts_issue_idx ON git_artifacts(issue_key, updated_at DESC);
