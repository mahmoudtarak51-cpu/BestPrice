#!/usr/bin/env bash
set -euo pipefail

if [ ! -f deploy/oracle/.env.vm ]; then
  echo "Missing deploy/oracle/.env.vm"
  exit 1
fi

if [ ! -f deploy/oracle/.env.api ]; then
  echo "Missing deploy/oracle/.env.api"
  exit 1
fi

if [ ! -f deploy/oracle/.env.frontend ]; then
  echo "Missing deploy/oracle/.env.frontend"
  exit 1
fi

set -a
source deploy/oracle/.env.vm
set +a

docker compose --env-file deploy/oracle/.env.vm -f docker-compose.oracle.yml up -d --build

echo "Stack deployed."
echo "Frontend: http://<vm-ip>:3000"
echo "API health: http://<vm-ip>:3001/api/v1/health/live"
