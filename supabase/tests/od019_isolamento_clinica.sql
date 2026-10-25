-- OD-019 Q1-Q11: arquivo para revisao e futura execucao SOMENTE no odonto-qa.
-- NAO EXECUTADO PELO DEV. Executor externo deve validar ref uhuxteswtvgdnlixwrdu.
-- Antes M0: probes cruzados devem gravar dentro de subtransacao DESCARTADA (mostra o furo).
-- Depois M0: probes esperam 23503/constraint especifica. Modo detectado pelo catalogo.
-- Antes do cleanup SEC-B1, VALIDATE da M0 falha DE PROPOSITO; nao aplicar/testar no meio.
-- Testes nao limpam evidencias SEC-B1. Todas as fixtures d019... voltam com ROLLBACK.
-- Q6 ajustado com aval do Orquestrador: RPC efetiva recusa contexto antes do INSERT;
-- esperar evento_invalido/ficha_nao_encontrada + zero efeito, nao inventar um 23503.
-- L1-L5 sao prova Auth/app posterior a aplicacao pelo Orquestrador, NAO executada aqui:
-- L1 Bruno REST + Meu Dia x A: 23503/409 ou recusa de dominio, zero efeito.
-- L2 Ana x A: salvar/finalizar, Novo atendimento, Agenda e exclusao sinteticamente.
-- L3 Sara: Agenda/recepcao; REC-4 encaminhado continua limite da OD-015b4.
-- L4 Protetico: propria agenda; sem acesso/escrita clinica.
-- L5 Bruno x B: fluxo legitimo da clinica B; recarga e persistencia.
-- Evidencia futura: status/codigo, antes/depois/recarga; nunca cookie/token.
begin;

create temp table od019_resultados(caso text, passou boolean, detalhe text);
create temp table od019_modo(depois boolean);
insert into od019_modo select exists(select 1 from pg_constraint
 where conname='atendimentos_clinicos_paciente_mesma_clinica_fk' and conrelid='public.atendimentos_clinicos'::regclass);
grant select,insert on od019_resultados to authenticated;
grant select on od019_modo to authenticated;

create function pg_temp.caso(p_nome text, p_sql text, p_estado text default 'OK', p_constraint text default null, p_dominio text default null)
returns void language plpgsql security invoker as $fn$
declare v_estado text; v_constraint text; v_msg text;
begin
  begin
    execute p_sql;
    -- Forca rollback do probe MESMO quando o furo aceita a escrita. O resultado
    -- fica fora desta subtransacao. Os testes positivos tambem nao alteram o seed.
    raise exception using errcode='Z0019', message='probe_descartado';
  exception when others then
    get stacked diagnostics v_estado=returned_sqlstate,v_constraint=constraint_name,v_msg=message_text;
  end;
  if v_estado='Z0019' then v_estado:='OK'; end if;
  insert into od019_resultados values(p_nome,
    v_estado=p_estado and (p_constraint is null or v_constraint=p_constraint)
      and (p_dominio is null or v_msg ~ p_dominio),
    format('estado=%s esperado=%s constraint=%s',v_estado,p_estado,coalesce(v_constraint,'')));
end;
$fn$;

create function pg_temp.cruzado(p_nome text,p_sql text,p_constraint text)
returns void language plpgsql security invoker as $fn$
declare v_depois boolean;
begin
 select depois into v_depois from od019_modo;
 perform pg_temp.caso(p_nome,p_sql,case when v_depois then '23503' else 'OK' end,
   case when v_depois then p_constraint else null end);
end;
$fn$;

-- Prerequisitos: quatro identidades ficticias existentes, sem criar usuarios/segredos.
do $pre$
begin
 if (select count(*) from public.dentistas where
   (id='b0000000-0000-4000-8000-0000000000a1' and user_id='b0000000-0000-4000-8000-00000000000a' and clinica_id='b0000000-0000-4000-8000-000000000001') or
   (id='b0000000-0000-4000-8000-0000000000b1' and user_id='b0000000-0000-4000-8000-00000000000b' and clinica_id='b0000000-0000-4000-8000-000000000002') or
   (id='c0000000-0000-4000-8000-0000000000c1' and user_id='c0000000-0000-4000-8000-00000000000c' and clinica_id='b0000000-0000-4000-8000-000000000001') or
   (id='c0000000-0000-4000-8000-0000000000e2' and user_id='c0000000-0000-4000-8000-0000000000e1' and clinica_id='b0000000-0000-4000-8000-000000000001')) <> 4 then
   raise exception 'OD019: identidades QA divergentes';
 end if;
