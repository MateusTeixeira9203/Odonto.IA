# R-193 — Ações centrais acessíveis por teclado

STATUS: ACTIVE — execução local
OWNER: Implementar — código; Coordenação — integração; Auditor — gate
LAST_REVIEWED: 2026-10-11
CANONICAL_FOR: correção do achado M2-C01 de navegação por teclado

## Problema e evidência

No deployment atual, linhas/cartões de Pacientes, consultas existentes na Agenda semanal
e cartão da aba Orçamentos abrem por clique, mas não recebem foco com Tab.
O [Auditor reproduziu M2-C01](../auditorias/2026-10-11-R-182-M2-leitura.md) com conta QA B,
em três rotas, e confirmou `onClick` em elementos sem semântica interativa. É S1 para
usuário que opera por teclado e bloqueia AC-07 do R-182.

## Resultado, dentro e fora do escopo

Os três alvos passam a receber foco visível e abrir o mesmo destino/modal com Enter.
Espaço ativa botões; links seguem semântica nativa. Ponteiro, layout, dados, filtros,
autorização e navegação existentes permanecem. Não redesenhar telas, alterar schema,
API, lógica financeira ou os dados QA. DayView/MonthView e outras ações são inventário
separado, salvo consumidor direto comprovado.

## Critérios de aceite

| ID | Estado inicial e ação | Esperado e efeito proibido | Verificação segura |
| --- | --- | --- | --- |
| R193-01 | QA B na lista desktop e cartões mobile; Tab até paciente, Enter. | Foco visível; abre o paciente correto. Clique anterior continua; proibir ação duplicada. | Browser local com duas pessoas sintéticas, teclado e ponteiro; conferir URL. |
| R193-02 | QA B na Semana com consulta sintética existente; Tab até card, Enter/Espaço. | Foco visível; abre a consulta correta. Slots vazios e sobreposição preservados. | Browser local, 390 px e desktop; conferir detalhe e grade. |
| R193-03 | QA B na aba Orçamentos do paciente sintético; Tab até cartão, Enter/Espaço. | Foco visível; abre o orçamento correto. Nenhum pagamento, aceite ou edição. | Browser local, conferir ID/modal; repetir por ponteiro. |
| R193-04 | Após mudança, navegação em light/dark e 390 px. | Sem overflow, sem `React #418` novo, sem perda da ação por mouse. | Navegador local + lint/typecheck focais; QA publicada só após deploy autorizado. |

Preferir `<a>`/`button` nativos onde o HTML os comporte. Se a estrutura de tabela ou
conteúdo do card impedir um elemento nativo sem quebrar semântica, usar `role`, `tabIndex`,
teclas e nome acessível explícitos; registrar a escolha. Não introduzir `button` com
estrutura HTML inválida. Focus ring deve usar tokens do projeto e aparecer nos dois temas.

## Handoff de execução — 04_HANDOFF_TEMPLATE

- **Tarefa/área/responsável:** R-193, interação Pacientes/Agenda/Orçamento, chat Implementar.
- **Estado/base:** execução local sobre `codex/baseline-producao-v2`, base `ba5b531`;
  HID-01 já alterou `pacientes-table.tsx` e `week-view.tsx` neste checkout compartilhado.
- **Fontes:** esta spec, relatório M2-C01, `AGENTS.md`, `00_FONTE_DA_VERDADE.md`.
- **Arquivos sob responsabilidade:** `src/components/pacientes/pacientes-table.tsx`,
  `src/app/dashboard/agendamentos/_components/week-view.tsx`,
  `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` e teste focal
  relacionado. Não tocar outras specs, `plans/ESTADO.md`, auditoria ampla ou migrations.
- **Dependências:** preservar a correção local HID-01; Auditor não edita código.
- **Testes/evidência:** registrar PASSA/NÃO PASSA/NÃO TESTADO por R193-01 a 04,
  ambiente/versão, foco, teclado, ponteiro, URL/modal e regressões diretas.
