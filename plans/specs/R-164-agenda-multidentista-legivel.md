# R-164 — Agenda de vários dentistas: cards legíveis

> **SPEC (redesign)** · **R-164** · 🔵 ativo
> **Aberto:** 2026-09-10 · **Fase:** implementação · Protótipo V2 e execução autorizados em 11/09.

## 0. Identificação

- Rota: `/dashboard/agendamentos`, visão Dia com várias colunas de dentistas.
- Apresentação principal: `src/app/dashboard/agendamentos/_components/day-view.tsx`.
- Detalhe existente: `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx`.
- Recorte independente de R-159/R-161; não precisa esperar nova governança ou WhatsApp.

## 1. Estado atual e observação do usuário

Print recebido em 10/09/2026: `IMG-20260902-WA0005.jpeg`. Na grade com horários próximos
e cards estreitos, uma coluna vertical de ícones cobre/consome quase todo o espaço do
conteúdo. Nomes aparecem reduzidos a poucos caracteres; status e horário também ficam cortados.
Não registrar nomes de pacientes da foto nesta spec; a evidência é a obstrução visual.

Inventário no código: DayView calcula `isWide = widthPct > 65 && !multiColuna`;
em várias colunas usa ações como ícones, ainda ocupando uma faixa lateral.
O array inclui Confirmar, Chegou, Faltou, Cancelar e Ficha conforme estado/perfil.
Card tem altura por duração, largura/posição por sobreposição; `overflow-hidden`;
conteúdo flex, `min-w-0`, padding horizontal e chips de horário/status/duração.
Coluna de dentista tem largura mínima de 160px; sobreposições subdividem essa largura.
O detalhe já possui ações rotuladas de status e seletor para demais estados.
Abrir o detalhe usa `onAppointmentClick`; remover faixa lateral não exige novas actions/API.

Inventário confrontado com V2 e componente renderizado; a revisão acessível V3 e o aplicativo
integrado ainda aguardam a conferência final do usuário.

## 2. Trava de segurança

- Preservar status, transições, permissões, callbacks e registro dos agendamentos.
- Preservar horários, durações reais, encaixes, responsável, cor por dentista e algoritmo
  de sobreposição. Não mudar altura/duração do compromisso para fingir espaço disponível.
- Manter a navegação de abrir detalhe pelo card, com acesso por teclado e nome acessível.
- As ações continuam no detalhe existente; não remover possibilidade de confirmar/falta/cancelar.
- Sem alteração de schema, regras financeiras, RLS, envio de WhatsApp ou agendamentos existentes.
- Visões Mês/Semana/coluna única ficam fora desse recorte até pedido específico.

## 3. O que o usuário quer — transcrição do pedido

> “Vamos tirar isso, deixar só o nome do paciente agendado, confirmado ou concluído,
> os status que tem lá [...] Tem alguns que não dá nem pra ver o nome.”

Interpretação de implementação proposta, distinta da transcrição: retirar a faixa de
ações dos cards em várias colunas; conteúdo compacto com nome em destaque, horário e
status textual atual. Duração e informação complementar podem continuar no detalhe.
Não renomear os status do sistema nesta correção. Clique abre as ações já existentes.

## 4. Referência visual e limites

Reutilizar tokens de Agenda/Dashboard, cores de profissional e STATUS_CONFIG existentes.
Não extrair medidas/cores da fotografia nem introduzir nova paleta. Geometria e texto
serão conferidos no protótipo; fonte de tokens final é o artefato aprovado/estilos existentes.

- Nome ocupa a largura útil recuperada; status não empurra o nome para fora do card.
- Nenhum ícone de ação sobreposto ao nome, nem no hover/foco.
- Em largura insuficiente, truncamento controlado e nome completo no detalhe; não diminuir
  a fonte progressivamente até ficar ilegível ou depender de tooltip para uso no celular.
- Muitos encaixes podem continuar estreitos mesmo sem botões. Se o caso do print ainda
  ficar ilegível, apresentar necessidade de ajuste de largura/rolagem como recorte adicional;
  não alterar silenciosamente o algoritmo de distribuição ou declarar problema resolvido.

## 5. Gates de aceite

- [ ] Reprodução sintética da foto: vários dentistas, consultas de 15/30min, sobreposições,
  nomes longos e cada status; zero dados reais necessários para reproduzir.
