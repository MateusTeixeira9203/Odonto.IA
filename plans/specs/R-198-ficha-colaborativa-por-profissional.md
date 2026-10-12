# R-198 — Ficha colaborativa por profissional

> **SPEC** · **R-198** · ⏳ fila após a estabilização (decisão do usuário em 12/10)
> **Aberto:** 2026-10-12 · **Fechado:** — · **Fase:** contrato

## 1. Problema

Quando o dentista A encaminha um procedimento ao dentista B, a Ficha já mostra a B a ação
“Adicionar procedimentos”. A chamada, porém, falha porque a RPC aceita somente o autor da
Ficha. A interface promete uma capacidade que o servidor nega.

B precisa registrar outros procedimentos encontrados durante sua atuação sem criar outra
Ficha nem assumir a autoria de A. A mesma Ficha deve continuar clinicamente legível quando
há mais de um profissional, e cada responsável deve formar seu próprio orçamento.

## 2. Decisão e alternativas descartadas

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Uma Ficha compartilhada, agrupada por responsável | Criar uma Ficha por dentista | Fragmentaria o mesmo contexto clínico e o histórico do paciente |
| Autoria permanece em cada evento | Transferir a autoria da Ficha ou dos eventos de A para B | Apagaria responsabilidade clínica e trilha de auditoria |
| Orçamentos separados por dentista responsável na mesma Ficha | Um orçamento com itens de vários dentistas | Misturaria aceite, cobrança, pagamento, repasse, RLS e responsabilidade financeira |
| Acesso de B nasce de encaminhamento ativo na própria Ficha | Permitir a qualquer dentista da clínica acrescentar eventos | Ampliaria acesso clínico sem necessidade demonstrada |
| Dois marcos no mesmo contrato | Misturar autorização e redesign numa única entrega indivisível | O reparo de capacidade precisa ser verificável antes da mudança de apresentação |

**Encaminhamento ativo**, neste item, é um evento da mesma Ficha com
`encaminhado_para = dentista atual` e `retirado_em IS NULL`, enquanto a Ficha não está
assinada. A assinatura da Ficha ou a retirada do último encaminhamento encerra novas adições;
eventos já registrados permanecem no histórico.

## 3. Objetivo e como funciona

**Objetivo:** permitir que B, legitimado por encaminhamento ativo, acrescente procedimentos
próprios à Ficha de A e forme um orçamento separado, preservando autoria, isolamento e
histórico.

1. A abre a Ficha e encaminha ao menos um procedimento a B.
2. B abre a mesma Ficha e usa “Adicionar procedimentos”.
3. Cada evento novo é gravado na mesma Ficha com B como autor, sem alterar eventos de A.
4. A apresentação agrupa eventos pelo responsável clínico/financeiro, mantendo a autoria
   original visível em cada evento.
5. Eventos sob responsabilidade de A e B entram em orçamentos distintos por dentista.

### Responsável do evento

Usar a regra canônica da R-173:

```text
encaminhado_para → dentista_id do evento → dentista_id da Ficha para legado incompleto
```

O agrupamento e a escolha do orçamento usam essa regra. “Registrado por” sempre mostra o
autor original do evento e não é substituído pelo responsável.

## 4. Contrato técnico

### Marco 1 — reparar a capacidade já exibida

- A autorização é conferida no servidor e novamente dentro da transação da RPC.
- Pode adicionar: autor da Ficha ou dentista com encaminhamento ativo na mesma Ficha,
  paciente e clínica.
- Exigir identidade profissional ativa. Dono não dentista, secretaria e protético não
  recebem permissão clínica por papel administrativo.
- O servidor preenche `clinica_id`, `paciente_id`, `ficha_id` e `dentista_id`; o cliente não
  escolhe a autoria. Para o lote de B, `dentista_id = B`.
- Preservar validação clínica, idempotência por IDs/captura, trava da Ficha e log por evento.
- A RPC rejeita Ficha assinada, encaminhamento ausente/retirado, outra clínica, paciente
  divergente, autoria forjada ou payload parcial, sem deixar gravação nem log parcial.
- Retirar o encaminhamento ou assinar a Ficha durante a chamada não pode produzir
  autorização por estado antigo; a elegibilidade é decidida sob trava na transação.

