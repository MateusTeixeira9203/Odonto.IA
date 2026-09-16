# R-165 — Cadastro e responsável pela assinatura

> **SPEC** · **R-165** · 🔵 ativo
> **Aberto:** 2026-09-10 · **Fase:** contrato · 15/09/2026

## 1. Problema

Hoje cada `assinaturas_dentista` cobra seu próprio dentista: `complete_onboarding` sempre cria
um perfil clínico e o webhook suspende apenas esse vínculo. Isso não representa uma clínica que
centraliza a conta nem um proprietário que só administra. A modalidade precisa determinar
cobertura e entrada, não apenas texto no checkout.

## 2. Decisão

- Novas unidades escolhem `individual` ou `centralizada`, uma modalidade por clínica.
- Cada dentista coberto custa **R$200/mês**. Proprietário que atende ocupa cobertura; proprietário
  sem atendimento e secretaria não ocupam cobertura enquanto houver dentista ativo pago na clínica.
- Na individual, o dentista é seu próprio pagador. Na centralizada, só o responsável ativo de
  `clinica_governanca` com `modelo_clinica='gerida'` é pagador. Pagar não concede capacidade clínica.
- R92 permanece intacta: contratos atuais não migram, cancelam, reativam ou mudam preço.
- Proprietário sem atuação usa `/clinica` e `/equipe` via `getMemberContext`/governança, sem
  `dentistas`, admin clínico ou shell de atendimento artificial.

## 3. Objetivo

Criar cadastro aditivo e um resolvedor server-side que calcula cobertura por vínculo. O recorte
prepara contrato, cobertura e checkout novo, sem cobrança real, alteração Stripe ou liberação sem
cobertura.

## 4. Contrato técnico

### Persistência aditiva

`public.assinaturas_comerciais` é a fonte de verdade R165, sem reutilizar
`assinaturas_dentista`: `id`, `clinica_id`, `modalidade`, `pagador_usuario_id`, `status`,
`preco_centavos=20000`, `ciclo='mensal'`, IDs Stripe nulos até sincronização, `quantidade_contratada`,
`versao` e timestamps. Na individual a quantidade é 1 e pagador é o usuário do dentista; na
centralizada o pagador é o responsável e a quantidade fica NULL enquanto aguarda o checkout;
ativação exige quantidade positiva. `configuracoes_comerciais_clinica` guarda a modalidade mesmo
quando o proprietário não atende e ainda não existe contrato individual. IDs Stripe têm índices
únicos parciais.

`public.coberturas_assinatura` registra contrato, clínica, dentista, início/fim e motivo. Só há
uma cobertura atual por clínica+dentista; encerramento não apaga histórico. A mutação bloqueia
contrato e dentista, valida tenant e impede que a centralizada exceda a quantidade contratada.

`private.resolver_cobertura_comercial(clinica, usuario)` devolve somente
`coberto`, `sem_cobertura` ou `legado`. Sem linha R165 devolve `legado` e mantém R92. Dentista
exige cobertura vigente com contrato `trialing`, `active` ou `past_due`; owner não clínico e
secretaria exigem algum dentista ativo coberto na mesma unidade. Não é RPC pública, não recebe
autoridade do cliente e não usa cargo como fallback.

### Cadastro, planos e integração

`public.iniciar_onboarding_r165(...)` é RPC aditiva: autentica, impede membership ativa e cria
clínica, vínculo e governança numa transação. Recebe apenas dados básicos, modalidade,
`atuaClinicamente` e `modeloClinica`. Governança e pagador são escolhas independentes: clínica
gerida aceita pagamento individual ou centralizado. Colaborativa aceita individual; centralizada
exige responsável em clínica gerida. Cria dentista só quando há atendimento. Proprietário sem
atendimento recebe vínculo `gestor` e governança gerida; na individual não recebe contrato fictício. Retorna `clinicaId`,
`membroId`, `dentistaId|null`, contrato em `aguardando_checkout` e `checkoutPendente=true`.
Nenhuma `coberturas_assinatura` nasce nesse passo. `complete_onboarding` conserva assinatura e
consumidores vigentes.

`src/app/onboarding/actions.ts` adapta somente o cadastro novo. A UI pergunta se o criador atende
e quem paga antes de confirmar; mostra custo unitário e cobertura administrativa. Precisa de
brief e controles existentes; formulário integrado somente ao piloto Free, para conferência de Mateus.
O banco também nasce fechado: `private.r165_piloto_onboarding.habilitado=false` bloqueia a RPC
pública mesmo por chamada direta. Somente o operador do Free habilita a linha privada por SQL;
`authenticated` não pode lê-la nem alterá-la. Produção mantém a flag desligada.

`src/app/planos/actions.ts`, `src/server/services/formacao-clinica.ts` e peças novas em
`src/server/billing/` passarão a consumir o contrato R165 no lote de checkout. `createCheckout` e
`criarCheckoutAssinaturaDentista` seguem exclusivamente R92. Checkout R165 só abre para o pagador
validado; URL de retorno nunca libera acesso.

