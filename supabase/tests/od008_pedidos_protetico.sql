-- OD-008: T01-T22; executar INTEIRO em UMA conexao exclusiva, apenas no odonto-qa.
-- Nao executar agora: primeiro revisar o SQL e combinar a janela com o Orquestrador.
-- Emula claims no Postgres; nao certifica login/JWT HTTP ou persistencia pela UI.
-- Modo automatico: antes (ALL), aplicada (trava) ou volta segura (4 policies sem trava).
-- Antes: deve FALHAR nas lacunas; T07 ja e barrado pelo WITH CHECK antigo.
-- Volta: T02/T10 validam zero linhas; equipe e bloqueios continuam obrigatorios.
-- Nao persiste fixtures nem cria senha. Qualquer erro aborta a transacao; terminar com ROLLBACK.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path = public;

do $mode$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='pedidos_protetico' and policyname='pedidos_protetico_access' and cmd='ALL') then
    perform set_config('od008.modo','antes',true);
  elsif exists (select 1 from pg_trigger where tgrelid='public.pedidos_protetico'::regclass and tgname='pedidos_protetico_trava_protetico' and not tgisinternal) then
    perform set_config('od008.modo','aplicada',true);
  elsif (select count(*) from pg_policies where schemaname='public' and tablename='pedidos_protetico')=4 then
    perform set_config('od008.modo','volta',true);
  else
    raise exception 'OD-008: estado do schema nao reconhecido; nenhuma fixture foi criada.';
  end if;
end;
$mode$;

-- Sem ON CONFLICT nos IDs fixos: colisao aborta, nunca reutiliza/altera dados existentes.
create temp table od008_antes on commit drop as
  select md5(coalesce(string_agg(to_jsonb(p)::text, '|' order by id),'')) as hash
  from public.pedidos_protetico p;
create temp table od008_resultados (
  caso text primary key, passou boolean not null, detalhe text not null
) on commit drop;
grant select, insert on pg_temp.od008_resultados to authenticated;

create function pg_temp.od008_assert(caso text, ok boolean, detalhe text)
returns void language sql security invoker as $fn$
  insert into pg_temp.od008_resultados values(caso,coalesce(ok,false),detalhe);
$fn$;

-- Uma escrita inesperadamente aceita e SEMPRE desfeita pela subtransacao da excecao.
-- Somente 42501 (ou zero linhas explicitamente permitido) conta como recusa correta.
create function pg_temp.od008_negado(comando text, permitir_zero boolean default false)
returns boolean language plpgsql security invoker as $fn$
declare afetadas bigint;
begin
  execute comando;
  get diagnostics afetadas = row_count;
  if afetadas=0 and (permitir_zero or current_setting('od008.modo')='volta') then
    return true;
  end if;
  raise exception using errcode='PZ001', message='OD008 escrita inesperada: reverter subtransacao';
exception
  when insufficient_privilege then return true;
  when sqlstate 'PZ001' then return false;
  when others then
    raise notice 'OD-008: recusa retornou SQLSTATE % em vez de 42501.', SQLSTATE;
    return false;
end;
$fn$;

do $temp_grants$
begin
  execute format('grant usage on schema %I to authenticated',
    (select nspname from pg_namespace where oid=pg_my_temp_schema()));
end;
$temp_grants$;
grant execute on function pg_temp.od008_assert(text,boolean,text), pg_temp.od008_negado(text,boolean) to authenticated;

insert into public.clinicas(id,nome) values
  ('b0080000-0000-4000-8000-000000000001','QA OD008 Clinica A'),('b0080000-0000-4000-8000-000000000002','QA OD008 Clinica B');

insert into auth.users(id,email) values
  ('b0080000-0000-4000-8000-000000000101','od008-pa@example.invalid'),
  ('b0080000-0000-4000-8000-000000000102','od008-pa2@example.invalid'),
  ('b0080000-0000-4000-8000-000000000103','od008-da@example.invalid'),
  ('b0080000-0000-4000-8000-000000000104','od008-sa@example.invalid'),
  ('b0080000-0000-4000-8000-000000000105','od008-aa@example.invalid'),
  ('b0080000-0000-4000-8000-000000000106','od008-pb@example.invalid'),
  ('b0080000-0000-4000-8000-000000000107','od008-db@example.invalid');
