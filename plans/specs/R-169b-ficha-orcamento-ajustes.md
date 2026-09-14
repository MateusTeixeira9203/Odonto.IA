# R-169b — Oferecer ao orçamento as alterações da ficha

> **SPEC** · **R-169b** · 🔵 recorte do R169 ativo
> **Aberto:** 2026-09-14 · **Fechado:** — · **Fase:** contrato
> **Revisão:** 3 — execução autorizada; pendências na auditoria existente, sem nova tabela/RLS.
> Recorte obrigatório da mesma entrega [R169](R-169-dex-ficha-edicao-rapida.md).
> Destino: banco principal `zenfemoxvwerplrjgfqz`. Preview autorizado; SQL compatível isolado, sem promover o app em produção.

## 1. Problema

Depois de acrescentar um procedimento à ficha, o dentista abre o orçamento e não identifica
claramente o que ainda falta incluir. Refazer o orçamento inteiro duplica trabalho e ameaça
vínculos existentes. A retirada também precisa ter um caminho explícito, sem apagar recebimentos.

Clarificação do usuário em 14/09: o novo comportamento é **oferecer a diferença da ficha ao
orçamento**, com aviso explícito e inclusão somente dos procedimentos faltantes. Não é uma
reforma geral de preços, descontos, parcelamento ou edição financeira.

## 2. Decisão e escopo

- Ao abrir um orçamento ligado à ficha, comparar os procedimentos elegíveis dela com os IDs já
  vinculados. Aviso: **“Há 1 procedimento nesta ficha que ainda não está neste orçamento.”**
- Mostrar nome/região/data de inclusão na ficha e permitir **Revisar e adicionar** só os itens
  escolhidos. O procedimento já está na ficha; a ação agora se chama **Adicionar ao orçamento**.
- Não recriar orçamento, reenviar todos os procedimentos nem importar itens duplicados.
- A entrada “Gerar/Novo orçamento” da ficha, quando já existir orçamento relacionado, também
  oferece **Atualizar orçamento existente**; não cria outro por falta de descoberta do anterior.
- Remoção disponível dentro do orçamento. Remover item comercial não remove o registro clínico
  automaticamente. Na ficha, retirada pode oferecer **Remover também do orçamento**.
- Se a retirada comercial for adiada, a diferença reaparece ao abrir o orçamento, até resolução
  explícita. Nenhuma sincronização financeira silenciosa.
- Preservar pagamentos e orçamento existentes, inclusive aprovados/parciais/pagos. Reusar as
  regras atuais de aprovação, acordo, desconto e cobrança; não introduzir nova política de crédito.
- Edição de nomes clínicos permanece em R169. Se o orçamento precisar acompanhar o novo nome,
  oferecer atualização explícita da descrição ligada, sem alterar preço/catálogo.
- O sinal âmbar pertence **somente ao botão de orçamento na ficha aberta**. Não colocar contador,
  pulso ou alerta na visão geral do prontuário, histórico de visitas, Meu Dia ou aba Orçamentos.
  O modal compartilhado recebe origem explícita `ficha`; essa origem habilita a nova apresentação.

## 3. Fluxo e ordem de execução

1. Ficha recebe procedimento novo pelo Dex; salva na mesma ficha com ID próprio.
2. Dentista abre o orçamento da ficha; aviso lista apenas faltantes, com data de inclusão.
3. Revisar e adicionar abre a montagem existente filtrada aos selecionados; preço sem vínculo
   não é inventado e pode ser preenchido como já ocorre no orçamento.
4. Adicionar ao orçamento grava novos itens/vínculos em uma transação e atualiza o modal atual.
5. O aviso passa a mostrar somente o que ainda falta; itens já incluídos, aprovações e pagamentos
   permanecem. O dentista pode continuar no mesmo orçamento e registrar pagamento normalmente.

Executar: conferir base produtiva → contrato de identidade/retirada → leitura de diferenças →
adição atômica → retirada/aviso persistente → QA financeiro integrado → liberação do pacote R169.
Entrega em lotes reversíveis é permitida; não declarar o pacote completo sem estes gates.

### Mapa das jornadas e superfícies