end;
$pre$;

insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD019 paciente A');
insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d0190000-0000-4000-8000-000000000102','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD019 paciente A2');
insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d0190000-0000-4000-8000-000000000103','b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-0000000000b1','OD019 paciente B');
insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d0190000-0000-4000-8000-000000000104','b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-0000000000b1','OD019 paciente B2');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status) values('d0190000-0000-4000-8000-000000000201','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','manual','aberta');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status) values('d0190000-0000-4000-8000-000000000202','b0000000-0000-4000-8000-000000000002','d0190000-0000-4000-8000-000000000103','b0000000-0000-4000-8000-0000000000b1','manual','aberta');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status) values('d0190000-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000002','d0190000-0000-4000-8000-000000000104','b0000000-0000-4000-8000-0000000000b1','manual','aberta');
insert into public.agendamentos(id,clinica_id,paciente_id,dentista_id,data_hora,created_by) values('d0190000-0000-4000-8000-000000000301','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','2026-10-25T12:00:00Z','b0000000-0000-4000-8000-0000000000a1');
insert into public.agendamentos(id,clinica_id,paciente_id,dentista_id,data_hora,created_by) values('d0190000-0000-4000-8000-000000000302','b0000000-0000-4000-8000-000000000002','d0190000-0000-4000-8000-000000000103','b0000000-0000-4000-8000-0000000000b1','2026-10-25T12:00:00Z','b0000000-0000-4000-8000-0000000000b1');

reset role;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
set local role authenticated;

select pg_temp.cruzado('Q1 visita B paciente A', $q$insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,agendamento_id,chave_idempotencia,data_atendimento,origem,estado) values('d0190000-0000-4000-8000-000000000411','b0000000-0000-4000-8000-000000000002','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000b1',null,'d0190000-0000-4000-8000-000000000411','2026-10-25','meu_dia','preparando');$q$, 'atendimentos_clinicos_paciente_mesma_clinica_fk');
select pg_temp.cruzado('Q2 visita B agendamento A', $q$insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,agendamento_id,chave_idempotencia,data_atendimento,origem,estado) values('d0190000-0000-4000-8000-000000000412','b0000000-0000-4000-8000-000000000002','d0190000-0000-4000-8000-000000000103','b0000000-0000-4000-8000-0000000000b1','d0190000-0000-4000-8000-000000000301','d0190000-0000-4000-8000-000000000412','2026-10-25','meu_dia','preparando');$q$, 'atendimentos_clinicos_agendamento_mesma_clinica_fk');
select pg_temp.cruzado('Q3 ficha B paciente A', $q$insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status) values('d0190000-0000-4000-8000-000000000211','b0000000-0000-4000-8000-000000000002','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000b1','manual','aberta');$q$, 'fichas_paciente_mesma_clinica_fk');
select pg_temp.cruzado('Q4a evento B paciente A sem ficha isola FK paciente', $q$insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado) values('d0190000-0000-4000-8000-000000000511','b0000000-0000-4000-8000-000000000002','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000b1',null,'profilaxia','indicado','clinica','boca','{}','sessao_atual');$q$, 'odontograma_eventos_paciente_mesma_clinica_fk');
select pg_temp.cruzado('Q4b evento B outro paciente da ficha B', $q$insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado) values('d0190000-0000-4000-8000-000000000512','b0000000-0000-4000-8000-000000000002','d0190000-0000-4000-8000-000000000103','b0000000-0000-4000-8000-0000000000b1','d0190000-0000-4000-8000-000000000203','profilaxia','indicado','clinica','boca','{}','sessao_atual');$q$, 'odontograma_eventos_ficha_mesmo_paciente_fk');
select pg_temp.cruzado('Q5 agendamento B paciente A', $q$insert into public.agendamentos(id,clinica_id,paciente_id,dentista_id,data_hora,created_by) values('d0190000-0000-4000-8000-000000000311','b0000000-0000-4000-8000-000000000002','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000b1','2026-10-25T12:00:00Z','b0000000-0000-4000-8000-0000000000b1');$q$, 'agendamentos_paciente_mesma_clinica_fk');
select pg_temp.caso('Q6 RPC real recusa dominio antes do INSERT', $q$select public.adicionar_procedimentos_ficha('d0190000-0000-4000-8000-000000000202','d0190000-0000-4000-8000-000000000103','d0190000-0000-4000-8000-000000000700','[{"id": "d0190000-0000-4000-8000-000000000513", "clinica_id": "b0000000-0000-4000-8000-000000000002", "paciente_id": "d0190000-0000-4000-8000-000000000101", "dentista_id": "b0000000-0000-4000-8000-0000000000b1", "ficha_id": "d0190000-0000-4000-8000-000000000202", "tipo": "profilaxia", "status": "indicado", "origem": "clinica", "momento_planejado": "sessao_atual", "nivel": "boca", "faces": [], "observacao": null, "realizado_em": null}]'::jsonb);$q$, 'P0001', null, '^(evento_invalido|ficha_nao_encontrada)$');