- [ ] Cards multicoluna não exibem faixa de ações, incluindo o atalho de ficha que ocupa espaço.
- [ ] Nome tem prioridade visual; nome/horário/status não são cobertos por botões ou chips.
- [ ] Clique/teclado abre detalhe do paciente/agendamento correto; nome completo disponível.
- [ ] Confirmar, chegada, falta e cancelamento continuam no detalhe com mesmas guardas.
- [ ] Coluna única e outras visões não perdem seus controles por efeito colateral.
- [ ] Light/dark, desktop e viewport estreito conferidos; muitas sobreposições avaliadas.
- [ ] Nenhuma API/schema/regra de negócio alterada; diff isolado das outras frentes locais.

## 6. Execução e entrega

Inventário → protótipo do card/grade do print → aprovação visual → ajuste na visão Dia →
QA na clínica de teste → preview → publicação autorizada em lote próprio.
Não misturar com alterações locais do retorno, billing, financeiro ou reforma de gestão.

## 7. Pós-entrega

### Revisão acessível no ambiente de teste — 11/09

Execução e conferência posterior autorizadas pelo usuário. V2 aprovado permanece preservado.
V3 registra a correção proposta após medir contraste insuficiente nos tokens usados pelo app:
nome/horário/status usam primeiro plano do tema; fundos e faixa do dentista permanecem.
Chip usa `color-mix` válido, inclusive quando a origem é CSS var. Foco visível e nomes das
setas de navegação completam a revisão. Não alterar estados, abreviações ou distribuição.
O app eleva fontes de 9/10px para 10/11px por regra global de legibilidade: V3 documenta
essas medidas efetivas, sem remover a proteção global para reproduzir fonte menor.
Esta revisão ainda depende da conferência visual do usuário; não é autorização de produção.

Protótipo V2 preparado e inspecionado no navegador em 10/09:
`plans/artefatos/R-164-agenda-multidentista-legivel-v2.html` (aprovado para implementação em 11/09).
V1 preservada; V2 retira a navegação fictícia e apresenta somente a grade para avaliação.
Quatro dentistas, consultas 15/30min, sobreposições, nomes longos e todos os status.
Detalhe demonstrativo abre com nome completo; ações não estão conectadas ao banco.

Medidas extraídas do DOM: altura mínima 52px, raio 9px, padding interno 6px/7px;
nome 12px/750, line-height 13,8px; horário 10px/800; status 9px/800, padding 2px/4px.
Fonte provisória do protótipo: ui-sans-serif/system-ui; implementação deve usar a fonte do app.
Tokens claros observados: teal #2f9c85, teal-ink #1e7060, fundo #f4f4f6,
superfície #ffffff, borda #c2c2c6, texto #09090b. Usar tokens equivalentes do aplicativo.
Grade preserva SLOT_HEIGHT=96 e calcularFaixas; remover ícones não elimina o estreitamento
dos encaixes: card em três faixas mediu 84,22px em viewport 1280 e 55,73px em viewport 596.
Esse limite fica visível no protótipo; ampliar colunas/alterar distribuição exige decisão própria.

Implementado em dois arquivos, sem API/schema: `b98b5c7` publicou a retirada de ações no preview;
`4755602` local acrescenta contraste/foco/setas, integrado como `e336bcd` em
`codex/testes-integrados` (base financeira R-157). Nenhuma promoção para clientes.
Dois testes focados e lint passaram. Harness do componente real, com CSS/fontes do app,
confirmou clique/Enter com IDs corretos e ações ausentes em multicoluna. Revisão UX aprovou
o componente após corrigir contraste e chip CSS inválido. V3 aguarda conferência visual.
Medida estreita observada: três faixas podem produzir alvo de 38,26 × 50,4px em viewport390;
não ampliar algoritmo silenciosamente. Coluna única conserva a faixa antiga: muitos ícones
em card baixo continuam cortados; teclado aciona callback, mas clique na área cortada falha.
Esse achado preexistente é recorte separado; não declarar todos os atalhos testados por mouse.
QA do aplicativo novo com gravação no detalhe segue pendente: Vivaldi não responde aos inputs,
e IAB não tem sessão Vercel para abrir o preview protegido. Não remover proteção como atalho.
Configuração e fixtures no [contrato do ambiente](ambiente-teste-supabase-free.md).