| ID | Gatilho → integração → resultado | Gate observável |
|---|---|---|
| O01 | Abrir ficha → resumo server de orçamentos/vínculos → CTA exclusivo | 0/1/vários orçamentos distinguidos; nunca usar a primeira linha da query como decisão |
| O02 | Salvar C07/C10 → recarregar resumo da ficha → âmbar | Só eventos persistidos/elegíveis ainda não orçados; não acende em rascunho/erro |
| O03 | Clicar sem orçamento → `abrirOrcamentoParaFicha` → montagem/criação vigente | Criar orçamento normal, sem pulsação de atualização nem duplicata |
| O04 | Clicar com orçamento único → detalhe existente + diferenças | Mesmo `orcamentoId`, aviso explícito e somente faltantes |
| O05 | Vários destinos → selecionar um → detalhe | Contagem da ficha sem duplicar evento; diferenças do destino selecionado recalculadas |
| O06 | Revisar e adicionar → `NovoOrcamentoModal` em modo adicionar | Seleção/preço somente dos faltantes; cancelar mantém orçamento e aviso |
| O07 | Confirmar → `adicionarItensAoOrcamento` → RPC → reload detalhe/resumo | Itens anteriores/pagamentos mantidos; inclusão parcial reduz contador pelo realmente incluído |
| O08 | Fechar/reabrir/recarregar ou outra aba incluir → nova leitura | Pendência real continua; resolvida some; pulso não reinicia por render/foco |
| O09 | Renomear/status/observação/remoção → diferenças específicas | Nunca acende âmbar de inclusão; renomeação por mesmo ID não vira item novo |
| O10 | Retirar da ficha → ação clínica + opção orçamento → pendência persistente | Aplicar agora ou depois sem perder referência item/evento nem histórico |
| O11 | Retirar só do orçamento → action/RPC de retirada | Ficha intacta; grupo/legado revisados; evento retirado não reaparece como novidade automática |
| O12 | Retirada afeta cobrança → edição existente de etapa/acordo → retorno ao modal | Atualização explícita do saldo/previsões; recebido e documentos anteriores preservados |
| O13 | Registrar pagamento após inclusão/revisão → RPC atual → Financeiro/PDF novo | Saldo/cobrança corretos no mesmo orçamento, inclusive desconto e pagamento parcial |
| O14 | Sem permissão/assinatura/conflito/rede → erro ou revisão orientada | Sem fallback para orçamento novo, nenhum dado de outra ficha, escolhas preservadas |

## 4. Contrato técnico

### Fatos já conferidos

- `orcamentos.ficha_id` e `orcamento_eventos(clinica_id,orcamento_id,evento_id)` são os vínculos
  existentes; `evento_id` é único. A tabela não possui relação direta com `orcamento_itens.id`.
- `odontograma_eventos.created_at` representa inclusão; não usar a data clínica `registrado_em`
  como filtro de elegibilidade. Datas explicam o aviso, IDs determinam o que falta.
- `adicionarItensAoOrcamento` chama `adicionar_itens_orcamento_com_eventos` ou a variante `_r157`.
  As duas RPCs existem no principal; manter suporte a composição e unicidade concorrente.
- `excluir_evento_odontograma` bloqueia evento orçado; sua FK é ON DELETE RESTRICT.
  Pagamentos têm FK para orçamento ON DELETE CASCADE: excluir o pai é proibido neste fluxo.
- `editarOrcamento` atual apaga/reinsere a lista e recusa itens aprovados/com composição. Seu corpo
  não serve para inclusão/retirada incremental; não basta remover as guardas.
- `editar_cobranca_orcamento(uuid,uuid[],numeric)` e `recompor_previsao_cobranca` foram confirmadas
  por metadados no principal. Reusar esse fluxo R167 ao revisar uma etapa afetada.
- R166 (descontos) e R167 (edição de etapa) estão no checkout
  `/home/mtx/.local/share/odontoia-testes/editar-etapa`; conferir o SHA produtivo antes de portar.
  Esta spec foi renumerada R169 porque R167 e R168 já existiam em outros checkouts.

### Leitura das diferenças

Nova função server `getDiferencasFichaOrcamento`, junto das leituras de orçamento do perfil:

```ts
type ProcedimentoFaltante = {
  eventoId: string;
  nome: string;
  local: string;
  adicionadoEm: string;
};
type DiferencasFichaOrcamento = {
  fichaId: string;
  orcamentoId: string;
  faltantes: ProcedimentoFaltante[];
  renomeacoesPendentes: {
    alteracaoId: string; eventoId: string; itemId: string | null;
    nomeAnterior: string; nomeAtual: string;
  }[];
  retiradasPendentes: {
    eventoId: string;
    nome: string;
    retiradoEm: string;
    itemId: string | null; // null exige seleção explícita do item legado
  }[];
};
```

