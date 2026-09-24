# R-173 — Criação de orçamento confiável

> **SPEC** · **R-173** · 🔵 ativo
> **Aberto:** 2026-09-24 · **Fechado:** — · **Fase:** aprovada

## 1. Problema

Em produção, a criação de um orçamento a partir de ficha clínica retornou “Nenhum item foi salvo”. A investigação no Preview confirmou o SQLSTATE `42703`: o trigger financeiro compartilhado lia `NEW.origem_lancamento` ao inserir em `orcamentos`, coluna que só existe nos lançamentos manuais. O erro da RPC não era classificado integralmente pela Server Action, o que impedia o diagnóstico. A superfície de procedimentos também cortava nomes extensos tanto na montagem quanto na escolha de itens para uma etapa.

## 2. Decisão

Manter a criação transacional no banco. Corrigir o trigger financeiro para ler `origem_lancamento` de forma estruturalmente segura nas cinco tabelas atendidas. Unificar a regra de responsável financeiro usada pela tela e pelas RPCs/validadores: encaminhamento explícito, depois autor do evento, depois autor da ficha. A tela recebe somente mensagens seguras e acionáveis; detalhes técnicos ficam no log de servidor. O patch parte de `origin/main` e não inclui recursos de preview.

## 3. Objetivo

O dentista consegue criar orçamento para procedimentos válidos da própria ficha; se a criação for recusada, entende o que precisa corrigir sem que exista gravação parcial. Nomes longos permanecem legíveis na montagem e ao selecionar itens de uma etapa.

## 4. Contrato técnico

- **Banco:** migrations forward-only recriam as funções de criação/adicionamento de orçamento e validadores de vínculo que comparam responsável de evento, e corrigem o trigger financeiro compartilhado. Não alteram tabelas, RLS, grants ou dados existentes.
- **Trigger financeiro:** `private.definir_titular_financeiro` extrai opcionalmente `origem_lancamento` com `to_jsonb(NEW)`, evitando referência a uma coluna inexistente quando o trigger recebe `orcamentos`, `pagamentos` ou cobranças.
- **Responsável financeiro de evento:** `coalesce(encaminhado_para, dentista_id, ficha.dentista_id)`.
- **Server Action:** `criarOrcamento` e a ação de adicionar itens convertem os códigos conhecidos `orcamento_*` em mensagens seguras. Erro desconhecido registra somente código/mensagem da RPC no servidor e retorna orientação de recarregar/tentar novamente.
- **Catálogo:** quando existir procedimento do catálogo do responsável atual com o mesmo vínculo, o ID desse catálogo é enviado; um ID histórico incompatível não é priorizado.
- **UI:** o modal de montagem usa área maior para procedimentos em desktop; nome longo quebra linha. A lista de seleção da etapa reserva largura ao valor e deixa o nome quebrar linha.

## 5. Comportamento

1. **Criação válida:** dentista autenticado abre a própria ficha, seleciona eventos clínicos válidos e confirma. A RPC cria orçamento, itens e vínculos em uma transação; a página é revalidada.
2. **Responsável por evento:** outra pessoa abriu a ficha, mas o dentista atual registrou o evento sem encaminhamento. A tela e o banco reconhecem o autor do evento como responsável e permitem somente ele criar/adicionar esse item.
3. **Evento indisponível ou já orçado:** a RPC recusa; nenhum orçamento ou item parcial fica salvo e a tela orienta a recarregar a ficha.
4. **Erro não classificado:** a tela informa falha temporária e preserva os campos; o log de servidor contém o diagnóstico técnico, sem expor-o ao cliente.
5. **Nomes extensos:** o nome completo pode ocupar mais de uma linha sem cobrir preço, quantidade, checkbox ou ação de remoção.

## 6. Referência visual

- Preservar tokens atuais (`bg-surface`, `border-border`, `text-text-primary`, `text-text-secondary`, `text-teal-ink`).
- Na montagem desktop, ampliar o modal para `90vw` (máximo `1280px`), manter a coluna de dinheiro fixa em `360px` e entregar o restante para procedimentos.
- Nas linhas de item e de etapa, procedimento pode quebrar linha; preço fica em coluna que não encolhe.

## 7. Invariantes

- Nenhuma mudança de RLS, permissões ou política multi-clínica.
- Toda consulta e vínculo continua limitado à clínica ativa.
- Um evento não entra em dois orçamentos; falha continua atômica.
- Encaminhamento explícito sempre prevalece sobre autoria.
- Não alterar os fluxos Meu Consultor, gestão, estoque ou qualquer código exclusivo de preview.

## 8. Gates de aceite

| Gate | Evidência |
|---|---|
| Criação por autor do evento | teste SQL/integração da RPC com ficha de outro autor, evento do dentista-alvo e orçamento criado uma única vez |
| Encaminhamento preservado | teste da RPC rejeita dentista diferente do encaminhado |
| Sem gravação parcial | teste força evento inválido e confirma ausência de orçamento/itens/vínculos novos |
| Erro acionável | teste unitário da classificação de códigos e inspeção da Server Action |
| Layout | revisão no navegador desktop e largura reduzida, com nomes longos na montagem e na etapa |
| Regressão técnica | `pnpm typecheck`, testes focados e build/preview remoto |

## 9. Fora de escopo

- Redesenho do fluxo de orçamento ou cobrança.
- Alteração retroativa em orçamentos, pagamentos, fichas ou eventos existentes.
- Publicação em produção sem migration aplicada e sem aprovação final do usuário.