- **Riscos/reversão:** elemento clicável em tabela e cards sobrepostos pode mudar
  geometria; revertê-lo isoladamente não deve reverter HID-01. Até duas tentativas
  por falha; depois relatar causa/bloqueio.
- **Não fazer:** dado real, banco, commit, push, deploy ou mudança de regra financeira.
- **Próxima ação:** inspecionar markup e consumidores, aplicar menor mudança, testar
  com conta/fixtures QA e entregar para revisão da Coordenação.

## Evidência de execução local — 2026-10-11

- **Implementação:** Pacientes usa `Link` nativo e focável no nome da linha desktop e em todo o
  cartão mobile, preservando a semântica de tabela e Enter nativo; consulta existente da Semana
  passou a usar `button` nativo com somente conteúdo phrasing; cartão de Orçamento recebeu foco,
  nome acessível, Enter e Espaço. O botão da consulta preserva o posicionamento absoluto e a
  geometria de sobreposição.
- **R193-01 — NÃO TESTADO ponta a ponta:** a rota local redirecionou a `/login`; não havia sessão
  QA no navegador isolado. Lint focal e `tsc --noEmit` passaram. Falta validar Tab/Enter, clique e
  URL com duas pessoas sintéticas em desktop e 390 px.
- **R193-02 — NÃO TESTADO ponta a ponta:** mesma limitação de autenticação. A consulta é agora
  `button type="button"`, portanto Enter/Espaço seguem semântica nativa; falta conferir no browser
  o detalhe correto, slots vazios e sobreposição em desktop/390 px.
- **R193-03 — NÃO TESTADO ponta a ponta:** mesma limitação de autenticação. O cartão trata Enter
  e Espaço sem submeter nenhuma ação; falta conferir modal/ID correto e o clique com fixture sintética.
- **R193-04 — NÃO TESTADO no navegador:** `pnpm exec eslint` nos três alvos concluiu sem erros
  (27 avisos preexistentes em `paciente-detail-client.tsx`); `pnpm exec tsc --noEmit` e
  `git diff --check` passaram. Light/dark, 390 px, overflow, console e mouse aguardam sessão QA.
- **Ambiente:** checkout local em `codex/baseline-producao-v2`, servidor Next local em
  `http://localhost:3107`, sem escrita de dados, migration, commit, push ou deploy.
- **Reversão:** remover somente os atributos/handlers e a troca para `button` deste item; não
  reverter as alterações HID-01 já presentes em `pacientes-table.tsx` e `week-view.tsx`.

## Gate de integração local — Coordenação, 11/10/2026

[Evidência autenticada QA B](../auditorias/evidencias-2026-10-11-auditoria-ampla/r193-mobile-dark-gate-final.json):
Next local em `localhost:3107`, servidor UTC, desktop 1280 px light e mobile 390 px dark,
sem escrita clínica ou financeira. O primeiro replay de ponteiro do roteiro de QA
comparou com um ID anterior após a lista mudar de ordem; a comparação foi corrigida
para o alvo efetivamente clicado e o gate completo repetido passou.

| Critério | Resultado local | Limite |
| --- | --- | --- |
| R193-01 | **PASSA:** Tab, foco visível, Enter e ponteiro abriram o paciente selecionado nas duas larguras. | Duas pessoas sintéticas estavam na lista; a versão publicada continua sem a correção. |
| R193-02 | **PASSA no card existente:** Tab, foco visível, Enter, Espaço e ponteiro abriram o diálogo nas duas larguras. | Grade com sobreposição/slots vazios não recebeu ensaio específico; verificar se surgirem fixtures apropriadas. |
| R193-03 | **PASSA:** Tab, foco visível, Enter, Espaço e mouse abriram o diálogo de orçamento nas duas larguras; nenhuma submissão. | ID do diálogo não foi aferido no DOM; o card da fixture foi o alvo único visível. |
| R193-04 | **PASSA no recorte:** 390 px dark sem overflow; desktop light; zero erro de console/hidratação; mouse passou nos três alvos. | Gate publicado depende de deploy autorizado. |

