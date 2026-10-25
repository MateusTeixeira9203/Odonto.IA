-- OD015M3 cleanup / 6b aprovada: SOMENTE QA, npm run qa:fixture-clean.
-- NAO executado pelo Dev. Excecao explicita: dados FINANCEIROS FICTICIOS por IDs exatos.
-- Paciente/ES PERMANENTES: e0150000-0000-4000-8000-000000000001, e0150000-0000-4000-8000-000000000104, e0150000-0000-4000-8000-000000000303, e0150000-0000-4000-8000-000000000801.
-- Nunca apagar esses quatro, nunca desligar/contornar gatilho. Linha de paciente_documentos
-- e0150000-0000-4000-8000-000000000902 permanece como acervo ficticio do paciente (storage nao foi criado).
begin;
do $trava$
begin
 if not exists(select 1 from public.pacientes where id='e0150000-0000-4000-8000-000000000001'
   and nome='Paciente Exclusao QA' and clinica_id='b0000000-0000-4000-8000-000000000001') then
   raise exception 'cleanup_fora_do_qa';
 end if;
 if not exists(select 1 from public.odontograma_eventos where id='e0150000-0000-4000-8000-000000000303'
   and ficha_id='e0150000-0000-4000-8000-000000000104' and assinatura_id='e0150000-0000-4000-8000-000000000801') then
   raise exception 'fixture_es_estado_inesperado';
 end if;
end;
$trava$;
select set_config('od015.es_hash', (select md5(jsonb_build_object('paciente',p,'ficha',f,'evento',e,'assinatura',a)::text)
 from public.pacientes p join public.fichas f on f.paciente_id=p.id
 join public.odontograma_eventos e on e.ficha_id=f.id join public.assinaturas a on a.id=e.assinatura_id
 where p.id='e0150000-0000-4000-8000-000000000001' and f.id='e0150000-0000-4000-8000-000000000104' and e.id='e0150000-0000-4000-8000-000000000303' and a.id='e0150000-0000-4000-8000-000000000801'), true);
-- Ordem exata 6b: pontes, documento, cobranca, pagamento, orcamento, fichas, visitas, auditoria.
delete from public.orcamento_eventos where evento_id in ('e0150000-0000-4000-8000-000000000301','e0150000-0000-4000-8000-000000000304');
delete from public.documentos_aceite where id in ('e0150000-0000-4000-8000-000000001002');
delete from public.orcamento_cobrancas where id in ('e0150000-0000-4000-8000-000000001101');
delete from public.pagamentos where id in ('e0150000-0000-4000-8000-000000001202');
delete from public.orcamentos where id in ('e0150000-0000-4000-8000-000000000603');
delete from public.fichas where id in ('e0150000-0000-4000-8000-000000000101','e0150000-0000-4000-8000-000000000102','e0150000-0000-4000-8000-000000000107','e0150000-0000-4000-8000-000000000108');
delete from public.atendimentos_clinicos where id in ('e0150000-0000-4000-8000-000000000201');
delete from public.prontuario_exclusoes where paciente_id='e0150000-0000-4000-8000-000000000001';
do $fim$
begin
 if exists(select 1 from public.orcamento_eventos where evento_id in ('e0150000-0000-4000-8000-000000000301','e0150000-0000-4000-8000-000000000304'))
  or exists(select 1 from public.documentos_aceite where id='e0150000-0000-4000-8000-000000001002')
  or exists(select 1 from public.orcamento_cobrancas where id='e0150000-0000-4000-8000-000000001101')
  or exists(select 1 from public.orcamento_cobranca_itens where cobranca_id='e0150000-0000-4000-8000-000000001101' and orcamento_item_id='e0150000-0000-4000-8000-000000000701')
  or exists(select 1 from public.pagamentos where id='e0150000-0000-4000-8000-000000001202')
  or exists(select 1 from public.orcamentos where id='e0150000-0000-4000-8000-000000000603')
  or exists(select 1 from public.orcamento_itens where id='e0150000-0000-4000-8000-000000000701')
  or exists(select 1 from public.assinaturas where id='e0150000-0000-4000-8000-000000000802')
  or exists(select 1 from public.fichas where id in ('e0150000-0000-4000-8000-000000000101','e0150000-0000-4000-8000-000000000102','e0150000-0000-4000-8000-000000000107','e0150000-0000-4000-8000-000000000108'))
  or exists(select 1 from public.odontograma_eventos where id in ('e0150000-0000-4000-8000-000000000301','e0150000-0000-4000-8000-000000000304'))
  or exists(select 1 from public.ficha_evolucoes where id in ('e0150000-0000-4000-8000-000000000401','e0150000-0000-4000-8000-000000000403'))
  or exists(select 1 from public.atendimentos_clinicos where id='e0150000-0000-4000-8000-000000000201')
  or exists(select 1 from public.prontuario_exclusoes where paciente_id='e0150000-0000-4000-8000-000000000001') then
   raise exception 'cleanup_fixture_remanescente';
 end if;
 if not exists(select 1 from public.pacientes p join public.fichas f on f.paciente_id=p.id
   join public.odontograma_eventos e on e.ficha_id=f.id join public.assinaturas a on a.id=e.assinatura_id
   where p.id='e0150000-0000-4000-8000-000000000001' and f.id='e0150000-0000-4000-8000-000000000104' and e.id='e0150000-0000-4000-8000-000000000303' and a.id='e0150000-0000-4000-8000-000000000801'
     and md5(jsonb_build_object('paciente',p,'ficha',f,'evento',e,'assinatura',a)::text)=current_setting('od015.es_hash')) then
   raise exception 'fixture_es_estado_inesperado';
 end if;
end;
$fim$;
commit;
