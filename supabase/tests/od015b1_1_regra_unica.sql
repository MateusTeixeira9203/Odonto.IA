-- OD-015b1, somente odonto-qa uhuxteswtvgdnlixwrdu. NÃO executado pelo Dev.
-- M1: 20261025022100_od015b1_1_regra_unica.sql e rollback homônimo.
-- Conectar explicitamente ao QA como postgres. Antes do arquivo, na MESMA sessão:
-- SET odonto.qa_project_ref = 'uhuxteswtvgdnlixwrdu';
-- A variável é confirmação operacional; conferir host/ref na conexão também.
-- Fixture inteiramente sintética e descartável. Rodar arquivo inteiro; não selecionar só o seed.
-- Antes -> depois -> rollback da migração -> depois da reaplicação, pelo Orquestrador.
-- SQL simula identidades com SET LOCAL ROLE authenticated + claims (padrão matriz_acesso_clinico).
-- Não substitui o teste por sessões Auth reais, a cargo do QA.
begin;
do $guard$
begin
  if current_setting('odonto.qa_project_ref', true) is distinct from 'uhuxteswtvgdnlixwrdu' then
    raise exception 'Confirmar conexão odonto-qa e definir odonto.qa_project_ref antes do teste';
  end if;
end;
$guard$;
create temp table od015_resultados (caso text, passou boolean, detalhe text);
grant select, insert on od015_resultados to authenticated;
create function pg_temp.verificar(caso text, consulta text) returns void language plpgsql as $test$
declare ok boolean;
begin
  begin
    execute consulta into ok;
    insert into od015_resultados values (caso, coalesce(ok,false), null);
  exception when others then
    insert into od015_resultados values (caso, false, sqlstate || ': ' || sqlerrm);
  end;
end;
$test$;
create function pg_temp.recusar(caso text, comando text, esperado text) returns void language plpgsql as $test$
declare mensagem text;
begin
  begin
    execute comando;
    -- Força subtransação a desfazer até uma aceitação indevida, isolando os outros casos.
    raise exception using message = '__OD015_ACEITOU__';
  exception when others then
    mensagem := sqlerrm;
  end;
  insert into od015_resultados values (caso, mensagem = esperado, mensagem);
end;
$test$;
insert into public.clinicas(id,nome) values ('e015b100-0000-4000-8000-000000000001','OD015 clinica sintetica A'),('e015b100-0000-4000-8000-000000000002','OD015 clinica sintetica B');
insert into auth.users(id,email) values
 ('e015b100-0000-4000-8000-000000000021','od015-ana@example.invalid'),('e015b100-0000-4000-8000-000000000022','od015-carlos@example.invalid'),
 ('e015b100-0000-4000-8000-000000000023','od015-sara@example.invalid'),('e015b100-0000-4000-8000-000000000024','od015-protetico@example.invalid'),('e015b100-0000-4000-8000-000000000025','od015-bruno@example.invalid');
insert into public.users(id,email) values
 ('e015b100-0000-4000-8000-000000000021','od015-ana@example.invalid'),('e015b100-0000-4000-8000-000000000022','od015-carlos@example.invalid'),
 ('e015b100-0000-4000-8000-000000000023','od015-sara@example.invalid'),('e015b100-0000-4000-8000-000000000024','od015-protetico@example.invalid'),('e015b100-0000-4000-8000-000000000025','od015-bruno@example.invalid')
