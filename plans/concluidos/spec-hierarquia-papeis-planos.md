# Spec — Redefinição da hierarquia (papéis · visibilidade · planos)

> Criado 2026-07-04 (sessão de planejamento). Origem: debate com o fundador nesta sessão + o marcador deixado na migration 084 ("revisitar quando a hierarquia de planos/papéis mudar").
> **Status: PRONTA para execução** — validada com o fundador em 2026-07-04.
> Billing real e bot WhatsApp ficam **fora** desta spec (semana do WhatsApp+).

---

## 1. Objetivo

Achatar a hierarquia hoje centrada em `admin` (que "vê tudo") para um modelo de **consultórios independentes que dividem estrutura**:

- 3 papéis com fronteiras claras, sem "super-admin" clínico.
- Cada dentista opera um **silo próprio**; a **secretária** é o hub que vê tudo.
- Plano "Clínica" a partir de **2** dentistas (era 3), teto **5** (era 99), com desconto progressivo.

Princípio-guia: **"clínica" = N dentistas autônomos + 1 recepção compartilhada** — não uma empresa com prontuário unificado. Coerente com a decisão de billing "cada dentista paga a própria conta".

---

## 2. Modelo de papéis

| Papel (valor no banco) | Rótulo na UI | Atende | Convida / gere equipe | Config da clínica | Visibilidade clínica |
|---|---|---|---|---|---|
| `admin` | **Criador** | Sim (dentista pleno) | ✅ único | ✅ | **só o próprio silo** |
| `dentista` | Dentista | Sim | ❌ | ❌ | só o próprio silo |
| `secretaria` | Secretária | Não | ❌ | parcial (bot/WhatsApp) | **vê tudo da clínica** |

**Mudança-chave:** hoje `admin` = super-visão clínica + gestão. Depois, `admin` mantém só os poderes **administrativos** (convite, equipe, config) e passa a ver **só o próprio silo clínico**, igual a um dentista comum.

**Decisão de implementação:** o valor `admin` permanece no banco — **zero migração de roles**. Muda o rótulo (UI) e o conjunto de poderes clínicos. "Criador" é `admin`; a distinção vira só administrativa.

**Quem é o Criador:** o dentista que **iniciou a clínica** — assinou e fez os primeiros convites. Não é um papel "acima": é um dentista qualquer cujo **único** privilégio extra é convidar/gerir membros. Visibilidade, catálogo e agenda são iguais aos de qualquer dentista.

---

## 3. Modelo de visibilidade (RLS) — o coração da mudança

**Regra geral:** todo dado clínico é visível apenas pelo **dentista dono** (`dentista_id` do próprio registro) **OU** pela **secretária** (`get_my_role() = 'secretaria'`).

Espelha o padrão que **já roda em produção**: financeiro (`is_own_finance_record`, migration 057) e catálogo (migration 084). Não inventa mecânica nova — estende a existente.

**Fonte do "dono":** o `dentista_id` do próprio registro (não via join com paciente). É o padrão do 084, mantém a RLS barata (sem join a cada checagem) e é consistente por construção — só o dono cria fichas/orçamentos do seu paciente, então `registro.dentista_id` == `paciente.dentista_id` naturalmente.

### Delta por tabela (vs migration 057)

| Tabela | Hoje | Depois |
|---|---|---|
| `pacientes` | todos da clínica (ALL) | **dono OR secretária** |
| `fichas` | todos leem | dono OR secretária |
| `orcamentos` / `orcamento_itens` | todos leem | dono OR secretária |
| `agendamentos` | todos | dono OR secretária |
| `pagamentos` | todos | dono OR secretária |
| `planejamentos` (+ etapas/seções/procedimentos) | todos leem | dono OR secretária |
| `paciente_documentos` | todos | dono OR secretária |
| `despesas` / `receitas_manuais` | **já siloado** | (sem mudança) |
| `procedimentos` (catálogo) | dono + admin + secretária (084) | **dono + secretária** (remove admin — cada um o seu) |
| `horarios_disponiveis` | todos leem | **dono + secretária** (dentista só a própria agenda; secretária/bot veem todas) |