### Marco 2 — agrupar e orçar por responsável

- Na Ficha, renderizar uma seção por responsável resolvido pela regra da R-173.
- Dentro da seção, manter grupos clínicos atuais, status, localização, autoria e ações já
  permitidas. Agrupar não concede edição de evento alheio.
- Cada seção apresenta somente a ação de orçamento do seu responsável.
- Para a combinação `ficha_id + dentista responsável`, reutilizar o orçamento elegível
  quando o fluxo atual determinar isso ou criar um novo conforme os contratos vigentes.
  Nunca misturar itens de dois responsáveis no mesmo orçamento.
- Repetir a mesma confirmação de criação não pode duplicar a proposta. Essa proteção é da
  operação; não impõe unicidade vitalícia a todos os orçamentos da Ficha.
- Se já houver mais de um orçamento histórico da combinação, preservar o bloqueio atual de
  escolha automática e orientar a abertura da área de Orçamentos. Este item não escolhe,
  funde nem apaga registros existentes.
- Evento encaminhado por A a B pertence ao grupo e ao orçamento de B, mas continua exibindo
  A como autor. Evento novo registrado por B sem novo encaminhamento também pertence a B.
- Aceite, aprovação, cobrança, parcelas, pagamentos, repasses e visibilidade continuam
  vinculados ao `dentista_id` de cada orçamento; este item não os consolida.

### Permissões

| Ação | Permitido | Negado |
|---|---|---|
| Ver a Ficha | Regras atuais do prontuário da clínica | Outra clínica; este item não amplia leitura |
| Adicionar procedimento | Autor da Ficha; dentista com encaminhamento ativo | Dentista sem encaminhamento; dono não dentista; secretaria; protético |
| Editar/retirar evento novo | Autor B, pelas regras clínicas atuais | A editar evento de B; B editar evento de A por causa deste item |
| Criar/adicionar ao orçamento | Quem já pode agir pelo dentista responsável | Orçamento de outro responsável; orçamento misto |
| Assinar/aprovar | Regras atuais de assinatura e orçamento | Este item não cria aprovação cruzada |

## 5. Comportamento — o alvo funcional

| Estado | O que a tela mostra | O que o servidor faz |
|---|---|---|
| Carregando | A ação fica desabilitada e mantém os dados preenchidos | Processa uma chamada idempotente |
| Vazio | Seção do responsável sem eventos não é criada | Não cria orçamento vazio |
| Sucesso | Novo evento aparece no grupo de B após recarga | Grava evento, autoria e log na mesma transação |
| Erro | Mensagem acionável e formulário preservado | Reverte todo o lote |
| Sem permissão | Ação não aparece; chamada direta retorna `sem_permissao` | Não grava evento, vínculo ou log |
| Ficha assinada | Ficha permanece somente leitura | Retorna `ficha_assinada` |
| Dados incompletos | Legado usa autor da Ficha; responsável irresolúvel não pode ser orçado | Não adivinha dentista nem mistura orçamento |
| Múltiplos orçamentos históricos | Orienta abrir a área de Orçamentos | Não escolhe, funde ou apaga um deles automaticamente |
| Conflito | Orienta recarregar a Ficha | Revalida encaminhamento e assinatura sob trava |

## 6. Referência visual

- Não há artefato aprovado para este item.
- Preservar a tela atual da Ficha e seus tokens.
- Marco 1 não redesenha a lista.
- Marco 2 introduz somente cabeçalho por responsável, contagem de procedimentos e ação de
  orçamento da seção. A autoria continua visível na linha do evento.
- Qualquer mudança maior de hierarquia visual exige artefato aprovado antes do código.

## 7. Invariantes

- Uma Ficha permanece a unidade clínica do contexto; colaboração não cria cópia.
- Autoria de evento é imutável e corresponde a quem o registrou.
- Encaminhamento define responsabilidade, não autoria.
- B nunca altera silenciosamente conteúdo, assinatura ou vínculo criado por A.
- Um evento ativo não entra em dois orçamentos.
- Um orçamento contém eventos de um único responsável.
- Toda leitura e mutação permanece limitada à clínica ativa e protegida por RLS/RPC.
- Retirada de encaminhamento corta novas adições de B, sem apagar eventos ou orçamentos já
  existentes.
