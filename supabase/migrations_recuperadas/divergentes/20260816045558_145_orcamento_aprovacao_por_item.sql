-- 145 — R-114: aprovação por item + estado derivado do orçamento

alter table public.orcamento_itens
  add column if not exists aprovado boolean not null default false;

comment on column public.orcamento_itens.aprovado is
  'R-114 — true quando o paciente aprovou este item. Item nao aprovado continua visivel '
  'no orcamento (lista viva do que falta fechar); so nao conta no devido nem sai no PDF.';

update public.orcamento_itens oi
   set aprovado = true
  from public.orcamentos o
 where o.id = oi.orcamento_id
   and (
     o.status = 'aprovado'
     or exists (
       select 1 from public.pagamentos p
        where p.orcamento_id = o.id and p.status = 'pago'
     )
   );

create or replace view public.orcamentos_com_estado
with (security_invoker = true) as
select
  o.*,
  coalesce(ai.soma_aprovada, 0)                   as valor_aprovado,
  coalesce(pg.total_pago, 0)                      as valor_pago,
  coalesce(o.valor_acordado, ai.soma_aprovada, 0) as valor_devido,
  case
    when coalesce(ai.soma_aprovada, 0) = 0
      then 'proposto'
    when coalesce(pg.total_pago, 0) < coalesce(o.valor_acordado, ai.soma_aprovada, 0)
      then 'aceito'
    else 'quitado'
  end as estado
from public.orcamentos o
left join lateral (
  select sum(oi.preco_total) as soma_aprovada
    from public.orcamento_itens oi
   where oi.orcamento_id = o.id
     and oi.aprovado
) ai on true
left join lateral (
  select sum(p.valor) as total_pago
    from public.pagamentos p
   where p.orcamento_id = o.id
     and p.status = 'pago'
) pg on true;

grant select on public.orcamentos_com_estado to authenticated;