-- Trigger EFETIVO on_auth_user_created cria public.users (somente espelho).
update public.users set active_clinica_id='b0080000-0000-4000-8000-000000000001' where id in ('b0080000-0000-4000-8000-000000000101','b0080000-0000-4000-8000-000000000102','b0080000-0000-4000-8000-000000000103','b0080000-0000-4000-8000-000000000104','b0080000-0000-4000-8000-000000000105');
update public.users set active_clinica_id='b0080000-0000-4000-8000-000000000002' where id in ('b0080000-0000-4000-8000-000000000106','b0080000-0000-4000-8000-000000000107');
insert into public.dentistas(id,user_id,clinica_id,nome,role,ativo) values
  ('b0080000-0000-4000-8000-000000000201','b0080000-0000-4000-8000-000000000101','b0080000-0000-4000-8000-000000000001','QA OD008 PA','protetico',true),
  ('b0080000-0000-4000-8000-000000000202','b0080000-0000-4000-8000-000000000102','b0080000-0000-4000-8000-000000000001','QA OD008 PA2','protetico',true),
  ('b0080000-0000-4000-8000-000000000203','b0080000-0000-4000-8000-000000000103','b0080000-0000-4000-8000-000000000001','QA OD008 DA','dentista',true),
  ('b0080000-0000-4000-8000-000000000204','b0080000-0000-4000-8000-000000000104','b0080000-0000-4000-8000-000000000001','QA OD008 SA','secretaria',true),
  ('b0080000-0000-4000-8000-000000000205','b0080000-0000-4000-8000-000000000105','b0080000-0000-4000-8000-000000000001','QA OD008 AA','admin',true),
  ('b0080000-0000-4000-8000-000000000206','b0080000-0000-4000-8000-000000000106','b0080000-0000-4000-8000-000000000002','QA OD008 PB','protetico',true),
  ('b0080000-0000-4000-8000-000000000207','b0080000-0000-4000-8000-000000000107','b0080000-0000-4000-8000-000000000002','QA OD008 DB','dentista',true);
insert into public.clinica_usuarios(id,usuario_id,clinica_id,role,status) values
  ('b0080000-0000-4000-8000-000000000301','b0080000-0000-4000-8000-000000000101','b0080000-0000-4000-8000-000000000001','protetico','ativo'),
  ('b0080000-0000-4000-8000-000000000302','b0080000-0000-4000-8000-000000000102','b0080000-0000-4000-8000-000000000001','protetico','ativo'),
  ('b0080000-0000-4000-8000-000000000303','b0080000-0000-4000-8000-000000000103','b0080000-0000-4000-8000-000000000001','dentista','ativo'),
  ('b0080000-0000-4000-8000-000000000304','b0080000-0000-4000-8000-000000000104','b0080000-0000-4000-8000-000000000001','secretaria','ativo'),
  ('b0080000-0000-4000-8000-000000000305','b0080000-0000-4000-8000-000000000105','b0080000-0000-4000-8000-000000000001','admin','ativo'),
  ('b0080000-0000-4000-8000-000000000306','b0080000-0000-4000-8000-000000000106','b0080000-0000-4000-8000-000000000002','protetico','ativo'),
  ('b0080000-0000-4000-8000-000000000307','b0080000-0000-4000-8000-000000000107','b0080000-0000-4000-8000-000000000002','dentista','ativo');
insert into public.pacientes(id,clinica_id,dentista_id,nome) values
  ('b0080000-0000-4000-8000-000000000401','b0080000-0000-4000-8000-000000000001','b0080000-0000-4000-8000-000000000203','QA OD008 Paciente A'),
  ('b0080000-0000-4000-8000-000000000402','b0080000-0000-4000-8000-000000000002','b0080000-0000-4000-8000-000000000207','QA OD008 Paciente B');
