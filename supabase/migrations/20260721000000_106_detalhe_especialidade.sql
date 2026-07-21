-- 106 — `detalhe` de especialidade nos eventos do odontograma
--
-- Spec: plans/specs/spec-106-detalhe-especialidade.md
-- Aplicada em prod com OK explícito do Mateus em 21/07/2026.
--
-- Destrava a camada 3 da ficha (tabela de endo, campos de implante, periograma):
-- o evento gravava o QUÊ/ONDE/QUANDO/QUEM mas não tinha onde guardar o dado clínico
-- da especialidade. Também amplia o vocabulário (`tipo`) e o nível de âncora (`nivel`)
-- pra procedimentos que não pertencem a um dente.
--
-- 100% ADITIVA e nullable: nenhum dado existente muda, nenhuma ficha antiga quebra.

alter table public.odontograma_eventos
  add column if not exists detalhe jsonb,
  add column if not exists encaminhado_para uuid references public.dentistas(id) on delete set null;

comment on column public.odontograma_eventos.detalhe is
  'Dado clinico da especialidade, validado por Zod na aplicacao (um schema por tipo).
   NULL quando o procedimento nao tem dado estruturado. Nunca contem cor, rotulo ou
   qualquer coisa derivavel — so o que o dentista mediu ou escolheu. Leitura SEMPRE
   por safeParse: detalhe corrompido degrada pra "sem tabela", nunca quebra a ficha.';

comment on column public.odontograma_eventos.encaminhado_para is
  'Dentista a quem o procedimento PLANEJADO foi encaminhado. NAO transfere autoria:
   a ficha continua do autor (nucleo clinico 3.1, migration 099).';

-- ── vocabulario clinico (tipo) ────────────────────────────────────────────
-- +exame_periodontal / profilaxia / raspagem / clareamento / fluor: procedimentos
-- que existem no design (artefato §04 "perfil da regiao") e nao tinham como ser
-- gravados — o card "Boca" era impossivel.
alter table public.odontograma_eventos drop constraint if exists odontograma_eventos_tipo_check;
alter table public.odontograma_eventos add constraint odontograma_eventos_tipo_check check (tipo in (
  'carie_restauracao','exodontia','endodontia','lesao_periapical',
  'implante','coroa','ponte','selante','inclusao','esfoliacao',
  'fratura','pino_nucleo',
  'exame_periodontal','profilaxia','raspagem','clareamento','fluor'
));

-- ── nivel de ancora: 'boca' ───────────────────────────────────────────────
-- Exame periodontal de boca toda e profilaxia nao tem dente ancora. A constraint
-- anterior so aceitava arcada/quadrante/dente/face e rejeitava esses registros.
alter table public.odontograma_eventos drop constraint if exists odontograma_eventos_nivel_check;
alter table public.odontograma_eventos add constraint odontograma_eventos_nivel_check
  check (nivel in ('boca','arcada','quadrante','dente','face'));

alter table public.odontograma_eventos drop constraint if exists odontograma_eventos_ancora_valida;
alter table public.odontograma_eventos add constraint odontograma_eventos_ancora_valida check (
  (nivel = 'boca'      and arcada is null     and quadrante is null and dente is null) or
  (nivel = 'arcada'    and arcada is not null and quadrante is null and dente is null) or
  (nivel = 'quadrante' and quadrante is not null and dente is null) or
  (nivel = 'dente'     and dente is not null and faces = '{}') or
  (nivel = 'face'      and dente is not null and faces <> '{}')
);

-- Sem indice GIN sobre `detalhe`: busca do tipo "todos com lima #40" ainda nao e
-- requisito. Entra quando for — CREATE INDEX nao exige migracao de dado.