- Validar clínica, paciente, ficha e responsável do orçamento; query sempre escopada por clínica.
- Elegíveis: procedimentos clínicos ativos da ficha sob responsabilidade autorizada, indicados
  ou realizados. Implante preexistente é histórico; sua remoção indicada/realizada é outro evento.
- Faltante = elegível sem vínculo em `orcamento_eventos`, por identidade. Evento já em outro
  orçamento não é oferecido novamente; informar o vínculo existente quando relevante.
- Vários orçamentos da ficha: o usuário escolhe destino. Nenhum é escolhido pela ordem da query.
- Sem orçamento: manter criação existente com os elegíveis; não mostrar aviso de diferença fictício.
- Sem diferença: nenhum banner nem gravação. Erro de leitura não pode aparentar “Tudo atualizado”.

### Estado do botão e atualização dos dados

- Propor `ResumoOrcamentoDaFicha = { fichaId: string; orcamentoIds: string[];
  eventoIdsFaltantes: string[]; quantidadeProcedimentos: number }` como projeção de leitura.
  Resposta usa união carregando/erro/carregado; sem erro convertido em contador zero.
- `quantidadeProcedimentos` usa o mesmo agrupamento da lista de revisão, com os IDs faltantes
  deduplicados entre orçamentos. Não contar itens de colegas, retirados ou já orçados em outro destino.
- Estados: nenhum orçamento → **Criar orçamento** normal; existente sem inclusão pendente →
  **Ver orçamento** normal; existente com faltantes → **Atualizar orçamento · N** âmbar.
- Só obter/mostrar resumo quando a ficha específica estiver aberta; independente da quantidade de
  consultas históricas. No código, distinguir `superficie.tipo === 'ficha'` do prontuário geral,
  mesmo que ambos sejam renderizados por `ProntuarioTab` e usem o mesmo callback antigo.
  Passar origem tipada `{ tipo: 'ficha'; fichaId: string }` pela abertura do modal; o callback
  da listagem histórica conserva sua apresentação atual, sem herdar esse estado por compartilhamento.
- Cor/contador permanecem ao apenas abrir/fechar o modal. Somem quando nenhum faltante elegível
  restar; adicionar seleção parcial mantém o restante. Adiar não resolve a inclusão pendente.
- Clique no CTA tem feedback/trava imediatos e abre o destino sem repetir descoberta; um modal por vez.
- Aviso compacto só no orçamento solicitado; cada entrada clínica não reabre nem repete a proposta.
- Após incluir, retirar IDs confirmados do contador imediatamente e conferir o resumo em background;
  atualizar também após salvar/retirar, ao reabrir ficha/modal e retornar à aba do browser;
  ignorar resposta de ficha/paciente/ator anterior. Sem polling nem request por procedimento.
- `paciente-detail-client` integra resumo/abertura com `useOrcamentoModal`. Leitura de resumo e
  detalhe compartilha elegibilidade/IDs; uma única fonte de decisão, sem duas contas divergentes.
- `carregarModoDaFicha` hoje escolhe o primeiro orçamento e o catch volta a modo novo: corrigir
  para seleção explícita/erro recuperável. `carregarOrcamentoPersistido` tem arrays financeiros
  vazios provisórios: não usá-los para substituir pagamentos/etapas/aceites do orçamento existente.

### Inclusão incremental

- Reusar `adicionarItensAoOrcamento`, seu Zod e modal de montagem; transportar os `eventoIds`
  selecionados, não apenas descrição/dente. ID/nome do catálogo e preço seguem regras existentes.
- Cada evento precisa ser da mesma `ficha_id`, paciente, clínica e responsável do orçamento alvo;
  validar novamente na RPC, inclusive variante `_r157`, antes de qualquer INSERT.
- Lote atômico: inserir itens e vínculos juntos; se um evento já foi incluído, recarregar o aviso
  sem criar item órfão/duplicado. Mesma operação/retry não gera segunda inclusão.
- Manter IDs, descrições, composição, preços, aprovações e pagamentos dos itens anteriores.
  Item novo segue aprovação explícita existente; inclusão não marca aceite nem registra recebimento.
- Refazer a leitura do modal após sucesso; fechar/reabrir/recarregar conserva o mesmo resultado.
  Atualizar explicitamente `orcamentosState` e resumo: `router.refresh()` sozinho não substitui
  esse estado local. Buscar pagamentos/cobranças/aceite reais ao reabrir o detalhe existente.

### Retirada e correspondência de itens

Contrato proposto para action `retirarProcedimentoDoOrcamento`:

```ts
type RetirarProcedimentoDoOrcamentoInput = {
  fichaId: string;
  orcamentoId: string;
  itemId: string;
  eventoIds: string[];
  versaoEsperada: string;
  confirmarAjusteFinanceiro?: boolean;
};
type RetiradaOrcamentoResult =
  | { ok: true; orcamentoId: string }
  | { ok: false; code: 'INVALIDO' | 'SEM_PERMISSAO' | 'CONFLITO' | 'REVISAR_COBRANCA'; error: string };
```

- Migration proposta: `orcamento_eventos.item_id uuid NULL` referencia item do mesmo orçamento,
  validado com clínica. N eventos podem apontar ao mesmo item. Legado nulo não recebe backfill
  por texto: dentista identifica a linha comercial durante a revisão.
- Retirada usa marcação histórica `retirado_em timestamptz NULL` em item/evento, quando aplicável;
  mantém dados e referências para auditoria/documentos, sem DELETE do pai ou cascata financeira.
  Registrar autor/data/antes/depois no mecanismo de auditoria existente.
- Pendências de retirada/renomeação adiadas precisam de registro persistente identificado por
  clínica/ficha/evento/orçamento, tipo e data; resolução aplicada/dispensada é explícita.
  Reusar `activity_logs`: alteração clínica e resolução explícita por `alteracaoId`,
  preservando clínica/paciente/ficha/evento e autoria; nenhuma tabela ou policy nova.
- Contrato mínimo da pendência: `id`, `clinica_id`, `ficha_id`, `evento_id`, `orcamento_id`,
  `tipo` (retirada/renomeacao), `antes`/`depois` tipados por tipo, autor/data e resolução
  (pendente/aplicada/dispensada), autor/data de resolução. Derivar pendente enquanto não existir
  log de resolução correspondente; criar o log clínico na mesma transação da alteração
  clínica; resolver por ID/versão em transação com o ajuste comercial, sem apagar a evidência.
  Renomeação oferece aplicar/dispensar a descrição; preço intacto e item legado exige vínculo explícito.
- Todos os leitores ativos (ficha, pendentes, candidatos, proposta, somatórios, views e PDFs novos)
  distinguem retirado de ativo. Histórico e documentos já assinados conservam a versão original.
- Retirar somente do orçamento conserva o procedimento na ficha. Seu vínculo histórico impede
  reaparecimento automático como novidade; reintroduzir exige gesto explícito, com histórico.
- Grupos: retirar um evento de um item com vários não retira o grupo inteiro silenciosamente.
  Revisão mostra o grupo e os eventos; o dentista confirma escopo/preço pelos controles existentes.
- RPC atômica valida versão, item/eventos, permissões, assinatura e dependências de cobrança;
  trava orçamento e registros envolvidos em ordem estável. Falha não deixa meia retirada.
- Item aprovado/com cobrança não é removido por delete simples. A revisão apresenta a etapa/acordo
  afetado e reutiliza o ajuste existente no mesmo contexto; dinheiro recebido não bloqueia abrir
  a revisão. `REVISAR_COBRANCA` encaminha a essa ação, não encerra o fluxo com erro genérico.
- A retirada clínica só ocorre com autorização clínica própria; autorização financeira não permite
  editar ficha de colega/assinada. Escolher retirar só do orçamento não altera a ficha.

### Fronteira financeira preservada

- Atualizar a proposta não redefine silenciosamente o valor negociado. Etapa/acordo afetado
  exige confirmação do dentista no fluxo já existente, com total/recebido/saldo visíveis.
- R166 continua fonte da fórmula: acordo explícito vence; não acumular desconto global e etapas.
  R167 continua fonte da edição de etapa; recebimentos pagos/cancelados não são reescritos.
- Previsões pendentes só mudam quando o ajuste financeiro correspondente é confirmado. Alterar
  nome ou apenas abrir o orçamento não muda valor, vencimento, parcela nem aprovação.
- Não alterar nesta entrega as guardas atuais de valor abaixo do recebido nem criar créditos/
  devoluções automáticas. Se a retirada pedir esse acerto, mostrar valor e caminho explícito
  existente de correção/estorno, sem executá-lo por efeito colateral. Essa situação é gate próprio.
- Não presumir que a assinatura anterior cobre novos itens. Preservar documento assinado e usar
  o fluxo existente caso o dentista queira registrar novo aceite.

## 5. Comportamento e exemplos