on conflict(id) do nothing;
update public.users set active_clinica_id='e015b100-0000-4000-8000-000000000001' where id in ('e015b100-0000-4000-8000-000000000021','e015b100-0000-4000-8000-000000000022','e015b100-0000-4000-8000-000000000023','e015b100-0000-4000-8000-000000000024');
update public.users set active_clinica_id='e015b100-0000-4000-8000-000000000002' where id='e015b100-0000-4000-8000-000000000025';
insert into public.dentistas(id,clinica_id,user_id,nome,role,ativo,cro) values
 ('e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000021','OD015 Ana','dentista',true,'QA-ANA'),
 ('e015b100-0000-4000-8000-000000000012','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000022','OD015 Carlos','dentista',true,'QA-CARLOS'),
 ('e015b100-0000-4000-8000-000000000013','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000023','OD015 Sara','secretaria',true,null),
 ('e015b100-0000-4000-8000-000000000014','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000024','OD015 Protetico','protetico',true,null),
 ('e015b100-0000-4000-8000-000000000015','e015b100-0000-4000-8000-000000000002','e015b100-0000-4000-8000-000000000025','OD015 Bruno','dentista',true,'QA-BRUNO');
insert into public.clinica_usuarios(usuario_id,clinica_id,role,status) values
 ('e015b100-0000-4000-8000-000000000021','e015b100-0000-4000-8000-000000000001','dentista','ativo'),('e015b100-0000-4000-8000-000000000022','e015b100-0000-4000-8000-000000000001','dentista','ativo'),
 ('e015b100-0000-4000-8000-000000000023','e015b100-0000-4000-8000-000000000001','secretaria','ativo'),('e015b100-0000-4000-8000-000000000024','e015b100-0000-4000-8000-000000000001','protetico','ativo'),('e015b100-0000-4000-8000-000000000025','e015b100-0000-4000-8000-000000000002','dentista','ativo');
insert into public.pacientes(id,clinica_id,dentista_id,nome) values ('e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000011','OD015 paciente sintetico');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,queixa_principal,assinado_em,assinatura_url)
values ('e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','OD015 fixture','2026-10-20T12:00:00Z','qa/od015/ficha');
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado)
values ('e015b100-0000-4000-8000-000000000033','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000033','2026-10-24','ficha','preparando');
insert into public.assinaturas(id,clinica_id,paciente_id,tipo,ficha_id,dentista_id,assinado_por,cro_no_ato,assinatura_ref)
values ('e015b100-0000-4000-8000-000000000052','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','procedimentos','e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000011','OD015 sintetico','QA-ANA','qa/od015/assinatura');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000041','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','indicado','clinica','boca','{}','sessao_atual','2026-10-20T12:00:00Z',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000042','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','realizado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z','e015b100-0000-4000-8000-000000000052',null,'2026-10-24');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000043','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','indicado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000044','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','indicado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000045','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','indicado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000046','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','realizado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,null,'2026-10-24');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000047','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','realizado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,null,'2026-10-24');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000048','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','realizado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,null,'2026-10-24');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000049','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','realizado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,null,'2026-10-24');
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,dentista_id,data,texto,created_at)
values ('e015b100-0000-4000-8000-000000000051','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000011','2026-10-20','OD015 E0','2026-10-20T12:00:00Z');
insert into public.atendimento_eventos(clinica_id,atendimento_id,evento_id,papel) values ('e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000033','e015b100-0000-4000-8000-000000000045','registrado');
create temp table od015_antes as
select id,md5(to_jsonb(e)::text) hash from public.odontograma_eventos e where id in ('e015b100-0000-4000-8000-000000000041','e015b100-0000-4000-8000-000000000042');
create temp table od015_acl as select
 has_function_privilege('anon','public.assinar_procedimentos(uuid[],text,text)','execute') anon,
 has_function_privilege('authenticated','public.assinar_procedimentos(uuid[],text,text)','execute') authenticated,
 has_function_privilege('service_role','public.assinar_procedimentos(uuid[],text,text)','execute') service_role;