-- nome_busca e preenchido pelo trigger EFETIVO trg_pacientes_nome_busca.
insert into public.pedidos_protetico
  (id,clinica_id,protetico_id,dentista_id,paciente_id,observacao,data_entrega,status,entregue_em) values
  ('b0080000-0000-4000-8000-000000000501','b0080000-0000-4000-8000-000000000001','b0080000-0000-4000-8000-000000000201','b0080000-0000-4000-8000-000000000203','b0080000-0000-4000-8000-000000000401','QA OD008 K1',current_date+7,'pendente',null),
  ('b0080000-0000-4000-8000-000000000502','b0080000-0000-4000-8000-000000000001','b0080000-0000-4000-8000-000000000201','b0080000-0000-4000-8000-000000000203','b0080000-0000-4000-8000-000000000401','QA OD008 K2',current_date+7,'entregue',now()-interval '1 day'),
  ('b0080000-0000-4000-8000-000000000503','b0080000-0000-4000-8000-000000000001','b0080000-0000-4000-8000-000000000202','b0080000-0000-4000-8000-000000000203','b0080000-0000-4000-8000-000000000401','QA OD008 K3',current_date+7,'pendente',null),
  ('b0080000-0000-4000-8000-000000000504','b0080000-0000-4000-8000-000000000002','b0080000-0000-4000-8000-000000000206','b0080000-0000-4000-8000-000000000207','b0080000-0000-4000-8000-000000000402','QA OD008 K4',current_date+7,'pendente',null),
  ('b0080000-0000-4000-8000-000000000505','b0080000-0000-4000-8000-000000000001','b0080000-0000-4000-8000-000000000201','b0080000-0000-4000-8000-000000000203','b0080000-0000-4000-8000-000000000401','QA OD008 K5',current_date+7,'pendente',null);

reset role;
set local request.jwt.claims = '{"sub":"b0080000-0000-4000-8000-000000000101","role":"authenticated"}';
set local request.jwt.claim.sub = 'b0080000-0000-4000-8000-000000000101';
set local role authenticated;
-- Identidade PA: nao aceitar negativos obtidos com uma identidade incorreta.
do $who$ begin
  if public.get_my_role() is distinct from 'protetico'
     or public.get_my_dentista_id() is distinct from 'b0080000-0000-4000-8000-000000000201'::uuid
     or public.get_my_clinica_id() is distinct from 'b0080000-0000-4000-8000-000000000001'::uuid then
    raise exception 'OD-008: identidade PA diverge do seed; parar.';
  end if;
end; $who$;

select pg_temp.od008_assert('T01', (select array_agg(id order by id)=array['b0080000-0000-4000-8000-000000000501','b0080000-0000-4000-8000-000000000502','b0080000-0000-4000-8000-000000000505']::uuid[] from public.pedidos_protetico where id in ('b0080000-0000-4000-8000-000000000501','b0080000-0000-4000-8000-000000000502','b0080000-0000-4000-8000-000000000503','b0080000-0000-4000-8000-000000000504','b0080000-0000-4000-8000-000000000505')), 'PA ve K1/K2/K5; nao ve outro protetico nem outra clinica');

-- T02: mesmos campos e QUATRO filtros do actions.ts, com contagem exata.
do $app$
declare n bigint; ok boolean; modo text := current_setting('od008.modo');
begin
  update public.pedidos_protetico
    set status='entregue', entregue_em=clock_timestamp()
    where id='b0080000-0000-4000-8000-000000000501' and clinica_id='b0080000-0000-4000-8000-000000000001' and protetico_id='b0080000-0000-4000-8000-000000000201' and status='pendente';
  get diagnostics n=row_count;
  if modo='volta' then
    ok := n=0 and exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000501' and status='pendente' and entregue_em is null);
  else
    ok := n=1 and exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000501' and status='entregue' and entregue_em is not null);
  end if;
  perform pg_temp.od008_assert('T02',ok,'UPDATE exato do app: 1 linha na ida/antes; zero na volta segura');
  if not ok then
    raise exception 'T02: Marcar como entregue divergiu do contrato; PARAR e avisar o Orquestrador.';
  end if;
end;
$app$;

