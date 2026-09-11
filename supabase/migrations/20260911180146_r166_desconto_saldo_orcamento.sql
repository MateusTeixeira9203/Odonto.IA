-- R-166: desconto registrado reduz o devido, sem reescrever dinheiro ou acordos.
-- Preserva RLS, grants e assinaturas; as RPCs passam a consultar o cálculo canônico.
begin;

create or replace view public.orcamentos_com_estado
with (security_invoker = true) as
select o.*,
  coalesce(ai.soma_aprovada, 0) as valor_aprovado,
  coalesce(pg.total_pago, 0) as valor_pago,
  devido.valor as valor_devido,
  case
    when coalesce(ai.soma_aprovada, 0) = 0 then 'proposto'
    when coalesce(pg.total_pago, 0) < devido.valor then 'aceito'
    else 'quitado'
  end as estado
from public.orcamentos o
left join lateral (
  select sum(oi.preco_total) as soma_aprovada
  from public.orcamento_itens oi
  where oi.orcamento_id = o.id and oi.clinica_id = o.clinica_id and oi.aprovado
) ai on true
left join lateral (
  select sum(p.valor) as total_pago
  from public.pagamentos p
  where p.orcamento_id = o.id and p.clinica_id = o.clinica_id and p.status = 'pago'
) pg on true
left join lateral (
  select count(*) as quantidade, sum(c.desconto) as desconto
  from public.orcamento_cobrancas c
  where c.orcamento_id = o.id and c.clinica_id = o.clinica_id and c.situacao = 'aberta'
) etapas on true
cross join lateral (
  select coalesce(o.valor_acordado,
    greatest(0, coalesce(ai.soma_aprovada, 0) - case when etapas.quantidade > 0
      then coalesce(etapas.desconto, 0) else coalesce(o.desconto, 0) end)) as valor
) devido;

-- Alteração cirúrgica nas definições vigentes: mantém versões já aplicadas pelo painel,
-- locks, validações, logging, SECURITY DEFINER/search_path e grants existentes.
-- Falha atômica se a fórmula esperada tiver mudado: nunca sobrescreve código desconhecido.
do $migration$
declare
  assinatura text;
  definicao text;
  antigo text := 'v_valor_devido := coalesce(v_orc.valor_acordado, v_valor_aprovado);';
  novo text := 'select e.valor_devido into strict v_valor_devido from public.orcamentos_com_estado e where e.id = v_orc.id and e.clinica_id = v_clinica_id;';
begin
  foreach assinatura in array array[
    'public.registrar_recebimento_orcamento(uuid,numeric,text,date)',
    'public.confirmar_previsao_orcamento(uuid,text,date)',
    'public.corrigir_recebimento_orcamento(uuid,numeric,text,date)'
  ] loop
    definicao := pg_get_functiondef(assinatura::regprocedure);
    if strpos(definicao, antigo) > 0 then
      execute replace(definicao, antigo, novo);
    elsif strpos(definicao, novo) = 0 then
      raise exception 'R166: fórmula inesperada em %', assinatura;
    end if;
  end loop;

  assinatura := 'public.aceitar_orcamento(uuid,text,text)';
  definicao := pg_get_functiondef(assinatura::regprocedure);
  antigo := 'coalesce(v_orc.valor_acordado, v_valor_aprovado, 0)';
  novo := '(select e.valor_devido from public.orcamentos_com_estado e where e.id = p_orcamento_id and e.clinica_id = v_clinica_id)';
  if strpos(definicao, antigo) > 0 then
    execute replace(definicao, antigo, novo);
  elsif strpos(definicao, novo) = 0 then
    raise exception 'R166: fórmula inesperada em %', assinatura;
  end if;
  -- Não criar novas obrigações incompatíveis com o acordo global.
  select p.oid::regprocedure::text into strict assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'criar_cobranca_orcamento';
  definicao := pg_get_functiondef(assinatura::regprocedure);
  antigo := '  foreach v_item_id in array p_item_ids loop';
  novo := E'  if coalesce(v_orc.desconto, 0) > 0 or v_orc.valor_acordado is not null then\n    raise exception ''orcamento_acordo_global'';\n  end if;\n\n' || antigo;
  if strpos(definicao, 'orcamento_acordo_global') = 0 then
    if strpos(definicao, antigo) = 0 then raise exception 'R166: estrutura inesperada em %', assinatura; end if;
    -- Inserir apenas antes do primeiro loop, depois da autorização e lock do orçamento.
    definicao := overlay(definicao placing novo from strpos(definicao, antigo) for length(antigo));
    execute definicao;
  end if;
end;
$migration$;

commit;
