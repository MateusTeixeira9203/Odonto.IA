-- OD-019 M0 / C2 aprovado: visita x agendamento exige SOMENTE mesma clinica.
-- ESCREVER/REVISAR apenas nesta entrega; aplicacao depende da janela do Orquestrador.
-- Pre-requisito: executar od019_contagem_cruzados.sql; todos os C01-C20 devem ser zero.
-- QA tinha 2 visitas + 2 fichas ficticias cruzadas: cleanup separado ANTES de aplicar.
-- Antes da limpeza, VALIDATE falha DE PROPOSITO; BEGIN/COMMIT torna toda M0 atomica.
-- Usar executor que pare no primeiro erro e de ROLLBACK se a conexao continuar aberta.
-- Base efetiva QA: scratchpad/od019-effective-decoded.json (constraints/pg_get_functiondef).
-- Mantem FKs simples; nenhuma RPC, policy, grant ou trigger e substituida.
-- Ordem da serie: M0 < 20261025022100 (M1). M1/M2 ja presentes no QA nao sao alteradas.

begin;

-- 1. Chaves de referência por clínica (alvo das FKs compostas). atendimentos_clinicos já tem a sua.
alter table public.pacientes    add constraint pacientes_clinica_id_id_key    unique (clinica_id, id);
alter table public.dentistas    add constraint dentistas_clinica_id_id_key    unique (clinica_id, id);
alter table public.agendamentos add constraint agendamentos_clinica_id_id_key unique (clinica_id, id);
alter table public.fichas       add constraint fichas_clinica_id_id_key       unique (clinica_id, id);
alter table public.fichas       add constraint fichas_clinica_id_id_paciente_key unique (clinica_id, id, paciente_id);

-- 2. FKs compostas: NO ACTION; as FKs simples existentes continuam decidindo cascade/set null.
alter table public.atendimentos_clinicos
  add constraint atendimentos_clinicos_paciente_mesma_clinica_fk
    foreign key (clinica_id, paciente_id) references public.pacientes (clinica_id, id) not valid,
  add constraint atendimentos_clinicos_agendamento_mesma_clinica_fk
    foreign key (clinica_id, agendamento_id) references public.agendamentos (clinica_id, id) not valid,
  add constraint atendimentos_clinicos_dentista_mesma_clinica_fk
    foreign key (clinica_id, dentista_id) references public.dentistas (clinica_id, id) not valid;

alter table public.fichas
  add constraint fichas_paciente_mesma_clinica_fk
    foreign key (clinica_id, paciente_id) references public.pacientes (clinica_id, id) not valid,
  add constraint fichas_dentista_mesma_clinica_fk
    foreign key (clinica_id, dentista_id) references public.dentistas (clinica_id, id) not valid;

alter table public.ficha_evolucoes
  add constraint ficha_evolucoes_ficha_mesma_clinica_fk
    foreign key (clinica_id, ficha_id) references public.fichas (clinica_id, id) not valid,
  add constraint ficha_evolucoes_atendimento_mesma_clinica_fk
    foreign key (clinica_id, atendimento_id) references public.atendimentos_clinicos (clinica_id, id) not valid,
  add constraint ficha_evolucoes_dentista_mesma_clinica_fk
    foreign key (clinica_id, dentista_id) references public.dentistas (clinica_id, id) not valid;

alter table public.odontograma_eventos
  add constraint odontograma_eventos_paciente_mesma_clinica_fk
    foreign key (clinica_id, paciente_id) references public.pacientes (clinica_id, id) not valid,
  add constraint odontograma_eventos_ficha_mesmo_paciente_fk
    foreign key (clinica_id, ficha_id, paciente_id) references public.fichas (clinica_id, id, paciente_id) not valid,
  add constraint odontograma_eventos_dentista_mesma_clinica_fk
    foreign key (clinica_id, dentista_id) references public.dentistas (clinica_id, id) not valid,
  add constraint odontograma_eventos_encaminhado_mesma_clinica_fk
    foreign key (clinica_id, encaminhado_para) references public.dentistas (clinica_id, id) not valid;

alter table public.agendamentos
  add constraint agendamentos_paciente_mesma_clinica_fk
    foreign key (clinica_id, paciente_id) references public.pacientes (clinica_id, id) not valid,
  add constraint agendamentos_dentista_mesma_clinica_fk
    foreign key (clinica_id, dentista_id) references public.dentistas (clinica_id, id) not valid,
  add constraint agendamentos_criador_mesma_clinica_fk
    foreign key (clinica_id, created_by) references public.dentistas (clinica_id, id) not valid,
  add constraint agendamentos_atendimento_origem_mesma_clinica_fk
    foreign key (clinica_id, atendimento_origem_id) references public.atendimentos_clinicos (clinica_id, id) not valid;

-- 3. Validação: falha (e a migração inteira volta) se existir qualquer linha cruzada.
alter table public.atendimentos_clinicos validate constraint atendimentos_clinicos_paciente_mesma_clinica_fk;
alter table public.atendimentos_clinicos validate constraint atendimentos_clinicos_agendamento_mesma_clinica_fk;
alter table public.atendimentos_clinicos validate constraint atendimentos_clinicos_dentista_mesma_clinica_fk;
alter table public.fichas validate constraint fichas_paciente_mesma_clinica_fk;
alter table public.fichas validate constraint fichas_dentista_mesma_clinica_fk;
alter table public.ficha_evolucoes validate constraint ficha_evolucoes_ficha_mesma_clinica_fk;
alter table public.ficha_evolucoes validate constraint ficha_evolucoes_atendimento_mesma_clinica_fk;
alter table public.ficha_evolucoes validate constraint ficha_evolucoes_dentista_mesma_clinica_fk;
alter table public.odontograma_eventos validate constraint odontograma_eventos_paciente_mesma_clinica_fk;
alter table public.odontograma_eventos validate constraint odontograma_eventos_ficha_mesmo_paciente_fk;
alter table public.odontograma_eventos validate constraint odontograma_eventos_dentista_mesma_clinica_fk;
alter table public.odontograma_eventos validate constraint odontograma_eventos_encaminhado_mesma_clinica_fk;
alter table public.agendamentos validate constraint agendamentos_paciente_mesma_clinica_fk;
alter table public.agendamentos validate constraint agendamentos_dentista_mesma_clinica_fk;
alter table public.agendamentos validate constraint agendamentos_criador_mesma_clinica_fk;
alter table public.agendamentos validate constraint agendamentos_atendimento_origem_mesma_clinica_fk;

notify pgrst, 'reload schema';
commit;
