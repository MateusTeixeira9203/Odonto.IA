# R-155 — Estabilidade operacional e acesso recuperável

> **SPEC** · **R-155** · 🔵 ativo
> **Aberto:** 2026-09-07 · **Fechado:** — · **Fase:** implementação local concluída; rollout pendente
> Revisão 2 · aprovada pelo usuário em 2026-09-07 · executar antes de R-156.

## 1. Problema

Decisão do usuário: antes das features, falhas detectáveis, explicáveis, isoladas e recuperáveis;
pagante com acesso, não pagante sem acesso indevido, falha técnica distinta de inadimplência.

**Evidência da sessão:** print `ERR_TOO_MANY_REDIRECTS` no Dashboard/www; sandbox reproduziu
`checkout_pendente` + membership ativa: Dashboard 307 → bem-vindo 307 → Dashboard; `active` restaurado voltou 200.
Checkout, recuperação de webhook e cobrança sandbox R$200 passaram; segundo dentista preservado.
**Recusado não validado:** não houve `invoice.payment_failed`; tentativas anteriores não o comprovam.
**Antes da implementação:** retorno só lia DB/exigia membership ativa; havia loop entre Dashboard
e bem-vindo; cron suspendia sem Stripe; faltava boundary global e rascunho recuperável.
**Agora no código local:** reconciliação Stripe, projeção/acesso atômicos, claim recuperável, rotas
terminais, mensagens, proteção de rascunho, falha de sessão tipada, telemetria e boundary global.

## 2. Decisão e alternativas descartadas

| Decisão recomendada neste contrato | Alternativa descartada | Motivo |
|---|---|---|
| Sete camadas abaixo, com testes a cada entrega | Só corrigir o redirect | Deixa atraso, suspensão e recuperação inconsistentes |
| Projeção comercial única e reconciliação autenticada | URL de sucesso como autorização | Query string não prova pagamento |
| Reusar ledger, checkout, proxy, UI de erro e CI | Painel admin, fila externa ou novo monitor pago | Infra atual permite o recorte |
| RPC aditiva para projeção atômica, sem tabela nova | Atualizações independentes de assinatura/vínculo | Falha parcial e concorrência podem deixar pago suspenso |
| Proteção de rascunho antes de atualização | Recarregar toda aba automaticamente | Estado React pode conter trabalho ainda não salvo |

Preservar preços, trial, isenções, formação/elegibilidade, cobrança individual e graça atual de três dias.
Riscos: autorização, concorrência, dados não salvos e dependência externa; não mudar política clínica/IA.

## 3. Objetivo e como funciona

“Conferir novamente” recupera acesso por fontes do servidor; falha técnica não vira dívida.
Novas versões preservam trabalho recuperável. Evidência local: 214 testes, typecheck e build passaram;
migration, objetos/grants remotos, sandbox, duas contas e canal de alerta continuam pendentes.

## 4. Contrato técnico

### Recorte imediato — 08/09: sessão ilegível

Usuário autorizou investigar/corrigir causas de acesso travado hoje; refinamento amplo amanhã.
Produção: cookie `sb-…-auth-token=base64-invalid-session` reproduziu HTTP500 no proxy.
Loop antigo Dashboard/bem-vindo reproduzido antes de `a2236a6`; fix já publicado passa.
Contrato deste recorte: antes de criar o client Auth, remontar cookie do projeto com utilitário
do SDK e validar apenas decodificação/JSON. Se ilegível, remover somente cookie de sessão desse
projeto e seus chunks do request/response; proxy existente leva ao login. Não autorizar por JSON:
sessão legível continua passando por `getUser`. Falha de rede não é cookie corrompido.
Sem alteração de RLS, permissões, cobrança, schema ou dados clínicos. Checkout isolado da produção.
Aceite: inválido→login sem500; chunks válidos/sessão válida preservados; outros cookies intactos;
sem sessão→login; renovação continua visível ao servidor; nenhuma limpeza de storage ou logout global.
Publicação deste recorte depende de checks e sessão Vercel; não confundir correção local com deploy.
Verificação 08/09: 11 estados de navegação passaram no código publicado; loop reproduzido no pai
de `a2236a6`. Browser produção com clínica teste abriu Dashboard200; sem sessão abriu login200;
cookie ilegível reproduziu500. Patch local: válidos abrem Dashboard200, inválido abre login200;
renovação real com sessão da clínica teste propagou cookies ao request e response. Teste de
regressão, lint e tsc passaram. Fontes `middleware.ts`/`middleware.test.ts`, sem commit ou deploy.
Harness descartável: `/tmp/odonto-redirect-qa`; nenhuma consulta clínica ou cobrança foi escrita.

