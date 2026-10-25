-- Supplemental M3 Auth/browser QA: new synthetic patient, retired/forwarded refusal,
-- and a payment/charge owned by Carlos, invisible to Ana. QA host checked by runner.
-- No cleanup is authorized here. Retain these exact IDs for a future scoped cleanup.
begin;
insert into public.pacientes(id,clinica_id,dentista_id,nome) values
('e0150000-0000-4000-8000-000000009001','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-0000000000a1','QA M3 Extras 795872d 20261025');
insert into public.fichas(id,clinica_id,paciente_id,dentista_id,nome,origem,status,data_atendimento) values
('e0150000-0000-4000-8000-000000009101','b0000000-0000-4000-8000-000000000001','e0150000-0000-4000-8000-000000009001','b0000000-0000-4000-8000-0000000000a1','QA M3 Retirado','manual','aberta','2026-10-25'),
('e0150000-0000-4000-8000-000000009102','b0000000-0000-4000-8000-000000000001','e0150000-0000-4000-8000-000000009001','b0000000-0000-4000-8000-0000000000a1','QA M3 Encaminhado','manual','aberta','2026-10-25'),
('e0150000-0000-4000-8000-000000009103','b0000000-0000-4000-8000-000000000001','e0150000-0000-4000-8000-000000009001','b0000000-0000-4000-8000-0000000000a1','QA M3 RLS financeiro oculto','manual','aberta','2026-10-25');
insert into public.odontograma_eventos(id,clinica_id,paciente_id,ficha_id,dentista_id,tipo,status,origem,nivel,faces,momento_planejado,procedimento_nome,retirado_em,encaminhado_para) values
('e0150000-0000-4000-8000-000000009301','b0000000-0000-4000-8000-000000000001','e0150000-0000-4000-8000-000000009001','e0150000-0000-4000-8000-000000009101','b0000000-0000-4000-8000-0000000000a1','profilaxia','indicado','clinica','boca','{}','sessao_atual','QA M3 retirado sintético','2026-10-25T11:30:00Z',null),
('e0150000-0000-4000-8000-000000009302','b0000000-0000-4000-8000-000000000001','e0150000-0000-4000-8000-000000009001','e0150000-0000-4000-8000-000000009102','b0000000-0000-4000-8000-0000000000a1','profilaxia','indicado','clinica','boca','{}','sessao_atual','QA M3 encaminhado sintético',null,'c0000000-0000-4000-8000-0000000000d1');
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,ficha_id,status,total) values
('e0150000-0000-4000-8000-000000009601','b0000000-0000-4000-8000-000000000001','e0150000-0000-4000-8000-000000009001','b0000000-0000-4000-8000-0000000000a1','e0150000-0000-4000-8000-000000009103','rascunho',77);
insert into public.orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado) values
('e0150000-0000-4000-8000-000000009701','b0000000-0000-4000-8000-000000000001','e0150000-0000-4000-8000-000000009601','QA M3 financeiro oculto item',1,77,77,false);
insert into public.orcamento_cobrancas(id,clinica_id,orcamento_id,paciente_id,dentista_id,subtotal,valor_final) values
('e0150000-0000-4000-8000-000000009801','b0000000-0000-4000-8000-000000000001','e0150000-0000-4000-8000-000000009601','e0150000-0000-4000-8000-000000009001','c0000000-0000-4000-8000-0000000000d1',77,77);
insert into public.orcamento_cobranca_itens(cobranca_id,orcamento_item_id,clinica_id,preco_total_snapshot) values
('e0150000-0000-4000-8000-000000009801','e0150000-0000-4000-8000-000000009701','b0000000-0000-4000-8000-000000000001',77);
insert into public.pagamentos(id,clinica_id,orcamento_id,cobranca_id,paciente_id,dentista_id,valor,status,data_vencimento) values
('e0150000-0000-4000-8000-000000009901','b0000000-0000-4000-8000-000000000001','e0150000-0000-4000-8000-000000009601','e0150000-0000-4000-8000-000000009801','e0150000-0000-4000-8000-000000009001','c0000000-0000-4000-8000-0000000000d1',77,'pendente','2026-10-25');
commit;