**Helper SQL novo (opcional):** manter o padrão `dentista_id = get_my_dentista_id() OR get_my_role() = 'secretaria'` inline nas policies, como o 084 já faz. Não precisa de função nova.

### Encaminhamento / reatribuição — DECIDIDO (acontece muito, não é exceção)
Encaminhar paciente entre dentistas é **frequente**. Regra do fundador: **"a secretária passa o paciente, mas não a ficha — a ficha é individual"**.

- **A secretária transfere o PACIENTE** (troca `pacientes.dentista_id`) → o novo dentista passa a ver o paciente e cria as **próprias** fichas. Entra na **Fase A**: campo "dentista responsável" editável pela secretária, de forma visível.
- **A ficha NÃO acompanha** — é individual de quem a criou (alinha com prontuário = responsabilidade legal do profissional). O silo por `dentista_id` **do registro** já entrega isso: a ficha antiga permanece com o Dr. A (no "histórico dele"); o paciente passa pro Dr. B. **Não existe "transferência atômica"** — é indesejada, não uma limitação.
- **Consequência clínica:** o novo dentista **não herda** o histórico clínico do anterior. A ponte é a secretária (vê tudo) ou, no futuro, compartilhamento explícito dentista→dentista (§10).
- **Clínica sem secretária:** sem hub, o encaminhamento interno fica manual. O fundador considera a secretária **essencial** (parte fiscal/recebimento presencial) — clínica sem ela é o caso raro/futuro, mesmo com o bot automatizando confirmação.

### Desvio registrado: storage é por-CLÍNICA, não por-dentista

O silo por-dentista desta seção vale para o **banco** (todas as tabelas acima). O **storage** (`fichas`/`radiografias`/`audios`) é uma **exceção consciente**: fica clínica-escopado (path `clinicaId/pacienteId/...`, sem `dentista_id`), não por-dentista.

**Por quê:** por-dentista via join no dono-atual do paciente faria o arquivo **acompanhar** o paciente no encaminhamento — contradizendo a regra acima ("a ficha não acompanha, é individual de quem criou") e fazendo o Dr. A **perder acesso à própria radiografia** ao encaminhar o paciente. Por-dentista via path do criador funcionaria, mas exige repath + migração de todos os objetos existentes — caro demais pro ganho.

**Por que é seguro mesmo assim:** o controle primário do silo é o banco. Para abrir o arquivo de outro dentista, seria preciso o `fichaId` exato (UUID não-adivinhável) — e a RLS de tabela já esconde a linha da ficha de quem não é dono, então esse UUID nunca chega a quem não deveria. Storage por-clínica é defesa-em-profundidade, não o controle principal.

Detalhamento completo, alternativas descartadas e achados de segurança confirmados: `spec-seguranca-silo-validacao.md` (Frente 1 e Frente 5).

---

## 4. Modelo de planos

| Plano (valor no banco) | Dentistas ativos | Nota |
|---|---|---|
| Individual (`SOLO`) | 1 | inalterado |
| ~~`BASICO`~~ | — | **removido**, fundido em Clínica |
| Clínica (`CLINICA`) | **2 a 5** | gate 3→2; `limite_dentistas` 99→**5**; desconto progressivo |

### Código (`src/app/dashboard/configuracoes/plano-actions.ts`)
- `verificarStatusMigracao`: `podeAtivar: dentistasAtivos >= 2` (era `>= 3`).
- `ativarPlanoClinica`: exige `count >= 2` (era 3); `update({ plano: 'CLINICA', limite_dentistas: 5 })` (era 99).

### Migration
- `clinicas.plano` CHECK: remover `'BASICO'` do conjunto permitido.
- Migrar clínicas `plano = 'BASICO'` existentes → `'CLINICA'`.
- `UPDATE clinicas SET limite_dentistas = 5 WHERE plano = 'CLINICA' AND limite_dentistas > 5`.

