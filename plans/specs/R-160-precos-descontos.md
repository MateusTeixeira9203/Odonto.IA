# R-160 — Tabela da clínica, preço fixo e desconto autorizado

> **SPEC** · **R-160** · ⏳ fila
> **Aberto:** 2026-09-10 · **Fase:** contrato · Aguardando aprovação.
> Depende de R-159 e base R-157 validada; integração financeira no R-163.

## 1. Problema

A tabela hoje está associada ao dentista. Clínicas geridas precisam publicar preços que
os profissionais utilizem, sem aprovar cada orçamento e sem permitir que um desconto
não autorizado seja disfarçado como alteração de grupo, item ou valor acordado.

## 2. Decisões

- Unidade gerida pode usar tabela fixa comum. Colaborativa conserva tabelas individuais.
- Preço padrão não requer aprovação do gestor; aceite comercial do paciente continua separado.
- Permissões de editar tabela, propor exceção e aprovar desconto são independentes.
- Desconto aprovado autoriza uma proposta exata, não qualquer valor futuro desse orçamento.
- Orçamento congela preço e composição. Atualizar tabela não muda documentos já gerados.
- Limite inicial proposto de desconto autônomo: zero; responsável pode configurar por pessoa.

## 3. Fluxos

### Tabela e orçamento

Meu Consultório → Preços → pessoa autorizada cadastra/edita → publica revisão → novos
orçamentos usam a revisão. Dentista seleciona procedimentos/grupos → sistema resolve preço
no servidor → mostra composição/total → salva proposta disponível imediatamente.

Tabela ausente ou procedimento sem vínculo: “Preço não configurado”; permitir rascunho e
contato com responsável, sem converter ausência em R$0 nem impedir registrar a consulta.
Paciente pode aceitar parte da proposta; cobrança e saldo seguem só os itens/grupos aceitos.
Prazo de validade segue `validade_dias`; proposta expirada precisa ser reemitida antes de novo
aceite, preservando a anterior e eventuais pagamentos. Legado não é reclassificado em lote.

### Grupos e preço fechado

Reutilizar composição do R-157: selecionar procedimentos/dentes e nomear etapa; componentes
continuam clínicos, não recebem rateio artificial só para preencher preço individual.
Na tabela fixa, há duas origens válidas: soma dos preços tabelados ou pacote com preço
publicado (ex.: Arcada superior). Composição do pacote é validada, não apenas seu nome.
Valor livre requer `precos.excecao`; redução abaixo da referência também obedece à política
de desconto. Editar quantidade/composição invalida a exceção anterior e recalcula a referência.
Usuário sem exceção pode agrupar pela soma ou escolher pacote compatível; não digita preço livre.

### Desconto

Proposta → solicitar valor/justificativa → servidor calcula abatimento efetivo → se cabe
na autonomia configurada, aplica e audita → senão cria solicitação pendente → aprovador
autorizado decide → solicitante vê aprovação/rejeição. Negar mantém proposta pelo valor original.
Valor pendente aparece como simulação não autorizada; não pode virar aceite, PDF final ou cobrança.
Solicitação não bloqueia a alternativa pelo preço original. Gestor só recebe alerta interno;
sem enviar WhatsApp/email a terceiros automaticamente nesta entrega.

## 4. Contrato técnico proposto

### Base existente

- `procedimentos` possui clinica_id, dentista_id, preco_padrao e duracao_minutos; não remover
  autoria nem substituir todas as tabelas individuais para criar catálogo compartilhado.
- `src/app/dashboard/configuracoes/actions.ts` gerencia catálogo; adaptar com R-159.
- `src/app/dashboard/orcamentos/actions.ts`, `use-orcamento-modal.ts` e modais do perfil
  criam proposta/cobranças; `src/lib/orcamentos/grupos.ts` valida composição R-157.
- `src/lib/orcamentos/estado.ts` e `orcamentos_com_estado` derivam estado dos fatos;
  `src/types/database.ts` ainda tem status antigo. Não ressuscitar enum legado ao implementar.