do $retry$
declare n bigint;
begin
  update public.pedidos_protetico set status='entregue', entregue_em=clock_timestamp()
    where id='b0080000-0000-4000-8000-000000000501' and clinica_id='b0080000-0000-4000-8000-000000000001' and protetico_id='b0080000-0000-4000-8000-000000000201' and status='pendente';
  get diagnostics n=row_count;
  perform pg_temp.od008_assert('T03',n=0,'repeticao nao encontra pedido pendente');
end; $retry$;
select pg_temp.od008_assert('T04', (pg_temp.od008_negado($sql$update public.pedidos_protetico set data_entrega=current_date+45 where id='b0080000-0000-4000-8000-000000000505'$sql$, false)), 'nao muda previsao');
select pg_temp.od008_assert('T05', (pg_temp.od008_negado($sql$update public.pedidos_protetico set observacao='QA OD008 alteracao proibida' where id='b0080000-0000-4000-8000-000000000505'$sql$, false)), 'nao muda observacao');
select pg_temp.od008_assert('T06', (pg_temp.od008_negado($sql$update public.pedidos_protetico set paciente_id='b0080000-0000-4000-8000-000000000402' where id='b0080000-0000-4000-8000-000000000505'$sql$, false)), 'nao muda paciente');
select pg_temp.od008_assert('T07', (pg_temp.od008_negado($sql$update public.pedidos_protetico set protetico_id='b0080000-0000-4000-8000-000000000202' where id='b0080000-0000-4000-8000-000000000505'$sql$, false)), 'nao muda responsavel; WITH CHECK antigo ja barra');

-- T08: transicao valida nao autoriza mudar NENHUM outro campo, inclusive a chave.
do $mixed$
declare comando text; ok boolean := true;
begin
  foreach comando in array array[
    $sql$update public.pedidos_protetico set status='entregue', id='b0080000-0000-4000-8000-000000000599' where id='b0080000-0000-4000-8000-000000000505'$sql$,
    $sql$update public.pedidos_protetico set status='entregue', clinica_id='b0080000-0000-4000-8000-000000000002' where id='b0080000-0000-4000-8000-000000000505'$sql$,
    $sql$update public.pedidos_protetico set status='entregue', protetico_id='b0080000-0000-4000-8000-000000000202' where id='b0080000-0000-4000-8000-000000000505'$sql$,
    $sql$update public.pedidos_protetico set status='entregue', dentista_id='b0080000-0000-4000-8000-000000000207' where id='b0080000-0000-4000-8000-000000000505'$sql$,
    $sql$update public.pedidos_protetico set status='entregue', paciente_id='b0080000-0000-4000-8000-000000000402' where id='b0080000-0000-4000-8000-000000000505'$sql$,
    $sql$update public.pedidos_protetico set status='entregue', agendamento_id='b0080000-0000-4000-8000-000000000701' where id='b0080000-0000-4000-8000-000000000505'$sql$,
    $sql$update public.pedidos_protetico set status='entregue', observacao='QA OD008 nao permitido' where id='b0080000-0000-4000-8000-000000000505'$sql$,
    $sql$update public.pedidos_protetico set status='entregue', data_entrega=current_date+45 where id='b0080000-0000-4000-8000-000000000505'$sql$,
    $sql$update public.pedidos_protetico set status='entregue', created_at=now()-interval '10 days' where id='b0080000-0000-4000-8000-000000000505'$sql$
  ] loop
    if not pg_temp.od008_negado(comando) then ok := false; end if;
  end loop;
  perform pg_temp.od008_assert('T08',ok,'entrega junto com coluna protegida e recusada com 42501');
end; $mixed$;
select pg_temp.od008_assert('T09', (pg_temp.od008_negado($sql$update public.pedidos_protetico set status='pendente' where id='b0080000-0000-4000-8000-000000000502'$sql$, false)), 'nao desfaz entrega');

