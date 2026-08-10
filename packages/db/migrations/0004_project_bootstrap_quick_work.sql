ALTER TABLE issues ADD COLUMN IF NOT EXISTS issue_type text;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS delivery_path text;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS intake_source text;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS risk_class text;

UPDATE issues
SET
  issue_type = COALESCE(issue_type, payload->>'type', 'task'),
  delivery_path = COALESCE(delivery_path, payload->>'deliveryPath', 'planned'),
  intake_source = COALESCE(intake_source, payload#>>'{intake,source}', 'import'),
  risk_class = COALESCE(risk_class, payload#>>'{risk,class}', 'standard');

ALTER TABLE issues ALTER COLUMN issue_type SET NOT NULL;
ALTER TABLE issues ALTER COLUMN delivery_path SET NOT NULL;
ALTER TABLE issues ALTER COLUMN intake_source SET NOT NULL;
ALTER TABLE issues ALTER COLUMN risk_class SET NOT NULL;

CREATE INDEX IF NOT EXISTS issues_project_delivery_idx ON issues(project_id, delivery_path, state);

CREATE TABLE IF NOT EXISTS project_repository_bindings (
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  host text NOT NULL,
  repository_owner text NOT NULL,
  repository_name text NOT NULL,
  default_branch text NOT NULL,
  remote_url text,
  payload jsonb NOT NULL,
  PRIMARY KEY (project_id, host, repository_owner, repository_name),
  CONSTRAINT project_repository_identity_uq UNIQUE (host, repository_owner, repository_name)
);
CREATE INDEX IF NOT EXISTS project_repository_project_idx ON project_repository_bindings(project_id);