grant select on od015_antes,od015_acl to authenticated;
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000021","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('RU1 inserir novo direto', $q$with gravado as (insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces) values ('e015b100-0000-4000-8000-000000000061','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','profilaxia','indicado','clinica','boca','{}') returning id) select count(*)=1 from gravado$q$);
select pg_temp.verificar('RU1 RPC adicionar novo', $q$select public.adicionar_procedimentos_ficha('e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000090','[{"id":"e015b100-0000-4000-8000-000000000062","clinica_id":"e015b100-0000-4000-8000-000000000001","paciente_id":"e015b100-0000-4000-8000-000000000031","dentista_id":"e015b100-0000-4000-8000-000000000011","ficha_id":"e015b100-0000-4000-8000-000000000032","tipo":"endodontia","status":"indicado","origem":"clinica","momento_planejado":"sessao_atual","nivel":"boca","faces":[],"observacao":null,"realizado_em":null}]'::jsonb) = array['e015b100-0000-4000-8000-000000000062'::uuid]$q$);
select pg_temp.verificar('RU1 RPC salvar novo', $q$with chamada as materialized (select public.salvar_eventos_odontograma('e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','[{"id":"e015b100-0000-4000-8000-000000000063","clinica_id":"e015b100-0000-4000-8000-000000000001","paciente_id":"e015b100-0000-4000-8000-000000000031","dentista_id":"e015b100-0000-4000-8000-000000000011","ficha_id":"e015b100-0000-4000-8000-000000000032","tipo":"endodontia","status":"indicado","origem":"clinica","momento_planejado":"sessao_atual","nivel":"boca","faces":[],"observacao":null,"realizado_em":null}]'::jsonb,false)) select count(*)=1 from chamada$q$);
select pg_temp.verificar('RU2 alterar P0 negado', $q$with alterado as (update public.odontograma_eventos set observacao='indevido' where id='e015b100-0000-4000-8000-000000000041' returning id) select count(*)=0 from alterado$q$);
select pg_temp.recusar('RU2 RPC salvar P0', $q$select public.salvar_eventos_odontograma('e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','[{"id":"e015b100-0000-4000-8000-000000000041","clinica_id":"e015b100-0000-4000-8000-000000000001","paciente_id":"e015b100-0000-4000-8000-000000000031","dentista_id":"e015b100-0000-4000-8000-000000000011","ficha_id":"e015b100-0000-4000-8000-000000000032","tipo":"endodontia","status":"indicado","origem":"clinica","momento_planejado":"sessao_atual","nivel":"boca","faces":[],"observacao":null,"realizado_em":null}]'::jsonb,false)$q$, 'ficha_assinada');
select pg_temp.verificar('RU3 apagar P0 negado', $q$with apagado as (delete from public.odontograma_eventos where id='e015b100-0000-4000-8000-000000000041' returning id) select count(*)=0 from apagado$q$);
select pg_temp.recusar('RU3 RPC excluir P0', $q$select public.excluir_evento_odontograma('e015b100-0000-4000-8000-000000000041')$q$, 'registro_bloqueado');
select pg_temp.recusar('RU4 marca B trigger', $q$update public.odontograma_eventos set observacao='indevido' where id='e015b100-0000-4000-8000-000000000042'$q$, 'evento_assinado_imutavel');
select pg_temp.verificar('RU5 alterar PN', $q$with alterado as (update public.odontograma_eventos set observacao='OD015 alterado' where id='e015b100-0000-4000-8000-000000000043' returning id) select count(*)=1 from alterado$q$);
select pg_temp.verificar('RU5 editar detalhes PN', $q$with chamada as materialized (select public.editar_detalhes_evento_odontograma('e015b100-0000-4000-8000-000000000043','{"qa":true}'::jsonb,true)) select count(*)=1 from chamada$q$);
select pg_temp.verificar('RU5 excluir PN', $q$with chamada as materialized (select public.excluir_evento_odontograma('e015b100-0000-4000-8000-000000000043')) select count(*)=1 from chamada$q$);
select pg_temp.verificar('RU5 exclusao persistida na transacao', $q$select not exists(select 1 from public.odontograma_eventos where id='e015b100-0000-4000-8000-000000000043')$q$);
select pg_temp.verificar('RU5 retirar item novo', $q$with chamada as materialized (select public.retirar_evento_ficha_orcamento('e015b100-0000-4000-8000-000000000044')) select count(*)=1 from chamada$q$);
select pg_temp.recusar('RU5 retirar P0', $q$select public.retirar_evento_ficha_orcamento('e015b100-0000-4000-8000-000000000041')$q$, 'registro_bloqueado');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000022","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('RU6 Carlos inserir na ficha Ana', $q$select public.adicionar_procedimentos_ficha('e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000090','[{"id":"e015b100-0000-4000-8000-000000000064","clinica_id":"e015b100-0000-4000-8000-000000000001","paciente_id":"e015b100-0000-4000-8000-000000000031","dentista_id":"e015b100-0000-4000-8000-000000000012","ficha_id":"e015b100-0000-4000-8000-000000000032","tipo":"endodontia","status":"indicado","origem":"clinica","momento_planejado":"sessao_atual","nivel":"boca","faces":[],"observacao":null,"realizado_em":null}]'::jsonb)$q$, 'sem_permissao');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000023","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('RU7 Sara inserir', $q$select public.adicionar_procedimentos_ficha('e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000090','[{"id":"e015b100-0000-4000-8000-000000000065","clinica_id":"e015b100-0000-4000-8000-000000000001","paciente_id":"e015b100-0000-4000-8000-000000000031","dentista_id":"e015b100-0000-4000-8000-000000000013","ficha_id":"e015b100-0000-4000-8000-000000000032","tipo":"endodontia","status":"indicado","origem":"clinica","momento_planejado":"sessao_atual","nivel":"boca","faces":[],"observacao":null,"realizado_em":null}]'::jsonb)$q$, 'sem_permissao');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000021","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('RU8 sincronizar ficha A', $q$select public.salvar_eventos_odontograma('e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','[{"id":"e015b100-0000-4000-8000-000000000066","clinica_id":"e015b100-0000-4000-8000-000000000001","paciente_id":"e015b100-0000-4000-8000-000000000031","dentista_id":"e015b100-0000-4000-8000-000000000011","ficha_id":"e015b100-0000-4000-8000-000000000032","tipo":"endodontia","status":"indicado","origem":"clinica","momento_planejado":"sessao_atual","nivel":"boca","faces":[],"observacao":null,"realizado_em":null}]'::jsonb,true)$q$, 'ficha_assinada');
select pg_temp.verificar('RU9 leitura original preservada', $q$select count(*)=2 from pg_policies where schemaname='public' and tablename='odontograma_eventos' and ((policyname='odontograma_eventos_select' and cmd='SELECT' and regexp_replace(qual, '\s+', ' ', 'g')=regexp_replace($policy$(belongs_to_active_clinic(clinica_id) AND is_clinic_staff())$policy$, '\s+', ' ', 'g')) or (policyname='odontograma_eventos_select_own' and cmd='SELECT' and regexp_replace(qual, '\s+', ' ', 'g')=regexp_replace($policy$(belongs_to_active_clinic(clinica_id) AND (dentista_id = get_my_dentista_id()) AND (NOT (EXISTS ( SELECT 1
   FROM fichas f
  WHERE ((f.id = odontograma_eventos.ficha_id) AND (f.assinado_em IS NOT NULL))))))$policy$, '\s+', ' ', 'g')))$q$);