do $clock$
declare n bigint; ok boolean;
begin
  update public.pedidos_protetico set status='entregue', entregue_em='2000-01-01T00:00:00Z', updated_at='2000-01-01T00:00:00Z'
    where id='b0080000-0000-4000-8000-000000000505' and clinica_id='b0080000-0000-4000-8000-000000000001' and protetico_id='b0080000-0000-4000-8000-000000000201' and status='pendente';
  get diagnostics n=row_count;
  if current_setting('od008.modo')='volta' then
    ok := n=0 and exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000505' and status='pendente' and entregue_em is null);
  else
    ok := n=1 and exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000505' and status='entregue' and entregue_em=now() and updated_at=now());
  end if;
  perform pg_temp.od008_assert('T10',ok,'hora do servidor vence a fornecida; na volta UPDATE nao grava');
end; $clock$;
select pg_temp.od008_assert('T11', (pg_temp.od008_negado($sql$delete from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000501'$sql$, true) and exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000501')), 'PA nao apaga K1 e a linha continua existindo');
select pg_temp.od008_assert('T12', (pg_temp.od008_negado($sql$insert into public.pedidos_protetico(id,clinica_id,protetico_id,dentista_id,paciente_id,observacao,data_entrega) values('b0080000-0000-4000-8000-000000000512','b0080000-0000-4000-8000-000000000001','b0080000-0000-4000-8000-000000000201','b0080000-0000-4000-8000-000000000203','b0080000-0000-4000-8000-000000000401','QA OD008 criado',current_date+7)$sql$, false)), 'PA nao cria pedido para si');

reset role;
set local request.jwt.claims = '{"sub":"b0080000-0000-4000-8000-000000000102","role":"authenticated"}';
set local request.jwt.claim.sub = 'b0080000-0000-4000-8000-000000000102';
set local role authenticated;
-- Identidade PA2: nao aceitar negativos obtidos com uma identidade incorreta.
do $who$ begin
  if public.get_my_role() is distinct from 'protetico'
     or public.get_my_dentista_id() is distinct from 'b0080000-0000-4000-8000-000000000202'::uuid
     or public.get_my_clinica_id() is distinct from 'b0080000-0000-4000-8000-000000000001'::uuid then
    raise exception 'OD-008: identidade PA2 diverge do seed; parar.';
  end if;
end; $who$;

