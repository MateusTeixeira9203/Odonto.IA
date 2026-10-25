-- OD021 additional synthetic budget owned by the actual QA admin.
-- Only QA runner; no permission changes and no cleanup in this file.
begin;
insert into public.orcamentos(id,clinica_id,paciente_id,dentista_id,status,total,created_at) values
('e0210000-0000-4000-8000-000000000604','b0000000-0000-4000-8000-000000000001','e0210000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-0000000000a1','rascunho',124,'2026-10-22T11:00:00Z');
insert into public.orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado) values
('e0210000-0000-4000-8000-000000000704','b0000000-0000-4000-8000-000000000001','e0210000-0000-4000-8000-000000000604','QA OD021 Alice Admin',1,124,124,false);
commit;
