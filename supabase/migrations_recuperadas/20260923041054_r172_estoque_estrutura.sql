-- R-140e1: base física protegida. Não ativa estoque nem cria concessões/RPC pública.
-- Rollback operacional: manter estas estruturas e a UI desligada; nunca apagar fatos.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create unique index if not exists uq_dentistas_clinica_id_id
  on public.dentistas (clinica_id, id);

create table public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  titular_tipo text not null check (titular_tipo in ('clinica', 'dentista')),
  titular_dentista_id uuid,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  unidade_base text not null check (unidade_base in ('unidade', 'g', 'ml')),
  comportamento text not null default 'consumivel' check (comportamento = 'consumivel'),
  controle_lote boolean not null default false,
  minimo numeric(18,6) not null default 0 check (minimo >= 0 and minimo < 'Infinity'::numeric),
  ativo boolean not null default true,
  versao integer not null default 1 check (versao > 0),
  created_at timestamptz not null default now(),
  constraint estoque_itens_titular_check check (
    (titular_tipo = 'clinica' and titular_dentista_id is null)
    or (titular_tipo = 'dentista' and titular_dentista_id is not null)
  ),
  constraint estoque_itens_clinica_id_key unique (clinica_id, id),
  constraint estoque_itens_titular_fkey foreign key (clinica_id, titular_dentista_id)
    references public.dentistas(clinica_id, id) on delete restrict
);
create index estoque_itens_titular_nome_idx
  on public.estoque_itens(clinica_id, titular_tipo, titular_dentista_id, nome, id);

create table public.estoque_lotes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  item_id uuid not null,
  identificador_fabricante text check (char_length(btrim(identificador_fabricante)) between 1 and 120),
  validade date check (validade is null or isfinite(validade)),
  origem_sem_identificacao boolean not null,
  versao integer not null default 1 check (versao > 0),
  created_at timestamptz not null default now(),
  constraint estoque_lotes_origem_check check (
    origem_sem_identificacao = (identificador_fabricante is null)
  ),
  constraint estoque_lotes_clinica_item_id_key unique (clinica_id, item_id, id),
  constraint estoque_lotes_item_fkey foreign key (clinica_id, item_id)
    references public.estoque_itens(clinica_id, id) on delete restrict
);

create table public.estoque_operacoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  ator_usuario_id uuid not null references public.users(id) on delete restrict,
  chave_idempotencia uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  created_at timestamptz not null default now(),
  constraint estoque_operacoes_chave_key unique (clinica_id, ator_usuario_id, chave_idempotencia),
  constraint estoque_operacoes_clinica_ator_id_key unique (clinica_id, ator_usuario_id, id)
);

create table public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  item_id uuid not null,
  lote_id uuid not null,
  tipo text not null check (tipo in ('entrada', 'consumo', 'descarte', 'ajuste', 'reversao')),
  quantidade numeric(18,6) not null check (
    quantidade <> 0 and quantidade > '-Infinity'::numeric and quantidade < 'Infinity'::numeric
  ),
  motivo text constraint estoque_movimentos_motivo_tamanho_check check (char_length(btrim(motivo)) between 1 and 500),
  origem_tipo text not null check (origem_tipo in ('manual', 'contagem', 'correcao')),
  origem_id uuid,
  operacao_id uuid not null,
  reversao_de uuid unique,
  ator_usuario_id uuid not null references public.users(id) on delete restrict,
  ocorrido_em timestamptz not null default now(),
  constraint estoque_movimentos_sinal_check check (
    (tipo = 'entrada' and quantidade > 0)
    or (tipo in ('consumo', 'descarte') and quantidade < 0)
    or tipo in ('ajuste', 'reversao')
  ),
  constraint estoque_movimentos_motivo_check check (tipo = 'entrada' or motivo is not null),
  constraint estoque_movimentos_reversao_check check (
    (tipo = 'reversao') = (reversao_de is not null)
    and (reversao_de is null or (reversao_de <> id and origem_tipo = 'correcao'))
  ),
  constraint estoque_movimentos_clinica_item_lote_id_key unique (clinica_id, item_id, lote_id, id),
  constraint estoque_movimentos_lote_fkey foreign key (clinica_id, item_id, lote_id)
    references public.estoque_lotes(clinica_id, item_id, id) on delete restrict,
  constraint estoque_movimentos_operacao_fkey foreign key (clinica_id, ator_usuario_id, operacao_id)
    references public.estoque_operacoes(clinica_id, ator_usuario_id, id) on delete restrict,
  constraint estoque_movimentos_original_fkey foreign key (clinica_id, item_id, lote_id, reversao_de)
    references public.estoque_movimentos(clinica_id, item_id, lote_id, id) on delete restrict
);
create index estoque_movimentos_item_data_idx
  on public.estoque_movimentos(clinica_id, item_id, ocorrido_em desc, id);
create index estoque_movimentos_operacao_idx
  on public.estoque_movimentos(clinica_id, ator_usuario_id, operacao_id);

create table public.estoque_auditoria (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  ator_usuario_id uuid not null references public.users(id) on delete restrict,
  acao text not null check (char_length(btrim(acao)) between 1 and 80),
  item_id uuid not null,
  antes jsonb check (antes is null or jsonb_typeof(antes) = 'object'),
  depois jsonb check (depois is null or jsonb_typeof(depois) = 'object'),
  motivo text check (char_length(btrim(motivo)) between 1 and 500),
  operacao_id uuid not null,
  created_at timestamptz not null default now(),
  constraint estoque_auditoria_item_fkey foreign key (clinica_id, item_id)
    references public.estoque_itens(clinica_id, id) on delete restrict,
  constraint estoque_auditoria_operacao_fkey foreign key (clinica_id, ator_usuario_id, operacao_id)
    references public.estoque_operacoes(clinica_id, ator_usuario_id, id) on delete restrict
);
create index estoque_auditoria_item_data_idx
  on public.estoque_auditoria(clinica_id, item_id, created_at desc, id);
