alter table public.odontograma_eventos
  add column if not exists detalhe jsonb,
  add column if not exists encaminhado_para uuid references public.dentistas(id) on delete set null;

comment on column public.odontograma_eventos.detalhe is
  'Dado clinico da especialidade, validado por Zod na aplicacao (um schema por tipo). NULL quando o procedimento nao tem dado estruturado. Nunca contem cor, rotulo ou qualquer coisa derivavel. Leitura SEMPRE por safeParse: detalhe corrompido degrada pra "sem tabela", nunca quebra a ficha.';

comment on column public.odontograma_eventos.encaminhado_para is
  'Dentista a quem o procedimento PLANEJADO foi encaminhado. NAO transfere autoria: a ficha continua do autor (nucleo clinico 3.1, migration 099).';

alter table public.odontograma_eventos drop constraint if exists odontograma_eventos_tipo_check;
alter table public.odontograma_eventos add constraint odontograma_eventos_tipo_check check (tipo in (
  'carie_restauracao','exodontia','endodontia','lesao_periapical',
  'implante','coroa','ponte','selante','inclusao','esfoliacao',
  'fratura','pino_nucleo',
  'exame_periodontal','profilaxia','raspagem','clareamento','fluor'
));

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