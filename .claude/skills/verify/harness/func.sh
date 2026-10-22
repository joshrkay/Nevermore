#!/bin/bash
# (Re)starts the REAL supabase/functions/dispatch-outbox under Deno. Args: VAR=value overrides; an empty value unsets that var.
H=$(cd "$(dirname "$0")" && pwd); RUN=${RUN_DIR:-/tmp/verify-harness}; ROOT=$(cd "$H/../../../.." && pwd)
DENO=${DENO:-/tmp/verify-deno/node_modules/.bin/deno}
[ -f $RUN/func.pid ] && kill $(cat $RUN/func.pid) 2>/dev/null; sleep 0.5
# deno.land / esm.sh are blocked in the sandbox: map them to a Deno.serve shim and the local node_modules supabase-js
cat > $RUN/import_map.json <<JSON
{ "imports": { "https://deno.land/std@0.168.0/http/server.ts": "file://$H/std-serve.ts", "https://esm.sh/@supabase/supabase-js@2.100.0": "npm:@supabase/supabase-js" } }
JSON
declare -A E=([SUPABASE_URL]=http://127.0.0.1:54321 [SUPABASE_ANON_KEY]=$(node $H/jwt.mjs anon) [SUPABASE_SERVICE_ROLE_KEY]=$(node $H/jwt.mjs service_role)
 [RESEND_API_KEY]=re_verify_key [EMAIL_FROM]="Edgar Allan Advisory <intake@mail.verify.example>" [ADVISORY_NOTIFY_EMAIL]=advisors@verify.example
 [APP_BASE_URL]=https://app.verify.example [SUPPORT_EMAIL]=support@verify.example [PROSPECT_RESPONSE_TIME]="2 business days" [FUNC_PORT]=8000 [NO_PROXY]=127.0.0.1,localhost)
for kv in "$@"; do k=${kv%%=*}; v=${kv#*=}; if [ -z "$v" ]; then unset "E[$k]"; else E[$k]=$v; fi; done
A=(); for k in "${!E[@]}"; do A+=("$k=${E[$k]}"); done
cd $ROOT; env -i PATH=$PATH HOME=$HOME "${A[@]}" nohup $DENO run --node-modules-dir=manual --allow-net --allow-env --allow-read --import-map $RUN/import_map.json $H/entry.ts > $RUN/func.log 2>&1 &
echo $! > $RUN/func.pid
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:8000/ && break; sleep 0.5; done
