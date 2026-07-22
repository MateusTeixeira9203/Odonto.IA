# Roadmap — Odonto.IA

> **ROADMAP** · **Odonto.IA** · atualizado 2026-07-22
> **Ativo:** nenhum · **Fila:** 13 · **Concluídos:** 1 · **Congelados:** 0

> Reconstruído do zero em 2026-07-21 por decisão do Mateus. O histórico anterior está no
> git (`git show 4a93234:plans/roadmap/roadmap-mestre-2026-07-21.md`) e na pasta
> `Desktop/roadmap,spec, handofs antigos/` — consulta, não operação.

**Status:** ⏳ fila · 🔵 ativo (máx 1) · 🟡 no ar não verificado · ✅ no ar e verificado ·
🧊 congelado · ✂️ cortado. **Código escrito ≠ código verificado** — 🟡 se trata como não-feito.

## Agora

Nada ativo — R-13 fechou em 22/07. Próximo item: ver **Fila**.

> Detalhe do que falta e o que trava: `plans/ESTADO.md`

## Fila

Ordem = prioridade. Só entra item com objetivo claro em uma linha.
Peso: **P** (uma sessão) · **M** (2–3 sessões) · **G** (precisa quebrar).

> **Regra de produto (21/07):** *toda especialidade precisa de entrada manual, não só por voz.*
> Se o dentista não ditar, ou se a IA errar, tem que haver caminho pra lançar e corrigir na mão.
> Vale para os itens R-05 a R-08.

> A ordem abaixo é **provisória** — o Mateus revisa depois de ler o R-01 e de trazer o material
> de base de cada especialidade (previsto para 22/07). Nada aqui é especulação: todo item saiu
> de achado verificado no código em 21/07.

| ID | Item | Objetivo | Peso |
|---|---|---|---|
| R-01 | ⏳ Ficha: o registro como unidade de salvamento | Spec pronta em fase `contrato`, [aguardando aprovação](specs/R-01-registro-unidade-salvamento.md). Cedeu a vez em 22/07 pra agenda, que é bug em produção com usuário real | M |
| R-14 | ⏳ Dashboard da secretária monta "hoje" no fuso do servidor | `dashboard/page.tsx:26-29` usa `setHours` num Server Component: é meia-noite UTC, não BRT. Consulta a partir das 21h BRT some; a de ontem 21h–24h vaza pra dentro. Mesma classe do `feb4b68` | P |
| R-03 | ⏳ Assinatura e data por procedimento | O paciente assina o que foi feito, registro a registro; registro assinado congela e o resto da ficha segue editável | M |
| R-04 | ⏳ Encaminhar procedimento a outro dentista da clínica | O registro planejado ganha destino (`encaminhado_para`, já em prod), o destino é notificado e vê a fila dele | M |
| R-02 | ⏳ Ficha viva + fidelidade ao artefato | Um card só na criação e na leitura, ordenação por estado, agrupamento por procedimento e os símbolos do odontograma fiéis ao artefato | M |
| R-05 | ⏳ Ortodontia: lançamento e edição manual | `OrtoForm` existe e **nunca é renderizado** — hoje só a voz cria manutenção e não há como corrigir. Registro de arcada, não de dente | P |
| R-07 | ⏳ Procedimentos de rotina sem dono | `profilaxia`, `raspagem`, `clareamento`, `fluor`, `exame_periodontal` entraram no banco na migration 106 e não existem em plugin, chip nem enum da IA — "fiz profilaxia" não vira registro | M |
| R-06 | ⏳ Prótese fixa e odontopediatria completas | `ponte` e `esfoliacao` estão barradas no enum da IA e ausentes dos chips; faltam os símbolos (colchete pilar-pôntico, seta do permanente) | M |
| R-09 | ⏳ Voz nas especialidades (pass 2) | `/api/dex/extrair-especialidade` não tem um único chamador — endo e implante são 100% digitados. Começar pela endo | M |
| R-08 | ⏳ Periodontia: periograma | Tela própria (6 sítios × 32 dentes), tabela `perio_exames` — hoje só existe a declaração no registry. NIC calculado, nunca digitado | G |
| R-10 | ⏳ Rótulo do procedimento no orçamento e no PDF | `derivarV2DosEventos` gera "Extração - planejado (resto radicular)" — jargão interno e observação clínica no documento que o paciente lê | P |
| R-11 | ⏳ Unificar o caminho de gravação da ficha | Consulta usa server action e grava `status: concluida`; ficha rápida escreve do browser e grava `aberta`. Mesmo artefato clínico, dois contratos | M |
| R-12 | ⏳ Contraste AA nos tokens do app | `--text-3` e o botão primário reprovam WCAG AA (2,34:1 e 3,38:1 no claro). Valores corrigidos já estão na spec do R-01; falta aplicar no app inteiro | P |

## Congelado

| ID | Item | Por que parou | Descongelar quando |
|---|---|---|---|

## Concluído

| ID | Item | Fechado | Spec |
|---|---|---|---|
| R-13 | ✅ Agenda: janela de busca, multi-dentista e clique na grade | 2026-07-22 | [R-13](_arquivo/specs/R-13-agenda-janela-multidentista.md) |

## Cortado

| ID | Item | Por que não vamos fazer |
|---|---|---|
