-- OD015M3 revista +3b+6b. Somente odonto-qa, executor verifica ref uhuxteswtvgdnlixwrdu.
-- ESCRITO/NAO EXECUTADO pelo Dev. Q1-Q15 + Q16 ciclo + Q16b trava de formato.
-- Antes da M3: preflight falha explicitamente (funcoes/tabela ausentes). Nao cria M3 no QA.
-- Depois da M3: executar em janela aprovada; TODO seed/ciclo/DDL de teste termina em ROLLBACK.
-- Q16 reproduz VOLTA/REAPLICACAO dentro desta transacao, sem COMMIT/NOTIFY e sem perder auditoria.
-- Nenhum gatilho e desligado/contornado; fixtures d015... voltam somente por ROLLBACK.
-- Nenhuma chamada de quatro argumentos. r169d so tem PROBE NEGATIVO de EXECUTE, nunca chamada permissiva.
begin;
set local search_path=pg_catalog,public,pg_temp;

do $pre$
begin
 if to_regclass('public.prontuario_exclusoes') is null
  or to_regprocedure('public.excluir_ficha_clinica(uuid,text,text,text,boolean)') is null
  or to_regprocedure('public.descartar_atendimento_vazio(uuid)') is null then
   raise exception 'M3 ausente: Q1-Q16 NAO PASSAM antes da aplicacao; transacao abortada';
 end if;
end;
$pre$;
create temp table od015m3_resultados(caso text,passou boolean,detalhe text);
grant select,insert on od015m3_resultados to authenticated,anon;
create function pg_temp.verificar(p_caso text,p_sql text) returns void
language plpgsql security invoker as $fn$
declare v_ok boolean;v_estado text;
begin
 begin execute p_sql into v_ok;
 exception when others then get stacked diagnostics v_estado=returned_sqlstate;
 end;
 insert into od015m3_resultados values(p_caso,coalesce(v_ok,false),v_estado);
end;
$fn$;
create function pg_temp.executar(p_caso text,p_sql text) returns void
language plpgsql security invoker as $fn$
declare v_estado text;
begin
 begin execute p_sql;
 exception when others then get stacked diagnostics v_estado=returned_sqlstate;
 end;
 insert into od015m3_resultados values(p_caso,v_estado is null,v_estado);
end;
$fn$;
create function pg_temp.recusar(p_caso text,p_sql text,p_erro text) returns void
language plpgsql security invoker as $fn$
declare v_estado text;v_msg text;
begin
 begin
   execute p_sql;
   raise exception using errcode='Z0153',message='probe_indevidamente_aceito';
 exception when others then get stacked diagnostics v_estado=returned_sqlstate,v_msg=message_text;
 end;
 insert into od015m3_resultados values(p_caso,
  v_estado<>'Z0153' and (v_estado=p_erro or v_msg=p_erro),
  'estado='||v_estado||'; esperado='||p_erro);
end;
$fn$;


-- FASE 1: Q1-Q15 completos, fixtures independentes.

insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','Paciente Exclusao SQL');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FX','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000102','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FY','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000103','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FA','manual','aberta','2026-10-25','2026-10-25T10:00:00Z');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000104','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FS','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000105','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FD','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000106','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FP','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000107','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000d1','OD015M3 FC','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000108','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FO','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000109','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FR','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150000-0000-4000-8000-000000000110','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FE','manual','aberta','2026-10-25',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150000-0000-4000-8000-000000000201','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150000-0000-4000-8000-000000000201','2026-10-25','ficha','finalizado','2026-10-25T10:01:00Z');
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150000-0000-4000-8000-000000000202','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150000-0000-4000-8000-000000000202','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150000-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150000-0000-4000-8000-000000000203','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150000-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150000-0000-4000-8000-000000000204','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150000-0000-4000-8000-000000000205','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000d1','d0150000-0000-4000-8000-000000000205','2026-10-25','ficha','preparando',null);
insert into public.assinaturas(id,clinica_id,paciente_id,dentista_id,tipo,ficha_id,assinado_por,cro_no_ato,assinatura_ref) values('d0150000-0000-4000-8000-000000000801','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','procedimentos','d0150000-0000-4000-8000-000000000104','QA paciente sintetico','TESTE-A','qa/d0150000/assinatura-procedimento.png');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150000-0000-4000-8000-000000000301','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150000-0000-4000-8000-000000000302','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000102','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150000-0000-4000-8000-000000000303','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000104','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25','d0150000-0000-4000-8000-000000000801',null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150000-0000-4000-8000-000000000304','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000108','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150000-0000-4000-8000-000000000305','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000109','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25',null,'2026-10-25T10:02:00Z',null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150000-0000-4000-8000-000000000306','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000110','b0000000-0000-4000-8000-0000000000a1','profilaxia','indicado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico',null,null,null,'c0000000-0000-4000-8000-0000000000d1');
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d0150000-0000-4000-8000-000000000401','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000101','d0150000-0000-4000-8000-000000000201','b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FX',false);
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d0150000-0000-4000-8000-000000000402','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000102',null,'b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FY',false);
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d0150000-0000-4000-8000-000000000403','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000108',null,'b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FO',false);
insert into public.atendimento_eventos(clinica_id,atendimento_id,evento_id,papel) values('b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000201','d0150000-0000-4000-8000-000000000301','realizado');
insert into public.ficha_arquivos(id,clinica_id,ficha_id,tipo,nome_original,storage_url) values('d0150000-0000-4000-8000-000000000501','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000101','outro','QA documento ficticio.txt','qa/d0150000/arquivo-ficticio');
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d0150000-0000-4000-8000-000000000601','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150000-0000-4000-8000-000000000101','rascunho',null,100);
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d0150000-0000-4000-8000-000000000602','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150000-0000-4000-8000-000000000106','rascunho',null,100);
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d0150000-0000-4000-8000-000000000603','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150000-0000-4000-8000-000000000108','aprovado','2026-10-25T10:03:00Z',100);
insert into public.orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado) values('d0150000-0000-4000-8000-000000000701','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000603','QA item financeiro ficticio',1,100,100,true);
insert into public.orcamento_eventos(clinica_id,orcamento_id,evento_id,item_id) values('b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000603','d0150000-0000-4000-8000-000000000304','d0150000-0000-4000-8000-000000000701');
insert into public.assinaturas(id,clinica_id,paciente_id,dentista_id,tipo,orcamento_id,assinado_por,cro_no_ato,assinatura_ref) values('d0150000-0000-4000-8000-000000000802','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','orcamento','d0150000-0000-4000-8000-000000000603','QA paciente sintetico','TESTE-A','qa/d0150000/aceite.png');
insert into public.paciente_documentos(id,clinica_id,paciente_id,nome,url) values('d0150000-0000-4000-8000-000000000901','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','OD015M3 documento ficticio','qa/d0150000/documento-901.pdf');
insert into public.documentos_aceite(id,clinica_id,paciente_id,dentista_id,ficha_id,orcamento_id,assinatura_id,tipo,template_versao,template_hash,conteudo_snapshot,assinatura_paciente_ref,assinado_por,pdf_path,paciente_documento_id) values('d0150000-0000-4000-8000-000000001001','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150000-0000-4000-8000-000000000105',null,null,'tcle','QA-OD015M3','QA-HASH-SINTETICO','{}','qa/d0150000/aceite.png','QA paciente sintetico','qa/d0150000/documento-901.pdf','d0150000-0000-4000-8000-000000000901');
insert into public.paciente_documentos(id,clinica_id,paciente_id,nome,url) values('d0150000-0000-4000-8000-000000000902','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','OD015M3 documento ficticio','qa/d0150000/documento-902.pdf');
insert into public.documentos_aceite(id,clinica_id,paciente_id,dentista_id,ficha_id,orcamento_id,assinatura_id,tipo,template_versao,template_hash,conteudo_snapshot,assinatura_paciente_ref,assinado_por,pdf_path,paciente_documento_id) values('d0150000-0000-4000-8000-000000001002','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150000-0000-4000-8000-000000000108','d0150000-0000-4000-8000-000000000603','d0150000-0000-4000-8000-000000000802','orcamento','QA-OD015M3','QA-HASH-SINTETICO','{}','qa/d0150000/aceite.png','QA paciente sintetico','qa/d0150000/documento-902.pdf','d0150000-0000-4000-8000-000000000902');
insert into public.orcamento_cobrancas(id,clinica_id,orcamento_id,paciente_id,dentista_id,subtotal,valor_final) values('d0150000-0000-4000-8000-000000001101','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000603','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,100);
insert into public.orcamento_cobranca_itens(cobranca_id,orcamento_item_id,clinica_id,preco_total_snapshot) values('d0150000-0000-4000-8000-000000001101','d0150000-0000-4000-8000-000000000701','b0000000-0000-4000-8000-000000000001',100);
insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values('d0150000-0000-4000-8000-000000001201','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000602',null,'d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,'pendente','2026-10-25');
insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values('d0150000-0000-4000-8000-000000001202','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000603','d0150000-0000-4000-8000-000000001101','d0150000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,'pendente','2026-10-25');
insert into public.estoque_itens(id,clinica_id,titular_tipo,nome,unidade_base) values('d0150000-0000-4000-8000-000000001301','b0000000-0000-4000-8000-000000000001','clinica','QA OD015M3 material ficticio','unidade');
insert into public.estoque_lotes(id,clinica_id,item_id,origem_sem_identificacao) values('d0150000-0000-4000-8000-000000001302','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000001301',true);
insert into public.estoque_usos(id,clinica_id,atendimento_id,linha_origem_id,autor_usuario_id,snapshot_material,quantidade_declarada,unidade_declarada,item_id,lote_id) values('d0150000-0000-4000-8000-000000001303','b0000000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000204','d0150000-0000-4000-8000-000000001304','b0000000-0000-4000-8000-00000000000a','QA OD015M3 material ficticio',1,'unidade','d0150000-0000-4000-8000-000000001301','d0150000-0000-4000-8000-000000001302');

create temp table m3_before1(t text,id uuid,row jsonb);
insert into m3_before1 select 'fichas',id,to_jsonb(r) from public.fichas r where paciente_id='d0150000-0000-4000-8000-000000000001';
insert into m3_before1 select 'odontograma_eventos',id,to_jsonb(r) from public.odontograma_eventos r where paciente_id='d0150000-0000-4000-8000-000000000001';
insert into m3_before1 select 'assinaturas',id,to_jsonb(r) from public.assinaturas r where paciente_id='d0150000-0000-4000-8000-000000000001';
insert into m3_before1 select 'documentos_aceite',id,to_jsonb(r) from public.documentos_aceite r where paciente_id='d0150000-0000-4000-8000-000000000001';
insert into m3_before1 select 'orcamentos',id,to_jsonb(r) from public.orcamentos r where paciente_id='d0150000-0000-4000-8000-000000000001';
insert into m3_before1 select 'pagamentos',id,to_jsonb(r) from public.pagamentos r where paciente_id='d0150000-0000-4000-8000-000000000001';
insert into m3_before1 select 'orcamento_cobrancas',id,to_jsonb(r) from public.orcamento_cobrancas r where paciente_id='d0150000-0000-4000-8000-000000000001';
insert into m3_before1 select 'orcamento_itens',id,to_jsonb(r) from public.orcamento_itens r where orcamento_id='d0150000-0000-4000-8000-000000000603';
insert into m3_before1 select 'orcamento_eventos',evento_id,to_jsonb(r) from public.orcamento_eventos r where orcamento_id='d0150000-0000-4000-8000-000000000603';
insert into m3_before1 select 'orcamento_cobranca_itens',orcamento_item_id,to_jsonb(r) from public.orcamento_cobranca_itens r where cobranca_id='d0150000-0000-4000-8000-000000001101';
grant select on m3_before1 to authenticated;
create temp table m3_log_before1 as select count(*) as n from public.activity_logs where paciente_id='d0150000-0000-4000-8000-000000000001';
grant select on m3_log_before1 to authenticated;
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.executar('P1 Q1 excluir FX',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000101','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$);
select pg_temp.verificar('P1 Q1 cascatas e visita removidas',$q$select not exists(select 1 from public.fichas where id='d0150000-0000-4000-8000-000000000101') and not exists(select 1 from public.ficha_evolucoes where id='d0150000-0000-4000-8000-000000000401') and not exists(select 1 from public.odontograma_eventos where id='d0150000-0000-4000-8000-000000000301') and not exists(select 1 from public.ficha_arquivos where id='d0150000-0000-4000-8000-000000000501') and not exists(select 1 from public.orcamentos where id='d0150000-0000-4000-8000-000000000601') and not exists(select 1 from public.atendimentos_clinicos where id='d0150000-0000-4000-8000-000000000201')$q$);
select pg_temp.verificar('P1 Q1 auditoria resumo seguro',$q$select count(*)=1 and bool_and(excluido_por='b0000000-0000-4000-8000-0000000000a1' and excluido_por_usuario='b0000000-0000-4000-8000-00000000000a' and motivo='aberta_por_engano' and (resumo->>'evolucoes')::int=1 and (resumo->>'procedimentos')::int=1 and (resumo->>'arquivos')::int=1 and (resumo->>'visitas_descartadas')::int=1 and (resumo->>'orcamentos_apagados')::int=1 and (resumo->>'orcamentos_mantidos')::int=0 and not (resumo->>'confirmou_orcamento_aceito')::boolean and resumo::text not like '%QA-TEXTO-CLINICO%') from public.prontuario_exclusoes where ficha_id='d0150000-0000-4000-8000-000000000101'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000d","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P1 Q2 autoria papel isolamento',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000102','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'sem_permissao');
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P1 Q3 autoria papel isolamento',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000102','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'sem_permissao');
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P1 Q4 autoria papel isolamento',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000102','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'sem_permissao');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P1 Q5 autoria papel isolamento',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000102','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_nao_encontrada');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P1 Q6 prova clinica',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000103','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_assinada');
select pg_temp.recusar('P1 Q7 prova clinica',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000104','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_assinada');
select pg_temp.recusar('P1 Q8 prova clinica',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000105','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_assinada');
select pg_temp.recusar('P1 Q9 nome incorreto',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000102','aberta_por_engano',null,'Nome errado',false)$q$,'confirmacao_invalida');
select pg_temp.recusar('P1 Q9 motivo invalido',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000102','xyz',null,'Paciente Exclusao SQL',false)$q$,'motivo_invalido');
select pg_temp.recusar('P1 Q9 outro sem detalhe',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000102','outro',null,'Paciente Exclusao SQL',false)$q$,'motivo_invalido');
select pg_temp.verificar('P1 Q2-Q9 FY intacta sem auditoria indevida',$q$select to_jsonb(f)=b.row and not exists(select 1 from public.prontuario_exclusoes where ficha_id='d0150000-0000-4000-8000-000000000102') from public.fichas f join m3_before1 b on b.t='fichas' and b.id=f.id where f.id='d0150000-0000-4000-8000-000000000102'$q$);
select pg_temp.recusar('P1 Q10 caixa false',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'confirmar_orcamento_aceito');
select pg_temp.recusar('P1 Q10 caixa null',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',null)$q$,'confirmar_orcamento_aceito');
select pg_temp.verificar('P1 Q10 intacto fichas',$q$select to_jsonb(r)=b.row from public.fichas r join m3_before1 b on b.t='fichas' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000108'$q$);
select pg_temp.verificar('P1 Q10 intacto orcamentos',$q$select to_jsonb(r)=b.row from public.orcamentos r join m3_before1 b on b.t='orcamentos' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000603'$q$);
select pg_temp.verificar('P1 Q10 intacto assinaturas',$q$select to_jsonb(r)=b.row from public.assinaturas r join m3_before1 b on b.t='assinaturas' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000802'$q$);
select pg_temp.verificar('P1 Q10 intacto documentos_aceite',$q$select to_jsonb(r)=b.row from public.documentos_aceite r join m3_before1 b on b.t='documentos_aceite' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000001002'$q$);
select pg_temp.verificar('P1 Q10 intacto pagamentos',$q$select to_jsonb(r)=b.row from public.pagamentos r join m3_before1 b on b.t='pagamentos' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000001202'$q$);
select pg_temp.verificar('P1 Q10 intacto orcamento_cobrancas',$q$select to_jsonb(r)=b.row from public.orcamento_cobrancas r join m3_before1 b on b.t='orcamento_cobrancas' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000001101'$q$);
select pg_temp.verificar('P1 Q10 intacto orcamento_itens',$q$select to_jsonb(r)=b.row from public.orcamento_itens r join m3_before1 b on b.t='orcamento_itens' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000701'$q$);
select pg_temp.verificar('P1 Q10 ponte intacta',$q$select to_jsonb(r)=b.row from public.orcamento_eventos r join m3_before1 b on b.t='orcamento_eventos' and b.id=r.evento_id where r.evento_id='d0150000-0000-4000-8000-000000000304'$q$);
select pg_temp.verificar('P1 Q10 sem auditoria',$q$select count(*)=0 from public.prontuario_exclusoes where ficha_id='d0150000-0000-4000-8000-000000000108'$q$);
select pg_temp.executar('P1 Q11 excluir FO confirmada',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$);
select pg_temp.executar('P1 Q11 excluir FP com pagamento',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000106','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$);
select pg_temp.verificar('P1 Q11 cobranca itens preservados',$q$select to_jsonb(r)=b.row from public.orcamento_cobranca_itens r join m3_before1 b on b.t='orcamento_cobranca_itens' and b.id=r.orcamento_item_id where r.cobranca_id='d0150000-0000-4000-8000-000000001101' and r.orcamento_item_id='d0150000-0000-4000-8000-000000000701'$q$);
select pg_temp.verificar('P1 Q11 fichas e pontes removidas',$q$select not exists(select 1 from public.fichas where id in ('d0150000-0000-4000-8000-000000000108','d0150000-0000-4000-8000-000000000106')) and not exists(select 1 from public.orcamento_eventos where evento_id='d0150000-0000-4000-8000-000000000304')$q$);
select pg_temp.verificar('P1 Q11 orcamento preservado 602',$q$select r.ficha_id is null and (to_jsonb(r)-'ficha_id'-'updated_at')=(b.row-'ficha_id'-'updated_at') from public.orcamentos r join m3_before1 b on b.t='orcamentos' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000602'$q$);
select pg_temp.verificar('P1 Q11 orcamento preservado 603',$q$select r.ficha_id is null and (to_jsonb(r)-'ficha_id'-'updated_at')=(b.row-'ficha_id'-'updated_at') from public.orcamentos r join m3_before1 b on b.t='orcamentos' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000603'$q$);
select pg_temp.verificar('P1 Q11 preservado assinaturas802',$q$select to_jsonb(r)=b.row from public.assinaturas r join m3_before1 b on b.t='assinaturas' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000802'$q$);
select pg_temp.verificar('P1 Q11 preservado pagamentos1201',$q$select to_jsonb(r)=b.row from public.pagamentos r join m3_before1 b on b.t='pagamentos' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000001201'$q$);
select pg_temp.verificar('P1 Q11 preservado pagamentos1202',$q$select to_jsonb(r)=b.row from public.pagamentos r join m3_before1 b on b.t='pagamentos' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000001202'$q$);
select pg_temp.verificar('P1 Q11 preservado orcamento_cobrancas1101',$q$select to_jsonb(r)=b.row from public.orcamento_cobrancas r join m3_before1 b on b.t='orcamento_cobrancas' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000001101'$q$);
select pg_temp.verificar('P1 Q11 preservado orcamento_itens701',$q$select to_jsonb(r)=b.row from public.orcamento_itens r join m3_before1 b on b.t='orcamento_itens' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000701'$q$);
select pg_temp.verificar('P1 Q11 documento somente desvinculado',$q$select r.ficha_id is null and (to_jsonb(r)-'ficha_id')=(b.row-'ficha_id') from public.documentos_aceite r join m3_before1 b on b.t='documentos_aceite' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000001002'$q$);
select pg_temp.verificar('P1 Q11 auditoria confirma guarda sem conteudo',$q$select count(*)=1 and bool_and((resumo->>'orcamentos_mantidos')::int=1 and resumo->'orcamentos_mantidos_ids' @> '["d0150000-0000-4000-8000-000000000603"]'::jsonb and (resumo->>'confirmou_orcamento_aceito')::boolean and resumo::text not like '%QA-TEXTO-CLINICO%') from public.prontuario_exclusoes where ficha_id='d0150000-0000-4000-8000-000000000108'$q$);
select pg_temp.recusar('P1 Q12 retirado',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000109','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$,'ficha_com_retirado');
select pg_temp.recusar('P1 Q12 encaminhado',$q$select public.excluir_ficha_clinica('d0150000-0000-4000-8000-000000000110','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$,'ficha_com_encaminhamento');
select pg_temp.verificar('P1 Q12 ficha intacta 109',$q$select to_jsonb(r)=b.row from public.fichas r join m3_before1 b on b.t='fichas' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000109'$q$);
select pg_temp.verificar('P1 Q12 ficha intacta 110',$q$select to_jsonb(r)=b.row from public.fichas r join m3_before1 b on b.t='fichas' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000110'$q$);
select pg_temp.verificar('P1 Q12 evento305 intacto',$q$select to_jsonb(r)=b.row from public.odontograma_eventos r join m3_before1 b on b.t='odontograma_eventos' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000305'$q$);
select pg_temp.verificar('P1 Q12 evento306 intacto',$q$select to_jsonb(r)=b.row from public.odontograma_eventos r join m3_before1 b on b.t='odontograma_eventos' and b.id=r.id where r.id='d0150000-0000-4000-8000-000000000306'$q$);
select pg_temp.executar('P1 Q13 V0 vazia',$q$select public.descartar_atendimento_vazio('d0150000-0000-4000-8000-000000000202')$q$);
select pg_temp.verificar('P1 Q13 V0 removida e auditada',$q$select not exists(select 1 from public.atendimentos_clinicos where id='d0150000-0000-4000-8000-000000000202') and exists(select 1 from public.prontuario_exclusoes where atendimento_id='d0150000-0000-4000-8000-000000000202' and tipo='atendimento_vazio' and excluido_por='b0000000-0000-4000-8000-0000000000a1' and excluido_por_usuario='b0000000-0000-4000-8000-00000000000a')$q$);
select pg_temp.recusar('P1 Q13 V2 estoque',$q$select public.descartar_atendimento_vazio('d0150000-0000-4000-8000-000000000204')$q$,'atendimento_com_conteudo');
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000d","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P1 Q13 Carlos V0b alheia',$q$select public.descartar_atendimento_vazio('d0150000-0000-4000-8000-000000000203')$q$,'sem_permissao');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P1 Q14 leitura Ana',$q$select count(*)=4 from public.prontuario_exclusoes where paciente_id='d0150000-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000d","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P1 Q14 leitura Carlos',$q$select count(*)=4 from public.prontuario_exclusoes where paciente_id='d0150000-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P1 Q14 leitura Alice',$q$select count(*)=4 from public.prontuario_exclusoes where paciente_id='d0150000-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P1 Q14 leitura Sara',$q$select count(*)=0 from public.prontuario_exclusoes where paciente_id='d0150000-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P1 Q14 leitura Protetico',$q$select count(*)=0 from public.prontuario_exclusoes where paciente_id='d0150000-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P1 Q14 leitura Bruno',$q$select count(*)=0 from public.prontuario_exclusoes where paciente_id='d0150000-0000-4000-8000-000000000001'$q$);
reset role;set local request.jwt.claims='{"role":"anon"}';set local role anon;
select pg_temp.recusar('P1 Q14 anon sem SELECT',$q$select count(*) from public.prontuario_exclusoes$q$,'42501');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P1 Q15 INSERT direto auditoria',$q$insert into public.prontuario_exclusoes(clinica_id,tipo,paciente_id,ficha_id,excluido_por,excluido_por_usuario,motivo) values('b0000000-0000-4000-8000-000000000001','ficha','d0150000-0000-4000-8000-000000000001','d0150000-0000-4000-8000-000000000102','b0000000-0000-4000-8000-0000000000a1','b0000000-0000-4000-8000-00000000000a','aberta_por_engano')$q$,'42501');
select pg_temp.recusar('P1 Q15 UPDATE direto auditoria',$q$update public.prontuario_exclusoes set motivo='outro' where paciente_id='d0150000-0000-4000-8000-000000000001'$q$,'42501');
select pg_temp.recusar('P1 Q15 DELETE direto auditoria',$q$delete from public.prontuario_exclusoes where paciente_id='d0150000-0000-4000-8000-000000000001'$q$,'42501');
select pg_temp.recusar('P1 Q15 r169d acesso negado',$q$select public.excluir_ficha_propria_preservando_financeiro('d0150000-0000-4000-8000-000000000102')$q$,'42501');
select pg_temp.verificar('P1 Q15 sem activity_logs novos',$q$select (select count(*) from public.activity_logs where paciente_id='d0150000-0000-4000-8000-000000000001')=(select n from m3_log_before1)$q$);
reset role;
select pg_temp.verificar('P1 Q15 assinatura unica sem default',$q$select to_regprocedure('public.excluir_ficha_clinica(uuid,text,text,text)') is null and exists(select 1 from pg_proc where oid='public.excluir_ficha_clinica(uuid,text,text,text,boolean)'::regprocedure and pronargdefaults=0 and prosecdef and proconfig @> array['search_path=public']) and exists(select 1 from pg_proc where oid='public.descartar_atendimento_vazio(uuid)'::regprocedure and prosecdef and proconfig @> array['search_path=public'])$q$);
select pg_temp.verificar('P1 Q15 privilegios',$q$select not has_table_privilege('authenticated','public.atendimentos_clinicos','DELETE') and not has_function_privilege('authenticated','public.excluir_ficha_propria_preservando_financeiro(uuid)','EXECUTE') and not has_function_privilege('anon','public.excluir_ficha_clinica(uuid,text,text,text,boolean)','EXECUTE') and not has_function_privilege('anon','public.descartar_atendimento_vazio(uuid)','EXECUTE')$q$);


-- Q16: ciclo real por DDL literal, SEM envelope de transacao do arquivo, neste rollback.
do $q16$
declare v_auditoria text; v_contagem bigint;
begin
 select count(*) into v_contagem from public.prontuario_exclusoes;
 select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)::text) into v_auditoria from public.prontuario_exclusoes a;
 execute $volta$drop function if exists public.excluir_ficha_clinica(uuid, text, text, text, boolean);
drop function if exists public.descartar_atendimento_vazio(uuid);$volta$;
 if to_regprocedure('public.excluir_ficha_clinica(uuid,text,text,text,boolean)') is not null
   or to_regprocedure('public.descartar_atendimento_vazio(uuid)') is not null
   or to_regclass('public.prontuario_exclusoes') is null
   or has_function_privilege('authenticated','public.excluir_ficha_propria_preservando_financeiro(uuid)','EXECUTE') then
   raise exception 'Q16 volta estrutural divergiu';
 end if;
 execute $reaplicar$create table if not exists public.prontuario_exclusoes (
  id                   uuid primary key default gen_random_uuid(),
  clinica_id           uuid not null references public.clinicas(id) on delete cascade,
  tipo                 text not null check (tipo in ('ficha', 'atendimento_vazio')),
  paciente_id          uuid,          -- sem FK: o registro sobrevive à exclusão do paciente
  ficha_id             uuid,          -- sem FK: a ficha não existe mais
  atendimento_id       uuid,          -- sem FK
  excluido_por         uuid not null, -- dentistas.id no ato
  excluido_por_usuario uuid not null, -- auth.uid() no ato
  motivo               text check (motivo in
                         ('paciente_errado', 'ficha_duplicada', 'aberta_por_engano', 'registro_incompleto', 'outro')),
  motivo_detalhe       text check (motivo_detalhe is null or char_length(motivo_detalhe) between 5 and 200),
  resumo               jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  constraint prontuario_exclusoes_alvo check (
    (tipo = 'ficha' and ficha_id is not null and motivo is not null)
    or (tipo = 'atendimento_vazio' and atendimento_id is not null and motivo is null)),
  constraint prontuario_exclusoes_detalhe_so_outro check (
    (motivo = 'outro') = (motivo_detalhe is not null))
);

do $$
begin
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'prontuario_exclusoes'
        and column_name in ('id', 'clinica_id', 'tipo', 'paciente_id', 'ficha_id', 'atendimento_id',
                            'excluido_por', 'excluido_por_usuario', 'motivo', 'motivo_detalhe',
                            'resumo', 'created_at')) <> 12
     or (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'prontuario_exclusoes') <> 12
     or not exists (select 1 from pg_constraint
                    where conrelid = 'public.prontuario_exclusoes'::regclass
                      and conname in ('prontuario_exclusoes_alvo', 'prontuario_exclusoes_detalhe_so_outro')
                    having count(*) = 2) then
    raise exception 'prontuario_exclusoes_formato_inesperado';
  end if;
end $$;

comment on table public.prontuario_exclusoes is
  'OD-015b1-2 — auditoria de exclusão de ficha e de visita vazia. Resumo sem conteúdo clínico. '
  'Escrita só pelas funções excluir_ficha_clinica e descartar_atendimento_vazio; leitura só admin/dentista.';

create index if not exists prontuario_exclusoes_clinica_idx
  on public.prontuario_exclusoes (clinica_id, created_at desc);
create index if not exists prontuario_exclusoes_paciente_idx
  on public.prontuario_exclusoes (clinica_id, paciente_id, created_at desc);

alter table public.prontuario_exclusoes enable row level security;
revoke all on table public.prontuario_exclusoes from public, anon, authenticated;
grant select on table public.prontuario_exclusoes to authenticated;

drop policy if exists prontuario_exclusoes_select on public.prontuario_exclusoes;
create policy prontuario_exclusoes_select on public.prontuario_exclusoes
  for select to authenticated
  using (public.belongs_to_active_clinic(clinica_id) and public.is_clinic_dentista());

create or replace function public.descartar_atendimento_vazio(p_atendimento_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller     uuid := public.get_my_dentista_id();
  v_role       text := public.get_my_role();
  v_row        public.atendimentos_clinicos%rowtype;
begin
  if v_clinica_id is null or v_caller is null
     or coalesce(v_role, '') not in ('admin', 'dentista')
     or not public.has_active_membership() then
    raise exception 'sem_permissao';
  end if;

  select * into v_row
  from public.atendimentos_clinicos a
  where a.id = p_atendimento_id and a.clinica_id = v_clinica_id
  for update;
  if not found then raise exception 'atendimento_nao_encontrado'; end if;
  if v_row.dentista_id <> v_caller then raise exception 'sem_permissao'; end if;

  if exists (select 1 from public.atendimento_eventos ae where ae.atendimento_id = v_row.id)
     or exists (select 1 from public.ficha_evolucoes fe where fe.atendimento_id = v_row.id)
     or exists (select 1 from public.estoque_usos eu where eu.atendimento_id = v_row.id) then
    raise exception 'atendimento_com_conteudo';
  end if;

  delete from public.atendimentos_clinicos where id = v_row.id;

  insert into public.prontuario_exclusoes
    (clinica_id, tipo, paciente_id, atendimento_id, excluido_por, excluido_por_usuario, resumo)
  values
    (v_clinica_id, 'atendimento_vazio', v_row.paciente_id, v_row.id, v_caller, auth.uid(),
     jsonb_build_object('estado', v_row.estado, 'origem', v_row.origem,
                        'data_atendimento', v_row.data_atendimento, 'criado_em', v_row.created_at));
  return true;
end;
$$;

create or replace function public.excluir_ficha_clinica(
  p_ficha_id                  uuid,
  p_motivo                    text,
  p_motivo_detalhe            text,
  p_nome_paciente             text,
  p_confirma_orcamento_aceito boolean   -- sem default: quem chama tem de dizer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller     uuid := public.get_my_dentista_id();
  v_role       text := public.get_my_role();
  v_ficha      public.fichas%rowtype;
  v_nome       text;
  v_detalhe    text := nullif(btrim(coalesce(p_motivo_detalhe, '')), '');
  v_eventos    uuid[];
  v_orcs       uuid[];
  v_mantidos   uuid[];
  v_apagados   int;
  v_pontes     int;
  v_visitas    uuid[];
  v_vazias     uuid[] := '{}';
  v_id         uuid;
  v_resumo     jsonb;
  v_exclusao   uuid;
begin
  if v_clinica_id is null or v_caller is null
     or coalesce(v_role, '') not in ('admin', 'dentista')
     or not public.has_active_membership() then
    raise exception 'sem_permissao';
  end if;
  -- fichas tem a policy RESTRITIVA commercial_write_fichas; SECURITY DEFINER passa por cima da RLS.
  if not private.commercial_write_allowed(v_clinica_id) then
    raise exception 'cobranca_bloqueada';
  end if;

  select * into v_ficha from public.fichas f
  where f.id = p_ficha_id and f.clinica_id = v_clinica_id
  for update;
  if not found then raise exception 'ficha_nao_encontrada'; end if;
  if v_ficha.dentista_id <> v_caller then raise exception 'sem_permissao'; end if;

  -- 1. Prova clínica: sempre recusa. O aceite DO ORÇAMENTO não é prova clínica (tratado no passo 5).
  if v_ficha.assinado_em is not null or v_ficha.assinatura_url is not null
     or exists (select 1 from public.odontograma_eventos e
                where e.ficha_id = v_ficha.id and e.assinatura_id is not null)
     or exists (select 1 from public.assinaturas a
                where a.ficha_id = v_ficha.id and a.tipo <> 'orcamento')
     or exists (select 1 from public.documentos_aceite d
                where d.ficha_id = v_ficha.id and d.tipo <> 'orcamento') then
    raise exception 'ficha_assinada';
  end if;

  -- 2. Procedimentos da ficha, travados.
  perform 1 from public.odontograma_eventos e
  where e.ficha_id = v_ficha.id and e.clinica_id = v_clinica_id
  order by e.id for update;
  select coalesce(array_agg(e.id), '{}') into v_eventos
  from public.odontograma_eventos e
  where e.ficha_id = v_ficha.id and e.clinica_id = v_clinica_id;

  -- 3. Os gatilhos da prova clínica barram apagar procedimento retirado ou encaminhado a outro
  --    dentista. Recusa clara antes, em vez do erro do gatilho.
  if exists (select 1 from public.odontograma_eventos e
             where e.id = any(v_eventos) and e.retirado_em is not null) then
    raise exception 'ficha_com_retirado';
  end if;
  if exists (select 1 from public.odontograma_eventos e
             where e.id = any(v_eventos)
               and e.encaminhado_para is not null and e.encaminhado_para <> v_caller) then
    raise exception 'ficha_com_encaminhamento';
  end if;

  -- 4. Motivo e nome do paciente (confirmação forte conferida no banco).
  if p_motivo is null or p_motivo not in
       ('paciente_errado', 'ficha_duplicada', 'aberta_por_engano', 'registro_incompleto', 'outro')
     or (p_motivo = 'outro' and (v_detalhe is null or char_length(v_detalhe) not between 5 and 200)) then
    raise exception 'motivo_invalido';
  end if;
  if p_motivo <> 'outro' then v_detalhe := null; end if;

  select p.nome into v_nome from public.pacientes p
  where p.id = v_ficha.paciente_id and p.clinica_id = v_clinica_id;
  if v_nome is null
     or lower(regexp_replace(btrim(coalesce(p_nome_paciente, '')), '\s+', ' ', 'g'))
        <> lower(regexp_replace(btrim(v_nome), '\s+', ' ', 'g')) then
    raise exception 'confirmacao_invalida';
  end if;

  -- 5. Orçamentos da ficha (pelo ficha_id ou pelas pontes), travados.
  perform 1 from public.orcamentos o
  where o.clinica_id = v_clinica_id
    and (o.ficha_id = v_ficha.id
         or o.id in (select oe.orcamento_id from public.orcamento_eventos oe
                     where oe.evento_id = any(v_eventos)))
  order by o.id for update;
  select coalesce(array_agg(o.id), '{}') into v_orcs
  from public.orcamentos o
  where o.clinica_id = v_clinica_id
    and (o.ficha_id = v_ficha.id
         or o.id in (select oe.orcamento_id from public.orcamento_eventos oe
                     where oe.evento_id = any(v_eventos)));

  if exists (select 1 from public.orcamentos o
             where o.id = any(v_orcs) and o.paciente_id is distinct from v_ficha.paciente_id) then
    raise exception 'ficha_contexto_invalido';
  end if;

  -- Orçamento com aceite ou com movimento financeiro: é MANTIDO, e só se apaga a ficha
  -- com a caixa de confirmação marcada.
  select coalesce(array_agg(o.id), '{}') into v_mantidos
  from public.orcamentos o
  where o.id = any(v_orcs)
    and (o.status = 'aprovado' or o.aprovado_em is not null
         or exists (select 1 from public.orcamento_itens i where i.orcamento_id = o.id and i.aprovado)
         or exists (select 1 from public.assinaturas a where a.orcamento_id = o.id)
         or exists (select 1 from public.documentos_aceite d where d.orcamento_id = o.id)
         or exists (select 1 from public.pagamentos p where p.orcamento_id = o.id)
         or exists (select 1 from public.orcamento_cobrancas c where c.orcamento_id = o.id));

  if cardinality(v_mantidos) > 0 and p_confirma_orcamento_aceito is not true then
    raise exception 'confirmar_orcamento_aceito';
  end if;

  -- Orçamento sem aceite e sem movimento, ligado à ficha: sai junto, como antes.
  select count(*) into v_apagados from public.orcamentos o
  where o.id = any(v_orcs) and not (o.id = any(v_mantidos)) and o.ficha_id = v_ficha.id;
  select count(*) into v_pontes from public.orcamento_eventos oe where oe.evento_id = any(v_eventos);

  select coalesce(array_agg(distinct s.x), '{}') into v_visitas from (
    select fe.atendimento_id as x from public.ficha_evolucoes fe
    where fe.ficha_id = v_ficha.id and fe.atendimento_id is not null
    union
    select ae.atendimento_id from public.atendimento_eventos ae
    where ae.evento_id = any(v_eventos)
  ) s;

  -- RESUMO: só contagens, datas e ids. Nada de texto, dente ou nome de procedimento.
  v_resumo := jsonb_build_object(
    'data_atendimento',  v_ficha.data_atendimento,
    'ficha_criada_em',   v_ficha.created_at,
    'origem',            v_ficha.origem,
    'evolucoes',         (select count(*) from public.ficha_evolucoes fe where fe.ficha_id = v_ficha.id),
    'procedimentos',     cardinality(v_eventos),
    'procedimentos_realizados',
                         (select count(*) from public.odontograma_eventos e
                          where e.id = any(v_eventos) and e.status = 'realizado'),
    'arquivos',          (select count(*) from public.ficha_arquivos a where a.ficha_id = v_ficha.id),
    'planejamentos',     (select count(*) from public.planejamentos p where p.ficha_id = v_ficha.id),
    'orcamentos_apagados',            v_apagados,
    'orcamentos_mantidos',            cardinality(v_mantidos),
    'orcamentos_mantidos_ids',        to_jsonb(v_mantidos),
    'vinculos_orcamento_desligados',  v_pontes,
    'confirmou_orcamento_aceito',     cardinality(v_mantidos) > 0);

  -- 6. Desliga o orçamento mantido da ficha. Nada comercial é apagado.
  update public.orcamentos set ficha_id = null
  where id = any(v_mantidos) and ficha_id = v_ficha.id;
  update public.documentos_aceite set ficha_id = null
  where ficha_id = v_ficha.id and tipo = 'orcamento';
  delete from public.orcamento_eventos where evento_id = any(v_eventos);

  delete from public.fichas where id = v_ficha.id;

  foreach v_id in array v_visitas loop
    delete from public.atendimentos_clinicos a
    where a.id = v_id and a.clinica_id = v_clinica_id and a.dentista_id = v_caller
      and not exists (select 1 from public.atendimento_eventos ae where ae.atendimento_id = a.id)
      and not exists (select 1 from public.ficha_evolucoes fe where fe.atendimento_id = a.id)
      and not exists (select 1 from public.estoque_usos eu where eu.atendimento_id = a.id);
    if found then v_vazias := v_vazias || v_id; end if;
  end loop;

  insert into public.prontuario_exclusoes
    (clinica_id, tipo, paciente_id, ficha_id, excluido_por, excluido_por_usuario,
     motivo, motivo_detalhe, resumo)
  values
    (v_clinica_id, 'ficha', v_ficha.paciente_id, v_ficha.id, v_caller, auth.uid(),
     p_motivo, v_detalhe,
     v_resumo || jsonb_build_object('visitas_descartadas', cardinality(v_vazias)))
  returning id into v_exclusao;

  return jsonb_build_object('exclusao_id', v_exclusao,
                            'visitas_descartadas', cardinality(v_vazias),
                            'orcamentos_mantidos', cardinality(v_mantidos));
end;
$$;

revoke all on function public.descartar_atendimento_vazio(uuid) from public, anon;
grant execute on function public.descartar_atendimento_vazio(uuid) to authenticated;
revoke all on function public.excluir_ficha_clinica(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.excluir_ficha_clinica(uuid, text, text, text, boolean) to authenticated;

revoke execute on function public.excluir_ficha_propria_preservando_financeiro(uuid)
  from public, anon, authenticated;$reaplicar$;
 if (select count(*) from public.prontuario_exclusoes)<>v_contagem
  or (select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)::text) from public.prontuario_exclusoes a)<>v_auditoria then
   raise exception 'Q16 auditoria mudou';
 end if;
 if not exists(select 1 from pg_class where oid='public.prontuario_exclusoes'::regclass and relrowsecurity)
   or not exists(select 1 from pg_policy where polrelid='public.prontuario_exclusoes'::regclass and polname='prontuario_exclusoes_select')
   or to_regclass('public.prontuario_exclusoes_clinica_idx') is null
   or to_regclass('public.prontuario_exclusoes_paciente_idx') is null then
   raise exception 'Q16 RLS policy indices ausentes';
 end if;
 insert into od015m3_resultados values('Q16 volta reaplicacao e auditoria preservada',true,null);
end;
$q16$;


-- FASE 2: Q1-Q15 completos, fixtures independentes.

insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','Paciente Exclusao SQL');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000101','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FX','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000102','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FY','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000103','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FA','manual','aberta','2026-10-25','2026-10-25T10:00:00Z');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000104','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FS','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000105','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FD','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000106','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FP','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000107','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000d1','OD015M3 FC','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000108','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FO','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000109','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FR','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d0150001-0000-4000-8000-000000000110','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3 FE','manual','aberta','2026-10-25',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150001-0000-4000-8000-000000000201','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150001-0000-4000-8000-000000000201','2026-10-25','ficha','finalizado','2026-10-25T10:01:00Z');
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150001-0000-4000-8000-000000000202','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150001-0000-4000-8000-000000000202','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150001-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150001-0000-4000-8000-000000000203','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150001-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150001-0000-4000-8000-000000000204','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d0150001-0000-4000-8000-000000000205','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000d1','d0150001-0000-4000-8000-000000000205','2026-10-25','ficha','preparando',null);
insert into public.assinaturas(id,clinica_id,paciente_id,dentista_id,tipo,ficha_id,assinado_por,cro_no_ato,assinatura_ref) values('d0150001-0000-4000-8000-000000000801','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','procedimentos','d0150001-0000-4000-8000-000000000104','QA paciente sintetico','TESTE-A','qa/d0150001/assinatura-procedimento.png');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150001-0000-4000-8000-000000000301','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150001-0000-4000-8000-000000000302','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000102','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150001-0000-4000-8000-000000000303','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000104','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25','d0150001-0000-4000-8000-000000000801',null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150001-0000-4000-8000-000000000304','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000108','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150001-0000-4000-8000-000000000305','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000109','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico','2026-10-25',null,'2026-10-25T10:02:00Z',null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d0150001-0000-4000-8000-000000000306','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000110','b0000000-0000-4000-8000-0000000000a1','profilaxia','indicado','clinica','boca','{}','sessao_atual','OD015M3 procedimento sintetico',null,null,null,'c0000000-0000-4000-8000-0000000000d1');
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d0150001-0000-4000-8000-000000000401','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000101','d0150001-0000-4000-8000-000000000201','b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FX',false);
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d0150001-0000-4000-8000-000000000402','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000102',null,'b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FY',false);
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d0150001-0000-4000-8000-000000000403','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000108',null,'b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FO',false);
insert into public.atendimento_eventos(clinica_id,atendimento_id,evento_id,papel) values('b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000201','d0150001-0000-4000-8000-000000000301','realizado');
insert into public.ficha_arquivos(id,clinica_id,ficha_id,tipo,nome_original,storage_url) values('d0150001-0000-4000-8000-000000000501','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000101','outro','QA documento ficticio.txt','qa/d0150001/arquivo-ficticio');
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d0150001-0000-4000-8000-000000000601','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150001-0000-4000-8000-000000000101','rascunho',null,100);
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d0150001-0000-4000-8000-000000000602','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150001-0000-4000-8000-000000000106','rascunho',null,100);
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d0150001-0000-4000-8000-000000000603','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150001-0000-4000-8000-000000000108','aprovado','2026-10-25T10:03:00Z',100);
insert into public.orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado) values('d0150001-0000-4000-8000-000000000701','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000603','QA item financeiro ficticio',1,100,100,true);
insert into public.orcamento_eventos(clinica_id,orcamento_id,evento_id,item_id) values('b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000603','d0150001-0000-4000-8000-000000000304','d0150001-0000-4000-8000-000000000701');
insert into public.assinaturas(id,clinica_id,paciente_id,dentista_id,tipo,orcamento_id,assinado_por,cro_no_ato,assinatura_ref) values('d0150001-0000-4000-8000-000000000802','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','orcamento','d0150001-0000-4000-8000-000000000603','QA paciente sintetico','TESTE-A','qa/d0150001/aceite.png');
insert into public.paciente_documentos(id,clinica_id,paciente_id,nome,url) values('d0150001-0000-4000-8000-000000000901','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','OD015M3 documento ficticio','qa/d0150001/documento-901.pdf');
insert into public.documentos_aceite(id,clinica_id,paciente_id,dentista_id,ficha_id,orcamento_id,assinatura_id,tipo,template_versao,template_hash,conteudo_snapshot,assinatura_paciente_ref,assinado_por,pdf_path,paciente_documento_id) values('d0150001-0000-4000-8000-000000001001','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150001-0000-4000-8000-000000000105',null,null,'tcle','QA-OD015M3','QA-HASH-SINTETICO','{}','qa/d0150001/aceite.png','QA paciente sintetico','qa/d0150001/documento-901.pdf','d0150001-0000-4000-8000-000000000901');
insert into public.paciente_documentos(id,clinica_id,paciente_id,nome,url) values('d0150001-0000-4000-8000-000000000902','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','OD015M3 documento ficticio','qa/d0150001/documento-902.pdf');
insert into public.documentos_aceite(id,clinica_id,paciente_id,dentista_id,ficha_id,orcamento_id,assinatura_id,tipo,template_versao,template_hash,conteudo_snapshot,assinatura_paciente_ref,assinado_por,pdf_path,paciente_documento_id) values('d0150001-0000-4000-8000-000000001002','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d0150001-0000-4000-8000-000000000108','d0150001-0000-4000-8000-000000000603','d0150001-0000-4000-8000-000000000802','orcamento','QA-OD015M3','QA-HASH-SINTETICO','{}','qa/d0150001/aceite.png','QA paciente sintetico','qa/d0150001/documento-902.pdf','d0150001-0000-4000-8000-000000000902');
insert into public.orcamento_cobrancas(id,clinica_id,orcamento_id,paciente_id,dentista_id,subtotal,valor_final) values('d0150001-0000-4000-8000-000000001101','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000603','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,100);
insert into public.orcamento_cobranca_itens(cobranca_id,orcamento_item_id,clinica_id,preco_total_snapshot) values('d0150001-0000-4000-8000-000000001101','d0150001-0000-4000-8000-000000000701','b0000000-0000-4000-8000-000000000001',100);
insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values('d0150001-0000-4000-8000-000000001201','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000602',null,'d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,'pendente','2026-10-25');
insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values('d0150001-0000-4000-8000-000000001202','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000603','d0150001-0000-4000-8000-000000001101','d0150001-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,'pendente','2026-10-25');
insert into public.estoque_itens(id,clinica_id,titular_tipo,nome,unidade_base) values('d0150001-0000-4000-8000-000000001301','b0000000-0000-4000-8000-000000000001','clinica','QA OD015M3 material ficticio','unidade');
insert into public.estoque_lotes(id,clinica_id,item_id,origem_sem_identificacao) values('d0150001-0000-4000-8000-000000001302','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000001301',true);
insert into public.estoque_usos(id,clinica_id,atendimento_id,linha_origem_id,autor_usuario_id,snapshot_material,quantidade_declarada,unidade_declarada,item_id,lote_id) values('d0150001-0000-4000-8000-000000001303','b0000000-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000204','d0150001-0000-4000-8000-000000001304','b0000000-0000-4000-8000-00000000000a','QA OD015M3 material ficticio',1,'unidade','d0150001-0000-4000-8000-000000001301','d0150001-0000-4000-8000-000000001302');

create temp table m3_before2(t text,id uuid,row jsonb);
insert into m3_before2 select 'fichas',id,to_jsonb(r) from public.fichas r where paciente_id='d0150001-0000-4000-8000-000000000001';
insert into m3_before2 select 'odontograma_eventos',id,to_jsonb(r) from public.odontograma_eventos r where paciente_id='d0150001-0000-4000-8000-000000000001';
insert into m3_before2 select 'assinaturas',id,to_jsonb(r) from public.assinaturas r where paciente_id='d0150001-0000-4000-8000-000000000001';
insert into m3_before2 select 'documentos_aceite',id,to_jsonb(r) from public.documentos_aceite r where paciente_id='d0150001-0000-4000-8000-000000000001';
insert into m3_before2 select 'orcamentos',id,to_jsonb(r) from public.orcamentos r where paciente_id='d0150001-0000-4000-8000-000000000001';
insert into m3_before2 select 'pagamentos',id,to_jsonb(r) from public.pagamentos r where paciente_id='d0150001-0000-4000-8000-000000000001';
insert into m3_before2 select 'orcamento_cobrancas',id,to_jsonb(r) from public.orcamento_cobrancas r where paciente_id='d0150001-0000-4000-8000-000000000001';
insert into m3_before2 select 'orcamento_itens',id,to_jsonb(r) from public.orcamento_itens r where orcamento_id='d0150001-0000-4000-8000-000000000603';
insert into m3_before2 select 'orcamento_eventos',evento_id,to_jsonb(r) from public.orcamento_eventos r where orcamento_id='d0150001-0000-4000-8000-000000000603';
insert into m3_before2 select 'orcamento_cobranca_itens',orcamento_item_id,to_jsonb(r) from public.orcamento_cobranca_itens r where cobranca_id='d0150001-0000-4000-8000-000000001101';
grant select on m3_before2 to authenticated;
create temp table m3_log_before2 as select count(*) as n from public.activity_logs where paciente_id='d0150001-0000-4000-8000-000000000001';
grant select on m3_log_before2 to authenticated;
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.executar('P2 Q1 excluir FX',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000101','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$);
select pg_temp.verificar('P2 Q1 cascatas e visita removidas',$q$select not exists(select 1 from public.fichas where id='d0150001-0000-4000-8000-000000000101') and not exists(select 1 from public.ficha_evolucoes where id='d0150001-0000-4000-8000-000000000401') and not exists(select 1 from public.odontograma_eventos where id='d0150001-0000-4000-8000-000000000301') and not exists(select 1 from public.ficha_arquivos where id='d0150001-0000-4000-8000-000000000501') and not exists(select 1 from public.orcamentos where id='d0150001-0000-4000-8000-000000000601') and not exists(select 1 from public.atendimentos_clinicos where id='d0150001-0000-4000-8000-000000000201')$q$);
select pg_temp.verificar('P2 Q1 auditoria resumo seguro',$q$select count(*)=1 and bool_and(excluido_por='b0000000-0000-4000-8000-0000000000a1' and excluido_por_usuario='b0000000-0000-4000-8000-00000000000a' and motivo='aberta_por_engano' and (resumo->>'evolucoes')::int=1 and (resumo->>'procedimentos')::int=1 and (resumo->>'arquivos')::int=1 and (resumo->>'visitas_descartadas')::int=1 and (resumo->>'orcamentos_apagados')::int=1 and (resumo->>'orcamentos_mantidos')::int=0 and not (resumo->>'confirmou_orcamento_aceito')::boolean and resumo::text not like '%QA-TEXTO-CLINICO%') from public.prontuario_exclusoes where ficha_id='d0150001-0000-4000-8000-000000000101'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000d","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P2 Q2 autoria papel isolamento',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000102','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'sem_permissao');
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P2 Q3 autoria papel isolamento',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000102','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'sem_permissao');
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P2 Q4 autoria papel isolamento',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000102','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'sem_permissao');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P2 Q5 autoria papel isolamento',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000102','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_nao_encontrada');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P2 Q6 prova clinica',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000103','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_assinada');
select pg_temp.recusar('P2 Q7 prova clinica',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000104','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_assinada');
select pg_temp.recusar('P2 Q8 prova clinica',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000105','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_assinada');
select pg_temp.recusar('P2 Q9 nome incorreto',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000102','aberta_por_engano',null,'Nome errado',false)$q$,'confirmacao_invalida');
select pg_temp.recusar('P2 Q9 motivo invalido',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000102','xyz',null,'Paciente Exclusao SQL',false)$q$,'motivo_invalido');
select pg_temp.recusar('P2 Q9 outro sem detalhe',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000102','outro',null,'Paciente Exclusao SQL',false)$q$,'motivo_invalido');
select pg_temp.verificar('P2 Q2-Q9 FY intacta sem auditoria indevida',$q$select to_jsonb(f)=b.row and not exists(select 1 from public.prontuario_exclusoes where ficha_id='d0150001-0000-4000-8000-000000000102') from public.fichas f join m3_before2 b on b.t='fichas' and b.id=f.id where f.id='d0150001-0000-4000-8000-000000000102'$q$);
select pg_temp.recusar('P2 Q10 caixa false',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'confirmar_orcamento_aceito');
select pg_temp.recusar('P2 Q10 caixa null',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',null)$q$,'confirmar_orcamento_aceito');
select pg_temp.verificar('P2 Q10 intacto fichas',$q$select to_jsonb(r)=b.row from public.fichas r join m3_before2 b on b.t='fichas' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000108'$q$);
select pg_temp.verificar('P2 Q10 intacto orcamentos',$q$select to_jsonb(r)=b.row from public.orcamentos r join m3_before2 b on b.t='orcamentos' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000603'$q$);
select pg_temp.verificar('P2 Q10 intacto assinaturas',$q$select to_jsonb(r)=b.row from public.assinaturas r join m3_before2 b on b.t='assinaturas' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000802'$q$);
select pg_temp.verificar('P2 Q10 intacto documentos_aceite',$q$select to_jsonb(r)=b.row from public.documentos_aceite r join m3_before2 b on b.t='documentos_aceite' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000001002'$q$);
select pg_temp.verificar('P2 Q10 intacto pagamentos',$q$select to_jsonb(r)=b.row from public.pagamentos r join m3_before2 b on b.t='pagamentos' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000001202'$q$);
select pg_temp.verificar('P2 Q10 intacto orcamento_cobrancas',$q$select to_jsonb(r)=b.row from public.orcamento_cobrancas r join m3_before2 b on b.t='orcamento_cobrancas' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000001101'$q$);
select pg_temp.verificar('P2 Q10 intacto orcamento_itens',$q$select to_jsonb(r)=b.row from public.orcamento_itens r join m3_before2 b on b.t='orcamento_itens' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000701'$q$);
select pg_temp.verificar('P2 Q10 ponte intacta',$q$select to_jsonb(r)=b.row from public.orcamento_eventos r join m3_before2 b on b.t='orcamento_eventos' and b.id=r.evento_id where r.evento_id='d0150001-0000-4000-8000-000000000304'$q$);
select pg_temp.verificar('P2 Q10 sem auditoria',$q$select count(*)=0 from public.prontuario_exclusoes where ficha_id='d0150001-0000-4000-8000-000000000108'$q$);
select pg_temp.executar('P2 Q11 excluir FO confirmada',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$);
select pg_temp.executar('P2 Q11 excluir FP com pagamento',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000106','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$);
select pg_temp.verificar('P2 Q11 cobranca itens preservados',$q$select to_jsonb(r)=b.row from public.orcamento_cobranca_itens r join m3_before2 b on b.t='orcamento_cobranca_itens' and b.id=r.orcamento_item_id where r.cobranca_id='d0150001-0000-4000-8000-000000001101' and r.orcamento_item_id='d0150001-0000-4000-8000-000000000701'$q$);
select pg_temp.verificar('P2 Q11 fichas e pontes removidas',$q$select not exists(select 1 from public.fichas where id in ('d0150001-0000-4000-8000-000000000108','d0150001-0000-4000-8000-000000000106')) and not exists(select 1 from public.orcamento_eventos where evento_id='d0150001-0000-4000-8000-000000000304')$q$);
select pg_temp.verificar('P2 Q11 orcamento preservado 602',$q$select r.ficha_id is null and (to_jsonb(r)-'ficha_id'-'updated_at')=(b.row-'ficha_id'-'updated_at') from public.orcamentos r join m3_before2 b on b.t='orcamentos' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000602'$q$);
select pg_temp.verificar('P2 Q11 orcamento preservado 603',$q$select r.ficha_id is null and (to_jsonb(r)-'ficha_id'-'updated_at')=(b.row-'ficha_id'-'updated_at') from public.orcamentos r join m3_before2 b on b.t='orcamentos' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000603'$q$);
select pg_temp.verificar('P2 Q11 preservado assinaturas802',$q$select to_jsonb(r)=b.row from public.assinaturas r join m3_before2 b on b.t='assinaturas' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000802'$q$);
select pg_temp.verificar('P2 Q11 preservado pagamentos1201',$q$select to_jsonb(r)=b.row from public.pagamentos r join m3_before2 b on b.t='pagamentos' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000001201'$q$);
select pg_temp.verificar('P2 Q11 preservado pagamentos1202',$q$select to_jsonb(r)=b.row from public.pagamentos r join m3_before2 b on b.t='pagamentos' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000001202'$q$);
select pg_temp.verificar('P2 Q11 preservado orcamento_cobrancas1101',$q$select to_jsonb(r)=b.row from public.orcamento_cobrancas r join m3_before2 b on b.t='orcamento_cobrancas' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000001101'$q$);
select pg_temp.verificar('P2 Q11 preservado orcamento_itens701',$q$select to_jsonb(r)=b.row from public.orcamento_itens r join m3_before2 b on b.t='orcamento_itens' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000701'$q$);
select pg_temp.verificar('P2 Q11 documento somente desvinculado',$q$select r.ficha_id is null and (to_jsonb(r)-'ficha_id')=(b.row-'ficha_id') from public.documentos_aceite r join m3_before2 b on b.t='documentos_aceite' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000001002'$q$);
select pg_temp.verificar('P2 Q11 auditoria confirma guarda sem conteudo',$q$select count(*)=1 and bool_and((resumo->>'orcamentos_mantidos')::int=1 and resumo->'orcamentos_mantidos_ids' @> '["d0150001-0000-4000-8000-000000000603"]'::jsonb and (resumo->>'confirmou_orcamento_aceito')::boolean and resumo::text not like '%QA-TEXTO-CLINICO%') from public.prontuario_exclusoes where ficha_id='d0150001-0000-4000-8000-000000000108'$q$);
select pg_temp.recusar('P2 Q12 retirado',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000109','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$,'ficha_com_retirado');
select pg_temp.recusar('P2 Q12 encaminhado',$q$select public.excluir_ficha_clinica('d0150001-0000-4000-8000-000000000110','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$,'ficha_com_encaminhamento');
select pg_temp.verificar('P2 Q12 ficha intacta 109',$q$select to_jsonb(r)=b.row from public.fichas r join m3_before2 b on b.t='fichas' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000109'$q$);
select pg_temp.verificar('P2 Q12 ficha intacta 110',$q$select to_jsonb(r)=b.row from public.fichas r join m3_before2 b on b.t='fichas' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000110'$q$);
select pg_temp.verificar('P2 Q12 evento305 intacto',$q$select to_jsonb(r)=b.row from public.odontograma_eventos r join m3_before2 b on b.t='odontograma_eventos' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000305'$q$);
select pg_temp.verificar('P2 Q12 evento306 intacto',$q$select to_jsonb(r)=b.row from public.odontograma_eventos r join m3_before2 b on b.t='odontograma_eventos' and b.id=r.id where r.id='d0150001-0000-4000-8000-000000000306'$q$);
select pg_temp.executar('P2 Q13 V0 vazia',$q$select public.descartar_atendimento_vazio('d0150001-0000-4000-8000-000000000202')$q$);
select pg_temp.verificar('P2 Q13 V0 removida e auditada',$q$select not exists(select 1 from public.atendimentos_clinicos where id='d0150001-0000-4000-8000-000000000202') and exists(select 1 from public.prontuario_exclusoes where atendimento_id='d0150001-0000-4000-8000-000000000202' and tipo='atendimento_vazio' and excluido_por='b0000000-0000-4000-8000-0000000000a1' and excluido_por_usuario='b0000000-0000-4000-8000-00000000000a')$q$);
select pg_temp.recusar('P2 Q13 V2 estoque',$q$select public.descartar_atendimento_vazio('d0150001-0000-4000-8000-000000000204')$q$,'atendimento_com_conteudo');
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000d","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P2 Q13 Carlos V0b alheia',$q$select public.descartar_atendimento_vazio('d0150001-0000-4000-8000-000000000203')$q$,'sem_permissao');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P2 Q14 leitura Ana',$q$select count(*)=4 from public.prontuario_exclusoes where paciente_id='d0150001-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000d","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P2 Q14 leitura Carlos',$q$select count(*)=4 from public.prontuario_exclusoes where paciente_id='d0150001-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P2 Q14 leitura Alice',$q$select count(*)=4 from public.prontuario_exclusoes where paciente_id='d0150001-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P2 Q14 leitura Sara',$q$select count(*)=0 from public.prontuario_exclusoes where paciente_id='d0150001-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P2 Q14 leitura Protetico',$q$select count(*)=0 from public.prontuario_exclusoes where paciente_id='d0150001-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
set local role authenticated;

select pg_temp.verificar('P2 Q14 leitura Bruno',$q$select count(*)=0 from public.prontuario_exclusoes where paciente_id='d0150001-0000-4000-8000-000000000001'$q$);
reset role;set local request.jwt.claims='{"role":"anon"}';set local role anon;
select pg_temp.recusar('P2 Q14 anon sem SELECT',$q$select count(*) from public.prontuario_exclusoes$q$,'42501');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

select pg_temp.recusar('P2 Q15 INSERT direto auditoria',$q$insert into public.prontuario_exclusoes(clinica_id,tipo,paciente_id,ficha_id,excluido_por,excluido_por_usuario,motivo) values('b0000000-0000-4000-8000-000000000001','ficha','d0150001-0000-4000-8000-000000000001','d0150001-0000-4000-8000-000000000102','b0000000-0000-4000-8000-0000000000a1','b0000000-0000-4000-8000-00000000000a','aberta_por_engano')$q$,'42501');
select pg_temp.recusar('P2 Q15 UPDATE direto auditoria',$q$update public.prontuario_exclusoes set motivo='outro' where paciente_id='d0150001-0000-4000-8000-000000000001'$q$,'42501');
select pg_temp.recusar('P2 Q15 DELETE direto auditoria',$q$delete from public.prontuario_exclusoes where paciente_id='d0150001-0000-4000-8000-000000000001'$q$,'42501');
select pg_temp.recusar('P2 Q15 r169d acesso negado',$q$select public.excluir_ficha_propria_preservando_financeiro('d0150001-0000-4000-8000-000000000102')$q$,'42501');
select pg_temp.verificar('P2 Q15 sem activity_logs novos',$q$select (select count(*) from public.activity_logs where paciente_id='d0150001-0000-4000-8000-000000000001')=(select n from m3_log_before2)$q$);
reset role;
select pg_temp.verificar('P2 Q15 assinatura unica sem default',$q$select to_regprocedure('public.excluir_ficha_clinica(uuid,text,text,text)') is null and exists(select 1 from pg_proc where oid='public.excluir_ficha_clinica(uuid,text,text,text,boolean)'::regprocedure and pronargdefaults=0 and prosecdef and proconfig @> array['search_path=public']) and exists(select 1 from pg_proc where oid='public.descartar_atendimento_vazio(uuid)'::regprocedure and prosecdef and proconfig @> array['search_path=public'])$q$);
select pg_temp.verificar('P2 Q15 privilegios',$q$select not has_table_privilege('authenticated','public.atendimentos_clinicos','DELETE') and not has_function_privilege('authenticated','public.excluir_ficha_propria_preservando_financeiro(uuid)','EXECUTE') and not has_function_privilege('anon','public.excluir_ficha_clinica(uuid,text,text,text,boolean)','EXECUTE') and not has_function_privilege('anon','public.descartar_atendimento_vazio(uuid)','EXECUTE')$q$);

select pg_temp.recusar('Q16b formato alterado aborta reaplicacao',$q$alter table public.prontuario_exclusoes add column x int;create table if not exists public.prontuario_exclusoes (
  id                   uuid primary key default gen_random_uuid(),
  clinica_id           uuid not null references public.clinicas(id) on delete cascade,
  tipo                 text not null check (tipo in ('ficha', 'atendimento_vazio')),
  paciente_id          uuid,          -- sem FK: o registro sobrevive à exclusão do paciente
  ficha_id             uuid,          -- sem FK: a ficha não existe mais
  atendimento_id       uuid,          -- sem FK
  excluido_por         uuid not null, -- dentistas.id no ato
  excluido_por_usuario uuid not null, -- auth.uid() no ato
  motivo               text check (motivo in
                         ('paciente_errado', 'ficha_duplicada', 'aberta_por_engano', 'registro_incompleto', 'outro')),
  motivo_detalhe       text check (motivo_detalhe is null or char_length(motivo_detalhe) between 5 and 200),
  resumo               jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  constraint prontuario_exclusoes_alvo check (
    (tipo = 'ficha' and ficha_id is not null and motivo is not null)
    or (tipo = 'atendimento_vazio' and atendimento_id is not null and motivo is null)),
  constraint prontuario_exclusoes_detalhe_so_outro check (
    (motivo = 'outro') = (motivo_detalhe is not null))
);

do $$
begin
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'prontuario_exclusoes'
        and column_name in ('id', 'clinica_id', 'tipo', 'paciente_id', 'ficha_id', 'atendimento_id',
                            'excluido_por', 'excluido_por_usuario', 'motivo', 'motivo_detalhe',
                            'resumo', 'created_at')) <> 12
     or (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'prontuario_exclusoes') <> 12
     or not exists (select 1 from pg_constraint
                    where conrelid = 'public.prontuario_exclusoes'::regclass
                      and conname in ('prontuario_exclusoes_alvo', 'prontuario_exclusoes_detalhe_so_outro')
                    having count(*) = 2) then
    raise exception 'prontuario_exclusoes_formato_inesperado';
  end if;
end $$;

comment on table public.prontuario_exclusoes is
  'OD-015b1-2 — auditoria de exclusão de ficha e de visita vazia. Resumo sem conteúdo clínico. '
  'Escrita só pelas funções excluir_ficha_clinica e descartar_atendimento_vazio; leitura só admin/dentista.';

create index if not exists prontuario_exclusoes_clinica_idx
  on public.prontuario_exclusoes (clinica_id, created_at desc);
create index if not exists prontuario_exclusoes_paciente_idx
  on public.prontuario_exclusoes (clinica_id, paciente_id, created_at desc);

alter table public.prontuario_exclusoes enable row level security;
revoke all on table public.prontuario_exclusoes from public, anon, authenticated;
grant select on table public.prontuario_exclusoes to authenticated;

drop policy if exists prontuario_exclusoes_select on public.prontuario_exclusoes;
create policy prontuario_exclusoes_select on public.prontuario_exclusoes
  for select to authenticated
  using (public.belongs_to_active_clinic(clinica_id) and public.is_clinic_dentista());

create or replace function public.descartar_atendimento_vazio(p_atendimento_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller     uuid := public.get_my_dentista_id();
  v_role       text := public.get_my_role();
  v_row        public.atendimentos_clinicos%rowtype;
begin
  if v_clinica_id is null or v_caller is null
     or coalesce(v_role, '') not in ('admin', 'dentista')
     or not public.has_active_membership() then
    raise exception 'sem_permissao';
  end if;

  select * into v_row
  from public.atendimentos_clinicos a
  where a.id = p_atendimento_id and a.clinica_id = v_clinica_id
  for update;
  if not found then raise exception 'atendimento_nao_encontrado'; end if;
  if v_row.dentista_id <> v_caller then raise exception 'sem_permissao'; end if;

  if exists (select 1 from public.atendimento_eventos ae where ae.atendimento_id = v_row.id)
     or exists (select 1 from public.ficha_evolucoes fe where fe.atendimento_id = v_row.id)
     or exists (select 1 from public.estoque_usos eu where eu.atendimento_id = v_row.id) then
    raise exception 'atendimento_com_conteudo';
  end if;

  delete from public.atendimentos_clinicos where id = v_row.id;

  insert into public.prontuario_exclusoes
    (clinica_id, tipo, paciente_id, atendimento_id, excluido_por, excluido_por_usuario, resumo)
  values
    (v_clinica_id, 'atendimento_vazio', v_row.paciente_id, v_row.id, v_caller, auth.uid(),
     jsonb_build_object('estado', v_row.estado, 'origem', v_row.origem,
                        'data_atendimento', v_row.data_atendimento, 'criado_em', v_row.created_at));
  return true;
end;
$$;

create or replace function public.excluir_ficha_clinica(
  p_ficha_id                  uuid,
  p_motivo                    text,
  p_motivo_detalhe            text,
  p_nome_paciente             text,
  p_confirma_orcamento_aceito boolean   -- sem default: quem chama tem de dizer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller     uuid := public.get_my_dentista_id();
  v_role       text := public.get_my_role();
  v_ficha      public.fichas%rowtype;
  v_nome       text;
  v_detalhe    text := nullif(btrim(coalesce(p_motivo_detalhe, '')), '');
  v_eventos    uuid[];
  v_orcs       uuid[];
  v_mantidos   uuid[];
  v_apagados   int;
  v_pontes     int;
  v_visitas    uuid[];
  v_vazias     uuid[] := '{}';
  v_id         uuid;
  v_resumo     jsonb;
  v_exclusao   uuid;
begin
  if v_clinica_id is null or v_caller is null
     or coalesce(v_role, '') not in ('admin', 'dentista')
     or not public.has_active_membership() then
    raise exception 'sem_permissao';
  end if;
  -- fichas tem a policy RESTRITIVA commercial_write_fichas; SECURITY DEFINER passa por cima da RLS.
  if not private.commercial_write_allowed(v_clinica_id) then
    raise exception 'cobranca_bloqueada';
  end if;

  select * into v_ficha from public.fichas f
  where f.id = p_ficha_id and f.clinica_id = v_clinica_id
  for update;
  if not found then raise exception 'ficha_nao_encontrada'; end if;
  if v_ficha.dentista_id <> v_caller then raise exception 'sem_permissao'; end if;

  -- 1. Prova clínica: sempre recusa. O aceite DO ORÇAMENTO não é prova clínica (tratado no passo 5).
  if v_ficha.assinado_em is not null or v_ficha.assinatura_url is not null
     or exists (select 1 from public.odontograma_eventos e
                where e.ficha_id = v_ficha.id and e.assinatura_id is not null)
     or exists (select 1 from public.assinaturas a
                where a.ficha_id = v_ficha.id and a.tipo <> 'orcamento')
     or exists (select 1 from public.documentos_aceite d
                where d.ficha_id = v_ficha.id and d.tipo <> 'orcamento') then
    raise exception 'ficha_assinada';
  end if;

  -- 2. Procedimentos da ficha, travados.
  perform 1 from public.odontograma_eventos e
  where e.ficha_id = v_ficha.id and e.clinica_id = v_clinica_id
  order by e.id for update;
  select coalesce(array_agg(e.id), '{}') into v_eventos
  from public.odontograma_eventos e
  where e.ficha_id = v_ficha.id and e.clinica_id = v_clinica_id;

  -- 3. Os gatilhos da prova clínica barram apagar procedimento retirado ou encaminhado a outro
  --    dentista. Recusa clara antes, em vez do erro do gatilho.
  if exists (select 1 from public.odontograma_eventos e
             where e.id = any(v_eventos) and e.retirado_em is not null) then
    raise exception 'ficha_com_retirado';
  end if;
  if exists (select 1 from public.odontograma_eventos e
             where e.id = any(v_eventos)
               and e.encaminhado_para is not null and e.encaminhado_para <> v_caller) then
    raise exception 'ficha_com_encaminhamento';
  end if;

  -- 4. Motivo e nome do paciente (confirmação forte conferida no banco).
  if p_motivo is null or p_motivo not in
       ('paciente_errado', 'ficha_duplicada', 'aberta_por_engano', 'registro_incompleto', 'outro')
     or (p_motivo = 'outro' and (v_detalhe is null or char_length(v_detalhe) not between 5 and 200)) then
    raise exception 'motivo_invalido';
  end if;
  if p_motivo <> 'outro' then v_detalhe := null; end if;

  select p.nome into v_nome from public.pacientes p
  where p.id = v_ficha.paciente_id and p.clinica_id = v_clinica_id;
  if v_nome is null
     or lower(regexp_replace(btrim(coalesce(p_nome_paciente, '')), '\s+', ' ', 'g'))
        <> lower(regexp_replace(btrim(v_nome), '\s+', ' ', 'g')) then
    raise exception 'confirmacao_invalida';
  end if;

  -- 5. Orçamentos da ficha (pelo ficha_id ou pelas pontes), travados.
  perform 1 from public.orcamentos o
  where o.clinica_id = v_clinica_id
    and (o.ficha_id = v_ficha.id
         or o.id in (select oe.orcamento_id from public.orcamento_eventos oe
                     where oe.evento_id = any(v_eventos)))
  order by o.id for update;
  select coalesce(array_agg(o.id), '{}') into v_orcs
  from public.orcamentos o
  where o.clinica_id = v_clinica_id
    and (o.ficha_id = v_ficha.id
         or o.id in (select oe.orcamento_id from public.orcamento_eventos oe
                     where oe.evento_id = any(v_eventos)));

  if exists (select 1 from public.orcamentos o
             where o.id = any(v_orcs) and o.paciente_id is distinct from v_ficha.paciente_id) then
    raise exception 'ficha_contexto_invalido';
  end if;

  -- Orçamento com aceite ou com movimento financeiro: é MANTIDO, e só se apaga a ficha
  -- com a caixa de confirmação marcada.
  select coalesce(array_agg(o.id), '{}') into v_mantidos
  from public.orcamentos o
  where o.id = any(v_orcs)
    and (o.status = 'aprovado' or o.aprovado_em is not null
         or exists (select 1 from public.orcamento_itens i where i.orcamento_id = o.id and i.aprovado)
         or exists (select 1 from public.assinaturas a where a.orcamento_id = o.id)
         or exists (select 1 from public.documentos_aceite d where d.orcamento_id = o.id)
         or exists (select 1 from public.pagamentos p where p.orcamento_id = o.id)
         or exists (select 1 from public.orcamento_cobrancas c where c.orcamento_id = o.id));

  if cardinality(v_mantidos) > 0 and p_confirma_orcamento_aceito is not true then
    raise exception 'confirmar_orcamento_aceito';
  end if;

  -- Orçamento sem aceite e sem movimento, ligado à ficha: sai junto, como antes.
  select count(*) into v_apagados from public.orcamentos o
  where o.id = any(v_orcs) and not (o.id = any(v_mantidos)) and o.ficha_id = v_ficha.id;
  select count(*) into v_pontes from public.orcamento_eventos oe where oe.evento_id = any(v_eventos);

  select coalesce(array_agg(distinct s.x), '{}') into v_visitas from (
    select fe.atendimento_id as x from public.ficha_evolucoes fe
    where fe.ficha_id = v_ficha.id and fe.atendimento_id is not null
    union
    select ae.atendimento_id from public.atendimento_eventos ae
    where ae.evento_id = any(v_eventos)
  ) s;

  -- RESUMO: só contagens, datas e ids. Nada de texto, dente ou nome de procedimento.
  v_resumo := jsonb_build_object(
    'data_atendimento',  v_ficha.data_atendimento,
    'ficha_criada_em',   v_ficha.created_at,
    'origem',            v_ficha.origem,
    'evolucoes',         (select count(*) from public.ficha_evolucoes fe where fe.ficha_id = v_ficha.id),
    'procedimentos',     cardinality(v_eventos),
    'procedimentos_realizados',
                         (select count(*) from public.odontograma_eventos e
                          where e.id = any(v_eventos) and e.status = 'realizado'),
    'arquivos',          (select count(*) from public.ficha_arquivos a where a.ficha_id = v_ficha.id),
    'planejamentos',     (select count(*) from public.planejamentos p where p.ficha_id = v_ficha.id),
    'orcamentos_apagados',            v_apagados,
    'orcamentos_mantidos',            cardinality(v_mantidos),
    'orcamentos_mantidos_ids',        to_jsonb(v_mantidos),
    'vinculos_orcamento_desligados',  v_pontes,
    'confirmou_orcamento_aceito',     cardinality(v_mantidos) > 0);

  -- 6. Desliga o orçamento mantido da ficha. Nada comercial é apagado.
  update public.orcamentos set ficha_id = null
  where id = any(v_mantidos) and ficha_id = v_ficha.id;
  update public.documentos_aceite set ficha_id = null
  where ficha_id = v_ficha.id and tipo = 'orcamento';
  delete from public.orcamento_eventos where evento_id = any(v_eventos);

  delete from public.fichas where id = v_ficha.id;

  foreach v_id in array v_visitas loop
    delete from public.atendimentos_clinicos a
    where a.id = v_id and a.clinica_id = v_clinica_id and a.dentista_id = v_caller
      and not exists (select 1 from public.atendimento_eventos ae where ae.atendimento_id = a.id)
      and not exists (select 1 from public.ficha_evolucoes fe where fe.atendimento_id = a.id)
      and not exists (select 1 from public.estoque_usos eu where eu.atendimento_id = a.id);
    if found then v_vazias := v_vazias || v_id; end if;
  end loop;

  insert into public.prontuario_exclusoes
    (clinica_id, tipo, paciente_id, ficha_id, excluido_por, excluido_por_usuario,
     motivo, motivo_detalhe, resumo)
  values
    (v_clinica_id, 'ficha', v_ficha.paciente_id, v_ficha.id, v_caller, auth.uid(),
     p_motivo, v_detalhe,
     v_resumo || jsonb_build_object('visitas_descartadas', cardinality(v_vazias)))
  returning id into v_exclusao;

  return jsonb_build_object('exclusao_id', v_exclusao,
                            'visitas_descartadas', cardinality(v_vazias),
                            'orcamentos_mantidos', cardinality(v_mantidos));
end;
$$;

revoke all on function public.descartar_atendimento_vazio(uuid) from public, anon;
grant execute on function public.descartar_atendimento_vazio(uuid) to authenticated;
revoke all on function public.excluir_ficha_clinica(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.excluir_ficha_clinica(uuid, text, text, text, boolean) to authenticated;

revoke execute on function public.excluir_ficha_propria_preservando_financeiro(uuid)
  from public, anon, authenticated;$q$,'prontuario_exclusoes_formato_inesperado');

select pg_temp.verificar('Q16b alteracao revertida',$q$select not exists(select 1 from information_schema.columns where table_schema='public' and table_name='prontuario_exclusoes' and column_name='x')$q$);

select caso,passou,detalhe from od015m3_resultados order by caso;
do $final$
declare v_falhas text;
begin
 select string_agg(caso||' ['||coalesce(detalhe,'sem detalhe')||']','; ' order by caso) into v_falhas from od015m3_resultados where passou is not true;
 if v_falhas is not null then raise exception 'OD015M3 NAO PASSA: %; ROLLBACK se sessao continuar aberta',v_falhas;end if;
end;
$final$;
rollback;
