-- OD-015b1, somente odonto-qa uhuxteswtvgdnlixwrdu. NÃO executado pelo Dev.
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
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000047','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','realizado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,'e015b100-0000-4000-8000-000000000012','2026-10-24');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000048','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','realizado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,null,'2026-10-24');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado,created_at,assinatura_id,encaminhado_para,realizado_em) values ('e015b100-0000-4000-8000-000000000049','e015b100-0000-4000-8000-000000000001','e015b100-0000-4000-8000-000000000031','e015b100-0000-4000-8000-000000000011','e015b100-0000-4000-8000-000000000032','endodontia','realizado','clinica','boca','{}','sessao_atual','2026-10-21T12:00:00Z',null,'e015b100-0000-4000-8000-000000000012','2026-10-24');
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
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000023","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P1 Sara RPC', $q$select public.assinar_procedimentos(array['e015b100-0000-4000-8000-000000000046'::uuid],'OD015 sintetico','qa/od015/assinatura-nova') is not null$q$);
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000021","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P1 CRO e autor persistidos', $q$select s.dentista_id='e015b100-0000-4000-8000-000000000011'::uuid and s.cro_no_ato='QA-ANA' from public.odontograma_eventos e join public.assinaturas s on s.id=e.assinatura_id where e.id='e015b100-0000-4000-8000-000000000046'$q$);
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000022","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P2 Carlos assina encaminhado', $q$select public.assinar_procedimentos(array['e015b100-0000-4000-8000-000000000047'::uuid],'OD015 sintetico','qa/od015/assinatura-nova') is not null$q$);
select pg_temp.verificar('P2 CRO autor encaminhado', $q$select s.dentista_id='e015b100-0000-4000-8000-000000000012'::uuid and s.cro_no_ato='QA-CARLOS' from public.odontograma_eventos e join public.assinaturas s on s.id=e.assinatura_id where e.id='e015b100-0000-4000-8000-000000000047'$q$);
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000021","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('P3 autores misturados', $q$select public.assinar_procedimentos(array['e015b100-0000-4000-8000-000000000048'::uuid,'e015b100-0000-4000-8000-000000000049'::uuid],'OD015 sintetico','qa/od015/misto')$q$, 'autores_diferentes');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000024","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('P4 protetico', $q$select public.assinar_procedimentos(array['e015b100-0000-4000-8000-000000000048'::uuid],'OD015 sintetico','qa/od015/assinatura-nova')$q$, 'sem_permissao');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000025","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('P4 Bruno outra clinica', $q$select public.assinar_procedimentos(array['e015b100-0000-4000-8000-000000000048'::uuid],'OD015 sintetico','qa/od015/assinatura-nova')$q$, 'status_invalido');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000022","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('P4 colega nao autor', $q$select public.assinar_procedimentos(array['e015b100-0000-4000-8000-000000000048'::uuid],'OD015 sintetico','qa/od015/assinatura-nova')$q$, 'sem_permissao');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000023","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('P4 repeticao assinatura', $q$select public.assinar_procedimentos(array['e015b100-0000-4000-8000-000000000046'::uuid],'OD015 sintetico','qa/od015/assinatura-nova')$q$, 'status_invalido');
select pg_temp.recusar('P4 lote vazio', $q$select public.assinar_procedimentos('{}'::uuid[],'OD015 sintetico','qa/od015/vazio')$q$, 'status_invalido');
reset role;
set local request.jwt.claims = '{"sub":"e015b100-0000-4000-8000-000000000021","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P3 P4 zero assinatura nos negativos', $q$select count(*)=2 and bool_and(assinatura_id is null) from public.odontograma_eventos where id in ('e015b100-0000-4000-8000-000000000048','e015b100-0000-4000-8000-000000000049')$q$);
select pg_temp.verificar('P3 P4 total assinaturas esperado', $q$select count(*)=3 from public.assinaturas where ficha_id='e015b100-0000-4000-8000-000000000032'$q$);
select pg_temp.verificar('P4 linhas antigas preservadas', $q$select count(*)=2 and bool_and(a.hash=md5(to_jsonb(e)::text)) from od015_antes a join public.odontograma_eventos e using(id)$q$);
select pg_temp.verificar('P4 ACL padrao preservada', $q$select not anon and authenticated and service_role from od015_acl$q$);
reset role;
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
