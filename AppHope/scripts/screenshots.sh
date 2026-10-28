#!/usr/bin/env bash
set -uo pipefail
cleanup() { [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null; [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null; wait 2>/dev/null; }
trap cleanup EXIT
npm run api:start > /tmp/hope-api.log 2>&1 & API_PID=$!
(cd frontend && npm run preview > /tmp/hope-web.log 2>&1) & WEB_PID=$!
for i in $(seq 1 30); do
  a=$(curl -s -o /dev/null -w '%{http_code}' -m 2 http://localhost:3000/api/health 2>/dev/null || echo 000)
  w=$(curl -s -o /dev/null -w '%{http_code}' -m 2 http://localhost:4173/ 2>/dev/null || echo 000)
  [[ "$a" == "200" && "$w" == "200" ]] && break
  sleep 1
done
cd frontend && node e2e/screenshots.mjs
