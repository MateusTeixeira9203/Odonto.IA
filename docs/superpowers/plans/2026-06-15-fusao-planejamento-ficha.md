# Fusão PlanejamentoTab → Ficha (incrementos 5-7 da Fase 3)

**Data:** 2026-06-15
**Objetivo:** Eliminar a aba "Tratamento" e unificar tudo na ficha (modelo 1 ficha = 1 tratamento). A ficha vira o documento clínico único; o **Apresentar** (conversão) é preservado e elevado pra dentro dela. Nada de quebrar assinatura/PDF.

> **Esta é a maior cirurgia do redesign:** mesclar `FichasTab` (~1100 linhas) com o que vale do `PlanejamentoTab` (~1800 linhas). Sessão dedicada, increment por increment, com `tsc` + teste manual entre cada.

---

## O que já está pronto (não refazer)

Fase 3 Parte A — **concluída e verificada** (`tsc` verde, rodou em runtime):
- Aba renomeada → **Prontuário**; aba Resumo removida.
- Lista plana (`evolutions.map`); card **clicável** abre a ficha (`role="button"` + `onClick={handleEdit}`); ⋮ só com Imprimir/Excluir.
- Subsistema de episódios de tratamento **removido da FichasTab** (estado/handlers/modais/imports).
- Barra de abas virou **botões ícone+label** preenchidos (adapta a 4 ou 5 abas).

O **editor da ficha já tem** odontograma + procedimentos por dente + observações + assinatura + upload + sugestão de orçamento por IA. Ou seja: **o documento já existe** — falta reordenar, trazer o Apresentar e matar a aba Tratamento.

---

## Inventário do PlanejamentoTab — decisão de cada peça

| Peça (PlanejamentoTab) | Decisão | Por quê |
|---|---|---|
| **ApresentarPanel** (slides do plano, Editar/Apresentar) | **MOVER** pra ficha (botão "Apresentar ao paciente" no cabeçalho) | É o diferencial de conversão; tem que sobreviver |
| **Mapa do Tratamento** (odontograma agregado por sessões) | **DROPAR** | No 1:1 cada ficha tem seu odontograma; agregado não faz sentido |
| **Seções de planejamento por IA** (`sections`: exames/diagnóstico/tratamento) | **DROPAR/SIMPLIFICAR** | A ficha já é o plano; o Apresentar passa a montar slides a partir da ficha |
| **Episódios de tratamento** (criar/encerrar/historico/review/modais) | **DROPAR** | Modelo 1:1 (já removido da FichasTab) |
| **`budgetProcedures` / `budgetExists`** (orçamento) | **PRESERVAR (dado)** | O Apresentar mostra os valores; vem do orçamento do paciente |
| **`planProcs`** (procedimentos do plano) | **REAVALIAR** | No 1:1 viram os procedimentos-por-dente da própria ficha |
| **`documents`** (radiografias/fotos) | **PRESERVAR** | O Apresentar usa imagens; já existem em `paciente_documentos` |
| **`clinicaLogoUrl`** | **PRESERVAR** | Branding nos slides |

---

## Modelo unificado (o alvo)

```
Aba "Prontuário"  (única aba clínica — "Tratamento" some)
   └─ Lista de fichas (já pronta)
        └─ [abrir] → FICHA-DOCUMENTO (o editor de hoje, reordenado)
              Cabeçalho: paciente · data · [Apresentar ao paciente] · [Imprimir]
              Corpo (cima→baixo):
                queixa → odontograma → procedimentos por dente (marcável)
                → anotações/conduta → assinatura no rodapé
              [Apresentar] abre o ApresentarPanel alimentado PELA FICHA
```

Abas finais: **Prontuário · Agenda · Orçamentos · Arquivos** (4).

---

## A decisão técnica central: contrato de dados do Apresentar

Hoje o `ApresentarPanel` recebe `sections`, `planProcs`, `budgetProcedures`, `documents` (montados no PlanejamentoTab). No modelo fundido ele precisa ser alimentado **a partir da ficha**:

- **slides de procedimentos** ← `dentes_observacoes` da ficha (procedimentos por dente) + `procedimentos`
- **odontograma do slide** ← `dentes_afetados` da ficha
- **valores** ← orçamento do paciente (`budgetProcedures` — buscar em FichasTab)
- **imagens** ← `paciente_documentos` (já existe)
- **seções de texto (exames/diagnóstico)** ← DROPAR ou derivar das anotações da ficha