### 4.1 Camada 1 — estado canônico e autorização

Evoluir `src/lib/billing/estado-comercial.ts`/`resolverEstadoComercial` como fonte pura; adaptadores
preservam apresentação, não decidem acesso. Tipos **propostos**, não exports existentes:

```ts
type StatusAssinatura = 'aguardando_formacao' | 'checkout_pendente' | 'cartao_pronto'
  | 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled' | 'unpaid';
type EstadoComercialCanonico =
  | { tipo: 'liberado'; motivo: 'isento' | 'trial' | 'ativo' | 'formacao' }
  | { tipo: 'carencia'; ate: string }
  | { tipo: 'confirmacao_pendente' }
  | { tipo: 'formacao_pendente' }
  | { tipo: 'regularizacao'; motivo: 'recusado' | 'suspenso' | 'cancelado' | 'sem_assinatura' };
type LeituraComercial =
  | { ok: true; estado: EstadoComercialCanonico }
  | { ok: false; motivo: 'sessao_expirada' | 'sem_vinculo' | 'indisponivel'; referencia: string };
```

Entrada: isenção, status, `grace_ends_at`, agora, `obterAcessoFormacaoClinica` e falha da invoice atual.
Status desconhecido/erro/carência ausente em past_due = indisponível/reconciliar, nunca “sem dívida”.
Isenção vence cobrança; `trialing`/`active` liberam; formação só libera pelo serviço atual;
`past_due` libera até `grace_ends_at > agora`; vencimento exige 4.2 antes de suspensão.
`cancel_at_period_end` na Stripe não bloqueia antes do fim enquanto subscription segue ativa.

Layouts/retorno/planos/configurações/actions usam a mesma decisão; `requireClinicContext` mantém
role/remoção/elegibilidade e arquivo clínico/configurações. Falha individual não suspende o colega.

### 4.2 Camada 2 — reconciliação e proteção contra DB obsoleto

Módulo proposto `src/server/services/reconciliacao-assinatura.ts`, compartilhado com webhook/assinatura-dentista.

```ts
type MotivoReconciliacao = 'retorno' | 'manual' | 'pre_suspensao' | 'webhook';
type ReconciliacaoResult =
  | { ok: true; leitura: Extract<LeituraComercial, { ok: true }>; alterou: boolean }
  | { ok: false; motivo: 'indisponivel' | 'conflito' | 'sem_vinculo'; referencia: string };
declare function reconciliarAssinaturaDentista(input: {
  userId: string; clinicId: string; motivo: MotivoReconciliacao;
}): Promise<ReconciliacaoResult>;
```

Contrato server-only: IDs vêm de contexto autenticado/evento validado, nunca do corpo do cliente.
Contexto comercial aceita vínculo ativo/pendente/suspenso sem liberar dados clínicos; usa
`users.active_clinica_id` + `clinica_usuarios`. Ambiguidade termina em seleção/onboarding, não “último vínculo”.

Buscar `assinaturas_dentista` por `usuario_id` + `clinica_id`; conferir customer, subscription,
metadata de assinatura e modo sandbox/live. Sem subscription persistida, consultar somente
`stripe_checkout_session_id`/`stripe_setup_session_id` associados à mesma linha. Conferir sessão
e subscription atuais; setup de cartão sozinho não é pagamento nem ativação coletiva.
Reusar `statusStripeParaInterno`, política de trial, `ativarFormacaoSePronta` e elegibilidade.
Consultar a última invoice; uma invoice antiga não altera `last_invoice_id` nem reinicia graça.

`conferirRetornoCheckout()` em `src/app/checkout/retorno/actions.ts` continua sem argumentos;
`EstadoRetornoCheckout` ganha `leitura: LeituraComercial` quando não confirmado. Manter campos de sucesso.
DB pendente/bloqueante reconcilia; falha retorna mensagem/ref, sem redirect em catch ou consulta pública por ID.