select pg_temp.verificar('RU9 sem ALL de escrita', $q$select not exists(select 1 from pg_policies where schemaname='public' and tablename='odontograma_eventos' and cmd='ALL')$q$);
select pg_temp.recusar('RU10 E0 imutavel', $q$select public.editar_evolucao_clinica('e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000032',null,'e015b100-0000-4000-8000-000000000051','OD015 E0','indevido')$q$, 'evolucao_assinada');
select pg_temp.recusar('RU10 anotacoes legadas imutaveis', $q$select public.editar_evolucao_clinica('e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000032',null,null,null,'indevido')$q$, 'evolucao_assinada');
select pg_temp.verificar('RU11 inserir evolucao nova', $q$select public.editar_evolucao_clinica('e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000033',null,null,'OD015 nova') = 'OD015 nova'$q$);
select pg_temp.verificar('RU11 editar evolucao nova', $q$select public.editar_evolucao_clinica('e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000032','e015b100-0000-4000-8000-000000000033',e.id,'OD015 nova','OD015 editada')='OD015 editada' from public.ficha_evolucoes e where ficha_id='e015b100-0000-4000-8000-000000000032' and atendimento_id='e015b100-0000-4000-8000-000000000033'$q$);
select pg_temp.verificar('RU11 recarga SQL', $q$select texto='OD015 editada' from public.ficha_evolucoes where ficha_id='e015b100-0000-4000-8000-000000000032' and atendimento_id='e015b100-0000-4000-8000-000000000033'$q$);
select pg_temp.verificar('RU12 encaminhar novo', $q$with chamada as materialized (select public.encaminhar_eventos_odontograma(array['e015b100-0000-4000-8000-000000000045'::uuid],'e015b100-0000-4000-8000-000000000012')) select count(*)=1 from chamada$q$);
select pg_temp.recusar('RU12 encaminhar P0', $q$select public.encaminhar_eventos_odontograma(array['e015b100-0000-4000-8000-000000000041'::uuid],'e015b100-0000-4000-8000-000000000012')$q$, 'sem_permissao');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000022","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('RU12 destinatario detalhe novo', $q$with chamada as materialized (select public.preencher_detalhe_encaminhado('e015b100-0000-4000-8000-000000000045','{"qa":true}'::jsonb)) select count(*)=1 from chamada$q$);
select pg_temp.verificar('RU12 destinatario concluir novo', $q$with chamada as materialized (select public.concluir_evento_encaminhado(array['e015b100-0000-4000-8000-000000000045'::uuid],'realizado','2026-10-24')) select count(*)=1 from chamada$q$);
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000021","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('RU12 preserva restricao destinatario', $q$select public.editar_detalhes_evento_odontograma('e015b100-0000-4000-8000-000000000045','{}'::jsonb,true)$q$, 'sem_permissao');
select pg_temp.verificar('RU antigos preservados', $q$select count(*)=2 and bool_and(a.hash=md5(to_jsonb(e)::text)) from od015_antes a join public.odontograma_eventos e using(id)$q$);
select pg_temp.recusar('RU13 INSERT direto retroativo', $q$insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,created_at) values ('e015b100-0000-4000-8000-000000000067','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','profilaxia','indicado','clinica','boca','{}','2026-10-19T12:00:00Z')$q$, 'new row violates row-level security policy for table "odontograma_eventos"');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000022","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('RU14 Carlos INSERT direto na ficha assinada Ana', $q$insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,created_at) values ('e015b100-0000-4000-8000-000000000068','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000012','e015b100-0000-4000-8000-000000000032','profilaxia','indicado','clinica','boca','{}','2026-10-24T12:00:00Z')$q$, 'new row violates row-level security policy for table "odontograma_eventos"');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000025","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('RU helper nao revela ficha de outra clinica', $q$select not public.travado_pela_assinatura_da_ficha('e015b100-0000-4000-8000-000000000032','2026-10-19T12:00:00Z')$q$);
reset role;
select pg_temp.verificar('RU13 RU14 zero insercoes persistidas', $q$select not exists(select 1 from public.odontograma_eventos where id in ('e015b100-0000-4000-8000-000000000067','e015b100-0000-4000-8000-000000000068'))$q$);
select caso,passou,detalhe from od015_resultados order by caso;
do $resultado$
declare r record;
begin
  for r in select * from od015_resultados order by caso loop
    raise notice '%: % %', r.caso, case when r.passou then 'PASSA' else 'NAO PASSA' end, coalesce(r.detalhe,'');
  end loop;
  if exists(select 1 from od015_resultados where not passou) then
    raise exception 'OD015: testes falharam; transacao abortada, executar ROLLBACK se a sessao continuar aberta';
  end if;
end;
$resultado$;
rollback;