### Desconto progressivo
Tabela de preço por nº de dentistas (2→5, quanto mais barato por cabeça). **Números TBD com o fundador**, entram quando montar o billing.

### Direção de billing (NÃO agora)
Assinatura migra de **por-clínica** (`clinicas.plano`) para **por-dentista**. Quando o provider (AbacatePay?) entrar, o billing vive por dentista e `clinicas.plano` vira **derivado** (nº de dentistas ativos). Esta spec só prepara o terreno; não move a assinatura.

---

## 5. Mudanças de schema (mínimas)

- `pacientes.dentista_id`: nullable hoje → **backfill dos órfãos** (atribuir ao 1º dentista da clínica, padrão da 084). Considerar `NOT NULL` depois do backfill.
- Demais tabelas: `dentista_id` já é `NOT NULL` — **sem mudança de coluna**.
- `clinicas.plano` CHECK: remover `'BASICO'`.
- **Nenhuma tabela nova.**

---

## 6. Invariantes

1. Todo paciente tem exatamente um dentista dono (`pacientes.dentista_id` preenchido).
2. Um dentista **nunca** vê dado clínico de paciente que não é seu.
3. A secretária vê todo dado clínico da clínica, mas **não atende** (não cria prontuário próprio).
4. Só o Criador (`admin`) convida/remove membros e edita config da clínica.
5. Roles no banco permanecem `admin` / `dentista` / `secretaria` — **nenhuma migração de roles**.
6. Plano é função do nº de dentistas ativos: 1 = Individual, 2–5 = Clínica; **nunca > 5** via self-service.

---

## 7. Fora de escopo (registrado, não agora)

- Billing real / gateway / números do desconto progressivo.
- Bot WhatsApp no nível da clínica (semana do WhatsApp) — a hierarquia só deixa o **gancho**.
- UI **rica** de encaminhamento (motivo, histórico, notificação ao dentista) — a transferência básica (secretária troca o responsável) entra na Fase A; o resto é depois.
- Herança do poder de convite quando o Criador sai da clínica.
- Quem "paga" pela secretária (seat) — billing futuro.
- Templates de mensagem do bot: secretária **ou** dentista (a decidir na semana do WhatsApp).

---

## 8. Faseamento

- **Fase A (núcleo):** migration de RLS (silo total) + backfill `pacientes.dentista_id` + **secretária troca o "dentista responsável" do paciente** (encaminhamento básico) + ajuste `plano-actions` (gate 2 / teto 5) + remover `BASICO` + rótulo `admin`→"Criador" na UI.
- **Fase B:** varrer `permissions.ts` e telas que assumem "admin vê tudo"; auditar server actions que listam pacientes/fichas sem filtro de dono (a RLS protege, mas UIs podem quebrar com listas vazias).
- **Fase C (semana WhatsApp):** bot no nível da clínica + templates.

---

## 9. Decisões — todas resolvidas nesta sessão

1. **Catálogo de procedimentos:** cada dentista o seu; o Criador **não** vê o dos outros (remove o privilégio de admin da 084). Coerente com "autônomo cobra os próprios preços".
2. **`horarios_disponiveis`:** dentista vê **só a própria agenda**; secretária e bot veem **todas** (precisam pra gerenciar a clínica).
3. **Reatribuição:** secretária passa o paciente; a ficha fica individual (§3). Sem transferência atômica.

---

## 10. Visão futura (registrada, muito além desta spec)

- **Rede de dentistas entre clínicas:** encaminhamento e comunicação entre dentistas de clínicas **diferentes** que usam o Odonto.IA — uma camada "rede social profissional". O encaminhamento intra-clínica desta spec é o primeiro tijolo.
- **Compartilhamento explícito de ficha** dentista→dentista (dentro ou entre clínicas), sempre ativo/consentido, nunca automático — é a ponte pra "o novo dentista não herda o histórico" da §3.
- **Bot reduz, mas não elimina, a secretária:** confirmação/agendamento via WhatsApp automatiza parte do trabalho; o recebimento presencial/fiscal mantém a secretária essencial enquanto houver transação física.
