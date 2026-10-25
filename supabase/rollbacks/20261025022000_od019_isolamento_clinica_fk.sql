-- OD-019: VOLTA TOTAL DE EMERGENCIA, texto exato aprovado na spec.
-- REABRE SEC-B1. NAO executar sem aprovacao explicita do usuario.
-- Preferir correcao para frente / retirada somente da FK causadora em recorte aprovado.
-- Remove exclusivamente objetos novos da M0; FKs simples e chave de visitas intactas.
-- Arquivo escrito, NAO aplicado. Nenhum DROP de tabela/dado.

begin;
alter table public.agendamentos drop constraint if exists agendamentos_atendimento_origem_mesma_clinica_fk,
  drop constraint if exists agendamentos_criador_mesma_clinica_fk,
  drop constraint if exists agendamentos_dentista_mesma_clinica_fk,
  drop constraint if exists agendamentos_paciente_mesma_clinica_fk;
alter table public.odontograma_eventos drop constraint if exists odontograma_eventos_encaminhado_mesma_clinica_fk,
  drop constraint if exists odontograma_eventos_dentista_mesma_clinica_fk,
  drop constraint if exists odontograma_eventos_ficha_mesmo_paciente_fk,
  drop constraint if exists odontograma_eventos_paciente_mesma_clinica_fk;
alter table public.ficha_evolucoes drop constraint if exists ficha_evolucoes_dentista_mesma_clinica_fk,
  drop constraint if exists ficha_evolucoes_atendimento_mesma_clinica_fk,
  drop constraint if exists ficha_evolucoes_ficha_mesma_clinica_fk;
alter table public.fichas drop constraint if exists fichas_dentista_mesma_clinica_fk,
  drop constraint if exists fichas_paciente_mesma_clinica_fk;
alter table public.atendimentos_clinicos drop constraint if exists atendimentos_clinicos_dentista_mesma_clinica_fk,
  drop constraint if exists atendimentos_clinicos_agendamento_mesma_clinica_fk,
  drop constraint if exists atendimentos_clinicos_paciente_mesma_clinica_fk;
alter table public.fichas drop constraint if exists fichas_clinica_id_id_paciente_key,
  drop constraint if exists fichas_clinica_id_id_key;
alter table public.agendamentos drop constraint if exists agendamentos_clinica_id_id_key;
alter table public.dentistas drop constraint if exists dentistas_clinica_id_id_key;
alter table public.pacientes drop constraint if exists pacientes_clinica_id_id_key;
notify pgrst, 'reload schema';
commit;
