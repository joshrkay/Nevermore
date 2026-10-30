#!/bin/bash
# Brings up: scratch Postgres DB 'verify' (real migrations) -> real PostgREST :3001 -> gateway stand-in :54321 (GoTrue /user + /rest/v1 + /functions/v1)
# -> fake Resend :54400 -> real dispatch-outbox under Deno :8000.  Prereqs are listed in SKILL.md.
H=$(cd "$(dirname "$0")" && pwd); RUN=${RUN_DIR:-/tmp/verify-harness}; ROOT=$(cd "$H/../../../.." && pwd)
PGRST=${PGRST:-/tmp/verify-pgrst/postgrest}; mkdir -p $RUN; export RUN_DIR=$RUN
"$H/down.sh" >/dev/null 2>&1
service postgresql start >/dev/null 2>&1; sleep 2
su postgres -c "psql -q -c 'DROP DATABASE IF EXISTS verify' -c 'CREATE DATABASE verify'" 2>&1 | grep -v NOTICE
su postgres -c "cd $ROOT && psql -q -d verify -v ON_ERROR_STOP=1 -f -" < $H/setup.sql || { echo "DB setup failed"; exit 1; }
cat > $RUN/pgrst.conf <<CONF
db-uri = "postgres://authenticator:pw@127.0.0.1:5432/verify"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "verify-harness-secret-0123456789abcdef"
server-host = "127.0.0.1"
server-port = 3001
CONF
(nohup $PGRST $RUN/pgrst.conf > $RUN/pgrst.log 2>&1 & echo $! > $RUN/pgrst.pid)
(nohup node $H/front.mjs > $RUN/front.log 2>&1 & echo $! > $RUN/front.pid)
(nohup node $H/resend.mjs $RUN/resend.jsonl > $RUN/resend.log 2>&1 & echo $! > $RUN/resend.pid)
for i in $(seq 1 20); do curl -s -o /dev/null http://127.0.0.1:3001/ && break; sleep 0.5; done
"$H/func.sh"
"$H/webhook.sh"
echo "up: pgrst=$(curl -s -o /dev/null -w %{http_code} http://127.0.0.1:3001/) gateway=$(curl -s -o /dev/null -w %{http_code} http://127.0.0.1:54321/x) func(GET)=$(curl -s -o /dev/null -w %{http_code} http://127.0.0.1:8000/) (expect 200 404 405)"
