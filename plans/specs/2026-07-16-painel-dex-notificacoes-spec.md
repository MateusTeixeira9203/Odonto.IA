# Spec: Painel do Dex — notificações que chegam

> **Status:** **APROVADA pelo Mateus em 16/07** — diagnóstico, mapa canônico, migration 103,
> design do painel do Dex, destinatário-pessoa e fonte "sem retorno 30/60" (regra híbrida)
> **Data:** 2026-07-16
> **Origem:** roadmap 3.1 fila #7 · investigação de 16/07 (o "passo 1" declarado: por que 0/48?)
> **Modelo de execução:** Sonnet
> **Sequenciamento:** a **Fatia 0 (migration 103) entra na leva de SÁBADO** junto da 099–102 —
> furo vivo e pré-requisito do protético. O resto (Fatias 1–2) executa em **qualquer janela
> pós-gate**: os arquivos (`notification-bell`, `alerts route`, `mobile-header/drawer`) são
> **disjuntos** das frentes v3/Job A/transcrição — não colide com "uma frente por vez" das
> grandes. Recomendação: primeira janela curta disponível (destrava o protético, fila #6).

---

## 1. Problema — o diagnóstico de 16/07 (fatos, não hipóteses)

O canal de notificação do dentista está **estruturalmente quebrado em 3 camadas**:

| # | Camada | Evidência |
|---|---|---|
| 1 | **Donos nunca recebem** | Notificações nascem `para_role='dentista'`; os 3 donos têm role `admin` → o filtro da rota (`para_role.eq.admin`) **nunca casa**. 8 notificações invisíveis pra usuários ativos |
| 2 | **Mobile não tem sino** | `NotificationBell` só monta em `sidebar-content`/`floating-dock` (desktop). `MobileHeader` e `MobileDrawer` não têm sino — dentista de celular vive sem canal |
| 3 | **Abrir = zerar tudo** | `handleBellClick` → `markAllNotifsRead()`: abrir o painel marca TODAS como lidas. 1 clique descarta 20 sem ler. (E os 3 `dentista` ativos, com 40 notificações bem-formadas, nunca clicaram em 30 dias — o sino do dock não converte) |
| + | **RLS vaza entre dentistas** | A policy filtra `para_role` e **ignora `para_dentista_id`** — a rota filtra certo, mas acesso direto à tabela (inclusive o canal **realtime** do sino, que assina INSERTs sem filtro) entrega a notificação do A pro B |

Dados de prod (16/07): 106 notificações · dentista 48/0 lidas (35 agendamento_criado,
10 pagamento_confirmado — rajada única em 15/07, conferir origem na execução —, 3
cancelamentos) · secretária 58/17 lidas (o fluxo DELA funciona — mesma UI, papel que
recebe e usa desktop).

## 1.1 Mapa canônico — quem recebe o quê (auditado no código, 16/07)

**Endereçadas à PESSOA (o dentista específico):**

| Notificação | Gatilho (quem gera) | Categoria no dia dele | Produtor |
|---|---|---|---|
| `agendamento_criado` | Secretária agenda pra ele | Agenda | `agendamentos/actions.ts:159` |
| `agendamento_cancelado` | Consulta dele cancelada | Agenda | `agendamentos/actions.ts:517` |
| `checkin_paciente` | Recepção marca "chegou" | Agenda (agora!) | `agendamentos/actions.ts:411` — 0 em prod, check-in não usado |
| `pagamento_confirmado` | Secretária registra entrada em nome dele | Dinheiro | `financeiro:399` + `orcamentos:415` + `orcamentos:640` (3 produtores — suspeita da rajada 10×) |
| `sistema` (despesa) | Secretária lança saída em nome dele | Dinheiro | `financeiro/actions.ts:314` |
| `convite_clinica` | Convite de equipe | Clínica | `invites.ts:155` |
| `atribuicao_ficha` *(futuro)* | Colega/fluxo atribui ficha | Clínica | Fatia B do protético |
| `trabalho_pronto` *(futuro)* | Protético marca entregue | Clínica | Fatia B do protético — o keystone |

**Broadcast por papel (`secretaria`):**

| Notificação | Gatilho | Produtor |
|---|---|---|
| `consulta_finalizada` | Dentista encerra consulta | `consulta/actions.ts:69` |
| `orcamento_enviado` | Dentista envia orçamento | `orcamentos/actions.ts:77` |
| `briefing` | Bot WhatsApp agendou · orçamento aprovado | `message-handler:357` + `orcamentos:81` |
| `follow_up` | Paciente recusou lembrete (WhatsApp) | `message-handler:405` — **nunca disparou** (WhatsApp desligado) |

**Alertas computados** (não persistem; aparecem no mesmo painel): secretária — consultas de
hoje sem confirmação · orçamentos em rascunho · orçamento enviado >3 dias; dentista/admin —
só "complete seu CRO". *(Dono-admin com CRO preenchido = painel sempre vazio hoje — o
sintoma "bugadinho".)*

## 2. Decisões (16/07, com o Mateus)

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| **Destinatário é a PESSOA** — `para_dentista_id` preenchido torna o role irrelevante; role é só broadcast (`'secretaria'`, `'all'`) | Manter role como filtro primário | Dono-admin atende paciente; o bug de camada 1 se repetiria a cada tipo novo |
| **Fix da RLS = migration 103, SÁBADO** | Esperar a execução do painel | Furo vivo (vaza entre dentistas hoje) + pré-requisito da Fatia B do protético + SQL pequeno |
| **Leitura por item + "marcar todas"** — abrir o painel NÃO zera | Manter "abrir = tudo lido" | O badge passa a dizer a verdade; o não-visto continua visível |
| **Protético vê: primeiro nome + trabalho + prazo** | Nome completo | Minimização LGPD — papel externo à cadeia clínica; o texto é o que o dentista escreveu |
| **Sino melhorado, sem página nova** *(declarada)* | Central/página de notificações | 106 notificações em 3 meses — volume não justifica página; ponytail |
| **Mobile: badge no `MobileHeader` + painel; entrada no drawer** *(declarada — detalhe no design da execução)* | Só desktop | Camada 2 do diagnóstico; o dentista de consultório é mobile |
| **v1 NÃO cria geradores novos** (follow-up, vencimento) *(declarada)* | Incluir as 4 fontes já | Follow-up nunca foi gerado e vencimento tem 0 uso (parcelamento). Canal primeiro; fonte quando existir de verdade. O TIPO `atribuicao_ficha` fica pronto no render — o gerador vem com o protético |
| **Pacientes sem retorno (30/60 dias) = ALERTA COMPUTADO, não notificação** *(pedido do Mateus, 16/07)* | Gerar notificação quando o paciente cruza 30 dias | "Sumido" é estado contínuo, não evento — notificação exigiria cron + dedup + re-disparo. Computado = deriva na abertura do painel, sempre atual, zero infra. É também o sinal que a régua de WhatsApp (recuperação, backlog) vai consumir depois — nasce aqui com a definição certa |

## 3. Fatias

### Fatia 0 — Migration 103 (SÁBADO, junto da leva 099–102)

```sql
-- 103_notificacoes_destinatario_pessoa.sql
-- Destinatário é a PESSOA: para_dentista_id preenchido → só ele lê (role irrelevante).
-- para_dentista_id null → broadcast por role na clínica (comportamento atual preservado).

drop policy if exists notificacoes_select on public.notificacoes;
create policy notificacoes_select on public.notificacoes for select
  using (
    belongs_to_active_clinic(clinica_id)
    and (
      (para_dentista_id is not null and para_dentista_id = get_my_dentista_id())
      or
      (para_dentista_id is null and (para_role = get_my_role() or para_role = 'all'))
    )
  );
-- Nota de execução: conferir na 099/089 o nome real do helper de role
-- (get_my_role() aqui é placeholder do padrão vigente) e replicar o padrão de
-- UPDATE (marcar lida) restrito ao mesmo predicado.
```

**Harness (sábado):** +2 asserções na `matriz_acesso_clinico.sql` — dentista B **não** lê
notificação endereçada ao A; broadcast de role continua legível pelos do role.

### Fatia 1 — Entrega (o canal passa a chegar)

- **Rota `/api/dex/alerts`**: filtro muda pra semântica pessoa-primeiro (espelho exato da
  103): `para_dentista_id.eq.me OU (is.null E role match)`. O `.or()` duplo atual (que ANDa
  os dois grupos) é substituído pela expressão explícita.
- **Sino no mobile**: badge de contagem no `MobileHeader` (o dentista VÊ que tem algo) +
  painel de notificações acessível (header ou item de topo no `MobileDrawer` — design da
  execução decide a forma exata; gate cobre o comportamento).
- **Leitura por item**: remover `markAllNotifsRead()` do `handleBellClick`; item marca ao
  clicar; botão "Marcar todas como lidas" permanece no rodapé.
- **Realtime**: manter a assinatura de INSERT — pós-103 a RLS limita o que chega; gate
  verifica que B não recebe evento da notificação do A.

### Fatia 2 — Fontes e render

- Tipo **`atribuicao_ficha`** entra no `TIPO_ICON`/`typeMap` (render pronto; **gerador só
  na Fatia B do protético**).
- `follow_up` e vencimento: **nada** no v1 (decisão acima) — ícones já existentes ficam.
- Rajada `pagamento_confirmado` 10× em 15/07: investigar o produtor na execução (possível
  gerador em loop na feature de 15/07) — 30min, com gate de "1 evento = 1 notificação".
- **Pacientes sem retorno (novo, 16/07)** — alerta computado no painel:
  - **Definição:** paciente cuja última visita (ficha por `data_atendimento`, com fallback
    em agendamento `completed`) foi há **≥30 dias** **E que não tem agendamento futuro**
    marcado. Quem tem retorno agendado NÃO está sumido — essa segunda condição é o que
    separa "recall" de "lista de todo mundo".
  - **Faixas:** 30–59 dias = info · **60+ = warning** (sobe a cor).
  - **Estrutura de resolução por paciente** (decidida 16/07 — regra HÍBRIDA):
    1. Sem nenhum atendimento (ficha)? → fora (nunca veio ≠ sumiu).
    2. Tem agendamento futuro? → fora (não está sumido).
    3. Última visita < 30 dias? → fora (ativo).
    4. SUMIDO — atribuição ao dentista:
       a. **Alguém tem procedimento INDICADO em aberto nele?** → aparece pra **quem
          indicou** (recall de valor: caso parado; mesmo reduce de pendências do cockpit).
       b. **Ninguém tem pendência?** → aparece pra **quem fez o último atendimento**
          (recall de manutenção). Autoria REAL via fichas — nunca `pacientes.dentista_id`
          (zumbi, Spec 1 inv. #5).
    - Cobre o caso do canal: coroa aberta do X faz o José aparecer pro X, não pro
      endodontista Y que já terminou.
  - **Por papel:** dentista comum = regra híbrida (os seus). **Dono-admin = DUAS linhas**:
    "seus pacientes" (híbrida) + "na clínica" (agregado total — perder paciente é problema
    do negócio). Secretária = linha da clínica (recall é trabalho dela no balcão).
  - **Órfãos** (último atendimento de dentista que saiu, sem pendência de ativo): só na
    linha da clínica — registrado, aceitável no v1.
  - **Forma:** UMA linha agregada no painel — *"5 pacientes sem retorno (2 há 60+ dias)"* —
    nunca 1 item por paciente (ruído). Clique → `/dashboard/pacientes?sem_retorno=1`
    (a página de pacientes ganha esse filtro, com "dias sem retorno" e "último atendimento
    por" visíveis na lista — escopo pequeno incluído nesta fatia).
  - Família visual: **Agenda** (é sobre trazer de volta pra agenda); ícone user-clock.

## 3.1 Design — o sino vira o PAINEL DO DEX (direção do Mateus, 16/07)

O dropdown genérico morre; o overlay ganha identidade Dex e organização pelo **dia a dia
do dentista** — fácil de entender sem treino:

- **Agrupamento temporal, não por tipo:** `Hoje` · `Ontem` · `Antes` — é como o dentista
  pensa ("o que aconteceu hoje?"). O TIPO vira ícone + cor no item, nunca seção.
- **3 categorias visuais** (ícone/cor): **Agenda** (novo/cancelado/chegou — teal),
  **Dinheiro** (entrada/saída em nome dele — teal money/warning) e **Clínica** (convite,
  atribuição, protético — neutro). Máximo de 3 famílias — mais que isso vira taxonomia.
- **Anatomia do item:** ícone em squircle colorido · título forte · mensagem em 1 linha ·
  tempo relativo em mono · ponto de não-lida. Clique = navega + marca lida (decisão:
  abrir o painel NÃO zera).
- **Header Dex:** avatar D + "Notificações" + contagem verdadeira + "marcar todas".
- **Mobile = mesmo painel como bottom sheet**, badge no `MobileHeader`. Um componente,
  duas embalagens.
- **Estado vazio com identidade:** Dex + "Tudo em dia" (o que já existe, mantido).
- **Sem filtros no v1** (volume: 106 em 3 meses) — registrado como refinamento futuro.
- Continua **overlay, sem página nova** (decisão mantida) — "painel" é a identidade e a
  organização, não uma rota.

## 4. Invariantes

- [ ] **#1** Destinatário-pessoa: `para_dentista_id` preenchido → só ele vê, em **todas** as
      camadas (RLS, rota, realtime). A regra é UMA, escrita nos dois níveis com o mesmo shape.
- [ ] **#2** Abrir o painel **não** altera estado de leitura — só clique no item (ou no
      "todas").
- [ ] **#3** O badge diz a verdade: contagem = não-lidas que o usuário realmente pode ver.
- [ ] **#4** Nenhuma página nova, nenhum push/e-mail/som no v1 — é o sino, consertado.
- [ ] **#5** Fluxo da secretária não regride (58/17 é o único fluxo que funciona hoje).
- [ ] **#6** Zero LLM — notificação é evento, não geração.

## 5. Gates de aceite

- [ ] Dono (role `admin`) com notificação endereçada a ele: badge aparece, painel lista, clique marca lida. *(mata a camada 1)*
- [ ] No celular: badge visível no header, painel abre, leitura funciona. *(mata a camada 2)*
- [ ] Abrir o sino e fechar sem clicar em nada: contagem **não muda**. *(mata a camada 3)*
- [ ] Dentista B logado **não** vê nem recebe (realtime) notificação endereçada ao A. *(mata o vazamento — asserções da 103 no harness + teste de sessão)*
- [ ] Broadcast pra `secretaria` continua chegando pra ela; contagens dela intactas.
- [ ] Notificação com `href` navega certo nos dois form factors.
- [ ] `atribuicao_ficha` renderiza com ícone/cor (semeada à mão) — pronto pro protético.
- [ ] **Sem retorno:** paciente com última ficha há 45 dias e sem agendamento futuro →
      conta na linha; o mesmo paciente COM agendamento futuro → some da linha; 60+ dias →
      warning. Contagem bate com query manual.
- [ ] Clique na linha abre `/dashboard/pacientes?sem_retorno=1` com a lista filtrada
      (dias sem retorno + último atendimento por quem).
- [ ] Atribuição híbrida: paciente sumido com procedimento indicado em aberto do X →
      conta pro X mesmo que o último atendimento seja do Y; sem pendência de ninguém →
      conta pra quem atendeu por último.
- [ ] Dono-admin vê as DUAS linhas (seus + clínica) com contagens independentes corretas;
      dentista comum só a dele; secretária só a da clínica.
- [ ] Paciente cadastrado que nunca teve atendimento não conta em lugar nenhum.

## 6. Relação com o protético (fila #6)

O keystone do protético — o "**pronto**" que pinga o dentista — usa ESTE canal com o tipo
`atribuicao_ficha`/`trabalho_pronto`. Ordem confirmada: **painel antes do protético**.
Decisões do protético já tomadas e registradas (16/07): tabela própria + senha opcional ·
grátis · "só sinaliza" atraso · agenda dele É a do dentista · **vê primeiro nome + trabalho
+ prazo** (minimização). A spec final da Fatia B congela **pós-099 em prod** (decisão da
manhã, mantida) — todos os gates dela são comportamentais.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| `get_my_role()`/helper de role divergir do padrão real das migrations | Nota explícita na 103: conferir na 089/099 antes de aplicar — é 1 nome de função |
| Realtime entregar payload antes da RLS filtrar | Gate específico (#4 dos aceites) com 2 sessões reais |
| Corrigir a entrega e inundar o dentista com 30 dias de backlog (48 de uma vez) | Na execução: marcar como lidas as notificações > 30 dias na própria 103 (`update ... set lida = true where created_at < now() - interval '30 days'`) — começar limpo, não com dívida |
