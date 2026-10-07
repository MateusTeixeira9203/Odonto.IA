# R-185 — Reaplicação segura do lote de restauração

> **SPEC** · **R-185** · 🔵 ativo
> **Aberto:** 2026-10-06 · **Fase:** implementado e verificado em localhost; sem deploy

## Problema e decisão

Na QA sintética, D15+D25 × faces V+O criaram 4 eventos; reaplicar no mesmo editor gerou 8 e um orçamento com 8 itens. A decisão do usuário nesta conversa: **reaplicação idêntica no mesmo rascunho é a mesma intenção clínica**. Um segundo procedimento legítimo precisa de diferença clínica explícita. O gesto da cliente real continua desconhecido.

## Contrato técnico

Somente a ação “Restauração ▾ → Aplicar” de `FaixaLote` usa a nova proteção. `eventosDoLoteRestauracao` continua criando propostas com IDs próprios; uma função pura acrescenta apenas propostas sem intenção igual no estado **atual** do rascunho. O callback de estado usa atualização funcional para que cliques rápidos comparem com a versão mais recente, sem depender do render anterior.

Identidade de uma intenção de restauração: tipo `carie_restauracao`, dente, conjunto de faces (ordem irrelevante), status, origem, `momento_planejado`, data clínica disponível (`realizado_em` em realizado; data de lançamento do lote / `registrado_em` em indicado), dentista autor, `encaminhadoParaId`, `procedimentoId`/`procedimentoNome`, `grupo_id`/`papel_no_grupo`, observação e detalhe. A comparação usa valores exatos para notas/detalhes: normalizar texto poderia fundir descrições clinicamente distintas. Dado desconhecido de autoria/data em evento antigo **não** autoriza supressão. Evento assinado permanece intocado e não bloqueia nova intenção. O primeiro evento conserva ID e posição.

O draft de lote carrega autoria e data como metadados transitórios. O argumento de autor é opcional só para preservar chamadas antigas da função pura; sem autor conhecido, não há supressão. Sem schema/API novos. O fluxo atual da Ficha é `ProntuarioTab → useRegistrarPainel → FaixaLote`, compartilhado com Meu Dia. `FichasTab` permanece no repositório, mas não é renderizado pelo perfil atual; não entra no recorte. Ambos os saves atuais encaminham o draft como está, sem dedup global de restaurações.

## Comportamento e exemplos

- Vazio → aplicar D15+D25, V+O: quatro eventos; aplicar novamente qualquer número de vezes: mesmos quatro IDs.
- Diferente dente, face, data disponível, modo, autor, encaminhamento, procedimento, grupo, observação ou detalhe: novo evento preservado. Em realizado clínico, editar `realizado_em` muda a identidade atual, mesmo que a data transitória original continue igual.
- Se uma seleção parcialmente repete o lote, acrescentar só combinações ainda ausentes.
- Dois cliques rápidos contra o mesmo rascunho: quatro eventos, não oito.
- Eventos existentes, assinados ou de autoria/data incerta não são alterados nem removidos.
- Recarregar e salvar mantém contagem e IDs persistidos; orçamento recebe apenas os eventos realmente presentes.

## Gates

1. Testes puros da primeira aplicação, sete reaplicações, clique rápido com estado funcional, múltiplos dentes/faces, sobreposição parcial, todas as dimensões de distinção, assinado e metadata desconhecida.
2. Ficha e Meu Dia renderizados em clínica/paciente QA: draft, payload de save, linhas no banco e itens do orçamento conferidos antes/depois de reload.
3. Typecheck/lint focal e testes de odontograma passam, mas **não** substituem o gate funcional.
4. Código restrito à criação/reaplicação do lote nas duas entradas atuais. Sem mudança visual, financeiro, histórico, RLS, schema, push ou deploy.

## Reversão e limites

Reverter o patch de lote no cliente; não limpar eventos históricos. Metadados transitórios de lote não sobrevivem por si só ao banco. Eventos antigos não entram no rascunho novo do fluxo atual; se outro editor futuramente misturar eventos antigos ao draft sem autoria/data comprovadas, a comparação conservadora pode permitir novo evento, em vez de suprimir ato legítimo. O contrato não pretende deduplicar IA, eventos de outros tipos nem corrigir registros existentes.
