-- OD-015b1 M3b: C1-C11, APENAS odonto-qa uhuxteswtvgdnlixwrdu.
-- Escrito/NAO EXECUTADO pelo Dev. Rodar SOMENTE em janela aprovada apos M3b aplicada.
-- Seed sintetico derivado da M3, faixas d015b100/d015b101; nunca o paciente/ES e015.
-- Um BEGIN/ROLLBACK inclui dados, testes e DDL de volta/reaplicacao. Nenhum gatilho e contornado.
-- Saida: somente nomes de testes/booleanos/SQLSTATE; NUNCA conteudo da copia.
-- Executar od015b1_2_apagar.sql INTEIRO (Q1-Q16b) depois, sem editar a M3.
-- O executor confere o host QA ANTES de executar; nao aplicar M3b neste preflight.
begin;
set local search_path=pg_catalog,public,pg_temp;
do $pre$
begin
 if to_regclass('public.prontuario_exclusoes_copias') is null
    or to_regprocedure('public.excluir_ficha_clinica(uuid,text,text,text,boolean)') is null then
   raise exception 'M3b ausente: C1-C11 NAO PASSAM antes da aplicacao';
 end if;
 if has_table_privilege('authenticated','public.fichas','DELETE') then
   raise exception 'M3b ausente/incompleta: DELETE direto ainda permitido';
 end if;
end;
$pre$;
create temp table m3b_resultados(caso text,passou boolean,detalhe text);
grant select,insert on m3b_resultados to authenticated,anon;
create function pg_temp.verificar(p_caso text,p_sql text) returns void
language plpgsql security invoker as $fn$
declare v_ok boolean;v_estado text;
begin
 begin execute p_sql into v_ok;
 exception when others then get stacked diagnostics v_estado=returned_sqlstate;
 end;
 insert into m3b_resultados values(p_caso,coalesce(v_ok,false),v_estado);
end;
$fn$;
create function pg_temp.recusar(p_caso text,p_sql text,p_erro text) returns void
language plpgsql security invoker as $fn$
declare v_estado text;v_msg text;
begin
 begin
  execute p_sql;
  raise exception using errcode='Z0154',message='probe_indevidamente_aceito';
 exception when others then get stacked diagnostics v_estado=returned_sqlstate,v_msg=message_text;
 end;
 insert into m3b_resultados values(p_caso,v_estado<>'Z0154' and (v_estado=p_erro or v_msg=p_erro),'estado='||v_estado||'; esperado='||p_erro);
end;
$fn$;
create function pg_temp.executar(p_caso text,p_sql text) returns void
language plpgsql security invoker as $fn$
declare v_estado text;
begin
 begin execute p_sql;
 exception when others then get stacked diagnostics v_estado=returned_sqlstate;
 end;
 insert into m3b_resultados values(p_caso,v_estado is null,v_estado);
end;
$fn$;
create temp table m3b_baseline as
 select md5(pg_get_functiondef('public.excluir_ficha_clinica(uuid,text,text,text,boolean)'::regprocedure)) as hash,
 has_function_privilege('authenticated','public.excluir_ficha_clinica(uuid,text,text,text,boolean)','EXECUTE') as exec;

