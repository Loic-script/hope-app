#!/usr/bin/env bash
# Demarre l'API et le frontend, joue le parcours de don, puis arrete tout.
set -uo pipefail

cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT

echo "--- Demarrage de l'API sur :3000 ---"
npm run api:start > /tmp/hope-api.log 2>&1 &
API_PID=$!

echo "--- Demarrage du frontend sur :4173 ---"
(cd frontend && npm run preview > /tmp/hope-web.log 2>&1) &
WEB_PID=$!

for i in $(seq 1 40); do
  api_ok=$(curl -s -o /dev/null -w '%{http_code}' -m 2 http://localhost:3000/api/health 2>/dev/null || echo 000)
  web_ok=$(curl -s -o /dev/null -w '%{http_code}' -m 2 http://localhost:4173/ 2>/dev/null || echo 000)
  if [[ "$api_ok" == "200" && "$web_ok" == "200" ]]; then
    echo "--- Les deux serveurs repondent (essai $i) ---"
    break
  fi
  sleep 1
done

if [[ "$api_ok" != "200" || "$web_ok" != "200" ]]; then
  echo "ECHEC : api=$api_ok web=$web_ok"
  echo "--- log API ---"; tail -20 /tmp/hope-api.log
  echo "--- log WEB ---"; tail -20 /tmp/hope-web.log
  exit 1
fi

node frontend/e2e/donation-journey.mjs
