#!/bin/bash
# (Re)starts the REAL supabase/functions/resend-webhook under Deno on :8001. Args: VAR=value overrides; an empty value unsets that var.
H=$(cd "$(dirname "$0")" && pwd); RUN=${RUN_DIR:-/tmp/verify-harness}; ROOT=$(cd "$H/../../../.." && pwd)
DENO=${DENO:-/tmp/verify-deno/node_modules/.bin/deno}
[ -f $RUN/webhook.pid ] && kill $(cat $RUN/webhook.pid) 2>/dev/null; sleep 0.5
# The import map func.sh writes (deno.land / esm.sh are blocked in the sandbox); write it too, so this can run alone.
cat > $RUN/import_map.json <<JSON
{ "imports": { "https://deno.land/std@0.168.0/http/server.ts": "file://$H/std-serve.ts", "https://esm.sh/@supabase/supabase-js@2.100.0": "npm:@supabase/supabase-js" } }
JSON
declare -A E=([SUPABASE_URL]=http://127.0.0.1:54321 [SUPABASE_SERVICE_ROLE_KEY]=$(node $H/jwt.mjs service_role)
 [RESEND_WEBHOOK_SECRET]=whsec_dmVyaWZ5LWhhcm5lc3Mtd2ViaG9vay1zZWNyZXQtMzJiIQ== [ADVISORY_NOTIFY_EMAIL]="advisors@verify.example, Second@verify.example"
 [FUNC_PORT]=8001 [NO_PROXY]=127.0.0.1,localhost)
for kv in "$@"; do k=${kv%%=*}; v=${kv#*=}; if [ -z "$v" ]; then unset "E[$k]"; else E[$k]=$v; fi; done
A=(); for k in "${!E[@]}"; do A+=("$k=${E[$k]}"); done
cd $ROOT; env -i PATH=$PATH HOME=$HOME "${A[@]}" nohup $DENO run --node-modules-dir=manual --allow-net --allow-env --allow-read --import-map $RUN/import_map.json $H/entry-webhook.ts > $RUN/webhook.log 2>&1 &
echo $! > $RUN/webhook.pid
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:8001/ && break; sleep 0.5; done
