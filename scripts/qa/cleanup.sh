#!/usr/bin/env bash
# Deletes QA test accounts (qa.*@repaihub.com / qa-*@repaihub.com) from production Supabase.
# The Supabase Management API token is injected by the environment's network proxy — never put it here.
set -euo pipefail
REF="${SUPABASE_REF:-mievzzzxpsomrzxhkecu}"
SQL="with p as (delete from public.profiles where email like 'qa.%@repaihub.com' or email like 'qa-%@repaihub.com' returning 1),
u as (delete from auth.users where email like 'qa.%@repaihub.com' or email like 'qa-%@repaihub.com' returning 1)
select (select count(*) from p) profiles_deleted, (select count(*) from u) users_deleted"
curl -s --max-time 60 -X POST -H 'Content-Type: application/json' \
  "https://api.supabase.com/v1/projects/$REF/database/query" \
  -d "$(python3 -c 'import json,sys;print(json.dumps({"query":sys.argv[1]}))' "$SQL")"
echo