Reusar `src/lib/rate-limit.ts`: conferência manual limitada por usuário+clínica (proposta: 6/min),
com espera informada. No cliente, uma requisição em voo, polling limitado a 12 leituras/30s como
hoje, no máximo uma consulta Stripe por ciclo automático; depois só retry explícito. Transporte
tem timeout de 10s, até duas tentativas de CAS; nunca retry infinito nem criação/cobrança no retry.

Antes de `suspenderGracasVencidas` bloquear: buscar Stripe atual, reconciliar e só aplicar suspensão
se a fatura atual continua devida e a carência venceu. Timeout/DB indisponível = adiar a mutação,
registrar erro e repetir no próximo ciclo. Não ampliar acesso de novos pagantes sem confirmação;
falha de verificação em request mostra indisponibilidade técnica, sem reclassificar inadimplência.
Cron global permanece autenticado por `CRON_SECRET`; teste chama serviço com escopo obrigatório
de clínica teste, **nunca** dispara `/api/cron/suspender-assinaturas-stripe` global no DB compartilhado.

### 4.3 Camada 3 — atomicidade, webhook e replay

Migrations locais `061_billing_idempotency`/`r92_assinatura_individual_stripe`: ledger tem event ID único,
clínica/dentista, outcome/payload, attempts, received_at/processed_at, last_error, token/lease;
RLS sem policies client-side; `claim_stripe_billing_event(text,text,jsonb,uuid)` só service_role.
Assinaturas têm updated_at e Stripe IDs únicos. **Schema remoto não conferido**: validar objetos/grants,
não confiar na tabela de migrations. Nenhuma consulta remota nesta redação.

Migration aditiva proposta: RPC `aplicar_estado_assinatura_reconciliado`, sem colunas/tabelas novas.
Parâmetros: `p_assinatura_id uuid`, `p_clinica_id uuid`, `p_usuario_id uuid`,
`p_expected_updated_at timestamptz`, `p_status text` limitado à união acima,
`p_trial_ends_at`, `p_current_period_ends_at`, `p_grace_ends_at` como timestamptz nullable,
`p_last_invoice_id text` nullable, `p_acesso text` em `manter|ativar|suspender`.
Retorno: `aplicado|conflito|sem_vinculo`. Na mesma transação, lock da assinatura, CAS de
`updated_at`, validação dos vínculos e escrita da projeção + membership + `dentistas.ativo`.
Nunca restaurar membro removido nem alterar `users.active_clinica_id` em webhook tardio.
Conflito exige nova leitura Stripe antes de repetir; nenhum snapshot antigo sobrescreve projeção
mais nova. Formação só passa `ativar` após gate coletivo existente; não ganha atalho individual.
Grants apenas service_role, `search_path` fixo, revogar PUBLIC/anon/authenticated; manter RLS atual.
Sem migration seria possível retry simples, mas não garantir atomicidade entre as três tabelas.

`POST /api/webhooks/stripe`: assinatura inválida/modo incompatível 400; cobrança desativada 503;
falha de registro/aplicação 500; sucesso ou evento já processado 200. Claim ocupado não equivale
a processado: responder 503 com retry quando lease está vivo; distinguir pelo ledger. Corrida no
primeiro insert (unique violation) relê o registro. Toda finalização exige token e linha afetada.
Expirou lease: próximo worker recupera; worker antigo não finaliza outro claim. Todos os caminhos
de invoice/subscription usam estado atual; não regressar cancelamento nem graça em entrega fora
de ordem. Preencher clínica/dentista no ledger depois de validar associação; erros são redigidos.
Replay operacional usa reenvio do evento Stripe verificado, mesmo ID/claim; não “marca sucesso”
no SQL nem aceita payload arbitrário. Falha de envio de aviso não reverte pagamento; evitar novo
aviso em duplicata/replay da mesma invoice, sem prometer exactly-once de email sem outbox.

### 4.4 Camada 4 — navegação terminal

