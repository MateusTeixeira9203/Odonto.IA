# Handoff de execução — 2026-07-07 (madrugada)

> **Modo da próxima sessão: EXECUÇÃO.** Este handoff é o **checklist acionável** — aponta pro spec, não o repete. Não re-escopar: o que está especificado, executa; o que não está, volta pro planejamento.
> **Contrato mestre:** [`plans/specs/spec-leva-semana-loop-clinico.md`](../specs/spec-leva-semana-loop-clinico.md) — cada item tem `arquivo:linha`, invariantes e critério de aceite. Ler ele **antes** de codar.
> **Porquê / raciocínio:** `plans/handoffs/handoff-2026-07-06-discussao.md` (a discussão que originou a leva).

## Plano / spec de referência
- **Spec ativo:** `plans/specs/spec-leva-semana-loop-clinico.md` — **aprovado, pronto pra execução**.
- **Roadmap:** `plans/roadmap/roadmap-polimento.md` (itens #2, #5, #6, #7, #10, #11).

## O que esta sessão (planejamento) produziu
- Escopou e **fechou** os 6 itens da leva da semana (#2, #5, #6, #7, #10, #11) com o código na frente — cada decisão validada contra o código real.
- Gerou o spec de execução (contrato completo, `arquivo:linha`).
- **Nada foi codado.** Só artefatos em `plans/`.

## Régua da semana (contexto do porquê)
Teste com clínica **2 secretárias + 5 dentistas** é o alvo. **Mexer pouco, não desestabilizar o dinheiro, dogfoodar antes.** Nenhum item toca schema — tudo reusa tabela/action existente.

---

## PRONTO PRA CODAR (tem spec — seguir a ordem)

Ordem sugerida no spec §5. Resumo do que fazer em cada (detalhe no spec):

1. **#11 — Reordenar abas** _(aquece, ~5 min, risco zero)_
   `paciente-detail-client.tsx:1122-1125` → ordem `Prontuário · Orçamentos · Arquivos · Agenda`. Não remover nada.
   ⚠️ Micro-decisão aberta: manter rótulo "Arquivos" ou renomear "Documentos" (default: manter).

2. **#7 — Alerta de catálogo (Opção B)** _(isolado, ~zero risco)_
   `novo-orcamento-modal.tsx:235-249` → caixa âmbar empilhada + botão largo `Cadastrar "{nome}" a R$ {valor} no catálogo`. Salva na hora (reusa `handleCadastrarProcedimento`). **Sem confirm.**

3. **#5 + #6 + #10 juntos** — **mesma superfície: o card de ficha do `FichasTab.tsx`.** Fazer a barra de ações **inteira de uma vez**:
   - **#5:** ação principal por estado — não assinada: `[Gerar orçamento]`(teal)+`[Assinar]`(contorno) lado a lado; assinada: selo+`[Gerar orçamento]`. Divisor. `Editar/Baixar/Excluir` como ícones. Editar com ícone **distinto** do Assinar. **Sem "•••".**
   - **#6:** botão `Gerar orçamento` → callback `onGerarOrcamento(fichaId)` → pai abre `NovoOrcamentoModal` **mirado na ficha** (pula `selecionar`, cai em `itens` pré-preenchido via `fichaParaItens`). Ao Criar: toast + volta pra ficha (já é o comportamento). Envio = balcão na aba Orçamentos.
   - **#10:** botão `Agendar retorno` (só se há `retorno_sugerido`) → callback `onAgendarRetorno(fichaId, prazo)` → pai abre "Nova Consulta" pré-preenchido (paciente + data = hoje+prazo). Humano confirma o slot.
   - **Padrão-chave:** `FichasTab` é dinâmico/autocontido; os modais moram no pai → usar **callbacks pro pai** (§3.2 do spec), não duplicar modais.

4. **#2 — Walk-in "Atender agora"** _(o mais pesado — deixar por último)_
   - **Action nova:** `criarPacienteRapido({ nome, telefone })` (padrão de `criarProcedimentoRapido`, orcamentos/actions.ts:594). **Única coisa nova do repo inteiro.**
   - Popup busca-primeiro (reusa `buscarEncaixePacientes`) → acha (usa id) ou cria rápido → `criarEncaixe({ pacienteId, dataHora: agora })` → `router.push('/consulta/${id}')`.
   - Entrada na agenda/dashboard; bônus: atalho na página do paciente ao lado de "Nova Consulta".
   - Fantasma abandonado = fica na agenda (limpeza manual, **sem** auto-limpeza).

## PRECISA PLANNING ANTES (não codar nesta leva)
- Auto-limpeza do agendamento-fantasma (#2) · dedup de catálogo (#7 metade difícil) · remover aba Agenda (#11) · fluxo "secretária assina na recepção" · deep-link gerar-orçamento no fim da consulta. Tudo listado em §2 do spec como **fora de escopo**.

## VERIFICAÇÃO (antes de subir)
- [ ] **Dogfood o loop inteiro** como dentista: walk-in → consulta → ficha → assinar → gerar orçamento → agendar retorno. Versão mal-dogfoodada = bug na véspera do teste.
- [ ] `design-review` no card de ficha renderizado (é polish visual: tokens, light/dark, hierarquia, máx. 2 botões grandes).
- [ ] `qa-web` no fluxo clínico.
- [ ] Commitar por item (mensagens pequenas); **não** pushar sem revisar (há 6 commits locais não pushados + prod DB à frente do código — ver handoff de execução de 07-06).

## Decisões tomadas (pra não re-debater)
| Decisão | Descartado | Motivo |
|---|---|---|
| Walk-in busca-primeiro + criar nome+telefone | Só-nome inline na consulta | Busca desduplica e preserva histórico/alertas; só-nome cria fantasma sem telefone → mata follow-up |
| Matar o "•••", tudo visível | Overflow menu | Esconder vai contra "menos cliques"; persona veterano precisa de affordance explícito |
| Ação principal do card **por estado** | Botão fixo | Menos clique: o teal é sempre o próximo passo (Assinar → Gerar orçamento) |
| Orçamento **desacoplado** da assinatura | Gatear orçamento em "assinado" | Clínica pode assinar na recepção; gatear prende o dentista |
| Após Criar orçamento: toast + fica na ficha | Auto-jump pro envio | Enviar PDF é **balcão** (secretária/checkout), não o fluxo clínico |
| #7 sem confirm | Auto-salvar com confirm | Confirm não resolve poluição real (dedup, deferido); só seria atrito |
| #10 dentista agenda na hora (Opção A) | Tarefa pro balcão (B) | Balcão pode estar ocupado/ausente ou não existir (solo); agendar com paciente na cadeira é a retenção mais forte |

## Arquivos que a execução vai tocar (do spec)
| Arquivo | Itens |
|---|---|
| `src/components/pacientes/FichasTab.tsx` | #5, #6, #10 (barra de ações + callbacks) |
| `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` | #5(header), #6(handler), #10(handler), #11(abas) |
| `src/app/dashboard/pacientes/[id]/_components/modals/novo-orcamento-modal.tsx` | #7 (caixa âmbar) |
| `src/app/dashboard/pacientes/[id]/actions.ts` (ou pacientes/actions.ts) | #2 (`criarPacienteRapido`) |
| novo componente + entrada agenda/dashboard | #2 (popup walk-in) |

## O que eu estava cogitando (não virou decisão)
- **#11 rótulo "Arquivos" vs "Documentos"** — ficou em aberto; decidir na execução (trivial).
- **#2 bônus (atalho na página do paciente)** — vale se sobrar folga; o popup global cobre todos os casos.
- **#10 ligar o campo "Data de retorno" do finalize-consultation-dialog** ao mesmo gatilho — bônus "dado flui pra frente", não bloqueia.
- **Validade do teste é um risco em si:** quanto mais mexer na véspera, menos se sabe o que se testa. Reservar tempo pra dogfoodar > codar mais um item.

## Como retomar
```bash
git checkout feat/fase1-onboarding-persona-loop
# ler o spec, depois abrir os 2 arquivos-âncora:
#   src/components/pacientes/FichasTab.tsx  (barra de ações — #5/#6/#10)
#   src/app/dashboard/pacientes/[id]/_components/modals/novo-orcamento-modal.tsx  (#7)
# ordem: #11 → #7 → #5+#6+#10 → #2
```

## Próxima sessão
- **Modo:** execução.
- **Ler primeiro:** este handoff (checklist) + `plans/specs/spec-leva-semana-loop-clinico.md` (contrato, panorama completo). Pro porquê: `handoff-2026-07-06-discussao.md`. Pro estado do repo/segurança: `handoff-2026-07-06-execucao.md`.