reset role;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.caso('Q7 fluxo Ana visita ficha evolucao RPC invoker', $q$insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,agendamento_id,chave_idempotencia,data_atendimento,origem,estado) values('d0190000-0000-4000-8000-000000000414','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','d0190000-0000-4000-8000-000000000301','d0190000-0000-4000-8000-000000000414','2026-10-25','meu_dia','preparando');insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status) values('d0190000-0000-4000-8000-000000000214','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','manual','aberta');insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto) values('d0190000-0000-4000-8000-000000000614','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000214','d0190000-0000-4000-8000-000000000414','b0000000-0000-4000-8000-0000000000a1','2026-10-25','OD019 evolucao sintetica');select public.salvar_eventos_odontograma('d0190000-0000-4000-8000-000000000214','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','[{"id": "d0190000-0000-4000-8000-000000000514", "clinica_id": "b0000000-0000-4000-8000-000000000001", "paciente_id": "d0190000-0000-4000-8000-000000000101", "dentista_id": "b0000000-0000-4000-8000-0000000000a1", "ficha_id": "d0190000-0000-4000-8000-000000000214", "tipo": "profilaxia", "status": "indicado", "origem": "clinica", "momento_planejado": "sessao_atual", "nivel": "boca", "faces": [], "observacao": null, "realizado_em": null}]'::jsonb,false);$q$, 'OK', null, null);

reset role;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}';
set local role authenticated;

select pg_temp.caso('Q8a Sara agendamento Ana paciente A', $q$insert into public.agendamentos(id,clinica_id,paciente_id,dentista_id,data_hora,created_by) values('d0190000-0000-4000-8000-000000000315','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','2026-10-25T12:00:00Z','b0000000-0000-4000-8000-0000000000a1');$q$, 'OK', null, null);
select pg_temp.cruzado('Q8b Sara paciente B', $q$insert into public.agendamentos(id,clinica_id,paciente_id,dentista_id,data_hora,created_by) values('d0190000-0000-4000-8000-000000000316','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000103','b0000000-0000-4000-8000-0000000000a1','2026-10-25T12:00:00Z','b0000000-0000-4000-8000-0000000000a1');$q$, 'agendamentos_paciente_mesma_clinica_fk');

