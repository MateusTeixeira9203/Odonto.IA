# R-140e1 — Base manual e permissões do estoque

> **SPEC** · **R-140e1** · ⏳ fila · **Aberto:** 2026-09-11 · **Fase:** execução autorizada no banco de teste
> Passos 1–3 do [plano de estoque](R-140e-estoque-rastreavel.md). Primeiro recorte: catálogo de permissões e titularidade; sem ativação geral.

Autorização de 11/09: começar a aplicação, exclusivamente em `etlqznuoxiilvxzygpat`.
Produção preservada; interface nova segue aprovação do artefato e gates abaixo.

## 1. Problema e entrega
Permitir operações de material por titular e ação, sem dar poder de ajuste a quem apenas cadastra.
Primeira entrega utilizável: consumíveis cadastrados manualmente, lotes, saldo, movimentos e UI.
Tipos implantável/uso limitado/reutilizável só ficam operacionais no R-140e2; não simular quantidade
consumível para instrumental. Reserva, compra, custo financeiro e consumo vinculado à ficha ficam fora deste lote.

## 2. Contrato de permissões
Reusar R-159, com sincronização obrigatória entre catálogo TypeScript e validador SQL.
Chaves abaixo são contrato NOVO onde indicado; não assumir existência só porque a UI terá switches.
Catálogo atual tem 42 ações; incluir as três novas em TS/allowlist SQL, ajustar teto42 para a
cardinalidade45 e testar paridade/coleção completa. Novas ações aceitam nenhum/proprio/selecionados/clinica.

| Controle apresentado | Chave | Autoriza | Não autoriza |
|---|---|---|---|
| Consultar materiais | estoque.ler, existente | Itens, saldo, lotes, histórico administrativo permitido | Alterações, preços de serviço ou prontuário |
| Cadastrar e editar materiais | estoque.gerir, existente e restrita a metadados | Catálogo, mínimo de reposição, arquivamento | Entrada, consumo, ajuste ou concessão |
| Registrar recebimentos | estoque.receber, nova | Saldo inicial conferido e entradas físicas | Alterar saldo anterior ou inventar recebimento |
| Registrar consumo | estoque.consumir, nova | Saída real do estoque autorizado | Cadastro, recebimento, ajuste ou autoria clínica |
| Registrar perda/descarte | estoque.descartar, nova | Saída por perda/validade, motivo obrigatório | Ajuste de inventário ou apagar fato |
| Corrigir inventário | estoque.ajustar, existente | Contagem física e movimentos compensatórios | Editar consumo clínico ou apagar fatos |
| Gerenciar kits | kits.gerir, existente | Definir/versionar kits no lote seguinte | Consumir componentes sem permissão |
| Confirmar etiqueta | materiais.confirmar, existente | Conferir dado de rastreabilidade R-140d | Baixar estoque por si só |

Toda ação de estoque depende também de estoque.ler no mesmo titular. Grants não implícitos;
editor apresenta dependências e resumo antes de salvar. Não introduzir alias amplo “gerir tudo”.
R-159b hoje tem estado preparacao, teto vazio e validação limitada às chaves existentes.
Antes de uso real, integrar ativação/validação e concessão limitada no R-159; não ignorar constraints,
nem transformar configuração em preparação em permissão efetiva por acidente.

### Escopos e autoridade
- proprio: apenas item pessoal do dentista da sessão; não significa item cadastrado pelo ator.
- selecionados: apenas titulares-dentistas autorizados explicitamente, sempre na mesma clínica.
- clinica: apenas itens de titular clínica (compartilhados); NÃO engloba pessoais dos colegas.
- nenhum: nega. Sem perfil clínico não há estoque próprio; recepção usa clínica/selecionados concedidos.
- Usar avaliador específico de titularidade. `professionalScopeContains` não serve como bypass:
  nele clinica abrange profissionais, enquanto aqui representa somente o estoque compartilhado.
- Owner controla concessões do estoque da clínica. Pessoal exige autorização expressa do titular;
  inicialmente não liberar concessão sobre pessoal alheio pelo editor gerencial.
- Poder conceder é R-159/permissoes.gerir com teto autorizado, não estoque.gerir. Recepção com
  cadastro/recebimento não concede a si consumo/ajuste. Responsável não altera seu próprio teto.
