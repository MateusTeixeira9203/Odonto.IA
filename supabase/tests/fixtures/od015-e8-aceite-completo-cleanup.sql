-- OD-015 E8 EXTRA: somente QA uhuxteswtvgdnlixwrdu pelo runner que valida host.
-- Faixa PROPRIA e015e800. Nao usa e0150000/Paciente Exclusao QA/ES nem fixtures anteriores.
-- Paciente ...0001; ficha ...0108; evento ...0304; evolucao ...0403; orcamento ...0603;
-- item ...0701; assinatura ...0802; metadado ...0902; documento ...1002; cobranca ...1101; pagamento ...1202.
-- Aceite V2 completo, R$100 aprovados, cobranca R$100, pagamento PIX PAGO R$100.
-- Caminhos ficticios: nenhum binario/arquivo de storage criado; nao testar download/PDF real.
-- Nao aplicado pelo Dev. Nao ha contorno de gatilho; qualquer erro aborta a transacao inteira.
-- EXCECAO autorizada: apaga somente objetos FINANCEIROS FICTICIOS desta faixa, por IDs exatos.
-- Ordem 6b: pontes, documento, cobranca, pagamento, orcamento (itens/assinatura em cascade), ficha, auditoria.
-- Acrescenta somente metadado e paciente EXTRA desta fixture. Nunca ES/paciente permanente.
-- npm.cmd run qa:fixture-clean -- --arquivo od015-e8-aceite-completo-cleanup.sql
begin;
do $cleanup$
begin
 if not exists(select 1 from public.pacientes where id='e015e800-0000-4000-8000-000000000001') then
  if exists(select 1 from public.pacientes where id='e015e800-0000-4000-8000-000000000001')
   or exists(select 1 from public.fichas where id='e015e800-0000-4000-8000-000000000108')
   or exists(select 1 from public.odontograma_eventos where id='e015e800-0000-4000-8000-000000000304')
   or exists(select 1 from public.ficha_evolucoes where id='e015e800-0000-4000-8000-000000000403')
   or exists(select 1 from public.orcamentos where id='e015e800-0000-4000-8000-000000000603')
   or exists(select 1 from public.orcamento_itens where id='e015e800-0000-4000-8000-000000000701')
   or exists(select 1 from public.orcamento_eventos where evento_id='e015e800-0000-4000-8000-000000000304' or orcamento_id='e015e800-0000-4000-8000-000000000603')
   or exists(select 1 from public.assinaturas where id='e015e800-0000-4000-8000-000000000802')
   or exists(select 1 from public.paciente_documentos where id='e015e800-0000-4000-8000-000000000902')
   or exists(select 1 from public.documentos_aceite where id='e015e800-0000-4000-8000-000000001002')
   or exists(select 1 from public.orcamento_cobrancas where id='e015e800-0000-4000-8000-000000001101')
   or exists(select 1 from public.orcamento_cobranca_itens where cobranca_id='e015e800-0000-4000-8000-000000001101' or orcamento_item_id='e015e800-0000-4000-8000-000000000701')
   or exists(select 1 from public.pagamentos where id='e015e800-0000-4000-8000-000000001202') or exists(select 1 from public.prontuario_exclusoes where paciente_id='e015e800-0000-4000-8000-000000000001') then
   raise exception 'cleanup_e8_orfaos_sem_paciente';
  end if;
  return; -- fixture inteiramente ausente: NO-OP; pode repetir o cleanup.
 end if;
 if not exists(select 1 from public.pacientes where id='e015e800-0000-4000-8000-000000000001' and nome='Paciente E8 Aceite Completo QA' and clinica_id='b0000000-0000-4000-8000-000000000001' and dentista_id='b0000000-0000-4000-8000-0000000000a1') then
  raise exception 'cleanup_fora_do_qa';
 end if;
 if exists(select 1 from public.fichas where (id='e015e800-0000-4000-8000-000000000108') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or paciente_id is distinct from 'e015e800-0000-4000-8000-000000000001' or dentista_id is distinct from 'b0000000-0000-4000-8000-0000000000a1')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.odontograma_eventos where (id='e015e800-0000-4000-8000-000000000304') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or paciente_id is distinct from 'e015e800-0000-4000-8000-000000000001' or dentista_id is distinct from 'b0000000-0000-4000-8000-0000000000a1' or ficha_id is distinct from 'e015e800-0000-4000-8000-000000000108')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.ficha_evolucoes where (id='e015e800-0000-4000-8000-000000000403') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or dentista_id is distinct from 'b0000000-0000-4000-8000-0000000000a1' or ficha_id is distinct from 'e015e800-0000-4000-8000-000000000108')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.orcamentos where (id='e015e800-0000-4000-8000-000000000603') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or paciente_id is distinct from 'e015e800-0000-4000-8000-000000000001' or dentista_id is distinct from 'b0000000-0000-4000-8000-0000000000a1' or ficha_id is not null and ficha_id is distinct from 'e015e800-0000-4000-8000-000000000108')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.orcamento_itens where (id='e015e800-0000-4000-8000-000000000701') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or orcamento_id is distinct from 'e015e800-0000-4000-8000-000000000603')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.orcamento_eventos where (evento_id='e015e800-0000-4000-8000-000000000304' or orcamento_id='e015e800-0000-4000-8000-000000000603') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or orcamento_id is distinct from 'e015e800-0000-4000-8000-000000000603' or evento_id is distinct from 'e015e800-0000-4000-8000-000000000304' or item_id is distinct from 'e015e800-0000-4000-8000-000000000701')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.assinaturas where (id='e015e800-0000-4000-8000-000000000802') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or paciente_id is distinct from 'e015e800-0000-4000-8000-000000000001' or dentista_id is distinct from 'b0000000-0000-4000-8000-0000000000a1' or orcamento_id is distinct from 'e015e800-0000-4000-8000-000000000603')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.paciente_documentos where (id='e015e800-0000-4000-8000-000000000902') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or paciente_id is distinct from 'e015e800-0000-4000-8000-000000000001')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.documentos_aceite where (id='e015e800-0000-4000-8000-000000001002') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or paciente_id is distinct from 'e015e800-0000-4000-8000-000000000001' or dentista_id is distinct from 'b0000000-0000-4000-8000-0000000000a1' or orcamento_id is distinct from 'e015e800-0000-4000-8000-000000000603' or paciente_documento_id is distinct from 'e015e800-0000-4000-8000-000000000902' or assinatura_id is distinct from 'e015e800-0000-4000-8000-000000000802' or ficha_id is not null and ficha_id is distinct from 'e015e800-0000-4000-8000-000000000108')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.orcamento_cobrancas where (id='e015e800-0000-4000-8000-000000001101') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or paciente_id is distinct from 'e015e800-0000-4000-8000-000000000001' or dentista_id is distinct from 'b0000000-0000-4000-8000-0000000000a1' or orcamento_id is distinct from 'e015e800-0000-4000-8000-000000000603')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.orcamento_cobranca_itens where (cobranca_id='e015e800-0000-4000-8000-000000001101' or orcamento_item_id='e015e800-0000-4000-8000-000000000701') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or cobranca_id is not null and cobranca_id is distinct from 'e015e800-0000-4000-8000-000000001101' or orcamento_item_id is distinct from 'e015e800-0000-4000-8000-000000000701')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.pagamentos where (id='e015e800-0000-4000-8000-000000001202') and (clinica_id is distinct from 'b0000000-0000-4000-8000-000000000001' or paciente_id is distinct from 'e015e800-0000-4000-8000-000000000001' or dentista_id is distinct from 'b0000000-0000-4000-8000-0000000000a1' or orcamento_id is distinct from 'e015e800-0000-4000-8000-000000000603' or cobranca_id is not null and cobranca_id is distinct from 'e015e800-0000-4000-8000-000000001101')) then
  raise exception 'cleanup_e8_contexto_inesperado';
 end if;
 if exists(select 1 from public.fichas where paciente_id='e015e800-0000-4000-8000-000000000001' and not (id='e015e800-0000-4000-8000-000000000108')) then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.odontograma_eventos where paciente_id='e015e800-0000-4000-8000-000000000001' and not (id='e015e800-0000-4000-8000-000000000304')) then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.orcamentos where paciente_id='e015e800-0000-4000-8000-000000000001' and not (id='e015e800-0000-4000-8000-000000000603')) then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.assinaturas where paciente_id='e015e800-0000-4000-8000-000000000001' and not (id='e015e800-0000-4000-8000-000000000802')) then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.paciente_documentos where paciente_id='e015e800-0000-4000-8000-000000000001' and not (id='e015e800-0000-4000-8000-000000000902')) then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.documentos_aceite where paciente_id='e015e800-0000-4000-8000-000000000001' and not (id='e015e800-0000-4000-8000-000000001002')) then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.orcamento_cobrancas where paciente_id='e015e800-0000-4000-8000-000000000001' and not (id='e015e800-0000-4000-8000-000000001101')) then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.pagamentos where paciente_id='e015e800-0000-4000-8000-000000000001' and not (id='e015e800-0000-4000-8000-000000001202')) then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.ficha_evolucoes where ficha_id='e015e800-0000-4000-8000-000000000108' and id<>'e015e800-0000-4000-8000-000000000403') then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.ficha_arquivos where ficha_id='e015e800-0000-4000-8000-000000000108') then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.planejamentos where ficha_id='e015e800-0000-4000-8000-000000000108') then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.planejamento_procedimentos where paciente_id='e015e800-0000-4000-8000-000000000001') then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.atendimentos_clinicos where paciente_id='e015e800-0000-4000-8000-000000000001') then
  raise exception 'cleanup_e8_dependencia_inesperada';
 end if;
 if exists(select 1 from public.odontograma_eventos where id='e015e800-0000-4000-8000-000000000304' and (assinatura_id is not null or retirado_em is not null or encaminhado_para is not null)) then
  raise exception 'cleanup_e8_evento_protegido';
 end if;
 delete from public.orcamento_eventos where evento_id='e015e800-0000-4000-8000-000000000304' and orcamento_id='e015e800-0000-4000-8000-000000000603';
 delete from public.documentos_aceite where id='e015e800-0000-4000-8000-000000001002';
 delete from public.orcamento_cobrancas where id='e015e800-0000-4000-8000-000000001101';
 delete from public.pagamentos where id='e015e800-0000-4000-8000-000000001202';
 delete from public.orcamentos where id='e015e800-0000-4000-8000-000000000603';
 delete from public.fichas where id='e015e800-0000-4000-8000-000000000108';
 delete from public.prontuario_exclusoes where paciente_id='e015e800-0000-4000-8000-000000000001'; -- copias M3b saem pelo FK cascade
 delete from public.paciente_documentos where id='e015e800-0000-4000-8000-000000000902';
 delete from public.pacientes where id='e015e800-0000-4000-8000-000000000001';
 if exists(select 1 from public.pacientes where id='e015e800-0000-4000-8000-000000000001')
   or exists(select 1 from public.fichas where id='e015e800-0000-4000-8000-000000000108')
   or exists(select 1 from public.odontograma_eventos where id='e015e800-0000-4000-8000-000000000304')
   or exists(select 1 from public.ficha_evolucoes where id='e015e800-0000-4000-8000-000000000403')
   or exists(select 1 from public.orcamentos where id='e015e800-0000-4000-8000-000000000603')
   or exists(select 1 from public.orcamento_itens where id='e015e800-0000-4000-8000-000000000701')
   or exists(select 1 from public.orcamento_eventos where evento_id='e015e800-0000-4000-8000-000000000304' or orcamento_id='e015e800-0000-4000-8000-000000000603')
   or exists(select 1 from public.assinaturas where id='e015e800-0000-4000-8000-000000000802')
   or exists(select 1 from public.paciente_documentos where id='e015e800-0000-4000-8000-000000000902')
   or exists(select 1 from public.documentos_aceite where id='e015e800-0000-4000-8000-000000001002')
   or exists(select 1 from public.orcamento_cobrancas where id='e015e800-0000-4000-8000-000000001101')
   or exists(select 1 from public.orcamento_cobranca_itens where cobranca_id='e015e800-0000-4000-8000-000000001101' or orcamento_item_id='e015e800-0000-4000-8000-000000000701')
   or exists(select 1 from public.pagamentos where id='e015e800-0000-4000-8000-000000001202') or exists(select 1 from public.prontuario_exclusoes where paciente_id='e015e800-0000-4000-8000-000000000001') then
  raise exception 'cleanup_fixture_remanescente';
 end if;
end;
$cleanup$;
commit;