- R-197 continua limitada a preço e quantidade de itens existentes; não implementa esta
  colaboração.

## 8. Gates de aceite

| Critério | Verificação segura | Estado inicial | Resultado esperado | Efeito proibido |
|---|---|---|---|---|
| Adição por B | Duas contas QA da mesma clínica, RPC + navegador + recarga | Ficha aberta de A com evento ativo encaminhado a B | B adiciona lote; eventos têm `dentista_id = B`, mesma Ficha e log de B | Alterar autoria/evento de A |
| Negativa sem vínculo | Conta C autenticada chama a RPC diretamente | C não tem encaminhamento ativo na Ficha | `sem_permissao`, efeito zero | UI ser a única barreira |
| Ficha assinada | B tenta adicionar após assinatura | Mesmo encaminhamento ainda existe | `ficha_assinada`, efeito zero | Novo evento após assinatura |
| Encaminhamento retirado | B tenta adicionar após retirada do último vínculo ativo | Ficha aberta, sem outro vínculo de B | `sem_permissao`, efeito zero | Permissão persistir por cache |
| Concorrência | Retirar/assinar enquanto B adiciona | Dados sintéticos e transações coordenadas | Só um estado válido vence; lote inteiro entra ou não entra | Gravação parcial |
| Autoria forjada | B envia payload declarando A | Ficha aberta e B autorizado | Servidor ignora/rejeita autoria forjada; grava somente como B ou nada | Evento novo atribuído a A |
| Agrupamento | Navegador com eventos de A, encaminhado A→B e evento novo de B | Mesma Ficha com dois responsáveis | Seções A e B; encaminhado A→B fica em B e mostra “Registrado por A” | Perder grupo clínico/status/localização |
| Orçamentos separados | Criar orçamento para A e B | Eventos elegíveis dos dois responsáveis | Dois orçamentos com `dentista_id` distinto e itens exclusivos | Orçamento misto ou evento duplicado |
| Repetição da criação | Repetir a mesma confirmação/identificador da operação | Nenhum orçamento criado por essa operação | Uma proposta criada; repetição devolve o mesmo resultado ou conflito seguro | Duas propostas por retry/duplo clique |
| Múltiplos históricos | Abrir combinação com dois orçamentos preexistentes | Dados sintéticos representando o legado | Orientação para a área de Orçamentos, sem mutação | Escolher, mesclar ou excluir automaticamente |
| Isolamento | Conta de outra clínica chama leitura/RPC | IDs conhecidos de dados sintéticos | Sem acesso e sem alteração | Vazamento entre clínicas |
| Regressão direta | Exercitar assinatura, edição permitida, retirada e R-169b/R-173 | Ficha sintética com eventos existentes | Fluxos atuais mantidos | Ampliar edição por encaminhamento |

Cada gate recebe `PASSA`, `NÃO PASSA` ou `NÃO TESTADO`, com ambiente, versão e evidência.
Migration/RPC de autorização exige teste direto com ao menos duas identidades autenticadas;
build e testes estáticos são evidência parcial.

## 9. Fora de escopo

- Alterar preço ou quantidade do orçamento — R-197.
- Orçamento único com itens de vários dentistas.
- Reabrir Ficha ou evento assinado.
- Transferir autoria, permitir edição cruzada ou apagar histórico.
- Redesenhar prontuário, pagamentos, repasses ou permissões gerais da clínica.
- Definir unicidade vitalícia ou política de revisão de orçamentos por Ficha e dentista.
- Corrigir retrospectivamente eventos, encaminhamentos ou orçamentos reais.
- Commit, push, deploy, migration em produção ou escrita de QA em dados reais.

## 10. Handoff ao Executor

Iniciar após o fechamento da estabilização. Implementar em dois lotes revisáveis.
O primeiro alinha a autorização da UI, Action e RPC e
fecha os gates clínicos/RLS. O segundo agrupa a apresentação e separa a formação dos
orçamentos por responsável. Não iniciar o segundo lote enquanto o primeiro não estiver
verificado com A, B e uma identidade negativa. Mudança de regra de assinatura, autoria,
pagamento ou RLS geral volta para decisão de produto.
