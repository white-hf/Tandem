#!/bin/sh
set -eu

backup_file=${1:-}
if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
  printf '%s\n' "Usage: deploy/restore.sh backups/tandem-<timestamp>.dump" >&2
  exit 2
fi

printf '%s\n' "This replaces the Tandem pilot database with: $backup_file"
printf '%s' "Type RESTORE to continue: "
read -r confirmation
[ "$confirmation" = "RESTORE" ] || { printf '%s\n' "Restore cancelled."; exit 1; }

docker compose --env-file .env.pilot -f compose.pilot.yaml stop api web
docker compose --env-file .env.pilot -f compose.pilot.yaml exec -T postgres pg_restore -U tandem -d tandem --clean --if-exists --no-owner < "$backup_file"
docker compose --env-file .env.pilot -f compose.pilot.yaml start api web
printf '%s\n' "Restore complete. Verify /ready and the latest Activity before resuming Agent work."
