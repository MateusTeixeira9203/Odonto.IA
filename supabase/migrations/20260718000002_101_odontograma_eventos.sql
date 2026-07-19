-- =====================================================================
-- 101 — odontograma_eventos (Spec Modo Consulta v3 — Odontograma, §1.7)
--
-- Spec: plans/specs/spec-modo-consulta-v3-odontograma.md
--
-- Event-log auditável do odontograma. O estado atual da boca é um REDUCE por
-- query (DISTINCT ON) sobre este log — nunca uma tabela materializada (§1.4).
--
-- ADITIVA: nenhuma coluna de fichas/orcamentos/pacientes muda (invariante #12).
-- O código que a usa (Motor A, componente, save) vem nos passos seguintes da
-- Fatia A — a tabela chegar antes não quebra nada (nada a lê ainda).
--
-- RLS = modelo do NÚCLEO CLÍNICO (099): a clínica LÊ (o acumulado da Fatia B
-- reduz eventos de TODOS os dentistas pra pintar a boca — regra #3 do núcleo),
-- o AUTOR escreve. Padrão idêntico ao fichas_write_own (089): helpers
-- is_clinic_staff / is_clinic_dentista / get_my_dentista_id confirmados.
-- =====================================================================

begin;

create table if not exists public.odontograma_eventos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  dentista_id uuid not null references public.dentistas(id) on delete cascade,
  ficha_id uuid references public.fichas(id) on delete set null,
  grupo_id uuid,
  tipo text not null check (tipo in (
    'carie_restauracao','exodontia','endodontia','lesao_periapical',
    'implante','coroa','ponte','selante','inclusao','esfoliacao',
    'fratura','pino_nucleo'
  )),
  status text not null check (status in ('indicado','realizado')),
  origem text not null default 'clinica' check (origem in ('clinica','preexistente')),
  nivel text not null check (nivel in ('arcada','quadrante','dente','face')),
  arcada text check (arcada in ('superior','inferior')),
  quadrante smallint check (quadrante between 1 and 8),
  dente smallint,
  faces text[] not null default '{}',
  papel_no_grupo text check (papel_no_grupo in ('pilar','pontico')),
  observacao text,
  realizado_em date,
  registrado_em date not null default current_date,
  created_at timestamptz not null default now()
);

comment on table public.odontograma_eventos is
  'Event-log auditável do odontograma. Convenção de aplicação: append-only — correção de
   erro clínico é um NOVO evento, nunca UPDATE do passado. RLS permite UPDATE/DELETE (mesmo
   padrão de fichas) só como via de escape pra erro de digitação imediato; a UI da Fatia A/B
   não expõe edição de eventos antigos. Ficha assinada congela seus eventos (invariante #14).';

comment on column public.odontograma_eventos.realizado_em is
  'Data clínica em que o procedimento foi REALIZADO (fiscalização CRO). Distinta de
   registrado_em (quando entrou no prontuário) e created_at (auditoria). Null quando
   status=indicado, ou pré-existente com data desconhecida. NUNCA inferida pela IA.';

-- indicado nunca tem data de realização
alter table public.odontograma_eventos add constraint odontograma_eventos_realizado_em_coerente check (
  status = 'realizado' or realizado_em is null
);

-- âncora: nivel decide quais campos são obrigatórios/proibidos (invariante #8)
alter table public.odontograma_eventos add constraint odontograma_eventos_ancora_valida check (
  (nivel = 'arcada'    and arcada is not null and quadrante is null and dente is null) or
  (nivel = 'quadrante' and quadrante is not null and dente is null) or
  (nivel = 'dente'     and dente is not null and faces = '{}') or
  (nivel = 'face'      and dente is not null and faces <> '{}')
);

-- dente, quando presente, é FDI válido (permanente 11-48 + decíduo 51-85)
alter table public.odontograma_eventos add constraint odontograma_eventos_dente_fdi check (
  dente is null or
  (dente between 11 and 18) or (dente between 21 and 28) or
  (dente between 31 and 38) or (dente between 41 and 48) or
  (dente between 51 and 55) or (dente between 61 and 65) or
  (dente between 71 and 75) or (dente between 81 and 85)
);

create index if not exists idx_odontograma_eventos_paciente on public.odontograma_eventos(paciente_id, dente);
create index if not exists idx_odontograma_eventos_clinica on public.odontograma_eventos(clinica_id);
create index if not exists idx_odontograma_eventos_ficha on public.odontograma_eventos(ficha_id);
create index if not exists idx_odontograma_eventos_grupo on public.odontograma_eventos(grupo_id) where grupo_id is not null;
-- suporta o reduce "estado atual" via DISTINCT ON paciente+dente+tipo+registrado_em desc (§3.4)
create index if not exists idx_odontograma_eventos_acumulado on public.odontograma_eventos(paciente_id, dente, tipo, registrado_em desc);

alter table public.odontograma_eventos enable row level security;

-- Núcleo clínico (099): a clínica lê — o acumulado precisa ver eventos de TODOS os dentistas.
drop policy if exists "odontograma_eventos_select" on public.odontograma_eventos;
create policy "odontograma_eventos_select" on public.odontograma_eventos for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

-- Escrita trancada no autor (mesmo padrão de fichas_write_own, 089).
drop policy if exists "odontograma_eventos_write_own" on public.odontograma_eventos;
create policy "odontograma_eventos_write_own" on public.odontograma_eventos for all
  using (belongs_to_active_clinic(clinica_id) and dentista_id = get_my_dentista_id())
  with check (belongs_to_active_clinic(clinica_id) and is_clinic_dentista() and dentista_id = get_my_dentista_id());

commit;
