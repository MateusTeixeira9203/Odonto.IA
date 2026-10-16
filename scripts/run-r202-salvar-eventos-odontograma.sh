#!/usr/bin/env bash
set -euo pipefail

# R-202: executa somente contra o Postgres descartável já preparado com schema-only equivalente.
# Nunca apontar estas variáveis para produção ou para uma base de QA compartilhada.
: "${R202_PSQL:?defina o caminho absoluto para psql do laboratório local}"
: "${R202_PGHOST:?defina o socket Unix do laboratório local}"
: "${R202_PGPORT:?defina a porta do laboratório local}"
: "${R202_EVIDENCE_DIR:?defina um diretório de evidência local}"

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p "$R202_EVIDENCE_DIR"

export PGHOST="$R202_PGHOST"
export PGPORT="$R202_PGPORT"
export PGUSER=postgres
export PGDATABASE=postgres

"$R202_PSQL" -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20261015234425_r202_otimizar_guard_eventos_odontograma.sql"
"$R202_PSQL" -v ON_ERROR_STOP=1 -f "$root/supabase/tests/r202_salvar_eventos_odontograma.sql" | tee "$R202_EVIDENCE_DIR/r202-rpc-results.tsv"

# O plano replica literalmente o guard alterado e roda como authenticated no schema completo.
"$R202_PSQL" -v ON_ERROR_STOP=1 -At <<'SQL' | tee "$R202_EVIDENCE_DIR/r202-guard-plan.json"
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000010', true);
explain (analyze, buffers, format json)
select exists (
  select 1
  from public.odontograma_eventos existente
  where existente.id = any(array[
    '00000000-0000-4000-8000-000000000200'::uuid
  ])
    and (
      (to_jsonb(existente)->>'retirado_em') is not null
      or existente.clinica_id is distinct from '00000000-0000-4000-8000-000000000001'::uuid
      or existente.paciente_id is distinct from '00000000-0000-4000-8000-000000000030'::uuid
      or existente.ficha_id is distinct from '00000000-0000-4000-8000-000000000040'::uuid
    )
);
commit;
SQL

# Plano do UPDATE que trata o `encaminhado_para: null` sem varrer eventos alheios.
"$R202_PSQL" -v ON_ERROR_STOP=1 -At <<'SQL' | tee "$R202_EVIDENCE_DIR/r202-encaminhamento-null-plan.json"
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000010', true);
explain (format json)
update public.odontograma_eventos evento
set encaminhado_para = nullif(payload.e->>'encaminhado_para', '')::uuid
from jsonb_array_elements('[{"id":"00000000-0000-4000-8000-000000000100","encaminhado_para":null}]'::jsonb) as payload(e)
where evento.id = any(array(
  select (ids.e->>'id')::uuid
  from jsonb_array_elements('[{"id":"00000000-0000-4000-8000-000000000100","encaminhado_para":null}]'::jsonb) as ids(e)
  where ids.e ? 'encaminhado_para'
))
  and evento.id = (payload.e->>'id')::uuid
  and evento.clinica_id = '00000000-0000-4000-8000-000000000001'::uuid
  and evento.paciente_id = '00000000-0000-4000-8000-000000000030'::uuid
  and evento.ficha_id = '00000000-0000-4000-8000-000000000041'::uuid
  and payload.e ? 'encaminhado_para';
rollback;
SQL

# `anon` não pode executar a RPC. A falha é esperada e registra o stderr como evidência.
if "$R202_PSQL" -v ON_ERROR_STOP=1 -c "set role anon; select public.salvar_eventos_odontograma('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000030','[]'::jsonb,false);" >"$R202_EVIDENCE_DIR/r202-anon.stdout" 2>"$R202_EVIDENCE_DIR/r202-anon.stderr"; then
  echo "R-202 expected anon denial, but the RPC returned success" >&2
  exit 1
fi
grep -q 'permission denied' "$R202_EVIDENCE_DIR/r202-anon.stderr"
printf 'PASS AC06-anon: execute denied\n' | tee "$R202_EVIDENCE_DIR/r202-anon-result.txt"