- RPCs locais reais: `criar_orcamento_com_eventos_r157`, `adicionar_itens_orcamento_com_eventos_r157`,
  `criar_cobranca_orcamento`, `aceitar_orcamento`; `src/types/orcamento.ts` guarda snapshots assinados.

```ts
type PoliticaDesconto = { autonomiaBps: number; aprovacaoMaximaBps: number };
type OrigemPreco = 'individual_legado' | 'tabela_clinica' | 'pacote_clinica' | 'excecao';
type ReferenciaPreco = {
  itemPrecoId: string; revisao: number; quantidade: number; valorCentavos: number;
};
type EstadoDesconto = 'pendente' | 'aprovado' | 'rejeitado' | 'substituido' | 'expirado';
interface SolicitarDescontoInput {
  clinicaIdEsperada: string; orcamentoId: string; revisaoEsperada: number;
  itemIds: string[]; descontoCentavos: number; motivo: string; chaveIdempotencia: string;
}
interface DecidirDescontoInput {
  clinicaIdEsperada: string; solicitacaoId: string; versaoEsperada: number;
  decisao: 'aprovar' | 'rejeitar'; motivo: string; chaveIdempotencia: string;
}
```

Novas actions tipadas: `publicarTabela`, `vincularProcedimentoPreco`, `solicitarDesconto`,
`decidirDesconto`; resultado discriminado do R-159, mais `PRECO_AUSENTE`, `PRECO_ALTERADO`,
`EXCECAO_PENDENTE`, `PROPOSTA_EXPIRADA`. Escrita real e cálculo final são transacionais.
Zod: UUID, inteiros seguros em centavos, quantidade positiva finita, motivo 1–500,
percentual em basis points inteiro 0–9999, valor final >=1 centavo, lista de itens 1–100 distintos.
Cortesia de total zero exige recorte próprio; não tratar 0/0 como pagamento confirmado.

### Schema novo proposto

| Objeto | Campos/constraints |
|---|---|
| `clinica_politica_precos` | clinica_id PK, modo `fixa`/`individual`, revisao, updated_at. Legado preservado. |
| `clinica_precos` | id, clinica_id, nome, tipo procedimento/pacote, ativo. Identidade estável. |
| `clinica_precos_revisoes` | id, clinica_id, preco_id, revisao, valor_centavos, composicao JSONB tipado para pacote, criado_por, created_at; UNIQUE preco+revisão, append-only. |
| `procedimento_preco_vinculos` | clinica_id, procedimento_id único, preco_id; FKs compostas; vínculo explícito, não match por texto/IA. |
| `orcamento_preco_snapshots` | id, clinica_id, orcamento_id, item_id, revisao_orcamento, origem, referencias, referencia_centavos, final_centavos; append-only. |
| `orcamento_descontos` | id, clinica_id, orcamento_id, revisao_orcamento, item_ids, hash_proposta, base_centavos, desconto_centavos, estado, solicitado_por, decidido_por nullable, motivos, versao, expires_at, created_at. |
| `clinica_desconto_limites` | clinica_id, membro_id único, autonomia_bps, aprovacao_maxima_bps; FK à configuração de acesso; limites sem permissão não concedem poder. |
| Auditoria comercial | Eventos append-only por clínica/ator/entidade, antes/depois, motivo, chave idempotente única por ator+clínica. |

Referências, itens, composição e responsáveis sempre da mesma clínica. Índices por
clínica/estado/created_at e orçamento/revisão. Writes diretos das tabelas críticas bloqueados;
RPCs são autorizadas também internamente; nenhuma policy de role pode permitir bypass.
Não reutilizar `preco_padrao` de outro dentista como tabela oficial sem vínculo autorizado.

### Política de autorização e concorrência

- Desconto efetivo = referência congelada menos valor final; incluir abatimentos de item,
  grupo, cobrança e `valor_acordado`. Não acumular duas autorizações sobre a mesma referência.
- Autonomia: desconto*10000 <= base*autonomiaBps; servidor calcula em inteiros, sem arredondar
  percentual para permitir exceção. O aprovador respeita seu teto e escopo.