**Tarefa-chave:** definir/ajustar a interface do `ApresentarPanel` pra aceitar esses dados vindos da ficha, em vez das `sections` do planejamento. Confirmar no início da execução lendo `ApresentarPanel.tsx` por completo (props + como monta os slides).

---

## Incrementos (ordem de execução, cada um com checkpoint)

### 5.1 — Confirmar a base (início)
- Ler `ApresentarPanel.tsx` inteiro (props reais + montagem dos slides).
- Confirmar qual odontograma o editor da FichasTab usa hoje vs o `Odontograma` (`@/components/odontograma/Odontograma`) do PlanejamentoTab — decidir o canônico na ficha.
- Conferir de onde sai `budgetProcedures` (query do orçamento) pra replicar em FichasTab.

### 5.2 — Reordenar o editor da ficha (documento)
- No painel `isPanelOpen` da FichasTab, reordenar pra: quem/quando → **queixa** → **odontograma** → **procedimentos por dente** → **anotações/conduta** → **assinatura no rodapé**.
- Hoje é 2 colunas (form | odontograma); virar documento top-down. **Não** mexer no `handleSave`/`formData`/assinatura — só layout.
- Checkpoint: criar/editar ficha + assinar + PDF continuam funcionando.

### 5.3 — Trazer o Apresentar pra ficha
- Adicionar botão **"Apresentar ao paciente"** no cabeçalho da ficha (primário, teal).
- Buscar em FichasTab os dados que o ApresentarPanel precisa (orçamento + documentos).
- Renderizar `<ApresentarPanel open={apresentarOpen} ... />` alimentado pela ficha (contrato acima).
- Checkpoint: abrir Apresentar, navegar slides, fechar — sem erro.

### 5.4 — Remover a aba "Tratamento"
- Em `paciente-detail-client.tsx`: remover a entrada `tratamento` do array de abas (já é ícone+botão).
- Remover o `TabsContent value="tratamento"` (que renderiza `PlanejamentoTab`).
- Remover o `TabsContent value="resumo"` órfão (limpeza pendente da Fase 1).
- Checkpoint: abas = Prontuário · Agenda · Orçamentos · Arquivos; default Prontuário.

### 5.5 — Aposentar o PlanejamentoTab
- Se nada mais usa `PlanejamentoTab`, deletar o arquivo + imports.
- Se o `ApresentarPanel` precisar de helpers que viviam nele, mover pra um util compartilhado.
- Checkpoint: `tsc` limpo, sem imports órfãos (rodar `eslint` no arquivo).

### 5.6 — Verificação final (manual, logado)
- Criar ficha nova no Modo Consulta → aparece no Prontuário.
- Abrir ficha → documento na ordem nova → marcar procedimento feito → assinar → PDF.
- Apresentar ao paciente → slides corretos (procedimentos + odontograma + valores).
- Confirmar que **nenhuma** funcionalidade legal (assinatura/PDF/prontuário) quebrou.

---

## Invariantes (NÃO pode quebrar)
- **Assinatura** (`assinado_em`, captura via `ConsultaAssinaturaModal`/signature_pad) e **PDF** (`/api/fichas/[id]/pdf`).
- Criação/edição de ficha (`handleSave`, `formData`, `dentes_observacoes`, `procedimentos_concluidos`).
- O odontograma e a marcação de procedimento por dente.

## Riscos
- **Maior:** quebrar o save/assinatura ao reordenar o editor (5.2) — por isso só mexer em layout, nunca em `handleSave`/`formData`.
- **Médio:** wiring do Apresentar (5.3) — o contrato de dados é novo; testar os slides.
- O `tsconfig` é `strict` **sem** `noUnusedLocals` → órfãos viram warning (não quebram build), mas limpar via `eslint`.

## Pós-fusão
- Polir a barra de botões já implementada (ela adapta sozinha pra 4 abas).
- Tema C (métricas TTV) e Tema D (cron emails D1/D3/D7) seguem pendentes.
- Revisar design do Modo Consulta (memória `project_modo_consulta_design`).
