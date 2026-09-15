# R-159a — Fundação de identidade e catálogo de acessos

> Contrato de execução · autorizado em 11/09/2026 como parte da implementação isolada.
> Recorte técnico de [R-159](R-159-acessos-clinica.md); não libera novos perfis no produto.

## Escopo

Separar a identidade do membro do seu perfil profissional opcional e representar o catálogo
fechado de permissões. Não alterar guards, rotas, billing ou RLS existentes nesta entrega.
Gestor sem dentista pode ser representado pelo contexto; isto não lhe concede acesso clínico.

## Contrato

- `access-catalog.ts`: catálogo literal das chaves e escopos válidos definidos em R-159.
- Zod valida acesso/coleção: chaves conhecidas, UUIDs, sem chaves/alvos duplicados,
  máximo 200 profissionais por escopo, selecionados não vazio e sem propriedades extras.
- Pacientes não aceita próprio; clínico.registrar aceita somente nenhum/próprio.
- Não usar pacientes.dentista_id como regra de autorização de prontuário compartilhado.
- `professionalScopeContains`, função pura de inclusão de escopo por profissional: nenhum não concede, clínica contém escopos menores,
  selecionados contém somente seus IDs; próprio exige resolver profissional do ator.
  Não é autorização de recurso nem teto entre atores. Acompanhamentos próprios usam identidade
  de usuário e terão resolvedor específico; recepção sem dentista não é excluída das tarefas.
- `member-context.ts`: contexto autenticado de usuário, clínica ativa, membership ativo,
  perfil clínico opcional. Autenticação via getUser; nunca confiar em ID do formulário.
- Clínica esperada divergente retorna contexto alterado; erros de leitura são indisponível,
  não cadastro inexistente; membership ausente/inativo nega acesso.
- Perfil clínico só existe para dentista/admin ativo; secretaria/protetico legados em dentistas
  não viram profissionais clínicos por terem uma linha nessa tabela.
- Resultado discriminado tipado; ausência de perfil é um resultado legítimo.
- Usar cliente autenticado/RLS, nenhuma service-role e toda consulta tenant filtrada.
- Sem consumidores novos neste lote: `requireClinicContext` continua intacto.

## Próximo contrato técnico

A persistência e enforcement são outro lote: teto de delegação explícito no banco,
hash canônico do payload idempotente, versão, auditoria na transação e revisão de todas as
policies permissivas antigas. Não basta esconder controles ou somar policy restritiva.
Modelo gerido fica desligado para clínicas existentes; nenhum cargo legado vira dono.

## Gates

- Testes de catálogo: desconhecido, duplicado, UUID inválido, 201 alvos, escopo indevido.
- Testes de inclusão: próprio sem profissional nega, selecionados não amplia escopo,
  concessão clínica não pode ser obtida de permissão própria.
- Testes de contexto com dependências controladas: não autenticado, clínica divergente,
  membro ausente/inativo, erro de consulta, membro não clínico e dentista legítimo.
- Lint/testes e typecheck focados; build na nuvem, sem servidor Next local. O build atual
  ignora erros de TypeScript e não substitui verificação de tipos.
- Diff não altera comportamento de rotas existentes; nenhuma migration neste lote.

## Limite de entrega

É infraestrutura para o próximo lote, não painel utilizável, cadastro liberado nem teste
concluído de permissões em produção. Decisões comerciais permanecem no R-165.

## Evidência — 11/09/2026

Quatro arquivos em `src/server/auth/`: catálogo/contexto e testes correspondentes.
15 testes, ESLint e typecheck direcionado passaram. Revisão técnica aprovou após corrigir
UUIDs canônicos, consulta de vínculo ativo (histórico de reentrada), perfil clínico legado,
ausência de ator e erros lançados. Sem consumidores, migrations ou mudanças de RLS.
Commit isolado local `8113b66`; integrado em `4244e5b` na branch `codex/testes-integrados`.