- Aprovar exige permissão vigente no ato. Quem solicita acima da própria autonomia não
  aprova a própria solicitação; quem tem autonomia já a exerce sem criar aprovação fictícia.
- Alteração do orçamento, itens, quantidades ou valor autorizado invalida solicitação pendente;
  decisão simultânea usa versão e lock. Repetir mesma chave não duplica desconto ou notificação.
- Novos preços publicados não alteram snapshots válidos: salvar novo orçamento valida revisão
  vigente; mudança durante edição retorna PRECO_ALTERADO para revisão do usuário.
- Na aprovação, guardar conteúdo/hash autorizados. Aceite, PDF e cobrança usam o mesmo snapshot.
- Aprovado comercialmente não marca procedimento como aceito pelo paciente nem realizado.
- Orçamento aceito/assinado não muda silenciosamente. Adendo/reemissão formal é outro recorte;
  neste, negociar somente proposta ainda não aceita e sem recebimento.
- Alteração de valor na reorganização de parcelas do legado não vira caminho de desconto sem
  permissão em clínica gerida. Parcelar sem mudar total continua possível com cobrança autorizada.

## 5. Comportamento e exemplos

| Estado | Resposta |
|---|---|
| Tabela vazia | Configurar preços; rascunho permitido, orçamento final sem preço bloqueado. |
| Carregando | Preservar proposta; confirmar uma vez com estado pending. |
| Sucesso | Proposta gerada, preço/origem claros, sem mensagem de aprovação obrigatória. |
| Inválido | Motivo/valor destacado; zero recebimentos ou descontos gravados parcialmente. |
| Sem permissão | Não editar tabela/valor; opção de solicitar só se autorizada. |
| Ausente/desatualizado | Preço não localizado/revisão mudou: recarregar referência sem perder seleção. |
| Conflito | Desconto já decidido/proposta modificada: mostrar estado atual, não sobrescrever. |
| Erro técnico | Rascunho preservado; tentativa idempotente, sem marcar solicitação enviada sem confirmação. |

- Superior 15 mil + inferior 15 mil = proposta 30 mil sem aprovação do gestor.
- Autonomia 0; pedido de 1 mil de desconto → pendente; rejeitar mantém 30 mil.
- Aprovar 1 mil sobre os mesmos itens → proposta 29 mil; alterar composição exige novo cálculo.
- Tabela muda de 15 para 16 mil: proposta válida anterior continua 15; nova usa 16.
- Aceitar só superior não cobra inferior. Fluxo de recebimento pertence ao R-163.

## 6. Referência visual

Meu Consultório → Preços; no orçamento exibir origem, referência, desconto e final, sem
perder composição/grupos R-157. Editor de desconto apresenta estado textual e histórico.
Brief R-158; artefato aprovado necessário antes de mudar telas de orçamento/configuração.

## 7. Invariantes

Preço fixo não aguarda gestor; desconto não cria aceite/recebimento; preço novo não muda
acordo antigo; responsável clínico não muda; todos os caminhos financeiros verificam exceções.

## 8. Gates de aceite

Testes de transação/cálculo e QA com gestor/dentista em duas contas, inclusive API/RPC direta.
- [ ] Cada estado §5 reproduzido, sem perda de seleção ou alteração parcial.
- [ ] Fluxo fixo salva e lista imediatamente; caixa continua zero.
- [ ] Permissão de editar tabela desligada bloqueia UI e chamada direta.
- [ ] Redução via grupo/preço/valor acordado/cobrança não burla limite.
- [ ] Desconto pendente/rejeitado não chega ao aceite/PDF final/cobrança como autorizado.
- [ ] Concorrência, revisão alterada e dupla decisão não aplicam desconto duas vezes.
- [ ] Publicação de tabela preserva proposta válida e snapshot já assinado.
- [ ] Preço ausente não vira zero; ausência não impede salvar atendimento clínico.
- [ ] Aprovação parcial, composição R-157 e orçamento legado mantêm regras atuais.

## 9. Fora de escopo

Reajuste retroativo, motor de negociação, cotação por IA, preço por convênio, renegociação
de acordo assinado/recebido, total gratuito, catálogo público ou assinatura SaaS.
