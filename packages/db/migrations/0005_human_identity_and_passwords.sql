-- Migration 0005: Human password login, session cookies, and credential metadata

ALTER TABLE principals ADD COLUMN IF NOT EXISTS username text UNIQUE;

ALTER TABLE principal_credentials ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'access_token';
ALTER TABLE principal_credentials ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Access Token';
ALTER TABLE principal_credentials ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE TABLE IF NOT EXISTS web_sessions (
  id text PRIMARY KEY,
  principal_id text NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  session_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_sessions_principal_idx ON web_sessions(principal_id);