reset role;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.caso('Q9a cascade paciente', $q$insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d0190000-0000-4000-8000-000000000109','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD019 cascade sintetico');insert into public.agendamentos(id,clinica_id,paciente_id,dentista_id,data_hora,created_by) values('d0190000-0000-4000-8000-000000000309','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000109','b0000000-0000-4000-8000-0000000000a1','2026-10-25T12:00:00Z','b0000000-0000-4000-8000-0000000000a1');insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,agendamento_id,chave_idempotencia,data_atendimento,origem,estado) values('d0190000-0000-4000-8000-000000000409','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000109','b0000000-0000-4000-8000-0000000000a1','d0190000-0000-4000-8000-000000000309','d0190000-0000-4000-8000-000000000409','2026-10-25','meu_dia','preparando');insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status) values('d0190000-0000-4000-8000-000000000209','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000109','b0000000-0000-4000-8000-0000000000a1','manual','aberta');insert into public.odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,tipo,status,origem,nivel,faces,momento_planejado) values('d0190000-0000-4000-8000-000000000509','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000109','b0000000-0000-4000-8000-0000000000a1','d0190000-0000-4000-8000-000000000209','profilaxia','indicado','clinica','boca','{}','sessao_atual');delete from public.pacientes where id='d0190000-0000-4000-8000-000000000109';do $assert$ begin if exists(select 1 from public.fichas where id='d0190000-0000-4000-8000-000000000209') or exists(select 1 from public.odontograma_eventos where id='d0190000-0000-4000-8000-000000000509') or exists(select 1 from public.atendimentos_clinicos where id='d0190000-0000-4000-8000-000000000409') or exists(select 1 from public.agendamentos where id='d0190000-0000-4000-8000-000000000309') then raise exception 'cascade nao removeu filhos'; end if; end $assert$;$q$, 'OK', null, null);
select pg_temp.caso('Q9b set null agendamento visita', $q$insert into public.agendamentos(id,clinica_id,paciente_id,dentista_id,data_hora,created_by) values('d0190000-0000-4000-8000-000000000310','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','2026-10-25T12:00:00Z','b0000000-0000-4000-8000-0000000000a1');insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,agendamento_id,chave_idempotencia,data_atendimento,origem,estado) values('d0190000-0000-4000-8000-000000000410','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','d0190000-0000-4000-8000-000000000310','d0190000-0000-4000-8000-000000000410','2026-10-25','meu_dia','preparando');delete from public.agendamentos where id='d0190000-0000-4000-8000-000000000310'; do $assert$ begin if not exists(select 1 from public.atendimentos_clinicos where id='d0190000-0000-4000-8000-000000000410' and agendamento_id is null) then raise exception 'set null nao preservou visita'; end if; end $assert$;$q$, 'OK', null, null);
select pg_temp.caso('Q9c mesma clinica permite pacientes diferentes visita-agendamento', $q$insert into public.agendamentos(id,clinica_id,paciente_id,dentista_id,data_hora,created_by) values('d0190000-0000-4000-8000-000000000317','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','2026-10-25T12:00:00Z','b0000000-0000-4000-8000-0000000000a1');insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,agendamento_id,chave_idempotencia,data_atendimento,origem,estado) values('d0190000-0000-4000-8000-000000000417','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','d0190000-0000-4000-8000-000000000317','d0190000-0000-4000-8000-000000000417','2026-10-25','meu_dia','preparando');update public.agendamentos set paciente_id='d0190000-0000-4000-8000-000000000102' where id='d0190000-0000-4000-8000-000000000317';do $assert$ begin if not exists(select 1 from public.agendamentos a join public.atendimentos_clinicos v on v.agendamento_id=a.id where a.id='d0190000-0000-4000-8000-000000000317' and a.paciente_id='d0190000-0000-4000-8000-000000000102' and v.paciente_id='d0190000-0000-4000-8000-000000000101') then raise exception 'troca legitima de paciente nao persistiu'; end if;end $assert$;$q$, 'OK', null, null);

