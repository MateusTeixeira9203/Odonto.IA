# R-161c — Procedimentos realocados e cenários de clínica

Contrato autorizado em 11/09, após os prints comparando Consultório e Pacientes.

## Decisões do usuário
- Consultório deve ter título grande como Pacientes; abas imediatamente abaixo (confirmado por resposta).
- Trocar nome Preços por Procedimentos; reutilizar catálogo, valores e ações atuais integralmente.
- Retirar a aba Procedimentos de Configurações no ambiente em que Consultório está habilitado.
- Clínica colaborativa mantém dentistas no mesmo nível; financeiro/catálogo são pessoais.
- Estoque deve distinguir pessoal e materiais compartilhados. Não misturar saldos por nome de material.
- Preservar a colaborativa e criar duas novas clínicas QA: proprietário que atende e proprietário não clínico.

## Inventário e trava
Navegação interna é ConsultorioNavigation; PageContainer wide e fontes do produto já existem.
Catálogo já é ProcedimentosCatalogo compartilhado, com lista vinda do servidor e key por titular.
Financeiro usa FinanceiroContent existente. Não alterar cálculos, forms, actions, payloads, schema ou RLS.
Observação dos prints: título atual Consultório é legenda pequena, inferior à hierarquia de Pacientes;
usuário escolheu título grande e o nome Procedimentos. Dock inferior deve continuar como está.

## Contrato da realocação
- Preservar URL `/dashboard/meu-consultorio/precos` para não quebrar preview/links; texto é Procedimentos.
- Título Consultório: classes da página Pacientes `font-heading font-bold text-3xl md:text-4xl`;
  cores semânticas; abas Financeiro/Procedimentos com foco/aria-current e 44px.
- Página catálogo: título Procedimentos; explicação de catálogo e valores pessoais; estados loading/erro coerentes.
- `ConfiguracoesClient` recebe `catalogoNoConsultorio?: boolean` calculado no servidor pelo piloto existente.
  Quando true, não monta catálogo nem aba; não anuncia catálogo na descrição.
- Configurações com `aba=procedimentos` redireciona para Consultório após guard, apenas com piloto ativo.
  Assim onboarding, DEX e links salvos continuam válidos sem mudar cada consumidor.
- Query do catálogo é omitida de Configurações quando realocado. Sem duplicar lista ou APIs.
- Fora do piloto, configuração e catálogo legados ficam acessíveis: não remover o único acesso antes
  de Consultório estar disponível. Produção continua fora deste lote.
- Guard pessoal de Consultório, filtro clínica+dentista, gate financeiro e recepção/protético preservados.

## Fixtures
Criar apenas registros sintéticos novos no Free etlqznuoxiilvxzygpat; sem reaproveitar/remover
contas de auditorias, sem tocar clínicas do usuário. Credenciais somente em arquivo privado 0600.
Proprietário dentista tem vínculo clínico real de QA; não clínico tem apenas identidade/membership.
Conferir schema/RPC atual antes de gravar. Registrar modelos, membros e limitações de UI efetivas.

## Estoque
Investigar implementação existente e dependências R-140d/e. Esta realocação não cria saldos falsos,
aba vazia nem baixa automática sem confirmação. Se inexiste módulo, separar contrato manual do
trabalho de OCR antes da implementação. Registrar resposta ao usuário sobre escopo/pendências.

## Gates
- [ ] Título/abas correspondem ao pedido, tokens, desktop/390 claro/escuro e teclado.
- [x] Procedimentos sai de Configurações no piloto; URL antiga chega ao catálogo correto.
- [x] Catálogo conserva componente/actions e listagem; Financeiro mantém implementação existente.
- [ ] Sem piloto, catálogo legado continua alcançável; sem ciclo de redirects.
- [ ] Duas clínicas novas criadas e verificadas; colaborativa preservada.
- [ ] Revisão técnica/UX, typecheck/lint focados, build/QA preview. Sem produção.

## Evidências e limitações — 11/09
Código `a760b9e` no candidate; typecheck/lint focados e revisões técnica/UX estática passaram.
Não existe estoque funcional no candidate: somente permissões previstas e placeholders.
Usuário depois delegou o planejamento completo: sequência manual→ficha→kits→OCR detalhada em
[R-140e](R-140e-estoque-rastreavel.md). Não representa estoque implementado.
Duas novas clínicas NÃO criadas: execute_sql recusou INSERT em transação read-only (25006),
rollback integral conferido. Zero clínicas/contas planejadas no Free; sem alteração de schema/RLS.
Credenciais reservadas em arquivo privado r159c-proprietarios-qa-credenciais.txt, não provisionadas.
A/B atuais têm governança explícita em preparação, não prova de modelo colaborativo definitivo.

## QA do preview publicado
Vercel odonto-ia-teste Gg7jkDXtGvQGbzA26MEJ691aUEbb: build sucesso, commit a760b9e.
A autenticada: /configuracoes?aba=procedimentos redirecionou para /meu-consultorio/precos;
h1 Consultório e aba Procedimentos; Configurações normal sem aba nem catálogo.
Dock Consultório abre Financeiro, link Procedimentos navega por Enter.
Desktop título DM Serif Display 36px; 390px título 30px, documento 390px sem overflow,
links 44px e extremo direito 296,44px. Claro/escuro e aria-current conferidos via DOM.
Screenshot continua timeout CDP: conferência visual completa pendente do usuário.
Financeiro renderizou R$5.400/19 lançamentos; fixture é compartilhada com outra frente,
então não comparar com o saldo R161b como se fosse isolamento temporal. Nenhuma mutation
financeira nesta tarefa. Catálogo manteve 1 removido da rodada anterior.
Fora do piloto revisado estaticamente, não executado em produção.
