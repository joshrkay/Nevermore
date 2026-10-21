# Source me:  source .claude/skills/verify/harness/lib.sh   (after up.sh)
H=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); RUN=${RUN_DIR:-/tmp/verify-harness}
S=$RUN  # run dir: logs, pid files, resend.jsonl
J="node $H/jwt.mjs"
U_A=00000000-0000-0000-0000-00000000000a; U_G=00000000-0000-0000-0000-00000000000b; U_C=00000000-0000-0000-0000-00000000000c
PROSPECT=$($J authenticated $U_A jo@acme.example false); GUEST=$($J authenticated $U_G "" true); OTHER=$($J authenticated $U_C pat@globex.example false)
SVC=$($J service_role); ANON=$($J anon)
export REST=http://127.0.0.1:54321/rest/v1
sql() { echo "$1" | su postgres -c "psql -d verify -A -F ' | '" ; }
invoke() { curl -s -w "  [http %{http_code}]\n" -X ${1:-POST} ${2:+-H "Authorization: Bearer $2"} http://127.0.0.1:8000/ ; }
newsession() { # token user_id data-json -> session id
  curl -s -X POST "$REST/chamber_sessions" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -H "Prefer: return=representation" \
    -d "{\"user_id\":\"$2\",\"chamber_data\":$3}" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0]?.id ?? "ERR"'; }
certify() { # token session_id data-json signed_at file_id  (what the browser's supabase update sends)
  curl -s -w "  [http %{http_code}]\n" -X PATCH "$REST/chamber_sessions?id=eq.$2" -H "Authorization: Bearer $1" -H "Content-Type: application/json" \
    -d "{\"status\":\"submitted\",\"chamber_data\":$3,\"submission\":{\"signer_name\":\"Jo Doe\",\"signer_title\":\"CEO\",\"signed_at\":\"$4\",\"file_id\":\"$5\",\"consent_version\":\"v1\",\"consent_text\":\"I certify.\",\"chamber_data\":$3}}"; }
stats() { curl -s http://127.0.0.1:54400/__stats; echo; }
mode() { curl -s -X POST http://127.0.0.1:54400/__mode -d "{\"mode\":\"$1\"}" >/dev/null; }   # ok | 503 | 429 | 403 | slow | accept_then_hang