`tsc --noEmit`, ESLint focal (sem erros; 27 avisos preexistentes no detalhe do
paciente) e `git diff --check` passaram. **Pronto para revisão local**, sem commit,
push ou deploy. M2-C01 segue **NÃO PASSA na produção atual** até publicação e replay.

## Revisão do Auditor — gate local, 11/10/2026

**Ambiente/versionamento:** checkout compartilhado `codex/baseline-producao-v2`, base
`ba5b531`, com HID-01 e R-193 ainda locais; Next 16.3.3 dev/webpack em
`http://localhost:3107`. Sessão autenticada da conta sintética QA B. Replays em desktop
1280 px claro/escuro e 390 px escuro. Nenhuma escrita, submissão, mensagem, IA,
pagamento, commit, push ou deploy.

| Critério | Parecer do Auditor | Evidência e limite |
| --- | --- | --- |
| R193-01 | **PASSA** | Em desktop, `Tab` alcançou os dois links de pacientes com foco visível; Enter abriu `2150CE91…`. Clique no link e clique fora dele, na célula da linha, preservaram os destinos corretos. Em 390 px escuro, o cartão inteiro é link focável, sem overflow, e Enter abriu `823604F0…`. |
| R193-02 | **NÃO TESTADO** | O card real **passa no recorte exercitado**: é `button`, tem nome acessível, recebe foco visível e abriu a consulta QA de 05/10 às 12:30 por Enter, Espaço e ponteiro, em desktop e 390 px escuro. A condição explícita de consultas sobrepostas não tinha fixture e não foi demonstrada; slots/grade permaneceram visíveis, mas sobreposição impede PASSA integral. |
| R193-03 | **PASSA** | O único cartão da fixture é focável, tem papel/nome, e Enter, Espaço e ponteiro abriram o orçamento esperado: 03/10, Coroa total D16, R$ 100 e saldo R$ 100. Nenhuma ação interna do modal foi acionada. Desktop e 390 px escuro sem overflow. |
| R193-04 | **PASSA** no gate local | Desktop claro/escuro e 390 px escuro preservaram navegação e ponteiro; documento não excedeu a largura. Aba limpa, aberta depois do aquecimento do dev server, terminou com zero erro/warning de console. Publicação e replay no domínio real permanecem **NÃO TESTADO** até deploy autorizado. |

Verificações independentes: `pnpm exec tsc --noEmit` **PASSA**; ESLint nos três
alvos **PASSA** sem erros e com os mesmos 27 avisos preexistentes no detalhe do paciente;
`git diff --check` **PASSA**. A implementação usa HTML válido no recorte: `Link` na
lista/cartão de Pacientes, `button` com conteúdo phrasing na Semana e `div role="button"`
sem controles interativos descendentes no Orçamento.

### Achados

- **Achados confirmados:** nenhum.
- **R193-N01 — NEEDS_EVIDENCE, potencial S3:** o nome acessível do orçamento contém
  somente a data (`Abrir orçamento de DD/MM/AAAA`). Dois orçamentos do mesmo paciente no
  mesmo dia teriam nomes iguais e `aria-label` ocultaria do nome acessível status/valor.
  As duas pessoas QA inspecionadas tinham um único cartão cada; o cenário não foi
  reproduzido e não bloqueia o gate da fixture atual.
- **FALSE_POSITIVE:** a primeira abertura da Agenda durante compilação quente emitiu erro
  transitório de chunk e não respondeu aos controles. Após o servidor estabilizar, reload
  e uma segunda aba limpa repetiram os três meios de ativação; a aba limpa teve zero erro.

**Conclusão:** nenhum defeito de implementação foi encontrado nos três alvos. O gate não
reprova o R-193, mas o critério R193-02 permanece formalmente **NÃO TESTADO** quanto à
sobreposição. Produção continua sem a correção até publicação autorizada e replay.