select pg_temp.od008_assert('T13', (not exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000501') and pg_temp.od008_negado($sql$update public.pedidos_protetico set status='entregue' where id='b0080000-0000-4000-8000-000000000501'$sql$, true)), 'PA2 nao ve nem atualiza K1 de PA');

reset role;
set local request.jwt.claims = '{"sub":"b0080000-0000-4000-8000-000000000106","role":"authenticated"}';
set local request.jwt.claim.sub = 'b0080000-0000-4000-8000-000000000106';
set local role authenticated;
-- Identidade PB: nao aceitar negativos obtidos com uma identidade incorreta.
do $who$ begin
  if public.get_my_role() is distinct from 'protetico'
     or public.get_my_dentista_id() is distinct from 'b0080000-0000-4000-8000-000000000206'::uuid
     or public.get_my_clinica_id() is distinct from 'b0080000-0000-4000-8000-000000000002'::uuid then
    raise exception 'OD-008: identidade PB diverge do seed; parar.';
  end if;
end; $who$;

select pg_temp.od008_assert('T14', (not exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000501') and pg_temp.od008_negado($sql$update public.pedidos_protetico set status='entregue' where id='b0080000-0000-4000-8000-000000000501'$sql$, true) and pg_temp.od008_negado($sql$delete from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000501'$sql$, true)), 'PB nao ve/atualiza/apaga K1 da clinica A');

reset role;
set local request.jwt.claims = '{"sub":"b0080000-0000-4000-8000-000000000103","role":"authenticated"}';
set local request.jwt.claim.sub = 'b0080000-0000-4000-8000-000000000103';
set local role authenticated;
-- Identidade DA: nao aceitar negativos obtidos com uma identidade incorreta.
do $who$ begin
  if public.get_my_role() is distinct from 'dentista'
     or public.get_my_dentista_id() is distinct from 'b0080000-0000-4000-8000-000000000203'::uuid
     or public.get_my_clinica_id() is distinct from 'b0080000-0000-4000-8000-000000000001'::uuid then
    raise exception 'OD-008: identidade DA diverge do seed; parar.';
  end if;
end; $who$;

select pg_temp.od008_assert('T15', (select array_agg(id order by id)=array['b0080000-0000-4000-8000-000000000501','b0080000-0000-4000-8000-000000000502','b0080000-0000-4000-8000-000000000503','b0080000-0000-4000-8000-000000000505']::uuid[] from public.pedidos_protetico where id in ('b0080000-0000-4000-8000-000000000501','b0080000-0000-4000-8000-000000000502','b0080000-0000-4000-8000-000000000503','b0080000-0000-4000-8000-000000000504','b0080000-0000-4000-8000-000000000505')), 'DA ve quatro da A e nao ve K4 da B');

do $dentist$
declare novo uuid; n bigint;
begin
  insert into public.pedidos_protetico(id,clinica_id,protetico_id,dentista_id,paciente_id,observacao,data_entrega) values('b0080000-0000-4000-8000-000000000516','b0080000-0000-4000-8000-000000000001','b0080000-0000-4000-8000-000000000201','b0080000-0000-4000-8000-000000000203','b0080000-0000-4000-8000-000000000401','QA OD008 criado',current_date+7) returning id into novo;
  perform pg_temp.od008_assert('T16',novo='b0080000-0000-4000-8000-000000000516'::uuid,'DA cria com RETURNING id, como INSERT select da Agenda');
  update public.pedidos_protetico set data_entrega=current_date+14, observacao='QA OD008 equipe altera' where id='b0080000-0000-4000-8000-000000000516';
  get diagnostics n=row_count;
  perform pg_temp.od008_assert('T17',n=1 and exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000516' and data_entrega=current_date+14 and observacao='QA OD008 equipe altera'),'DA continua editando data e observacao');
end; $dentist$;

reset role;
set local request.jwt.claims = '{"sub":"b0080000-0000-4000-8000-000000000104","role":"authenticated"}';
set local request.jwt.claim.sub = 'b0080000-0000-4000-8000-000000000104';
set local role authenticated;
-- Identidade SA: nao aceitar negativos obtidos com uma identidade incorreta.
do $who$ begin
  if public.get_my_role() is distinct from 'secretaria'
     or public.get_my_dentista_id() is distinct from 'b0080000-0000-4000-8000-000000000204'::uuid
     or public.get_my_clinica_id() is distinct from 'b0080000-0000-4000-8000-000000000001'::uuid then
    raise exception 'OD-008: identidade SA diverge do seed; parar.';
  end if;
end; $who$;


do $secretary$
declare novo uuid; n bigint; visiveis bigint;
begin
  select count(*) into visiveis from public.pedidos_protetico where id in ('b0080000-0000-4000-8000-000000000501','b0080000-0000-4000-8000-000000000502','b0080000-0000-4000-8000-000000000503','b0080000-0000-4000-8000-000000000505','b0080000-0000-4000-8000-000000000516');
  insert into public.pedidos_protetico(id,clinica_id,protetico_id,dentista_id,paciente_id,observacao,data_entrega) values('b0080000-0000-4000-8000-000000000518','b0080000-0000-4000-8000-000000000001','b0080000-0000-4000-8000-000000000201','b0080000-0000-4000-8000-000000000203','b0080000-0000-4000-8000-000000000401','QA OD008 criado',current_date+7) returning id into novo;
  update public.pedidos_protetico set data_entrega=current_date+15, observacao='QA OD008 secretaria altera' where id='b0080000-0000-4000-8000-000000000518';
  get diagnostics n=row_count;
  perform pg_temp.od008_assert('T18',visiveis=5 and novo='b0080000-0000-4000-8000-000000000518'::uuid and n=1 and exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000518' and data_entrega=current_date+15 and observacao='QA OD008 secretaria altera'),'SA continua vendo, criando e editando pedidos');
end; $secretary$;

reset role;
set local request.jwt.claims = '{"sub":"b0080000-0000-4000-8000-000000000105","role":"authenticated"}';
set local request.jwt.claim.sub = 'b0080000-0000-4000-8000-000000000105';
set local role authenticated;
-- Identidade AA: nao aceitar negativos obtidos com uma identidade incorreta.
do $who$ begin
  if public.get_my_role() is distinct from 'admin'
     or public.get_my_dentista_id() is distinct from 'b0080000-0000-4000-8000-000000000205'::uuid
     or public.get_my_clinica_id() is distinct from 'b0080000-0000-4000-8000-000000000001'::uuid then
    raise exception 'OD-008: identidade AA diverge do seed; parar.';
  end if;
end; $who$;


do $admin$
declare n bigint;
begin
  delete from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000518';
  get diagnostics n=row_count;
  perform pg_temp.od008_assert('T19',n=1 and not exists(select 1 from public.pedidos_protetico where id='b0080000-0000-4000-8000-000000000518'),'AA apaga somente o pedido sintetico criado pela SA');
end; $admin$;

reset role;
set local request.jwt.claims = '{"sub":"b0080000-0000-4000-8000-000000000107","role":"authenticated"}';
set local request.jwt.claim.sub = 'b0080000-0000-4000-8000-000000000107';
set local role authenticated;
-- Identidade DB: nao aceitar negativos obtidos com uma identidade incorreta.
do $who$ begin
  if public.get_my_role() is distinct from 'dentista'
     or public.get_my_dentista_id() is distinct from 'b0080000-0000-4000-8000-000000000207'::uuid
     or public.get_my_clinica_id() is distinct from 'b0080000-0000-4000-8000-000000000002'::uuid then
    raise exception 'OD-008: identidade DB diverge do seed; parar.';
  end if;
end; $who$;

select pg_temp.od008_assert('T20', (not exists(select 1 from public.pedidos_protetico where id in ('b0080000-0000-4000-8000-000000000501','b0080000-0000-4000-8000-000000000502','b0080000-0000-4000-8000-000000000503','b0080000-0000-4000-8000-000000000505'))), 'DB nao ve os pedidos da clinica A');

reset role;
set local request.jwt.claims = '{}';
set local request.jwt.claim.sub = '';
select pg_temp.od008_assert('T21', (select count(*)=4 and count(distinct cmd)=4 and bool_and(cmd in ('SELECT','INSERT','UPDATE','DELETE') and roles::text[]=array['authenticated']) from pg_policies where schemaname='public' and tablename='pedidos_protetico'), 'exatamente quatro policies, uma por comando, sem ALL');
select pg_temp.od008_assert('T22', (not exists(select 1 from pg_policies where schemaname='public' and tablename='pedidos_protetico' and policyname='pedidos_protetico_access')), 'policy ALL antiga nao existe');
select pg_temp.od008_assert('PRESERVACAO', ((select hash from pg_temp.od008_antes) = (select md5(coalesce(string_agg(to_jsonb(p)::text,'|' order by id),'')) from public.pedidos_protetico p where id not in ('b0080000-0000-4000-8000-000000000501','b0080000-0000-4000-8000-000000000502','b0080000-0000-4000-8000-000000000503','b0080000-0000-4000-8000-000000000504','b0080000-0000-4000-8000-000000000505','b0080000-0000-4000-8000-000000000516','b0080000-0000-4000-8000-000000000518'))), 'todos os pedidos anteriores ao seed continuam identicos');

select current_setting('od008.modo') as modo, caso,
       case when passou then 'PASSA' else 'NAO PASSA' end as resultado, detalhe
from pg_temp.od008_resultados order by caso;

do $summary$
declare falhas integer;
begin
  select count(*) into falhas from pg_temp.od008_resultados where not passou;
  if (select count(*) from pg_temp.od008_resultados where caso ~ '^T[0-9]{2}$') <> 22 then
    raise exception 'OD-008: cobertura incompleta de T01-T22.';
  end if;
  if falhas > 0 then
    raise exception 'OD-008: % falhas no modo %. Reverter transacao e revisar a tabela de resultados.', falhas, current_setting('od008.modo');
  end if;
  raise notice 'OD-008 OK: T01-T22 e preservacao, modo %. Nenhum dado sera persistido.', current_setting('od008.modo');
end; $summary$;

rollback;
