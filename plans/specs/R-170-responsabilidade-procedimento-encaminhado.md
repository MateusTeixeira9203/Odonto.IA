# R-170 — Responsabilidade do procedimento encaminhado

> **SPEC** · **R-170** · 🔵 ativo
> **Aberto:** 2026-09-16 · **Fechado:** — · **Fase:** aprovada pelo usuário nesta conversa

## 1. Problema

O procedimento encaminhado mistura autoria, responsável e executor no mesmo campo. Depois de concluído, o dentista que executou perde continuidade e o dentista de origem ainda pode alterar um registro que não executou. A ficha também promete adição compartilhada, mas a RPC bloqueia o destinatário.

## 2. Decisão e alternativas descartadas

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| `encaminhado_para` permanece como responsável/executor do procedimento | devolver ou transferir autoria ao concluir | Preserva quem criou e quem executou, sem apagar contexto |
| Origem lê, executor escreve o item encaminhado | ficha inteira editável pelo destinatário | Evita alteração de registros clínicos de outro dentista |
| Destinatário pode acrescentar itens próprios à ficha aberta | criar uma nova ficha para cada continuidade | Mantém um único tratamento e histórico legível |

## 3. Objetivo e como funciona

**Objetivo:** um encaminhamento concluído continua acessível ao executor e mostra seu retorno completo ao dentista de origem, dentro da mesma ficha.

No Meu Dia, o histórico clínico fica em ordem decrescente e permite filtrar todos os atendimentos, os do dentista logado e os de cada doutor. Pendência concluída deixa de contar como pendência, mas continua no histórico do executor. Na ficha aberta, todos leem; apenas o executor altera o item que recebeu. Ele pode adicionar novos itens próprios à mesma ficha enquanto ela não estiver assinada.

## 4. Contrato técnico

- Não acrescentar tabela nem trocar autoria: `odontograma_eventos.dentista_id` segue como autor e `encaminhado_para` segue como executor persistente.
- Substituir as RPCs `encaminhar_eventos_odontograma`, `concluir_evento_encaminhado`, `editar_detalhes_evento_odontograma`, `adicionar_procedimentos_ficha` e `assinar_procedimentos` com autorização por evento:
  - sem encaminhamento: somente autor;
  - encaminhado: somente `encaminhado_para` para status, detalhe técnico e assinatura;
  - origem conserva leitura e não pode remover/reatribuir/reabrir/assinar o evento;
  - adição aceita autor da ficha ou dentista que seja executor de ao menos um evento ativo dela; novos eventos usam obrigatoriamente `dentista_id = caller` e `encaminhado_para = null`.
- `MeuDiaVisita` expõe executor de cada evento para renderizar o retorno; `HistoricoBloco` filtra localmente as visitas já autorizadas por `dentistaId`, sem nova consulta.
- `ProntuarioTab` calcula ações por evento: item encaminhado só habilita destino; origem abre os detalhes em modo leitura. A assinatura seleciona itens cuja responsabilidade é do logado.

## 5. Comportamento — o alvo funcional

| Estado | Quando acontece | O que a tela mostra | O que a função faz |
|---|---|---|---|
| Sucesso | destino conclui item | `Realizado por você` e detalhes permanecem abríveis | atualiza status/data, sem limpar detalhe ou executor |
| Sucesso | origem abre retorno | status, executor e detalhe em leitura | não habilita controles de escrita |
| Sucesso | destino acrescenta item | novo card sob a mesma ficha | cria evento com autoria do destino |
| Sem permissão | origem tenta alterar item encaminhado | controles ausentes; RPC recusa chamada direta | não altera nenhuma coluna |
| Ficha assinada | qualquer tentativa de escrita | registro bloqueado | RPC devolve `ficha_assinada`/`registro_bloqueado` |
| Conflito | item mudou enquanto estava aberto | mensagem para recarregar | não sobrescreve conteúdo clínico |

```
destino abre procedimento encaminhado
  → preenche detalhe técnico e conclui
  → mesma linha guarda autor + executor + status
  → executor a encontra no histórico e pode continuar na ficha
  → origem a lê como retorno, sem escrita
```

| Dado / situação | O sistema faz | Resultado esperado |
|---|---|---|
| Dr. A encaminha canal a Dr. B | Dr. B registra canais e marca realizado | A vê o detalhe completo; B mantém acesso e responsabilidade |
| Dr. B identifica dois procedimentos adicionais | adiciona os dois à ficha aberta | os dois têm autor Dr. B; demais itens de A continuam bloqueados para B |
| Dr. A tenta marcar o canal encaminhado | bloqueia no banco e na UI | status e detalhes de B não mudam |
| Dr. B filtra histórico por `Meus` | mostra sua execução e suas visitas | não conta realizado como pendência |

## 6. Referência visual

Sem tela nova. Reusar a superfície de Meu Dia e da Ficha unificada: `bg-surface`, `border-border`, `text-text-primary`, status clínico existente e Motion leve de lista. No histórico, filtros são controles compactos acima das visitas, sem ocultar o botão de abrir ficha.

## 7. Invariantes

- [ ] Toda leitura e escrita continua limitada por `clinica_id` e papel clínico.
- [ ] Status realizado nunca apaga `detalhe`, `dentista_id` ou `encaminhado_para`.
- [ ] Um dentista não edita, retira, reassina ou muda status de evento encaminhado a outro.
- [ ] Eventos novos do executor não mudam autor, detalhes ou status dos eventos existentes.
- [ ] Assinatura segue pertencendo a quem é responsável pelo evento assinado.

## 8. Gates de aceite

- [ ] Com duas contas da mesma clínica, Dr. B conclui e reabre somente o item encaminhado a ele.
- [ ] Dr. A enxerga o item e seu detalhe, mas chamadas diretas de alteração falham.
- [ ] Dr. B adiciona itens à mesma ficha não assinada; Dr. A não perde nenhum item existente.
- [ ] Dr. B vê o concluído no histórico do Meu Dia, fora da contagem de pendências.
- [ ] Filtros do histórico mostram Todos, Meus e um doutor específico em ordem decrescente.
- [ ] Ficha assinada e outra clínica não permitem escrita.
- [ ] Testes unitários, typecheck e CI passam; RLS é validada manualmente com duas contas.

## 9. Fora de escopo

- Reatribuir/cancelar encaminhamento já aceito.
- Criar uma nova ficha automaticamente ao concluir.
- Alterar orçamento ou financeiro por causa do encaminhamento.