-- M3 opcional; ausente e NAO TESTADO, nunca PASSA silencioso.
do $m3$
begin
 if to_regprocedure('public.excluir_ficha_clinica(uuid,text,text,text)') is null
   or to_regprocedure('public.descartar_atendimento_vazio(uuid)') is null then
   raise notice 'Q9 M3 NAO TESTADO: ausente; aguarda decisao, nao e pre-requisito M0';
 else
   perform pg_temp.caso('Q9d M3 excluir ficha propria', $q$
     insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status)
     values('d0190000-0000-4000-8000-000000000220','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','manual','aberta');
     select public.excluir_ficha_clinica('d0190000-0000-4000-8000-000000000220','aberta_por_engano',null,'OD019 paciente A');
     do $assert$ begin if exists(select 1 from public.fichas where id='d0190000-0000-4000-8000-000000000220') then raise exception 'M3 nao excluiu ficha'; end if; end $assert$;
   $q$);
   perform pg_temp.caso('Q9e M3 descartar visita vazia', $q$
     insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado)
     values('d0190000-0000-4000-8000-000000000420','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','d0190000-0000-4000-8000-000000000420','2026-10-25','meu_dia','preparando');
     select public.descartar_atendimento_vazio('d0190000-0000-4000-8000-000000000420');
     do $assert$ begin if exists(select 1 from public.atendimentos_clinicos where id='d0190000-0000-4000-8000-000000000420') then raise exception 'M3 nao descartou visita'; end if; end $assert$;
   $q$);
 end if;
end;
$m3$;


reset role;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
set local role authenticated;

select pg_temp.caso('Q10 Protetico nao insere ficha', $q$insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status) values('d0190000-0000-4000-8000-000000000218','b0000000-0000-4000-8000-000000000001','d0190000-0000-4000-8000-000000000101','c0000000-0000-4000-8000-0000000000e2','manual','aberta');$q$, '42501', null, null);
reset role;


do $estrutura$
declare v_depois boolean; v_count integer;
begin
 select depois into v_depois from od019_modo;
 select count(*) into v_count from pg_constraint where connamespace='public'::regnamespace
   and conname in ('atendimentos_clinicos_paciente_mesma_clinica_fk','atendimentos_clinicos_agendamento_mesma_clinica_fk','atendimentos_clinicos_dentista_mesma_clinica_fk','fichas_paciente_mesma_clinica_fk','fichas_dentista_mesma_clinica_fk','ficha_evolucoes_ficha_mesma_clinica_fk','ficha_evolucoes_atendimento_mesma_clinica_fk','ficha_evolucoes_dentista_mesma_clinica_fk','odontograma_eventos_paciente_mesma_clinica_fk','odontograma_eventos_ficha_mesmo_paciente_fk','odontograma_eventos_dentista_mesma_clinica_fk','odontograma_eventos_encaminhado_mesma_clinica_fk','agendamentos_paciente_mesma_clinica_fk','agendamentos_dentista_mesma_clinica_fk','agendamentos_criador_mesma_clinica_fk','agendamentos_atendimento_origem_mesma_clinica_fk') and contype='f' and convalidated
   and confdeltype='a' and confupdtype='a' and confmatchtype='s';
 insert into od019_resultados values('Q11 FKs16 validadas MATCH SIMPLE NO ACTION',v_count=case when v_depois then 16 else 0 end,'count='||v_count);
 select count(*) into v_count from pg_constraint where connamespace='public'::regnamespace
   and conname in ('pacientes_clinica_id_id_key','dentistas_clinica_id_id_key','agendamentos_clinica_id_id_key','fichas_clinica_id_id_key','fichas_clinica_id_id_paciente_key') and contype='u';
 insert into od019_resultados values('Q11 unicas5',v_count=case when v_depois then 5 else 0 end,'count='||v_count);
end;
$estrutura$;


