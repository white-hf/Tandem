#!/bin/sh
set -eu

backup_directory=${1:-./backups}
mkdir -p "$backup_directory"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$backup_directory/tandem-$timestamp.dump"

docker compose --env-file .env.pilot -f compose.pilot.yaml exec -T postgres pg_dump -U tandem -d tandem -Fc > "$target"
chmod 600 "$target"
printf '%s\n' "Backup created: $target"