| Situação autenticada | Destino canônico e condição de saída |
|---|---|
| `checkout_pendente` + membership ativa | `/checkout/retorno?checkout=sucesso`; só sai após decisão canônica liberar |
| Formação sem liberação | `/bem-vindo-agregado`; permanece ali enquanto falta equipe/cartão |
| Suspenso/recusado/cancelado | retorno/planos com regularização e portal; não depende do Dashboard para recuperar |
| Liberado e onboarding completo | `/dashboard`, respeitando elegibilidade e role |
| Liberado e onboarding incompleto | onboarding existente; não regressa a checkout sem mudança de estado |
| Sem sessão válida | `/login` com retorno interno validado |

Query string só apresenta; visita direta verifica igual. Bem-vindo usa resolvedor; retorno aceita
contexto comercial suspenso/pendente. `safeReturnPath` e lista fechada impedem redirect externo.
Estado fixo chega a resposta renderizada em ≤3 redirects, sem URL repetida; erro de DB não manda
para onboarding ou alternância login/Dashboard.

### 4.5 Camada 5 — mensagens e recuperação

| Estado | Mensagem obrigatória em sentido | Ação disponível |
|---|---|---|
| Confirmação pendente | Ainda estamos confirmando sua assinatura | Conferir novamente; não afirmar que Stripe confirmou só pela URL |
| Recusado comprovado | Não foi possível concluir o pagamento | Atualizar forma de pagamento no portal/checkout já associado |
| `past_due` em graça | Pagamento pendente; acesso disponível até data explícita | Regularizar e conferir |
| Suspenso/cancelado | Acesso suspenso/assinatura encerrada, sem apagar prontuário | Portal/planos e verificar regularização |
| Sessão expirada comprovada | Sua sessão expirou; entre novamente | Login com retorno seguro e rascunho protegido |
| Indisponibilidade técnica | Não foi possível verificar agora; isso não confirma falta de pagamento | Retry e referência de suporte, sem expor stack |

### 4.6 Camada 6 — browser, PWA e trabalho não salvo

Next 16.3.3: manifest sem service worker; next.config sem deploymentId; proxy só trata host legado.
Docs locais: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/deploymentId.md`
e `01-app/02-guides/self-hosting.md`: deploymentId top-level/NEXT_DEPLOYMENT_ID podem recarregar e perder estado React.

ID imutável por deployment: observar `data-dpl-id` e `x-deployment-id`/`x-nextjs-deployment-id`;
respeitar valor da plataforma. Conferir suporte Vercel na execução, sem presumir plano pago.
Sem service worker/offline ou limpeza indiscriminada. Apex recomendado `odontoia.app`: conferir regra
da plataforma, um só canonicalizador www/apex; localhost/Preview não redirecionam para produção.

Proposta de proteção local a aprovar com este contrato: rascunho por aba em `sessionStorage`,
com schemaVersion, usuário, clínica, paciente, contexto, `visitaKey`, instante e payload tipado
pelos campos de `SalvarRegistroClinico` em `registrar-painel.tsx` (texto/eventos/orto/alerta/destino).
Incluir `fichaRascunhoId` e identidade da origem; extrair tipo compartilhado, não importar runtime
server no cliente. Persistir a cada mudança confirmada do editor; limpar só após sucesso integral
ou descarte explícito. Expiração proposta de 24h, validada ao ler; nunca registrar payload em logs.
Restauração exige mesmo usuário/clínica/paciente, revalida permissão e revisão do usuário antes de
salvar; schema incompatível não é aplicado silenciosamente. Troca de clínica não restaura outro
contexto. Logout explícito remove cópias; sessão expirada mantém cópia inacessível até mesmo login.
Quota/falha mantém memória/avisa/bloqueia atualização. Storage não guarda token/PDF/foto/áudio.
Captura/upload/retry de áudio bloqueia atualização voluntária; SO fechando não garante recuperar mídia.
`beforeunload` é auxiliar, insuficiente no mobile.
Atualização/retry de chunk ou Server Action nunca repete automaticamente escrita clínica incerta:
preserva `visitaKey`, consulta estado salvo e oferece recuperar/retomar. Navegação do app com dirty
pede salvar/descartar/permanecer; sessão inválida usa recuperação sem jogar conteúdo fora.
`useSessionGuard` e `updateSession` distinguem token inválido de falha técnica; só o primeiro limpa
cookies auth. Reusar `src/app/error.tsx`; cobrir falha do root layout com boundary apropriada se
reprodução mostrar lacuna. Não criar segundo fluxo de autenticação nem recarregar em loop.

### 4.7 Camada 7 — publicação, observabilidade e rollback

Estender `logBilling` (hoje provider só abacatepay) para Stripe: referência, origem, outcome,
latência, tentativa, deployment e associação técnica restrita. Sem payload clínico/email/token.
Alertas obrigatórios: evento `error`, lease vencido não recuperado, suspensão adiada e divergência
comercial persistente. Critério inicial: erro imediato; pending por >5min; cron diário sem sucesso
por >26h. Agregar repetição por referência; registrar responsável e runbook de replay/rollback.
Canal de alerta existente disponível é verificação pendente da execução; sem canal comprovado,
publicação fica bloqueada. Não contratar serviço nem afirmar que console sozinho notifica alguém.
CI: typecheck/test/build duros, lint informativo; novos testes/lint do recorte bloqueiam. Manter typecheck separado.
Publicar lote pequeno com aprovação; migration primeiro e isolada. Rollback retorna ao último
deployment compatível **com o conserto do loop**, mantém migration aditiva e reconcilia efeitos
pendentes; nunca restaura snapshots de produção ou desativa billing para liberar todo mundo.

## 5. Comportamento — estados e exemplos

Vazio: sem assinatura → planos. Carregando: conferir → uma chamada pendente e resultado/retry.
Sucesso: A pago → dashboard, B preservado. Validação: URL/ID/modo adulterado → rejeita sem cobrança.
Sem permissão: B tenta clínica A → nega sem dados. Desatualizado: Stripe ativo/DB suspenso →
reconcilia; removido não reativa. Conflito: cron/webhook → CAS/refetch, nunca projeção parcial.
Erro técnico: banco cai → mensagem/ref/retry. Atualização: texto reaparece no mesmo contexto, sem duplicar.

## 6. Referência visual

Reutilizar checkout, bem-vindo, planos, configurações, erro e editores; tokens `bg-background`,
`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, variantes/tipografia atuais.
Sem artefato/redesign; composição nova volta ao pipeline. Conferir light/dark, foco/teclado/feedback.