- Decisão de 12/09: na colaborativa, todos os dentistas ativos têm as mesmas seis ações
  operacionais no compartilhado e administram o próprio estoque. Sem acesso pessoal aos colegas.
  Não exige responsável exclusivo de estoque; gestão da recepção segue o contrato R-140e1a.
- Ativação/modelo são explícitos; não inferir colaborativa nem proprietário de cargos legados.

### Configurações iniciais sugeridas, revisáveis
Owner: catálogo/recebimento/consumo/descarte/ajuste comuns e concessão limitada do comum.
Dentista: ações pessoais; comum conforme concessão na gerida e igualdade na colaborativa ativada.
Recepção: nenhum acesso de estoque até concessão; preset “cadastro e recebimentos” concede ler,
gerir e receber no comum. Protético: nenhum automático. Pessoal do owner segue regra de dentista.
Revogação vale na próxima operação, inclusive modal aberto; fatos e saldo histórico permanecem.

## 3. Dados — base física aplicada no teste
Todas as tabelas têm id UUID, clinica_id, índices por clínica e RLS; FKs de filhos incluem clinica_id.
versaoEsperada nas operações da base refere-se ao item; lotes também são travados na transação.
Datas timestamptz do servidor; valores quantitativos NUMERIC(18,6), nunca float como autoridade.

| Objeto novo | Campos e restrições |
|---|---|
| estoque_itens | titular_tipo clinica/dentista, titular_dentista_id nullable consistente, nome, unidade_base, comportamento, controle_lote, minimo, ativo, versao, created_at. FK titular da mesma clínica; nome 1–120; mínimo >=0. |
| estoque_lotes | item_id, identificador_fabricante nullable, validade nullable, origem_sem_identificacao boolean, versao, created_at. Lote desconhecido explícito; nunca gerar fabricante/validade fictícios. |
| estoque_operacoes | ator_usuario_id, chave_idempotencia, payload_hash, resultado tipado, created_at; UNIQUE clínica+ator+chave. Livro de deduplicação interno, não exposto ao cliente. |
| estoque_movimentos | item_id, lote_id, tipo, quantidade assinada não zero, motivo, origem_tipo, origem_id nullable, operacao_id, reversao_de nullable, ator_usuario_id, ocorrido_em. Append-only; UNIQUE reversao_de quando preenchido. |
| estoque_auditoria | ator, ação, item, antes/depois de metadados, motivo, operacao_id, created_at; append-only. |

Saldo é soma de movimentos, por titular/item/lote; não uma coluna atualizada pelo formulário.
Lote sempre existe em movimento; quando não identificado, lote interno explícito sem dados inventados.
Recebimentos distintos podem criar lotes distintos mesmo com mesmo código/validade; identificador externo
não é chave global de estoque. Reutilizar lote exige escolha explícita no mesmo item/titular.
Item não muda titular, unidade_base ou comportamento após movimento. Corrigir nome não altera
snapshot de evento clínico posterior. Item com saldo diferente de zero não é arquivável.
Unidade-base inicial: unidade, g ou ml; aceita fração até 6 casas conforme material. Conversão de
embalagem é declarada e conferida em cada recebimento (ex.: 2 caixas × 100 unidades), persistida
no resultado da operação; não inferir consumo em gotas ou “uma seringa” sem medida definida.
Não há DELETE físico por usuário nem ON DELETE CASCADE sobre movimentos/fatos.

## 4. Contratos server-side
Reusar contexto de membro e Resultado tipado; nunca exigir perfil dentista de uma secretária que recebe.
Adapter em `src/server/estoque/` chama RPC autenticada; autorização dentro do banco em cada operação.
UI não importa service-role. Sem writes diretos às tabelas de fatos por anon/authenticated.
Novos contratos (nomenclatura proposta, validar objetos reais antes de aplicar):

