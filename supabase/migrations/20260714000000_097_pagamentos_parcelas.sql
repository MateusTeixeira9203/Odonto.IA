-- Parcelamento de pagamentos: rotula linhas de `pagamentos` geradas em lote por
-- `gerarParcelas` (ex.: "3 parcelas, vencimento mensal"). Aditivo — pagamentos
-- avulsos continuam com as duas colunas null. Base para os alertas de vencimento
-- futuros (idx_pagamentos_data_vencimento já existe desde 002_modules_tables.sql).

alter table public.pagamentos
  add column if not exists parcela_numero smallint,
  add column if not exists total_parcelas smallint;

comment on column public.pagamentos.parcela_numero is
  'Posição desta parcela dentro do parcelamento (1-based). Null = pagamento avulso.';
comment on column public.pagamentos.total_parcelas is
  'Quantidade total de parcelas do parcelamento a que esta linha pertence. Null = pagamento avulso.';

alter table public.pagamentos add constraint pagamentos_parcela_coerente check (
  (parcela_numero is null and total_parcelas is null) or
  (parcela_numero is not null and total_parcelas is not null and parcela_numero between 1 and total_parcelas)
);