## 7. Invariantes

- Servidor autoriza; isento não cobra; falha não concede acesso nem remove prontuário/afeta colega.
- Retry não cobra; Stripe atual prevalece; não suspender só por DB nem confirmar escrita parcial.
- Usuário usa clínica ativa; cron/evento resolve vínculo validado e escopa operações. Cliente não prova tenant.
- Rascunho não é Ficha salva nem conteúdo de outra identidade; mídia tem limite explícito acima.

## 8. Gates de aceite

Todos obrigatórios/pendentes; A automatizados, I integração, M manual. Evidência sintética por commit/deployment.

### A — automatizados, por camada (local/CI, dependências simuladas)

1. **AC-001 / A1:** matriz pura de todos os status × vínculo × isenção × formação × graça (antes,
   igual e depois do prazo) → estado/destino único; erro de DB distinto. Ampliar testes billing existentes.
2. **AC-002 / A2:** webhook ausente + Stripe ativo, session incompleta, modo/customer alheio, timeout,
   retry/limite → recuperação ou erro tipado; spies comprovam zero create/pay no “Conferir”.
3. **AC-003 / A3:** duplicata, ordem inversa, invoice antiga paga/falhada, claim concorrente/expirado,
   token antigo, CAS perdido e falha em cada write → respostas previstas, sem estado parcial confirmado.
4. **AC-004 / A4:** grafo das rotas de 4.4 (também login/onboarding/configurações e roles auxiliares)
   → terminal em ≤3 redirects por estado fixo; reproduzir o loop antigo e demonstrar ausência.
5. **AC-005 / A5:** componentes de retorno/erro com resultados simulados → cada mensagem/ação de 4.5,
   inclusive rejeição de Promise; loading encerra e botão pode recuperar sem submit simultâneo.
6. **AC-006 / A6:** token inválido versus rede; cookies preservados em redirect; rascunho round-trip,
   quota/schema inválido, outro usuário/tenant, sucesso parcial e chave preservada → sem perda silenciosa.
