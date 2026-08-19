#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Tandem - One-Click Deployment & Management Script
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.pilot"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

generate_random_token() {
  if command -v openssl &>/dev/null; then
    openssl rand -hex 24
  else
    head -c 24 /dev/urandom | xxd -p
  fi
}

init_env_if_missing() {
  if [ ! -f "$ENV_FILE" ]; then
    log_info "Creating default deployment configuration: .env.pilot"
    local db_password
    local human_token
    local agent_token
    db_password=$(generate_random_token)
    human_token="0000000000000000000000000000000000000000"
    agent_token="tan_agent_00000000000000000000000000000000"

    cat <<ENV_CONTENT > "$ENV_FILE"
# Tandem Production / Pilot Environment Configuration
POSTGRES_PASSWORD=tandem_pilot_password
TANDEM_HUMAN_TOKEN=${human_token}
TANDEM_AGENT_TOKEN=${agent_token}
TANDEM_AUTH_MODE=tokens
TANDEM_SEED_DEMO=false
ENV_CONTENT
    log_success ".env.pilot generated with configuration."
  fi
}

start_docker() {
  init_env_if_missing
  log_info "Building and launching Tandem via Docker Compose..."
  docker compose -f compose.pilot.yaml --env-file "$ENV_FILE" up -d --build
  
  echo ""
  log_success "🎉 Tandem Pilot stack is up and running!"
  echo "--------------------------------------------------------"
  echo -e "🌐 Human Web UI:        ${GREEN}http://127.0.0.1:4311${NC}"
  echo -e "🔌 Agent MCP API:       ${GREEN}http://127.0.0.1:4310/mcp${NC}"
  echo -e "📊 Database (Postgres): ${GREEN}127.0.0.1:5432 (internal)${NC}"
  echo "--------------------------------------------------------"
  echo "Tip: Run './tandem.sh status' to inspect container health."
}

stop_docker() {
  init_env_if_missing
  log_info "Stopping Tandem Docker services..."
  docker compose -f compose.pilot.yaml --env-file "$ENV_FILE" down
  log_success "Tandem services stopped cleanly."
}

restart_docker() {
  init_env_if_missing
  log_info "Restarting Tandem Docker services..."
  docker compose -f compose.pilot.yaml --env-file "$ENV_FILE" restart
  log_success "Tandem services restarted."
}

show_status() {
  init_env_if_missing
  log_info "Checking container status..."
  docker compose -f compose.pilot.yaml --env-file "$ENV_FILE" ps
  echo ""
  log_info "Checking API health endpoint..."
  if curl -s http://127.0.0.1:4310/health | grep -q "ok"; then
    log_success "API Health Check: OK"
  else
    log_warn "API Health Check: Waiting or Unreachable (ensure containers are running)."
  fi
}

show_logs() {
  init_env_if_missing
  local service="${1:-}"
  if [ -n "$service" ]; then
    docker compose -f compose.pilot.yaml --env-file "$ENV_FILE" logs -f "$service"
  else
    docker compose -f compose.pilot.yaml --env-file "$ENV_FILE" logs -f
  fi
}

show_help() {
  echo "Tandem Management Script"
  echo "Usage: ./tandem.sh [command]"
  echo ""
  echo "Commands:"
  echo "  up / start        Build and start Tandem in background (Docker Pilot stack)"
  echo "  down / stop       Stop all running Tandem containers"
  echo "  restart           Restart all Tandem containers"
  echo "  status / ps       Show status and health of Tandem services"
  echo "  logs [service]    View real-time logs (e.g. ./tandem.sh logs api)"
  echo "  dev               Start in local development mode (pnpm dev)"
  echo "  check / test      Run full workspace test and build checks"
  echo "  help              Show this help message"
}

case "${1:-up}" in
  up|start)
    start_docker
    ;;
  down|stop)
    stop_docker
    ;;
  restart)
    restart_docker
    ;;
  status|ps)
    show_status
    ;;
  logs)
    show_logs "${2:-}"
    ;;
  dev)
    log_info "Starting in local development mode..."
    pnpm dev
    ;;
  check|test)
    log_info "Running workspace tests and typechecks..."
    pnpm test
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    log_error "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