```ts
type TitularEstoque = { tipo: 'clinica' } | { tipo: 'dentista'; dentistaId: string };
type FalhaEstoque = 'INVALIDO' | 'SEM_ACESSO' | 'NAO_ENCONTRADO' | 'CONFLITO'
  | 'CONTEXTO_ALTERADO' | 'SALDO_INSUFICIENTE' | 'INDISPONIVEL';
type ResultadoEstoque<T> = { ok: true; data: T }
  | { ok: false; codigo: FalhaEstoque; mensagem: string };
interface ContextoOperacao {
  clinicaIdEsperada: string; chaveIdempotencia: string;
}
interface ItemInput extends ContextoOperacao {
  titular: TitularEstoque; nome: string; unidadeBase: 'unidade' | 'g' | 'ml';
  comportamento: 'consumivel'; controlaLote: boolean; minimo: string;
}
interface MovimentoInput extends ContextoOperacao {
  itemId: string; loteId: string; versaoEsperada: number;
  quantidade: string; motivo: string;
}
interface ContagemInput extends ContextoOperacao {
  itemId: string; loteId: string; versaoEsperada: number;
  quantidadeContada: string; motivo: string;
}
```
- listarEstoque({clinicaIdEsperada,titular,busca,filtro,cursor,limite}) → até 50 itens,
  cursor determinístico nome+id; filtros todos/baixo/validade/divergente/arquivados. Totais por filtro.
- detalharEstoque({clinicaIdEsperada,itemId,cursor}) → item, lotes e até 50 movimentos permitidos.
- cadastrarItem(ItemInput) → itemId, versao; saldo zero. Quantidade extra no payload é rejeitada.
- editarItem({contexto,itemId,versaoEsperada,nome,minimo,ativo,motivo}) → versão; não aceita titular/unidade.
- receberMaterial({contexto,itemId,versaoEsperada,loteId? OU novoLote,
  quantidadeBase,embalagemConferida?}) → movimentoId, loteId, saldo, versao.
  Novo lote: codigoFabricante|null, validadeISO|null; item que exige lote rejeita identificação ausente.
- consumirMaterial(MovimentoInput), descartarMaterial(MovimentoInput) → movimentoId,saldo,versao.
- ajustarContagem(ContagemInput) → movimentoId|null,saldo,versao; delta calculado NO SERVIDOR.
  Contagem igual ao saldo grava auditoria, não movimento zero. Motivo 1–500 e contagem >=0.
- corrigirMovimento({contexto,movimentoId,versaoEsperada,motivo,substituicao}) → inverso+substituto
  atômicos, uma correção por fato original; consumo clínico só pelo contrato R-140e2.

Zod estrito: UUIDs, texto limitado, limite1–50, busca<=120, decimais positivos com até 6 casas
em representação canônica, data ISO válida sem timezone implícito. Campos de ator são rejeitados.
Receber item vencido exige declaração explícita e motivo, aparece indisponível para consumo normal;
descarte continua possível. Sem bloqueio retroativo do registro clínico no lote seguinte.

### Transação e concorrência
Resolver clínica ativa+membro+acessos; validar titular/alvo; locks governança/membros conforme R-159,
então itens/lotes em ordem estável. Revalidar acesso e versão antes de gravar.
Chave igual/hash igual retorna resultado anterior; hash diferente conflita, nunca grava parcial.
Replay revalida acesso atual antes de mostrar resultado. Se timeout, repetir MESMA chave.
Lock por item serializa saldo; duas saídas que excederiam saldo: uma passa, outra recebe conflito/insuficiente.
Saída administrativa não permite saldo negativo; registro clínico real divergente é exceção documentada R-140e2.
Movimento, versão, auditoria e resultado idempotente na mesma transação. Falha de qualquer parte reverte tudo.
Políticas SELECT filtram titular e ação; RPCs não confiam em clinicaId/titular enviados pelo cliente.
DTO administrativo omite paciente, prontuário e nota clínica; origem de consumo aparece como referência
restrita sem link identificável. Relatório não agrega finanças ou divulga catálogo pessoal por kit.

## 5. Experiência e estados
Shell existente → Estoque → seletor Meu estoque/Compartilhados → busca/filtros → lista → detalhe.
Novo material é modal simples, sem quantidade inicial oculta; salvar oferece Registrar entrada se permitido.
Entrada mostra unidade, lote, quantidade e saldo resultante para conferência. Ajuste pede contagem+motivo;
não campo “novo saldo” livre. Saída/descarte têm ações separadas com finalidade clara.

| Estado | Resultado |
|---|---|
| Vazio | Explica o escopo; cadastrar só se permitido, sem dados inventados |
| Carregando | Skeleton/ação pendente; impedir clique duplo sem perder rascunho |
| Sucesso | Saldo atualizado pelo servidor e comprovante do movimento |
| Inválido | Erro no campo, sem gravar parte do formulário |
| Sem acesso | Botão ausente e RPC negada; sem revelar existência de item externo |
| Conflito/versão | Preservar rascunho, buscar saldo atual e pedir nova conferência |
| Rede/timeout | Resultado incerto explícito; consultar/repetir chave, não presumir sucesso |
| Revogação/troca de clínica | Interromper nova gravação; rascunho associado à origem, sem transportar IDs |

