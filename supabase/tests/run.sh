#!/usr/bin/env bash
# Runs every SQL test in this folder, each in its own throwaway database, and stops reporting
# success unless all of them pass. Needs a Postgres you can create databases on (NOT production):
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh
#
# Standard libpq variables choose the server. Pass test names to run a subset:
#   supabase/tests/run.sh advisor_operations certification
set -uo pipefail

cd "$(dirname "$0")/../.."

if [ "$#" -gt 0 ]; then
  tests=("$@")
else
  tests=()
  for f in supabase/tests/*.sql; do tests+=("$(basename "$f" .sql)"); done
fi
[ -e "supabase/tests/${tests[0]}.sql" ] || { echo "No SQL tests found." >&2; exit 1; }

failed=()
for t in "${tests[@]}"; do
  db="eaa_test_${t}"
  dropdb --if-exists --force "$db" >/dev/null 2>&1
  createdb "$db" || { echo "Could not create $db" >&2; exit 1; }
  echo "::group::$t"
  if psql -d "$db" -v ON_ERROR_STOP=1 -q -f "supabase/tests/$t.sql" 2>&1 | grep -v "NOTICE:  \(drop cascades\|schema .* does not exist\)\|^DETAIL:  drop cascades"; [ "${PIPESTATUS[0]}" -eq 0 ]; then
    echo "PASS $t"
  else
    echo "FAIL $t"
    failed+=("$t")
  fi
  echo "::endgroup::"
  dropdb --if-exists --force "$db" >/dev/null 2>&1
done

if [ "${#failed[@]}" -gt 0 ]; then
  echo "SQL tests failed: ${failed[*]}" >&2
  exit 1
fi
echo "All ${#tests[@]} SQL tests passed."
