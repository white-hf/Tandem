CREATE TABLE IF NOT EXISTS principals (
  id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('human', 'agent')),
  display_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'revoked')),
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  project_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS principal_credentials (
  id text PRIMARY KEY,
  principal_id text NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('active', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS principal_credentials_principal_idx ON principal_credentials(principal_id);