O webhook atual só entende `metadata.assinaturaDentistaId` e chama
`sincronizarSubscription`/`ativarAcesso`/`suspenderAcesso`. R165 precisa de dispatcher separado,
depois de `claim_stripe_billing_event`, por `metadata.assinaturaComercialId`. Ele atualiza contrato
e coberturas idempotentemente. Não editar webhook antes de revisar esse patch: misturar metadados
reativaria ou suspenderia pessoas indevidas.

`isTeamWorkspaceEnabled` hoje fica falso com Stripe ativo e bloqueia `/clinica`/`/equipe` para
owner não clínico pago. O lote posterior R165 substituirá esse gate por autorização comercial explícita em
`requireOwnerWorkspace` e páginas de gestão, preservando o dashboard clínico fora desse caminho.
Não reutilizar o fallback de recepção.

## 5. Comportamento

| Estado | Resultado |
|---|---|
| Individual coberto | Dentista entra; dívida de outro membro não o afeta. |
| Centralizada com vaga | Dentista entra sem checkout próprio. |
| Centralizada sem vaga | Vínculo/convite aguarda cobertura; não ativa nem cobra automaticamente. |
| Owner sem atuação + dentista pago | Entra somente em gestão, sem prontuário ou `dentistaId`. |
| Owner/secretária sem dentista coberto | Vê regularização; não ganha assinatura fictícia. |
| Falha técnica de webhook | Pendente de reconciliação, nunca inadimplência. |
| Unidade R92 | Mantém comportamento atual sem linha R165. |

Exemplo: owner centralizada compra duas coberturas e cobre duas dentistas, sem ocupar a terceira;
dentista individual em A permanece regular se B falhar; saída encerra só sua cobertura conforme a
política, preservando prontuário e fatos.

## 6. Referência visual

Cadastro inclui “Você atende pacientes nesta unidade?” e “Quem paga os acessos?”. Mostra preço,
quantidade coberta e inclusões sem usar o financeiro de pacientes. Convite informa checkout próprio
ou cobertura da clínica. Não há artefato aprovado nesta fase.

## 7. Invariantes

- Pagador, proprietário, dentista e recebedor do paciente são identidades distintas.
- Nunca criar dentista/admin clínico para cobrar ou acessar dashboard.
- Nenhuma transição R165 muda `active_clinica_id`, `removed_at` ou status fora do vínculo alvo;
  o cadastro inicial só define a clínica ativa do próprio criador.
- Cobertura é consultada no servidor; UI, JWT e metadata Stripe não autorizam acesso.
- Checkout, webhook e cron são idempotentes; evento repetido converge sem duplicar vaga/cobrança.
- Sem cobertura não há ativação por role; falha técnica não é inadimplência.

## 8. Gates de aceite

- [ ] Cadastro individual e centralizado cria identidade/modalidade correta; legado usa
  `complete_onboarding` sem mudança.
- [ ] Owner não clínico abre só gestão; URL, action e RPC clínica continuam negadas.
- [ ] Duas sessões validam individual, centralizada, falta de vaga e revogação.
- [ ] Só o pagador abre checkout; retorno não libera; webhook repetido/fora de ordem não duplica.
- [ ] Atraso individual não afeta colega; atraso centralizado respeita carência aprovada.
- [ ] Usuário em duas unidades tem cobertura por vínculo, sem reaproveitamento implícito.

## 9. Confirmado, preparado e pendente

Confirmado: R$200 por dentista/mês; proprietário clínico conta; proprietário sem atendimento e
secretárias incluídos enquanto existir dentista pago ativo. Ambas as modalidades em clínica gerida.

**Ainda sem resposta, não tratar como política aprovada:** quantidade inicial escolhida pelo owner,
aumento confirmado/redução na renovação; início somente após pagamento versus trial de sete dias.
Prorrata, transição e dispatcher do webhook serão fechados no lote de checkout. Não cobrar agora.

Neste sublote: formulário de cadastro no Free, RPC transacional, configuração comercial, contratos
pendentes e resolvedor de cobertura. Não cria trial, checkout ou cobertura. Produção mantém R92.
A navegação gratuita do piloto vem do gate de ambiente já existente, não de pagamento fictício.

Validação local: 8 testes TS, PGlite com governança independente do pagador, bloqueio de ativação
centralizada sem quantidade, capacidade e cadastro repetido; lint. Revisão técnica Terra sem achado
bloqueante. Migration aplicada somente ao Free. Navegador/duas sessões ficam para QA no Preview.

## 10. Fora de escopo

Cobrança Stripe real, alteração de preço/R92, migração de contratos, modalidade mista, repasse de
paciente, franquias, transferência de pagador e reembolso. Entram após a decisão de prorrata e a
revisão do patch de webhook.