7. **AC-007 / A7:** logs redigidos e limiares de alerta/cron → sinal esperado; CI falha quando A1–A6
falham. Usar `tsx --test` para lógica; harness de browser de R-156 §4.5 pode ser instalado aqui
   após decisão técnica, sem depender da implementação clínica de R-156 para fechar esta spec.

### I — integração controlada (localhost/Preview + Stripe sandbox + clínica teste remota)

1. **I1 (A1–A4):** checkout individual e formação coletiva com dois dentistas → DB/Stripe e destino
   conferidos; atraso de webhook recuperado pelo retorno, isento sem Stripe. Registrar antes/depois.
2. **I2 (A2/A3):** evento real sandbox reenviado duplicado/fora de ordem e falha injetada no adapter
   local → 500 recuperável, ledger processado após replay, zero nova subscription/invoice por retry.
3. **I3 (A1–A3):** provocar recusa na invoice da subscription sandbox de teste e comprovar evento
   `invoice.payment_failed`, invoice ainda devida, grace e mensagem. Sem esse evento, caso não passou.
4. **I4 (A1–A3):** graça vencida com Stripe já pago → nenhuma suspensão; ainda devida → só A suspenso;
   Stripe indisponível → adiado com alerta. Chamar serviço escopado, nunca cron global.
5. **I5 (A1–A5):** renovação, cancelamento ao fim/imediato e regularização pelo portal → estado atual,
   last invoice/graça sincronizados; cancelamento antigo não regressa recuperação posterior.
6. **I6 (A1/A3/A6):** duas contas logadas + clínicas sintéticas distintas; adulterar alvos → nega;
   B preservado inclusive active clinic. Novo grant/RPC e qualquer RLS exigem este gate no browser.
7. **I7 (A4–A6):** redirects HTTP e navegação com sessão velha, banco indisponível e cookies antigos →
   terminal recuperável, sem falso “inadimplente”; não capturar cookies em relatório.
8. **I8 (A6/A7):** duas builds consecutivas controladas, aba antiga/PWA com texto/eventos não salvos →
   versão identificável, restauração exata e um salvamento; simular chunk/action indisponível.
9. **I9 (A7):** exercitar alerta no canal escolhido e rollback em Preview → notificação recebida,
   versão anterior compatível acessível, replay ainda funciona. Não promover sem esta evidência.

### M — roteiro manual final do usuário (somente após A e I verdes)

1. **M1:** entrar como A e B na clínica teste; checkout individual/coletivo e isento apresentam caminho coerente.
2. **M2:** confirmar assinatura pendente e pagamento recuperado; “Conferir” não pede pagar outra vez.
3. **M3:** percorrer recusa, graça, suspensão e regularização preparados em I3–I5; entender motivo e ação.
4. **M4:** sessão expirada e indisponibilidade técnica têm mensagens distintas e deixam retomar o trabalho.
5. **M5:** usar browser/PWA, light/dark e mobile/desktop com aba antiga; texto e eventos reaparecem no mesmo paciente.
6. **M6:** validar entrada pelo domínio canônico e www após publicação autorizada, só leitura; sem loop.
7. **M7:** conferir restauração da clínica teste e relatório de gates; aceite visual/funcional não é presumido.

**Preparação/cleanup:** antes de I, autorização específica, snapshot restrito de estado comercial,
membership, plano/elegibilidade da clínica teste; sandbox validado, notificações externas simuladas.
Isolamento em outra clínica usa apenas atores sintéticos autorizados; não criar contas por suposição.
Restaurar apenas campos/objetos alterados pelo ensaio, conferir ausência de mudança concorrente e
reconciliar com Stripe; nunca alterar assinatura sandbox para fingir que cobrança live foi validada.
Estado residual informado (sandbox ativo e SOLO/Consultório) é ponto de partida, não regra de produto.
Smoke pós-publicação só leitura: login/dashboard/recuperação/status do webhook e deployment; falha
de acesso, alerta ausente ou perda de rascunho interrompe promoção. 🟡 até auditoria completa promover ✅.

## 9. Fora de escopo

Fora: painel admin, serviço pago, offline/áudio durável, preços/formação, seed/cleanup agora, Dex/redesign.
Pendências: aprovação/retenção local proposta, objetos remotos, domínio/version skew e canal de alertas.
