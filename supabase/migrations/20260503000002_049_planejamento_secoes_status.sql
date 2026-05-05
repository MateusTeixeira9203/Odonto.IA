-- 049: adiciona status e data estimada em planejamento_secoes
alter table planejamento_secoes
  add column if not exists status        text default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluido')),
  add column if not exists data_estimada date;