insert into od019_resultados
select 'Q11 FKs simples efetivas preservadas',not exists(
 select 1 from (values ('agendamentos','agendamentos_atendimento_origem_id_fkey','FOREIGN KEY (atendimento_origem_id) REFERENCES atendimentos_clinicos(id) ON DELETE SET NULL'),('agendamentos','agendamentos_clinica_id_fkey','FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE'),('agendamentos','agendamentos_created_by_fkey','FOREIGN KEY (created_by) REFERENCES dentistas(id)'),('agendamentos','agendamentos_dentista_id_fkey','FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE CASCADE'),('agendamentos','agendamentos_paciente_id_fkey','FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE'),('atendimento_eventos','atendimento_eventos_atendimento_id_fkey','FOREIGN KEY (atendimento_id) REFERENCES atendimentos_clinicos(id) ON DELETE CASCADE'),('atendimento_eventos','atendimento_eventos_clinica_id_fkey','FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE'),('atendimento_eventos','atendimento_eventos_evento_id_fkey','FOREIGN KEY (evento_id) REFERENCES odontograma_eventos(id) ON DELETE CASCADE'),('atendimentos_clinicos','atendimentos_clinicos_agendamento_id_fkey','FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id) ON DELETE SET NULL'),('atendimentos_clinicos','atendimentos_clinicos_clinica_id_fkey','FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE'),('atendimentos_clinicos','atendimentos_clinicos_criado_por_fkey','FOREIGN KEY (criado_por) REFERENCES users(id) ON DELETE SET NULL'),('atendimentos_clinicos','atendimentos_clinicos_dentista_id_fkey','FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE CASCADE'),('atendimentos_clinicos','atendimentos_clinicos_paciente_id_fkey','FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE'),('dentistas','dentistas_clinica_id_fkey','FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE'),('dentistas','dentistas_user_id_fkey','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),('ficha_evolucoes','ficha_evolucoes_atendimento_id_fkey','FOREIGN KEY (atendimento_id) REFERENCES atendimentos_clinicos(id) ON DELETE SET NULL'),('ficha_evolucoes','ficha_evolucoes_clinica_id_fkey','FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE'),('ficha_evolucoes','ficha_evolucoes_dentista_id_fkey','FOREIGN KEY (dentista_id) REFERENCES dentistas(id)'),('ficha_evolucoes','ficha_evolucoes_ficha_id_fkey','FOREIGN KEY (ficha_id) REFERENCES fichas(id) ON DELETE CASCADE'),('fichas','fichas_clinica_id_fkey','FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE'),('fichas','fichas_dentista_id_fkey','FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE CASCADE'),('fichas','fichas_paciente_id_fkey','FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE'),('fichas','fichas_tratamento_id_fkey','FOREIGN KEY (tratamento_id) REFERENCES tratamentos(id) ON DELETE SET NULL'),('odontograma_eventos','odontograma_eventos_assinatura_id_fkey','FOREIGN KEY (assinatura_id) REFERENCES assinaturas(id) ON DELETE SET NULL'),('odontograma_eventos','odontograma_eventos_clinica_id_fkey','FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE'),('odontograma_eventos','odontograma_eventos_dentista_id_fkey','FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE CASCADE'),('odontograma_eventos','odontograma_eventos_encaminhado_para_fkey','FOREIGN KEY (encaminhado_para) REFERENCES dentistas(id) ON DELETE SET NULL'),('odontograma_eventos','odontograma_eventos_ficha_id_fkey','FOREIGN KEY (ficha_id) REFERENCES fichas(id) ON DELETE CASCADE'),('odontograma_eventos','odontograma_eventos_paciente_id_fkey','FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE'),('odontograma_eventos','odontograma_eventos_procedimento_id_fkey','FOREIGN KEY (procedimento_id) REFERENCES procedimentos(id) ON DELETE SET NULL'),('odontograma_eventos','odontograma_eventos_retirado_por_fkey','FOREIGN KEY (retirado_por) REFERENCES dentistas(id) ON DELETE SET NULL'),('pacientes','pacientes_clinica_id_fkey','FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE'),('pacientes','pacientes_dentista_id_fkey','FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE SET NULL')) as base(tabela,nome,def)
 left join pg_constraint c on c.conrelid=('public.'||base.tabela)::regclass and c.conname=base.nome
 where c.oid is null or pg_get_constraintdef(c.oid,true)<>base.def),null;


-- Antes da limpeza: count pode ser >0, isso e evidenciado, nunca limpo por este teste.
select verificacao,cruzados from (select 'C01' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C02' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.agendamentos alvo on alvo.id = origem.agendamento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C03' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.agendamentos alvo on alvo.id = origem.agendamento_id where origem.paciente_id is distinct from alvo.paciente_id
union all
select 'C04' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C05' as verificacao, count(*) as cruzados from public.fichas origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C06' as verificacao, count(*) as cruzados from public.fichas origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C07' as verificacao, count(*) as cruzados from public.ficha_evolucoes origem join public.fichas alvo on alvo.id = origem.ficha_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C08' as verificacao, count(*) as cruzados from public.ficha_evolucoes origem join public.atendimentos_clinicos alvo on alvo.id = origem.atendimento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C09' as verificacao, count(*) as cruzados from public.ficha_evolucoes origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C10' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C11' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.fichas alvo on alvo.id = origem.ficha_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C12' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C13' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.dentistas alvo on alvo.id = origem.encaminhado_para where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C14' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.fichas alvo on alvo.id = origem.ficha_id where origem.paciente_id is distinct from alvo.paciente_id
union all
select 'C15' as verificacao, count(*) as cruzados from public.atendimento_eventos origem join public.atendimentos_clinicos alvo on alvo.id = origem.atendimento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C16' as verificacao, count(*) as cruzados from public.atendimento_eventos origem join public.odontograma_eventos alvo on alvo.id = origem.evento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C17' as verificacao, count(*) as cruzados from public.agendamentos origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C18' as verificacao, count(*) as cruzados from public.agendamentos origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C19' as verificacao, count(*) as cruzados from public.agendamentos origem join public.dentistas alvo on alvo.id = origem.created_by where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C20' as verificacao, count(*) as cruzados from public.agendamentos origem join public.atendimentos_clinicos alvo on alvo.id = origem.atendimento_origem_id where origem.clinica_id is distinct from alvo.clinica_id
) c order by verificacao;
insert into od019_resultados select 'Q11 cruzados zero depois M0',
 not (select depois from od019_modo) or not exists(select 1 from (select 'C01' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C02' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.agendamentos alvo on alvo.id = origem.agendamento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C03' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.agendamentos alvo on alvo.id = origem.agendamento_id where origem.paciente_id is distinct from alvo.paciente_id
union all
select 'C04' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C05' as verificacao, count(*) as cruzados from public.fichas origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C06' as verificacao, count(*) as cruzados from public.fichas origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C07' as verificacao, count(*) as cruzados from public.ficha_evolucoes origem join public.fichas alvo on alvo.id = origem.ficha_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C08' as verificacao, count(*) as cruzados from public.ficha_evolucoes origem join public.atendimentos_clinicos alvo on alvo.id = origem.atendimento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C09' as verificacao, count(*) as cruzados from public.ficha_evolucoes origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C10' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C11' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.fichas alvo on alvo.id = origem.ficha_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C12' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C13' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.dentistas alvo on alvo.id = origem.encaminhado_para where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C14' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.fichas alvo on alvo.id = origem.ficha_id where origem.paciente_id is distinct from alvo.paciente_id
union all
select 'C15' as verificacao, count(*) as cruzados from public.atendimento_eventos origem join public.atendimentos_clinicos alvo on alvo.id = origem.atendimento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C16' as verificacao, count(*) as cruzados from public.atendimento_eventos origem join public.odontograma_eventos alvo on alvo.id = origem.evento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C17' as verificacao, count(*) as cruzados from public.agendamentos origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C18' as verificacao, count(*) as cruzados from public.agendamentos origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C19' as verificacao, count(*) as cruzados from public.agendamentos origem join public.dentistas alvo on alvo.id = origem.created_by where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C20' as verificacao, count(*) as cruzados from public.agendamentos origem join public.atendimentos_clinicos alvo on alvo.id = origem.atendimento_origem_id where origem.clinica_id is distinct from alvo.clinica_id
) c where cruzados<>0),null;
-- Q6 zero efeito e todos os probes negativos/positivos descartados por subtransacao.
insert into od019_resultados select 'Q6 zero efeito',not exists(select 1 from public.odontograma_eventos where id='d0190000-0000-4000-8000-000000000513'),null;
select case when depois then 'DEPOIS M0' else 'ANTES M0: probes comprovam FURO, nao seguranca' end as modo from od019_modo;
select caso,passou,detalhe from od019_resultados order by caso;
do $fim$
begin
 if exists(select 1 from od019_resultados where not passou) then
   raise exception 'OD019 NAO PASSA: transacao abortada; ROLLBACK se conexao continuar aberta';
 end if;
end;
$fim$;
rollback;
