-- OD-019: somente count(*); nenhuma linha/identidade/conteudo clinico e retornada.
-- Executar no odonto-qa com papel de leitura que enxergue todas as clinicas, sem filtro RLS.
-- C03 e informativo: visita x agendamento SO mesma clinica; paciente pode diferir legitimamente.
-- C01-C20 eram zero exceto C01/C02/C05=2 no QA antes do cleanup SEC-B1.
-- Qualquer contagem nao zero: parar e analisar antes da M0. C03 nao e alvo da FK aprovada.
select 'C01' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C02' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.agendamentos alvo on alvo.id = origem.agendamento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C03' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.agendamentos alvo on alvo.id = origem.agendamento_id where origem.paciente_id is distinct from alvo.paciente_id
union all
select 'C04' as verificacao, count(*) as cruzados from public.atendimentos_clinicos origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C05' as verificacao, count(*) as cruzados from public.fichas origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C06' as verificacao, count(*) as cruzados from public.fichas origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C07' as verificacao, count(*) as cruzados from public.ficha_evolucoes origem join public.fichas alvo on alvo.id = origem.ficha_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C08' as verificacao, count(*) as cruzados from public.ficha_evolucoes origem join public.atendimentos_clinicos alvo on alvo.id = origem.atendimento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C09' as verificacao, count(*) as cruzados from public.ficha_evolucoes origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C10' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C11' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.fichas alvo on alvo.id = origem.ficha_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C12' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C13' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.dentistas alvo on alvo.id = origem.encaminhado_para where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C14' as verificacao, count(*) as cruzados from public.odontograma_eventos origem join public.fichas alvo on alvo.id = origem.ficha_id where origem.paciente_id is distinct from alvo.paciente_id
union all
select 'C15' as verificacao, count(*) as cruzados from public.atendimento_eventos origem join public.atendimentos_clinicos alvo on alvo.id = origem.atendimento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C16' as verificacao, count(*) as cruzados from public.atendimento_eventos origem join public.odontograma_eventos alvo on alvo.id = origem.evento_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C17' as verificacao, count(*) as cruzados from public.agendamentos origem join public.pacientes alvo on alvo.id = origem.paciente_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C18' as verificacao, count(*) as cruzados from public.agendamentos origem join public.dentistas alvo on alvo.id = origem.dentista_id where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C19' as verificacao, count(*) as cruzados from public.agendamentos origem join public.dentistas alvo on alvo.id = origem.created_by where origem.clinica_id is distinct from alvo.clinica_id
union all
select 'C20' as verificacao, count(*) as cruzados from public.agendamentos origem join public.atendimentos_clinicos alvo on alvo.id = origem.atendimento_origem_id where origem.clinica_id is distinct from alvo.clinica_id
order by verificacao;