Exemplos: cadastrar “Luva” mantém zero; receber100 e consumir2 deixa98; secretaria só com cadastro
não recebe100; A não vê B; owner vê comum, não pessoalB; duas saídas6 sobre10 não produzem−2.
Correção entrada100→80 conserva original, inverso−100 e substituto+80, com motivo e ator.

## 6. Visual
[Brief R-140e](../design/R-140e-estoque-DESIGN.md), produto existente. Artefato primeiro;
nenhuma nova biblioteca, paleta ou navegação global. Mockup não simula autorização funcional.

## 7. Invariantes
Titularidade inequívoca, fatos imutáveis, contexto revalidado, estoque separado de orçamento/caixa.
Material arquivado conserva histórico; desligamento de membro não transfere propriedade dos seus itens.
Acesso de cadastro nunca significa acesso a consumo/ajuste ou ao prontuário.

## 8. Gates de aceite do lote
- [ ] Matriz de cada controle: proprietário clínico/não clínico, dentista, recepção e colaborativa.
- [ ] Consentimento/teto/bootstrap R-159 resolvidos; recepção não consegue autoelevação.
- [ ] Duas contas logadas: próprio A/B/comum, URL/RPC direta, revogação sem renovar JWT.
- [ ] Cadastro zero, entrada parcial, contagem igual, correção encadeada e arquivamento com saldo.
- [ ] Replay igual/diferente, timeout pós-commit e duas saídas concorrentes sem saldo indevido.
- [ ] Falha de auditoria reverte fatos; item/lote externo e mudança de titular são negados.
- [ ] Frações/unidades/lotes desconhecidos/vencidos se comportam conforme §3–4.
- [ ] Cada estado da §5 no preview e 390px/desktop/teclado/claro/escuro.
- [ ] Migration aditiva preserva dados anteriores, rollback da UI conserva fatos novos.

## 9. Primeiro recorte executado
Catálogo/helper concluídos; migration aplicada somente no Free, sem conceder acessos.
[Evidências e limites](../auditorias/2026-09-11-r140e1-base-permissoes.md).
Base física concluída no segundo recorte abaixo. RPCs, ativação e UI pendentes; §8 segue aberto.

### Segundo recorte — estrutura protegida, antes da ativação
Usuário autorizou continuar; push apenas ao final. Implementar §3 e schemas de entrada §4.
Cinco tabelas novas, inicialmente sem privilégios de API para anon/authenticated/service_role;
RLS ligada e sem policies permissivas. Sem RPC pública, tab/menu ou concessão neste recorte.
FK composta lote/item/clínica e reversão/movimento original também conserva o mesmo lote.
Operações, movimentos e auditoria são imutáveis; correções futuras inserem fatos compensatórios.
ID/clinica/created_at de item não mudam; após movimento, titular/unidade/comportamento ficam travados.
Arquivar item com saldo não zero é negado; saldo não é coluna editável. Lotes preservam metadados.
Quantidade NUMERIC(18,6) finita; movimentos positivos só em entrada, negativos em consumo/descarte;
ajuste/reversão podem ter ambos sinais. Toda reversão referencia exatamente o fato original.
A migration é aditiva, sem seed/backfill nem permissões novas sobre tabelas antigas.
Reversão operacional mantém tabelas/fatos e módulo desligado; não executa DROP.
Gates deste recorte: constraints/triggers sob rollback e bloqueio direto de duas contas; não
substituem os testes positivos de RPC e consumo que continuam obrigatórios no §8.
Decisão de 12/09 incorporada: próprio privado e igualdade operacional colaborativa;
ativação e concessão no [R-140e1a](R-140e1a-autorizacao-estoque.md).
Aplicado no Free: 27 gates físicos com rollback e bloqueio API com A/B logados passaram.
[Evidências, commits e limites](../auditorias/2026-09-11-r140e1-estrutura-protegida.md).

## 10. Fora do lote
Autoria clínica, OCR, kit, ativo individual, compra, financeiro, importação em massa e transferência.