| Situação | Resultado esperado |
|---|---|
| Ficha tem A/B já orçados e ganha C | Banner lista somente C; adicionar mantém A/B e pagamentos |
| C incluído e modal reaberto | C não aparece novamente como faltante |
| Outra aba incluiu C antes | Atualizar diferenças; sem nova linha nem vínculo duplicado |
| Dois itens faltantes, apenas um selecionado | Adiciona só o escolhido; aviso conserva o outro |
| Gerar/Novo orçamento com proposta existente | Oferece atualizar a existente, sem criar duplicata |
| Nome de A editado na ficha | Continua o mesmo evento; não aparece como procedimento novo |
| Retirada da ficha adiada no orçamento | Ao abrir, aviso identifica o retirado e oferece revisar remoção |
| Remover só do orçamento | Item sai da proposta ativa; registro clínico e recebimentos permanecem |
| Item com cobrança/pagamento | Revisão explicita impacto e oferece editar etapa/acordo existente |
| Sem diferenças | Nenhum aviso; orçamento funciona como antes |
| Carregando/erro de rede/validação | Loading/mensagem junto da ação, escolhas preservadas |
| Sem permissão/assinatura/desatualizado | Motivo explícito, nenhuma escrita indevida; recarregar quando aplicável |
| Conflito de versão | Conservar escolha e refazer revisão; não aplicar sobre valores antigos |

## 6. Referência visual

Mesmo modal de orçamento da ficha, sem nova tela de sincronização. Aviso acima dos itens:
**“Há 1 procedimento nesta ficha que ainda não está neste orçamento.”**
Abaixo: nome, região, “Adicionado à ficha em DD/MM” e **Revisar e adicionar**.
Na revisão: somente selecionados, seus valores e **Adicionar ao orçamento**.
Retirada pendente tem mensagem distinta: “Este procedimento foi retirado da ficha e continua
neste orçamento”, com **Revisar remoção**. Reusar tokens/componentes atuais e o brief R169.
O destaque do CTA usa âmbar e pulso breve, especificados no DESIGN. Só novas inclusões disparam;
avisos de retirada/renomeação aparecem dentro do orçamento, sem esse sinal no botão.

## 7. Invariantes

1. Mesmo orçamento/ficha; aplicar somente as diferenças selecionadas.
2. Identidade por IDs; nome/data não provam correspondência nem novidade.
3. Registros recebidos não são apagados, redistribuídos ou refeitos pela sincronização.
4. Alterar ficha não significa alterar automaticamente orçamento, preço, acordo ou aceite.
5. Não abrir lacuna de permissão/RLS para facilitar inclusão ou retirada.

## 8. Gates de aceite

- [ ] Cenário A/B/C acima, duas adições sucessivas, seleção parcial, reload e retry sem duplicação.
- [ ] Aviso explícito com nome/região/data correta; somente faltantes elegíveis; outro orçamento,
  outro responsável e pré-existente não entram por engano. Falha de leitura não oculta pendência.
- [ ] Entrada Gerar/Novo orçamento encontra proposta existente e atualiza sem criar outro orçamento.
- [ ] O01–O14 completos, incluindo 0/1/vários destinos, agrupamento/contador, inclusão parcial e
  recarga após outra aba. Prontuário geral/Meu Dia/aba Orçamentos não recebem novo destaque.
- [ ] Âmbar apenas para inclusão persistida; renomear/status/remover/abrir modal não resolve nem
  cria a pendência. Pulso breve sem loop e reduced-motion; botão visível com uma só consulta.
- [ ] Retirada só comercial e retirada da ficha com aplicação imediata/adiada; grupo e vínculo legado.
- [ ] Orçamento aprovado, parcial/pago, com acordo, desconto e etapa: revisão disponível, dinheiro
  preservado; ajuste financeiro confirmado usa regras atuais. Acerto abaixo do recebido é explícito.
- [ ] Nome alterado não vira duplicação; original assinado permanece, documentos novos refletem revisão.
- [ ] Falha atômica, conflito e duas contas logadas; RLS/grants e clientes antigos compatíveis.
- [ ] QA integrado ficha → aviso → adicionar/retirar → orçamento → Financeiro; resultado após reload.
- [ ] Migration isolada/compatível, rollback e revisão do lote antes de liberar no principal.

## 9. Fora de escopo

Reforma da edição geral de preços/quantidades/descontos, nova política de crédito, novo motor de
parcelamento, apagar/recriar orçamento, estorno automático, alterar assinatura ou corrigir base em massa.
Edição financeira existente permanece disponível; este item conecta as mudanças da ficha a ela.