-- P1: C1-C10 completos, seed independente.
reset role;
insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','Paciente Exclusao SQL');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000101','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FX','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000102','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FY','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000103','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FA','manual','aberta','2026-10-25','2026-10-25T10:00:00Z');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000104','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FS','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000105','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FD','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000106','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FP','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000107','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000d1','OD015M3b FC','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000108','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FO','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000109','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FR','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b100-0000-4000-8000-000000000110','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FE','manual','aberta','2026-10-25',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b100-0000-4000-8000-000000000201','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b100-0000-4000-8000-000000000201','2026-10-25','ficha','finalizado','2026-10-25T10:01:00Z');
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b100-0000-4000-8000-000000000202','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b100-0000-4000-8000-000000000202','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b100-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b100-0000-4000-8000-000000000203','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b100-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b100-0000-4000-8000-000000000204','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b100-0000-4000-8000-000000000205','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000d1','d015b100-0000-4000-8000-000000000205','2026-10-25','ficha','preparando',null);
insert into public.assinaturas(id,clinica_id,paciente_id,dentista_id,tipo,ficha_id,assinado_por,cro_no_ato,assinatura_ref) values('d015b100-0000-4000-8000-000000000801','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','procedimentos','d015b100-0000-4000-8000-000000000104','QA paciente sintetico','TESTE-A','qa/d015b100/assinatura-procedimento.png');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b100-0000-4000-8000-000000000301','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b100-0000-4000-8000-000000000302','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000102','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b100-0000-4000-8000-000000000303','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000104','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25','d015b100-0000-4000-8000-000000000801',null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b100-0000-4000-8000-000000000304','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000108','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b100-0000-4000-8000-000000000305','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000109','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25',null,'2026-10-25T10:02:00Z',null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b100-0000-4000-8000-000000000306','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000110','b0000000-0000-4000-8000-0000000000a1','profilaxia','indicado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico',null,null,null,'c0000000-0000-4000-8000-0000000000d1');
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d015b100-0000-4000-8000-000000000401','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000101','d015b100-0000-4000-8000-000000000201','b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FX',false);
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d015b100-0000-4000-8000-000000000402','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000102',null,'b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FY',false);
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d015b100-0000-4000-8000-000000000403','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000108',null,'b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FO',false);
insert into public.atendimento_eventos(clinica_id,atendimento_id,evento_id,papel) values('b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000201','d015b100-0000-4000-8000-000000000301','realizado');
insert into public.ficha_arquivos(id,clinica_id,ficha_id,tipo,nome_original,storage_url,texto_extraido) values('d015b100-0000-4000-8000-000000000501','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000101','outro','QA documento ficticio.txt','qa/d015b100/arquivo-ficticio','QA-TEXTO-ARQUIVO-FX');
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d015b100-0000-4000-8000-000000000601','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b100-0000-4000-8000-000000000101','rascunho',null,100);
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d015b100-0000-4000-8000-000000000602','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b100-0000-4000-8000-000000000106','rascunho',null,100);
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d015b100-0000-4000-8000-000000000603','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b100-0000-4000-8000-000000000108','aprovado','2026-10-25T10:03:00Z',100);
insert into public.orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado) values('d015b100-0000-4000-8000-000000000701','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000603','QA item financeiro ficticio',1,100,100,true);
insert into public.orcamento_eventos(clinica_id,orcamento_id,evento_id,item_id) values('b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000603','d015b100-0000-4000-8000-000000000304','d015b100-0000-4000-8000-000000000701');
insert into public.assinaturas(id,clinica_id,paciente_id,dentista_id,tipo,orcamento_id,assinado_por,cro_no_ato,assinatura_ref) values('d015b100-0000-4000-8000-000000000802','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','orcamento','d015b100-0000-4000-8000-000000000603','QA paciente sintetico','TESTE-A','qa/d015b100/aceite.png');
insert into public.paciente_documentos(id,clinica_id,paciente_id,nome,url) values('d015b100-0000-4000-8000-000000000901','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','OD015M3b documento ficticio','qa/d015b100/documento-901.pdf');
insert into public.documentos_aceite(id,clinica_id,paciente_id,dentista_id,ficha_id,orcamento_id,assinatura_id,tipo,template_versao,template_hash,conteudo_snapshot,assinatura_paciente_ref,assinado_por,pdf_path,paciente_documento_id) values('d015b100-0000-4000-8000-000000001001','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b100-0000-4000-8000-000000000105',null,null,'tcle','QA-OD015M3b','QA-HASH-SINTETICO','{}','qa/d015b100/aceite.png','QA paciente sintetico','qa/d015b100/documento-901.pdf','d015b100-0000-4000-8000-000000000901');
insert into public.paciente_documentos(id,clinica_id,paciente_id,nome,url) values('d015b100-0000-4000-8000-000000000902','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','OD015M3b documento ficticio','qa/d015b100/documento-902.pdf');
insert into public.documentos_aceite(id,clinica_id,paciente_id,dentista_id,ficha_id,orcamento_id,assinatura_id,tipo,template_versao,template_hash,conteudo_snapshot,assinatura_paciente_ref,assinado_por,pdf_path,paciente_documento_id) values('d015b100-0000-4000-8000-000000001002','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b100-0000-4000-8000-000000000108','d015b100-0000-4000-8000-000000000603','d015b100-0000-4000-8000-000000000802','orcamento','QA-OD015M3b','QA-HASH-SINTETICO','{}','qa/d015b100/aceite.png','QA paciente sintetico','qa/d015b100/documento-902.pdf','d015b100-0000-4000-8000-000000000902');
insert into public.orcamento_cobrancas(id,clinica_id,orcamento_id,paciente_id,dentista_id,subtotal,valor_final) values('d015b100-0000-4000-8000-000000001101','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000603','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,100);
insert into public.orcamento_cobranca_itens(cobranca_id,orcamento_item_id,clinica_id,preco_total_snapshot) values('d015b100-0000-4000-8000-000000001101','d015b100-0000-4000-8000-000000000701','b0000000-0000-4000-8000-000000000001',100);
insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values('d015b100-0000-4000-8000-000000001201','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000602',null,'d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,'pendente','2026-10-25');
insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values('d015b100-0000-4000-8000-000000001202','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000603','d015b100-0000-4000-8000-000000001101','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,'pendente','2026-10-25');
insert into public.estoque_itens(id,clinica_id,titular_tipo,nome,unidade_base) values('d015b100-0000-4000-8000-000000001301','b0000000-0000-4000-8000-000000000001','clinica','QA OD015M3b material ficticio','unidade');
insert into public.estoque_lotes(id,clinica_id,item_id,origem_sem_identificacao) values('d015b100-0000-4000-8000-000000001302','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000001301',true);
insert into public.estoque_usos(id,clinica_id,atendimento_id,linha_origem_id,autor_usuario_id,snapshot_material,quantidade_declarada,unidade_declarada,item_id,lote_id) values('d015b100-0000-4000-8000-000000001303','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000204','d015b100-0000-4000-8000-000000001304','b0000000-0000-4000-8000-00000000000a','QA OD015M3b material ficticio',1,'unidade','d015b100-0000-4000-8000-000000001301','d015b100-0000-4000-8000-000000001302');


insert into public.orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado)
values('d015b100-0000-4000-8000-000000000702','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000601','QA item rascunho FX',1,100,100,false);
insert into public.orcamento_eventos(clinica_id,orcamento_id,evento_id,item_id)
values('b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000601','d015b100-0000-4000-8000-000000000301','d015b100-0000-4000-8000-000000000702');
insert into public.planejamentos(id,clinica_id,ficha_id,paciente_id,dentista_id,titulo)
values('d015b100-0000-4000-8000-000000001401','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000101','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','QA plano FX');
insert into public.planejamento_procedimentos(id,clinica_id,paciente_id,dentista_id,descricao,ficha_ref,ordem)
values('d015b100-0000-4000-8000-000000001402','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','QA planejamento FX','d015b100-0000-4000-8000-000000000101::qa',1);

create temp table expected_P1 as
select jsonb_build_object(
 'ficha',(select to_jsonb(r) from public.fichas r where id='d015b100-0000-4000-8000-000000000101'),
 'evolucao',(select to_jsonb(r) from public.ficha_evolucoes r where id='d015b100-0000-4000-8000-000000000401'),
 'procedimento',(select to_jsonb(r) from public.odontograma_eventos r where id='d015b100-0000-4000-8000-000000000301'),
 'arquivo',(select to_jsonb(r) from public.ficha_arquivos r where id='d015b100-0000-4000-8000-000000000501'),
 'planejamento',(select to_jsonb(r) from public.planejamentos r where id='d015b100-0000-4000-8000-000000001401'),
 'planejamento_procedimento',(select to_jsonb(r) from public.planejamento_procedimentos r where id='d015b100-0000-4000-8000-000000001402'),
 'orcamento',(select to_jsonb(r) from public.orcamentos r where id='d015b100-0000-4000-8000-000000000601'),
 'item',(select to_jsonb(r) from public.orcamento_itens r where id='d015b100-0000-4000-8000-000000000702'),
 'visita',(select to_jsonb(r) from public.atendimento_eventos r where evento_id='d015b100-0000-4000-8000-000000000301'),
 'ponte',(select to_jsonb(r) from public.orcamento_eventos r where evento_id='d015b100-0000-4000-8000-000000000301')
) as valor;
create temp table log_P1 as select count(*) n from public.activity_logs where paciente_id='d015b100-0000-4000-8000-000000000001';
create temp table financeiro_P1 as
select 'orcamentos' as t,to_jsonb(r)-'ficha_id'-'updated_at' as valor from public.orcamentos r where id='d015b100-0000-4000-8000-000000000603'
union all select 'assinaturas',to_jsonb(r) from public.assinaturas r where id='d015b100-0000-4000-8000-000000000802'
union all select 'documentos_aceite',to_jsonb(r)-'ficha_id' from public.documentos_aceite r where id='d015b100-0000-4000-8000-000000001002'
union all select 'orcamento_itens',to_jsonb(r) from public.orcamento_itens r where id='d015b100-0000-4000-8000-000000000701'
union all select 'orcamento_cobrancas',to_jsonb(r) from public.orcamento_cobrancas r where id='d015b100-0000-4000-8000-000000001101'
union all select 'orcamento_cobranca_itens',to_jsonb(r) from public.orcamento_cobranca_itens r where cobranca_id='d015b100-0000-4000-8000-000000001101'
union all select 'pagamentos',to_jsonb(r) from public.pagamentos r where id='d015b100-0000-4000-8000-000000001202';
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.executar('P1 C1 RPC apaga FX',$q$select public.excluir_ficha_clinica('d015b100-0000-4000-8000-000000000101','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$);
reset role;
select pg_temp.verificar('P1 C1 uma copia vinculada e resumo sem conteudo',$q$select count(*)=1 and bool_and(c.exclusao_id=a.id and c.ficha_id=a.ficha_id and c.clinica_id=a.clinica_id and c.versao=1 and a.resumo->>'copia_guardada'='true' and a.resumo::text not like '%QA-TEXTO-CLINICO-FX%') from public.prontuario_exclusoes_copias c join public.prontuario_exclusoes a on a.id=c.exclusao_id where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 snapshot integral ficha',$q$select c.conteudo #> '{ficha}' = e.valor->'ficha' from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 snapshot integral evolucao',$q$select c.conteudo #> '{evolucoes,0}' = e.valor->'evolucao' from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 snapshot integral procedimento',$q$select c.conteudo #> '{procedimentos,0}' = e.valor->'procedimento' from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 snapshot integral arquivo',$q$select c.conteudo #> '{arquivos,0}' = e.valor->'arquivo' from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 snapshot integral planejamento',$q$select c.conteudo #> '{planejamentos,0}' = e.valor->'planejamento' from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 snapshot integral planejamento_procedimento',$q$select c.conteudo #> '{planejamento_procedimentos,0}' = e.valor->'planejamento_procedimento' from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 snapshot integral item',$q$select c.conteudo #> '{orcamentos_apagados,0,itens,0}' = e.valor->'item' from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 snapshot integral visita',$q$select c.conteudo #> '{vinculos_visita,0}' = e.valor->'visita' from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 snapshot integral ponte',$q$select c.conteudo #> '{vinculos_orcamento,0}' = e.valor->'ponte' from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 orcamento rascunho integral com item',$q$select (c.conteudo #> '{orcamentos_apagados,0}')-'itens'=e.valor->'orcamento' and jsonb_array_length(c.conteudo->'orcamentos_apagados')=1 and jsonb_array_length(c.conteudo #> '{orcamentos_apagados,0,itens}')=1 from public.prontuario_exclusoes_copias c cross join expected_P1 e where c.ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 texto clinico e referencia sem binarios',$q$select conteudo #>> '{evolucoes,0,texto}'='QA-TEXTO-CLINICO-FX' and conteudo #>> '{arquivos,0,texto_extraido}'='QA-TEXTO-ARQUIVO-FX' and conteudo #>> '{arquivos,0,storage_url}'='qa/d015b100/arquivo-ficticio' and not (conteudo ? 'paciente') and (select count(*)=9 from jsonb_object_keys(conteudo)) from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 cardinalidade evolucoes',$q$select jsonb_array_length(conteudo->'evolucoes')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 cardinalidade procedimentos',$q$select jsonb_array_length(conteudo->'procedimentos')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 cardinalidade arquivos',$q$select jsonb_array_length(conteudo->'arquivos')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 cardinalidade planejamentos',$q$select jsonb_array_length(conteudo->'planejamentos')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 cardinalidade planejamento_procedimentos',$q$select jsonb_array_length(conteudo->'planejamento_procedimentos')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 cardinalidade vinculos_visita',$q$select jsonb_array_length(conteudo->'vinculos_visita')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 cardinalidade vinculos_orcamento',$q$select jsonb_array_length(conteudo->'vinculos_orcamento')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P1 C1 conteudo saiu do prontuario',$q$select not exists(select 1 from public.fichas where id='d015b100-0000-4000-8000-000000000101') and not exists(select 1 from public.ficha_evolucoes where ficha_id='d015b100-0000-4000-8000-000000000101') and not exists(select 1 from public.odontograma_eventos where ficha_id='d015b100-0000-4000-8000-000000000101') and not exists(select 1 from public.orcamentos where id='d015b100-0000-4000-8000-000000000601')$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P1 C2 Alice admin A le copia',$q$select count(*)=1 from public.prontuario_exclusoes_copias where paciente_id='d015b100-0000-4000-8000-000000000001'$q$);
select pg_temp.recusar('P1 C4 admin sem insert',$q$insert into public.prontuario_exclusoes_copias select * from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$,'42501');
select pg_temp.recusar('P1 C4 admin sem update',$q$update public.prontuario_exclusoes_copias set versao=2 where ficha_id='d015b100-0000-4000-8000-000000000101'$q$,'42501');
select pg_temp.recusar('P1 C4 admin sem delete',$q$delete from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000101'$q$,'42501');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P1 C3 Ana nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b100-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000d","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P1 C3 Carlos nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b100-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P1 C3 Sara nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b100-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P1 C3 Protetico nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b100-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P1 C3 Bruno nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b100-0000-4000-8000-000000000001'$q$);
reset role;
do $adminb$
declare v_usuario uuid;v_total bigint;
begin
 select cm.usuario_id into v_usuario from public.clinica_usuarios cm
 where cm.clinica_id='b0000000-0000-4000-8000-000000000002' and cm.role='admin' and cm.status='ativo' limit 1;
 if v_usuario is not null then
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_usuario,'role','authenticated')::text,true);
  set local role authenticated;
  select count(*) into v_total from public.prontuario_exclusoes_copias where paciente_id='d015b100-0000-4000-8000-000000000001';
  reset role;
  insert into m3b_resultados values('P1 C3 admin B nao le copia',v_total=0,null);
 else
  insert into m3b_resultados values('P1 C3 admin B inexistente: nao aplicavel',true,'sem conta admin B');
 end if;
end;
$adminb$;
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}';
set local role anon;
select pg_temp.recusar('P1 C3 anon sem SELECT',$q$select * from public.prontuario_exclusoes_copias$q$,'42501');
reset role;
select pg_temp.recusar('P1 C5 postgres nao altera copia',$q$update public.prontuario_exclusoes_copias set conteudo=conteudo where ficha_id='d015b100-0000-4000-8000-000000000101'$q$,'copia_prontuario_imutavel');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('P1 C6 FO sem caixa',$q$select public.excluir_ficha_clinica('d015b100-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'confirmar_orcamento_aceito');
select pg_temp.recusar('P1 C6 FR retirado',$q$select public.excluir_ficha_clinica('d015b100-0000-4000-8000-000000000109','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_com_retirado');
reset role;
select pg_temp.verificar('P1 C6 zero copias e auditoria das recusas',$q$select not exists(select 1 from public.prontuario_exclusoes_copias where ficha_id in ('d015b100-0000-4000-8000-000000000108','d015b100-0000-4000-8000-000000000109')) and not exists(select 1 from public.prontuario_exclusoes where ficha_id in ('d015b100-0000-4000-8000-000000000108','d015b100-0000-4000-8000-000000000109')) and (select count(*)=2 from public.fichas where id in ('d015b100-0000-4000-8000-000000000108','d015b100-0000-4000-8000-000000000109'))$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.executar('P1 C7 FO com caixa',$q$select public.excluir_ficha_clinica('d015b100-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$);
reset role;
select pg_temp.verificar('P1 C7 copia nao inclui orcamento mantido',$q$select count(*)=1 and bool_and(conteudo #>> '{ficha,id}'='d015b100-0000-4000-8000-000000000108' and jsonb_array_length(conteudo->'vinculos_orcamento')=1 and conteudo->'orcamentos_apagados'='[]'::jsonb) from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000108'$q$);
select pg_temp.verificar('P1 C7 preserva orcamentos',$q$select count(*)=1 and bool_and(exists(select 1 from public.orcamentos r where to_jsonb(r)-'ficha_id'-'updated_at'=e.valor)) from financeiro_P1 e where e.t='orcamentos'$q$);
select pg_temp.verificar('P1 C7 preserva assinaturas',$q$select count(*)=1 and bool_and(exists(select 1 from public.assinaturas r where to_jsonb(r)=e.valor)) from financeiro_P1 e where e.t='assinaturas'$q$);
select pg_temp.verificar('P1 C7 preserva documentos_aceite',$q$select count(*)=1 and bool_and(exists(select 1 from public.documentos_aceite r where to_jsonb(r)-'ficha_id'=e.valor)) from financeiro_P1 e where e.t='documentos_aceite'$q$);
select pg_temp.verificar('P1 C7 preserva orcamento_itens',$q$select count(*)=1 and bool_and(exists(select 1 from public.orcamento_itens r where to_jsonb(r)=e.valor)) from financeiro_P1 e where e.t='orcamento_itens'$q$);
select pg_temp.verificar('P1 C7 preserva orcamento_cobrancas',$q$select count(*)=1 and bool_and(exists(select 1 from public.orcamento_cobrancas r where to_jsonb(r)=e.valor)) from financeiro_P1 e where e.t='orcamento_cobrancas'$q$);
select pg_temp.verificar('P1 C7 preserva orcamento_cobranca_itens',$q$select count(*)=1 and bool_and(exists(select 1 from public.orcamento_cobranca_itens r where to_jsonb(r)=e.valor)) from financeiro_P1 e where e.t='orcamento_cobranca_itens'$q$);
select pg_temp.verificar('P1 C7 preserva pagamentos',$q$select count(*)=1 and bool_and(exists(select 1 from public.pagamentos r where to_jsonb(r)=e.valor)) from financeiro_P1 e where e.t='pagamentos'$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('P1 C8 DELETE direto negado',$q$delete from public.fichas where id='d015b100-0000-4000-8000-000000000102'$q$,'42501');
reset role;
select pg_temp.verificar('P1 C8 FY intacta',$q$select count(*)=1 from public.fichas where id='d015b100-0000-4000-8000-000000000102'$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.executar('P1 C9 descartar V0',$q$select public.descartar_atendimento_vazio('d015b100-0000-4000-8000-000000000202')$q$);
reset role;
select pg_temp.verificar('P1 C9 visita sem copia',$q$select not exists(select 1 from public.atendimentos_clinicos where id='d015b100-0000-4000-8000-000000000202') and exists(select 1 from public.prontuario_exclusoes a where a.atendimento_id='d015b100-0000-4000-8000-000000000202' and not exists(select 1 from public.prontuario_exclusoes_copias c where c.exclusao_id=a.id))$q$);
select pg_temp.verificar('P1 C10 RLS e policy admin unica',$q$select c.relrowsecurity and (select count(*)=1 and bool_and(cmd='SELECT' and qual like '%is_clinic_admin%' and qual like '%belongs_to_active_clinic%') from pg_policies where schemaname='public' and tablename='prontuario_exclusoes_copias') from pg_class c where c.oid='public.prontuario_exclusoes_copias'::regclass$q$);
select pg_temp.verificar('P1 C10 grants authenticated',$q$select not has_table_privilege('authenticated','public.prontuario_exclusoes_copias','INSERT') and not has_table_privilege('authenticated','public.prontuario_exclusoes_copias','UPDATE') and not has_table_privilege('authenticated','public.prontuario_exclusoes_copias','DELETE')$q$);
select pg_temp.verificar('P1 C10 grants anon',$q$select not has_table_privilege('anon','public.prontuario_exclusoes_copias','INSERT') and not has_table_privilege('anon','public.prontuario_exclusoes_copias','UPDATE') and not has_table_privilege('anon','public.prontuario_exclusoes_copias','DELETE')$q$);
select pg_temp.verificar('P1 C10 trigger update imutavel',$q$select exists(select 1 from pg_trigger where tgrelid='public.prontuario_exclusoes_copias'::regclass and tgname='prontuario_exclusoes_copias_imutavel' and tgenabled='O' and tgtype=19 and tgfoid='private.bloquear_alteracao_copia_prontuario()'::regprocedure)$q$);
select pg_temp.verificar('P1 C10 5args definer sem overload e grants preservados',$q$select p.pronargs=5 and p.pronargdefaults=0 and p.prosecdef and (select count(*)=1 from pg_proc where proname='excluir_ficha_clinica' and pronamespace='public'::regnamespace) and has_function_privilege('authenticated',p.oid,'EXECUTE')=(select exec from m3b_baseline) and not has_function_privilege('anon',p.oid,'EXECUTE') from pg_proc p where p.oid='public.excluir_ficha_clinica(uuid,text,text,text,boolean)'::regprocedure$q$);
select pg_temp.verificar('P1 C10 sem FK de paciente ou ficha',$q$select not exists(select 1 from pg_constraint where conrelid='public.prontuario_exclusoes_copias'::regclass and contype='f' and confrelid in ('public.pacientes'::regclass,'public.fichas'::regclass))$q$);
select pg_temp.verificar('P1 C10 nenhum activity log novo',$q$select count(*)=(select n from log_P1) from public.activity_logs where paciente_id='d015b100-0000-4000-8000-000000000001'$q$);

insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d015b100-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','Paciente Copia Extra SQL');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status,data_atendimento) values('d015b100-0000-4000-8000-000000000111','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000002','b0000000-0000-4000-8000-0000000000a1','manual','aberta','2026-10-25');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status,data_atendimento) values('d015b100-0000-4000-8000-000000000112','b0000000-0000-4000-8000-000000000001','d015b100-0000-4000-8000-000000000002','b0000000-0000-4000-8000-0000000000a1','manual','aberta','2026-10-25');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.executar('P1 C10 copia do paciente extra',$q$select public.excluir_ficha_clinica('d015b100-0000-4000-8000-000000000111','aberta_por_engano',null,'Paciente Copia Extra SQL',false)$q$);
reset role;
create temp table extra_P1 as select md5(conteudo::text) hash from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000111';
select pg_temp.executar('P1 C10 excluir paciente extra por cascade',$q$delete from public.pacientes where id='d015b100-0000-4000-8000-000000000002'$q$);
select pg_temp.verificar('P1 C10 copia fica apos paciente excluido',$q$select count(*)=1 and bool_and(md5(conteudo::text)=(select hash from extra_P1)) from public.prontuario_exclusoes_copias where ficha_id='d015b100-0000-4000-8000-000000000111'$q$);
select pg_temp.verificar('P1 C10 paciente extra e ficha viva sairam',$q$select not exists(select 1 from public.pacientes where id='d015b100-0000-4000-8000-000000000002') and not exists(select 1 from public.fichas where id='d015b100-0000-4000-8000-000000000112')$q$);

-- C11: volta literal e reaplicacao literal, sem COMMIT/BEGIN internos.
reset role;
create temp table copias_antes_ciclo as select count(*) n,
 md5(coalesce(jsonb_agg(to_jsonb(c) order by exclusao_id),'[]'::jsonb)::text) hash from public.prontuario_exclusoes_copias c;
do $ciclo$
begin
 execute $volta$
CREATE OR REPLACE FUNCTION public.excluir_ficha_clinica(p_ficha_id uuid, p_motivo text, p_motivo_detalhe text, p_nome_paciente text, p_confirma_orcamento_aceito boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- A tabela prontuario_exclusoes_copias, policy e gatilho FICAM.
-- DELETE em fichas NAO e devolvido: nao restaurar o bypass de auditoria/confirmacao.
$volta$;
end;
$ciclo$;
select pg_temp.verificar('C11 volta restaura md5 exato',$q$select md5(pg_get_functiondef('public.excluir_ficha_clinica(uuid,text,text,text,boolean)'::regprocedure))='66385c83a5ca541027363a0d8ca88575'$q$);
select pg_temp.verificar('C11 volta preserva copias e bloqueio DELETE',$q$select count(*)=(select n from copias_antes_ciclo) and md5(coalesce(jsonb_agg(to_jsonb(c) order by exclusao_id),'[]'::jsonb)::text)=(select hash from copias_antes_ciclo) and not has_table_privilege('authenticated','public.fichas','DELETE') from public.prontuario_exclusoes_copias c$q$);
do $ciclo$
begin
 execute $reaplicar$

create table if not exists public.prontuario_exclusoes_copias (
  exclusao_id uuid primary key references public.prontuario_exclusoes(id) on delete cascade,
  clinica_id  uuid not null references public.clinicas(id) on delete cascade,
  paciente_id uuid,           -- sem FK: a cópia sobrevive à exclusão do paciente (guarda legal)
  ficha_id    uuid not null,  -- sem FK: a ficha não existe mais
  versao      smallint not null default 1,
  conteudo    jsonb not null,
  created_at  timestamptz not null default now()
);

do $$
begin
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'prontuario_exclusoes_copias') <> 7 then
    raise exception 'prontuario_exclusoes_copias_formato_inesperado';
  end if;
end $$;

comment on table public.prontuario_exclusoes_copias is
  'OD-015b1 M3b — cópia protegida do conteúdo clínico da ficha apagada (dado de saúde, LGPD art. 11). '
  'Escrita só por excluir_ficha_clinica; leitura só admin da clínica; imutável; sem apagar automático.';

create index if not exists prontuario_exclusoes_copias_clinica_idx
  on public.prontuario_exclusoes_copias (clinica_id, created_at desc);

alter table public.prontuario_exclusoes_copias enable row level security;
revoke all on table public.prontuario_exclusoes_copias from public, anon, authenticated;
grant select on table public.prontuario_exclusoes_copias to authenticated;

drop policy if exists prontuario_exclusoes_copias_select on public.prontuario_exclusoes_copias;
create policy prontuario_exclusoes_copias_select on public.prontuario_exclusoes_copias
  for select to authenticated
  using (public.belongs_to_active_clinic(clinica_id) and public.is_clinic_admin());

create or replace function private.bloquear_alteracao_copia_prontuario()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'copia_prontuario_imutavel';
end;
$$;
revoke all on function private.bloquear_alteracao_copia_prontuario() from public, anon, authenticated;

drop trigger if exists prontuario_exclusoes_copias_imutavel on public.prontuario_exclusoes_copias;
create trigger prontuario_exclusoes_copias_imutavel
  before update on public.prontuario_exclusoes_copias
  for each row execute function private.bloquear_alteracao_copia_prontuario();

CREATE OR REPLACE FUNCTION public.excluir_ficha_clinica(p_ficha_id uuid, p_motivo text, p_motivo_detalhe text, p_nome_paciente text, p_confirma_orcamento_aceito boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_copia      jsonb;
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
    'confirmou_orcamento_aceito',     cardinality(v_mantidos) > 0,
    'copia_guardada',                 true);

  -- CÓPIA PROTEGIDA (M3b): o conteúdo inteiro, antes de qualquer delete. Só o admin lê.
  v_copia := jsonb_build_object(
    'ficha',         to_jsonb(v_ficha),
    'evolucoes',     coalesce((select jsonb_agg(to_jsonb(fe) order by fe.created_at, fe.id)
                               from public.ficha_evolucoes fe where fe.ficha_id = v_ficha.id), '[]'::jsonb),
    'procedimentos', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at, e.id)
                               from public.odontograma_eventos e where e.id = any(v_eventos)), '[]'::jsonb),
    'arquivos',      coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at, a.id)
                               from public.ficha_arquivos a where a.ficha_id = v_ficha.id), '[]'::jsonb),
    'planejamentos', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at, p.id)
                               from public.planejamentos p where p.ficha_id = v_ficha.id), '[]'::jsonb),
    'planejamento_procedimentos',
                     coalesce((select jsonb_agg(to_jsonb(pp) order by pp.ordem, pp.id)
                               from public.planejamento_procedimentos pp
                               where split_part(pp.ficha_ref, '::', 1) = v_ficha.id::text), '[]'::jsonb),
    'orcamentos_apagados',
                     coalesce((select jsonb_agg(to_jsonb(o) || jsonb_build_object('itens',
                                 coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at, i.id)
                                           from public.orcamento_itens i where i.orcamento_id = o.id), '[]'::jsonb))
                                 order by o.created_at, o.id)
                               from public.orcamentos o
                               where o.id = any(v_orcs) and not (o.id = any(v_mantidos))
                                 and o.ficha_id = v_ficha.id), '[]'::jsonb),
    'vinculos_visita',
                     coalesce((select jsonb_agg(to_jsonb(ae) order by ae.atendimento_id, ae.evento_id)
                               from public.atendimento_eventos ae where ae.evento_id = any(v_eventos)), '[]'::jsonb),
    'vinculos_orcamento',
                     coalesce((select jsonb_agg(to_jsonb(oe) order by oe.evento_id)
                               from public.orcamento_eventos oe where oe.evento_id = any(v_eventos)), '[]'::jsonb));

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

  insert into public.prontuario_exclusoes_copias (exclusao_id, clinica_id, paciente_id, ficha_id, conteudo)
  values (v_exclusao, v_clinica_id, v_ficha.paciente_id, v_ficha.id, v_copia);

  return jsonb_build_object('exclusao_id', v_exclusao,
                            'visitas_descartadas', cardinality(v_vazias),
                            'orcamentos_mantidos', cardinality(v_mantidos));