create index estoque_auditoria_operacao_idx
  on public.estoque_auditoria(clinica_id, ator_usuario_id, operacao_id);

create function private.estoque_impedir_alteracao_fato()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $$ begin
  raise exception 'ESTOQUE_FATO_IMUTAVEL' using errcode = '23514';
end; $$;

create trigger estoque_movimentos_imutaveis before update or delete on public.estoque_movimentos
  for each row execute function private.estoque_impedir_alteracao_fato();
create trigger estoque_operacoes_imutaveis before update or delete on public.estoque_operacoes
  for each row execute function private.estoque_impedir_alteracao_fato();
create trigger estoque_auditoria_imutavel before update or delete on public.estoque_auditoria
  for each row execute function private.estoque_impedir_alteracao_fato();
create trigger estoque_lotes_imutaveis before update or delete on public.estoque_lotes
  for each row execute function private.estoque_impedir_alteracao_fato();

create function private.estoque_validar_item()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $$ begin
  if tg_op = 'DELETE' then
    raise exception 'ESTOQUE_HISTORICO_PRESERVADO' using errcode = '23514';
  end if;
  if new.id <> old.id or new.clinica_id <> old.clinica_id or new.created_at <> old.created_at
    or new.versao <> old.versao + 1 then
    raise exception 'ESTOQUE_IDENTIDADE_OU_VERSAO_INVALIDA' using errcode = '23514';
  end if;
  if exists(select 1 from public.estoque_movimentos m where m.clinica_id = old.clinica_id and m.item_id = old.id) then
    if row(new.titular_tipo, new.titular_dentista_id, new.unidade_base, new.comportamento)
      is distinct from row(old.titular_tipo, old.titular_dentista_id, old.unidade_base, old.comportamento) then
      raise exception 'ESTOQUE_TITULAR_UNIDADE_IMUTAVEIS' using errcode = '23514';
    end if;
    if not new.ativo and exists (
      select 1 from public.estoque_movimentos m
      where m.clinica_id = old.clinica_id and m.item_id = old.id
      group by m.lote_id having sum(m.quantidade) <> 0
    ) then
      raise exception 'ESTOQUE_ITEM_COM_SALDO' using errcode = '23514';
    end if;
  end if;
  return new;
end; $$;
create trigger estoque_itens_preservar before update or delete on public.estoque_itens
  for each row execute function private.estoque_validar_item();

create function private.estoque_validar_lote()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $$ declare v_item public.estoque_itens%rowtype; begin
  select * into v_item from public.estoque_itens
    where clinica_id = new.clinica_id and id = new.item_id for update;
  if not found or not v_item.ativo then
    raise exception 'ESTOQUE_ITEM_INDISPONIVEL' using errcode = '23514';
  end if;
  if v_item.controle_lote and new.origem_sem_identificacao then
    raise exception 'ESTOQUE_LOTE_OBRIGATORIO' using errcode = '23514';
  end if;
  return new;
end; $$;
create trigger estoque_lotes_validar before insert on public.estoque_lotes
  for each row execute function private.estoque_validar_lote();

create function private.estoque_validar_movimento()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $$ declare v_item public.estoque_itens%rowtype; v_original public.estoque_movimentos%rowtype; begin
  -- Serializa operações do mesmo item, inclusive as que vêm de transações distintas.
  select * into v_item from public.estoque_itens
    where clinica_id = new.clinica_id and id = new.item_id for update;
  if not found or not v_item.ativo then
    raise exception 'ESTOQUE_ITEM_INDISPONIVEL' using errcode = '23514';
  end if;
  if new.tipo = 'reversao' then
    select * into v_original from public.estoque_movimentos
      where clinica_id = new.clinica_id and item_id = new.item_id and lote_id = new.lote_id
        and id = new.reversao_de;
    if not found or v_original.tipo = 'reversao' or new.quantidade <> -v_original.quantidade then
      raise exception 'ESTOQUE_REVERSAO_INVALIDA' using errcode = '23514';
    end if;
  end if;
  return new;
end; $$;
create trigger estoque_movimentos_validar before insert on public.estoque_movimentos
  for each row execute function private.estoque_validar_movimento();

create function private.estoque_validar_saldo_final()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $$ begin
  -- Diferido: inverso e substituto podem ter saldo intermediário negativo, nunca final.
  if (select coalesce(sum(m.quantidade), 0) from public.estoque_movimentos m
      where m.clinica_id = new.clinica_id and m.item_id = new.item_id and m.lote_id = new.lote_id) < 0 then
    raise exception 'ESTOQUE_SALDO_INSUFICIENTE' using errcode = '23514';
  end if;
  return null;
end; $$;
create constraint trigger estoque_saldo_final_nao_negativo
  after insert on public.estoque_movimentos deferrable initially deferred
  for each row execute function private.estoque_validar_saldo_final();

alter table public.estoque_itens enable row level security;
alter table public.estoque_lotes enable row level security;
alter table public.estoque_operacoes enable row level security;
alter table public.estoque_movimentos enable row level security;
alter table public.estoque_auditoria enable row level security;
revoke all on public.estoque_itens, public.estoque_lotes, public.estoque_operacoes,
  public.estoque_movimentos, public.estoque_auditoria from public, anon, authenticated, service_role;
revoke all on function private.estoque_impedir_alteracao_fato(), private.estoque_validar_item(),
  private.estoque_validar_lote(), private.estoque_validar_movimento(), private.estoque_validar_saldo_final()
  from public, anon, authenticated, service_role;