end;
$function$
;

-- O apagar direto pela API deixa de existir: só a função (com cópia, auditoria e confirmação) apaga.
revoke delete on table public.fichas from authenticated;

$reaplicar$;
end;
$ciclo$;
select pg_temp.verificar('C11 reaplicacao restaura funcao e preserva copias',$q$select count(*)=(select n from copias_antes_ciclo) and md5(coalesce(jsonb_agg(to_jsonb(c) order by exclusao_id),'[]'::jsonb)::text)=(select hash from copias_antes_ciclo) and md5(pg_get_functiondef('public.excluir_ficha_clinica(uuid,text,text,text,boolean)'::regprocedure))=(select hash from m3b_baseline) from public.prontuario_exclusoes_copias c$q$);

-- P2: C1-C10 completos, seed independente.
reset role;
insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','Paciente Exclusao SQL');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000101','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FX','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000102','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FY','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000103','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FA','manual','aberta','2026-10-25','2026-10-25T10:00:00Z');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000104','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FS','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000105','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FD','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000106','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FP','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000107','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000d1','OD015M3b FC','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000108','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FO','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000109','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FR','manual','aberta','2026-10-25',null);
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento,assinado_em) values('d015b101-0000-4000-8000-000000000110','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','OD015M3b FE','manual','aberta','2026-10-25',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b101-0000-4000-8000-000000000201','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b101-0000-4000-8000-000000000201','2026-10-25','ficha','finalizado','2026-10-25T10:01:00Z');
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b101-0000-4000-8000-000000000202','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b101-0000-4000-8000-000000000202','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b101-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b101-0000-4000-8000-000000000203','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b101-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b101-0000-4000-8000-000000000204','2026-10-25','ficha','preparando',null);
insert into public.atendimentos_clinicos(id,clinica_id,paciente_id,dentista_id,chave_idempotencia,data_atendimento,origem,estado,finalizado_em) values('d015b101-0000-4000-8000-000000000205','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000d1','d015b101-0000-4000-8000-000000000205','2026-10-25','ficha','preparando',null);
insert into public.assinaturas(id,clinica_id,paciente_id,dentista_id,tipo,ficha_id,assinado_por,cro_no_ato,assinatura_ref) values('d015b101-0000-4000-8000-000000000801','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','procedimentos','d015b101-0000-4000-8000-000000000104','QA paciente sintetico','TESTE-A','qa/d015b101/assinatura-procedimento.png');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b101-0000-4000-8000-000000000301','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000101','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b101-0000-4000-8000-000000000302','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000102','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b101-0000-4000-8000-000000000303','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000104','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25','d015b101-0000-4000-8000-000000000801',null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b101-0000-4000-8000-000000000304','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000108','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25',null,null,null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b101-0000-4000-8000-000000000305','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000109','b0000000-0000-4000-8000-0000000000a1','profilaxia','realizado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico','2026-10-25',null,'2026-10-25T10:02:00Z',null);
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,realizado_em,assinatura_id,retirado_em,encaminhado_para) values('d015b101-0000-4000-8000-000000000306','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000110','b0000000-0000-4000-8000-0000000000a1','profilaxia','indicado','clinica','boca','{}','sessao_atual','OD015M3b procedimento sintetico',null,null,null,'c0000000-0000-4000-8000-0000000000d1');
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d015b101-0000-4000-8000-000000000401','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000101','d015b101-0000-4000-8000-000000000201','b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FX',false);
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d015b101-0000-4000-8000-000000000402','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000102',null,'b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FY',false);
insert into public.ficha_evolucoes(id,clinica_id,ficha_id,atendimento_id,dentista_id,data,texto,automatica) values('d015b101-0000-4000-8000-000000000403','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000108',null,'b0000000-0000-4000-8000-0000000000a1','2026-10-25','QA-TEXTO-CLINICO-FO',false);
insert into public.atendimento_eventos(clinica_id,atendimento_id,evento_id,papel) values('b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000201','d015b101-0000-4000-8000-000000000301','realizado');
insert into public.ficha_arquivos(id,clinica_id,ficha_id,tipo,nome_original,storage_url,texto_extraido) values('d015b101-0000-4000-8000-000000000501','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000101','outro','QA documento ficticio.txt','qa/d015b101/arquivo-ficticio','QA-TEXTO-ARQUIVO-FX');
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d015b101-0000-4000-8000-000000000601','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b101-0000-4000-8000-000000000101','rascunho',null,100);
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d015b101-0000-4000-8000-000000000602','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b101-0000-4000-8000-000000000106','rascunho',null,100);
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,aprovado_em,total) values('d015b101-0000-4000-8000-000000000603','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b101-0000-4000-8000-000000000108','aprovado','2026-10-25T10:03:00Z',100);
insert into public.orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado) values('d015b101-0000-4000-8000-000000000701','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000603','QA item financeiro ficticio',1,100,100,true);
insert into public.orcamento_eventos(clinica_id,orcamento_id,evento_id,item_id) values('b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000603','d015b101-0000-4000-8000-000000000304','d015b101-0000-4000-8000-000000000701');
insert into public.assinaturas(id,clinica_id,paciente_id,dentista_id,tipo,orcamento_id,assinado_por,cro_no_ato,assinatura_ref) values('d015b101-0000-4000-8000-000000000802','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','orcamento','d015b101-0000-4000-8000-000000000603','QA paciente sintetico','TESTE-A','qa/d015b101/aceite.png');
insert into public.paciente_documentos(id,clinica_id,paciente_id,nome,url) values('d015b101-0000-4000-8000-000000000901','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','OD015M3b documento ficticio','qa/d015b101/documento-901.pdf');
insert into public.documentos_aceite(id,clinica_id,paciente_id,dentista_id,ficha_id,orcamento_id,assinatura_id,tipo,template_versao,template_hash,conteudo_snapshot,assinatura_paciente_ref,assinado_por,pdf_path,paciente_documento_id) values('d015b101-0000-4000-8000-000000001001','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b101-0000-4000-8000-000000000105',null,null,'tcle','QA-OD015M3b','QA-HASH-SINTETICO','{}','qa/d015b101/aceite.png','QA paciente sintetico','qa/d015b101/documento-901.pdf','d015b101-0000-4000-8000-000000000901');
insert into public.paciente_documentos(id,clinica_id,paciente_id,nome,url) values('d015b101-0000-4000-8000-000000000902','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','OD015M3b documento ficticio','qa/d015b101/documento-902.pdf');
insert into public.documentos_aceite(id,clinica_id,paciente_id,dentista_id,ficha_id,orcamento_id,assinatura_id,tipo,template_versao,template_hash,conteudo_snapshot,assinatura_paciente_ref,assinado_por,pdf_path,paciente_documento_id) values('d015b101-0000-4000-8000-000000001002','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','d015b101-0000-4000-8000-000000000108','d015b101-0000-4000-8000-000000000603','d015b101-0000-4000-8000-000000000802','orcamento','QA-OD015M3b','QA-HASH-SINTETICO','{}','qa/d015b101/aceite.png','QA paciente sintetico','qa/d015b101/documento-902.pdf','d015b101-0000-4000-8000-000000000902');
insert into public.orcamento_cobrancas(id,clinica_id,orcamento_id,paciente_id,dentista_id,subtotal,valor_final) values('d015b101-0000-4000-8000-000000001101','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000603','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,100);
insert into public.orcamento_cobranca_itens(cobranca_id,orcamento_item_id,clinica_id,preco_total_snapshot) values('d015b101-0000-4000-8000-000000001101','d015b101-0000-4000-8000-000000000701','b0000000-0000-4000-8000-000000000001',100);
insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values('d015b101-0000-4000-8000-000000001201','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000602',null,'d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,'pendente','2026-10-25');
insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values('d015b101-0000-4000-8000-000000001202','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000603','d015b101-0000-4000-8000-000000001101','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1',100,'pendente','2026-10-25');
insert into public.estoque_itens(id,clinica_id,titular_tipo,nome,unidade_base) values('d015b101-0000-4000-8000-000000001301','b0000000-0000-4000-8000-000000000001','clinica','QA OD015M3b material ficticio','unidade');
insert into public.estoque_lotes(id,clinica_id,item_id,origem_sem_identificacao) values('d015b101-0000-4000-8000-000000001302','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000001301',true);
insert into public.estoque_usos(id,clinica_id,atendimento_id,linha_origem_id,autor_usuario_id,snapshot_material,quantidade_declarada,unidade_declarada,item_id,lote_id) values('d015b101-0000-4000-8000-000000001303','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000204','d015b101-0000-4000-8000-000000001304','b0000000-0000-4000-8000-00000000000a','QA OD015M3b material ficticio',1,'unidade','d015b101-0000-4000-8000-000000001301','d015b101-0000-4000-8000-000000001302');


insert into public.orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado)
values('d015b101-0000-4000-8000-000000000702','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000601','QA item rascunho FX',1,100,100,false);
insert into public.orcamento_eventos(clinica_id,orcamento_id,evento_id,item_id)
values('b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000601','d015b101-0000-4000-8000-000000000301','d015b101-0000-4000-8000-000000000702');
insert into public.planejamentos(id,clinica_id,ficha_id,paciente_id,dentista_id,titulo)
values('d015b101-0000-4000-8000-000000001401','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000101','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','QA plano FX');
insert into public.planejamento_procedimentos(id,clinica_id,paciente_id,dentista_id,descricao,ficha_ref,ordem)
values('d015b101-0000-4000-8000-000000001402','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','QA planejamento FX','d015b101-0000-4000-8000-000000000101::qa',1);

create temp table expected_P2 as
select jsonb_build_object(
 'ficha',(select to_jsonb(r) from public.fichas r where id='d015b101-0000-4000-8000-000000000101'),
 'evolucao',(select to_jsonb(r) from public.ficha_evolucoes r where id='d015b101-0000-4000-8000-000000000401'),
 'procedimento',(select to_jsonb(r) from public.odontograma_eventos r where id='d015b101-0000-4000-8000-000000000301'),
 'arquivo',(select to_jsonb(r) from public.ficha_arquivos r where id='d015b101-0000-4000-8000-000000000501'),
 'planejamento',(select to_jsonb(r) from public.planejamentos r where id='d015b101-0000-4000-8000-000000001401'),
 'planejamento_procedimento',(select to_jsonb(r) from public.planejamento_procedimentos r where id='d015b101-0000-4000-8000-000000001402'),
 'orcamento',(select to_jsonb(r) from public.orcamentos r where id='d015b101-0000-4000-8000-000000000601'),
 'item',(select to_jsonb(r) from public.orcamento_itens r where id='d015b101-0000-4000-8000-000000000702'),
 'visita',(select to_jsonb(r) from public.atendimento_eventos r where evento_id='d015b101-0000-4000-8000-000000000301'),
 'ponte',(select to_jsonb(r) from public.orcamento_eventos r where evento_id='d015b101-0000-4000-8000-000000000301')
) as valor;
create temp table log_P2 as select count(*) n from public.activity_logs where paciente_id='d015b101-0000-4000-8000-000000000001';
create temp table financeiro_P2 as
select 'orcamentos' as t,to_jsonb(r)-'ficha_id'-'updated_at' as valor from public.orcamentos r where id='d015b101-0000-4000-8000-000000000603'
union all select 'assinaturas',to_jsonb(r) from public.assinaturas r where id='d015b101-0000-4000-8000-000000000802'
union all select 'documentos_aceite',to_jsonb(r)-'ficha_id' from public.documentos_aceite r where id='d015b101-0000-4000-8000-000000001002'
union all select 'orcamento_itens',to_jsonb(r) from public.orcamento_itens r where id='d015b101-0000-4000-8000-000000000701'
union all select 'orcamento_cobrancas',to_jsonb(r) from public.orcamento_cobrancas r where id='d015b101-0000-4000-8000-000000001101'
union all select 'orcamento_cobranca_itens',to_jsonb(r) from public.orcamento_cobranca_itens r where cobranca_id='d015b101-0000-4000-8000-000000001101'
union all select 'pagamentos',to_jsonb(r) from public.pagamentos r where id='d015b101-0000-4000-8000-000000001202';
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.executar('P2 C1 RPC apaga FX',$q$select public.excluir_ficha_clinica('d015b101-0000-4000-8000-000000000101','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$);
reset role;
select pg_temp.verificar('P2 C1 uma copia vinculada e resumo sem conteudo',$q$select count(*)=1 and bool_and(c.exclusao_id=a.id and c.ficha_id=a.ficha_id and c.clinica_id=a.clinica_id and c.versao=1 and a.resumo->>'copia_guardada'='true' and a.resumo::text not like '%QA-TEXTO-CLINICO-FX%') from public.prontuario_exclusoes_copias c join public.prontuario_exclusoes a on a.id=c.exclusao_id where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 snapshot integral ficha',$q$select c.conteudo #> '{ficha}' = e.valor->'ficha' from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 snapshot integral evolucao',$q$select c.conteudo #> '{evolucoes,0}' = e.valor->'evolucao' from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 snapshot integral procedimento',$q$select c.conteudo #> '{procedimentos,0}' = e.valor->'procedimento' from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 snapshot integral arquivo',$q$select c.conteudo #> '{arquivos,0}' = e.valor->'arquivo' from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 snapshot integral planejamento',$q$select c.conteudo #> '{planejamentos,0}' = e.valor->'planejamento' from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 snapshot integral planejamento_procedimento',$q$select c.conteudo #> '{planejamento_procedimentos,0}' = e.valor->'planejamento_procedimento' from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 snapshot integral item',$q$select c.conteudo #> '{orcamentos_apagados,0,itens,0}' = e.valor->'item' from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 snapshot integral visita',$q$select c.conteudo #> '{vinculos_visita,0}' = e.valor->'visita' from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 snapshot integral ponte',$q$select c.conteudo #> '{vinculos_orcamento,0}' = e.valor->'ponte' from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 orcamento rascunho integral com item',$q$select (c.conteudo #> '{orcamentos_apagados,0}')-'itens'=e.valor->'orcamento' and jsonb_array_length(c.conteudo->'orcamentos_apagados')=1 and jsonb_array_length(c.conteudo #> '{orcamentos_apagados,0,itens}')=1 from public.prontuario_exclusoes_copias c cross join expected_P2 e where c.ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 texto clinico e referencia sem binarios',$q$select conteudo #>> '{evolucoes,0,texto}'='QA-TEXTO-CLINICO-FX' and conteudo #>> '{arquivos,0,texto_extraido}'='QA-TEXTO-ARQUIVO-FX' and conteudo #>> '{arquivos,0,storage_url}'='qa/d015b101/arquivo-ficticio' and not (conteudo ? 'paciente') and (select count(*)=9 from jsonb_object_keys(conteudo)) from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 cardinalidade evolucoes',$q$select jsonb_array_length(conteudo->'evolucoes')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 cardinalidade procedimentos',$q$select jsonb_array_length(conteudo->'procedimentos')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 cardinalidade arquivos',$q$select jsonb_array_length(conteudo->'arquivos')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 cardinalidade planejamentos',$q$select jsonb_array_length(conteudo->'planejamentos')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 cardinalidade planejamento_procedimentos',$q$select jsonb_array_length(conteudo->'planejamento_procedimentos')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 cardinalidade vinculos_visita',$q$select jsonb_array_length(conteudo->'vinculos_visita')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 cardinalidade vinculos_orcamento',$q$select jsonb_array_length(conteudo->'vinculos_orcamento')=1 from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$);
select pg_temp.verificar('P2 C1 conteudo saiu do prontuario',$q$select not exists(select 1 from public.fichas where id='d015b101-0000-4000-8000-000000000101') and not exists(select 1 from public.ficha_evolucoes where ficha_id='d015b101-0000-4000-8000-000000000101') and not exists(select 1 from public.odontograma_eventos where ficha_id='d015b101-0000-4000-8000-000000000101') and not exists(select 1 from public.orcamentos where id='d015b101-0000-4000-8000-000000000601')$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P2 C2 Alice admin A le copia',$q$select count(*)=1 from public.prontuario_exclusoes_copias where paciente_id='d015b101-0000-4000-8000-000000000001'$q$);
select pg_temp.recusar('P2 C4 admin sem insert',$q$insert into public.prontuario_exclusoes_copias select * from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$,'42501');
select pg_temp.recusar('P2 C4 admin sem update',$q$update public.prontuario_exclusoes_copias set versao=2 where ficha_id='d015b101-0000-4000-8000-000000000101'$q$,'42501');
select pg_temp.recusar('P2 C4 admin sem delete',$q$delete from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000101'$q$,'42501');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P2 C3 Ana nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b101-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000d","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P2 C3 Carlos nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b101-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P2 C3 Sara nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b101-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"c0000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P2 C3 Protetico nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b101-0000-4000-8000-000000000001'$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
set local role authenticated;
select pg_temp.verificar('P2 C3 Bruno nao le copia',$q$select count(*)=0 from public.prontuario_exclusoes_copias where paciente_id='d015b101-0000-4000-8000-000000000001'$q$);
reset role;
do $adminb$
declare v_usuario uuid;v_total bigint;
begin
 select cm.usuario_id into v_usuario from public.clinica_usuarios cm
 where cm.clinica_id='b0000000-0000-4000-8000-000000000002' and cm.role='admin' and cm.status='ativo' limit 1;
 if v_usuario is not null then
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_usuario,'role','authenticated')::text,true);
  set local role authenticated;
  select count(*) into v_total from public.prontuario_exclusoes_copias where paciente_id='d015b101-0000-4000-8000-000000000001';
  reset role;
  insert into m3b_resultados values('P2 C3 admin B nao le copia',v_total=0,null);
 else
  insert into m3b_resultados values('P2 C3 admin B inexistente: nao aplicavel',true,'sem conta admin B');
 end if;
end;
$adminb$;
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}';
set local role anon;
select pg_temp.recusar('P2 C3 anon sem SELECT',$q$select * from public.prontuario_exclusoes_copias$q$,'42501');
reset role;
select pg_temp.recusar('P2 C5 postgres nao altera copia',$q$update public.prontuario_exclusoes_copias set conteudo=conteudo where ficha_id='d015b101-0000-4000-8000-000000000101'$q$,'copia_prontuario_imutavel');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('P2 C6 FO sem caixa',$q$select public.excluir_ficha_clinica('d015b101-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'confirmar_orcamento_aceito');
select pg_temp.recusar('P2 C6 FR retirado',$q$select public.excluir_ficha_clinica('d015b101-0000-4000-8000-000000000109','aberta_por_engano',null,'Paciente Exclusao SQL',false)$q$,'ficha_com_retirado');
reset role;
select pg_temp.verificar('P2 C6 zero copias e auditoria das recusas',$q$select not exists(select 1 from public.prontuario_exclusoes_copias where ficha_id in ('d015b101-0000-4000-8000-000000000108','d015b101-0000-4000-8000-000000000109')) and not exists(select 1 from public.prontuario_exclusoes where ficha_id in ('d015b101-0000-4000-8000-000000000108','d015b101-0000-4000-8000-000000000109')) and (select count(*)=2 from public.fichas where id in ('d015b101-0000-4000-8000-000000000108','d015b101-0000-4000-8000-000000000109'))$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.executar('P2 C7 FO com caixa',$q$select public.excluir_ficha_clinica('d015b101-0000-4000-8000-000000000108','aberta_por_engano',null,'Paciente Exclusao SQL',true)$q$);
reset role;
select pg_temp.verificar('P2 C7 copia nao inclui orcamento mantido',$q$select count(*)=1 and bool_and(conteudo #>> '{ficha,id}'='d015b101-0000-4000-8000-000000000108' and jsonb_array_length(conteudo->'vinculos_orcamento')=1 and conteudo->'orcamentos_apagados'='[]'::jsonb) from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000108'$q$);
select pg_temp.verificar('P2 C7 preserva orcamentos',$q$select count(*)=1 and bool_and(exists(select 1 from public.orcamentos r where to_jsonb(r)-'ficha_id'-'updated_at'=e.valor)) from financeiro_P2 e where e.t='orcamentos'$q$);
select pg_temp.verificar('P2 C7 preserva assinaturas',$q$select count(*)=1 and bool_and(exists(select 1 from public.assinaturas r where to_jsonb(r)=e.valor)) from financeiro_P2 e where e.t='assinaturas'$q$);
select pg_temp.verificar('P2 C7 preserva documentos_aceite',$q$select count(*)=1 and bool_and(exists(select 1 from public.documentos_aceite r where to_jsonb(r)-'ficha_id'=e.valor)) from financeiro_P2 e where e.t='documentos_aceite'$q$);
select pg_temp.verificar('P2 C7 preserva orcamento_itens',$q$select count(*)=1 and bool_and(exists(select 1 from public.orcamento_itens r where to_jsonb(r)=e.valor)) from financeiro_P2 e where e.t='orcamento_itens'$q$);
select pg_temp.verificar('P2 C7 preserva orcamento_cobrancas',$q$select count(*)=1 and bool_and(exists(select 1 from public.orcamento_cobrancas r where to_jsonb(r)=e.valor)) from financeiro_P2 e where e.t='orcamento_cobrancas'$q$);
select pg_temp.verificar('P2 C7 preserva orcamento_cobranca_itens',$q$select count(*)=1 and bool_and(exists(select 1 from public.orcamento_cobranca_itens r where to_jsonb(r)=e.valor)) from financeiro_P2 e where e.t='orcamento_cobranca_itens'$q$);
select pg_temp.verificar('P2 C7 preserva pagamentos',$q$select count(*)=1 and bool_and(exists(select 1 from public.pagamentos r where to_jsonb(r)=e.valor)) from financeiro_P2 e where e.t='pagamentos'$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.recusar('P2 C8 DELETE direto negado',$q$delete from public.fichas where id='d015b101-0000-4000-8000-000000000102'$q$,'42501');
reset role;
select pg_temp.verificar('P2 C8 FY intacta',$q$select count(*)=1 from public.fichas where id='d015b101-0000-4000-8000-000000000102'$q$);
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.executar('P2 C9 descartar V0',$q$select public.descartar_atendimento_vazio('d015b101-0000-4000-8000-000000000202')$q$);
reset role;
select pg_temp.verificar('P2 C9 visita sem copia',$q$select not exists(select 1 from public.atendimentos_clinicos where id='d015b101-0000-4000-8000-000000000202') and exists(select 1 from public.prontuario_exclusoes a where a.atendimento_id='d015b101-0000-4000-8000-000000000202' and not exists(select 1 from public.prontuario_exclusoes_copias c where c.exclusao_id=a.id))$q$);
select pg_temp.verificar('P2 C10 RLS e policy admin unica',$q$select c.relrowsecurity and (select count(*)=1 and bool_and(cmd='SELECT' and qual like '%is_clinic_admin%' and qual like '%belongs_to_active_clinic%') from pg_policies where schemaname='public' and tablename='prontuario_exclusoes_copias') from pg_class c where c.oid='public.prontuario_exclusoes_copias'::regclass$q$);
select pg_temp.verificar('P2 C10 grants authenticated',$q$select not has_table_privilege('authenticated','public.prontuario_exclusoes_copias','INSERT') and not has_table_privilege('authenticated','public.prontuario_exclusoes_copias','UPDATE') and not has_table_privilege('authenticated','public.prontuario_exclusoes_copias','DELETE')$q$);
select pg_temp.verificar('P2 C10 grants anon',$q$select not has_table_privilege('anon','public.prontuario_exclusoes_copias','INSERT') and not has_table_privilege('anon','public.prontuario_exclusoes_copias','UPDATE') and not has_table_privilege('anon','public.prontuario_exclusoes_copias','DELETE')$q$);
select pg_temp.verificar('P2 C10 trigger update imutavel',$q$select exists(select 1 from pg_trigger where tgrelid='public.prontuario_exclusoes_copias'::regclass and tgname='prontuario_exclusoes_copias_imutavel' and tgenabled='O' and tgtype=19 and tgfoid='private.bloquear_alteracao_copia_prontuario()'::regprocedure)$q$);
select pg_temp.verificar('P2 C10 5args definer sem overload e grants preservados',$q$select p.pronargs=5 and p.pronargdefaults=0 and p.prosecdef and (select count(*)=1 from pg_proc where proname='excluir_ficha_clinica' and pronamespace='public'::regnamespace) and has_function_privilege('authenticated',p.oid,'EXECUTE')=(select exec from m3b_baseline) and not has_function_privilege('anon',p.oid,'EXECUTE') from pg_proc p where p.oid='public.excluir_ficha_clinica(uuid,text,text,text,boolean)'::regprocedure$q$);
select pg_temp.verificar('P2 C10 sem FK de paciente ou ficha',$q$select not exists(select 1 from pg_constraint where conrelid='public.prontuario_exclusoes_copias'::regclass and contype='f' and confrelid in ('public.pacientes'::regclass,'public.fichas'::regclass))$q$);
select pg_temp.verificar('P2 C10 nenhum activity log novo',$q$select count(*)=(select n from log_P2) from public.activity_logs where paciente_id='d015b101-0000-4000-8000-000000000001'$q$);

insert into public.pacientes(id,clinica_id,dentista_id,nome) values('d015b101-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','Paciente Copia Extra SQL');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status,data_atendimento) values('d015b101-0000-4000-8000-000000000111','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000002','b0000000-0000-4000-8000-0000000000a1','manual','aberta','2026-10-25');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,origem,status,data_atendimento) values('d015b101-0000-4000-8000-000000000112','b0000000-0000-4000-8000-000000000001','d015b101-0000-4000-8000-000000000002','b0000000-0000-4000-8000-0000000000a1','manual','aberta','2026-10-25');
reset role;
set local request.jwt.claims='{"sub":"b0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
select pg_temp.executar('P2 C10 copia do paciente extra',$q$select public.excluir_ficha_clinica('d015b101-0000-4000-8000-000000000111','aberta_por_engano',null,'Paciente Copia Extra SQL',false)$q$);
reset role;
create temp table extra_P2 as select md5(conteudo::text) hash from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000111';
select pg_temp.executar('P2 C10 excluir paciente extra por cascade',$q$delete from public.pacientes where id='d015b101-0000-4000-8000-000000000002'$q$);
select pg_temp.verificar('P2 C10 copia fica apos paciente excluido',$q$select count(*)=1 and bool_and(md5(conteudo::text)=(select hash from extra_P2)) from public.prontuario_exclusoes_copias where ficha_id='d015b101-0000-4000-8000-000000000111'$q$);
select pg_temp.verificar('P2 C10 paciente extra e ficha viva sairam',$q$select not exists(select 1 from public.pacientes where id='d015b101-0000-4000-8000-000000000002') and not exists(select 1 from public.fichas where id='d015b101-0000-4000-8000-000000000112')$q$);

reset role;
select caso,passou,detalhe from m3b_resultados order by caso;
do $final$
declare v_falhas text;
begin
 select string_agg(caso||' ['||coalesce(detalhe,'sem detalhe')||']','; ' order by caso) into v_falhas from m3b_resultados where passou is not true;
 if v_falhas is not null then raise exception 'OD015M3b NAO PASSA: %; ROLLBACK se sessao continuar aberta',v_falhas;end if;
end;
$final$;
rollback;
