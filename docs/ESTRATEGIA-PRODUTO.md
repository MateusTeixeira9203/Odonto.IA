# Estratégia de Produto — Odonto.IA

> **Bússola de decisões.** Antes de aprovar qualquer feature de onboarding, ativação ou retenção, pergunte: *isso serve ao momento de valor e fecha o loop do Hook?* Se não, reavalie.

Última revisão: 2026-06-13

---

## 1. Momento de valor (a estrela-guia)

> **A primeira vez que o dentista fala/dita durante a consulta e vê a ficha aparecer estruturada sozinha — diagnóstico, dentes marcados, procedimentos — sem digitar uma palavra.**

Não é "abrir o Modo Consulta". É **ver a mágica acontecer**. Esse é o evento exato que prova o benefício.

**Implicações que já guiam o produto:**

| Decisão | Por quê |
|---|---|
| Rota `/consulta/demo` (dia 0) | Entrega o momento de valor sem exigir cadastro de paciente nem agendamento |
| Métrica de TTV = tempo até 1ª ficha `origem = 'modo_consulta'` | A coluna `fichas.origem` mede exatamente isso |
| Emails D0/D1 empurram para a demo | O momento precisa acontecer nos primeiros 1–2 dias (ver §4) |
| Item-chave do checklist de ativação | "Ver a primeira ficha estruturada pelo DEX" |

---

## 2. Gatilho interno (5 porquês)

> **"Ele sente _ansiedade de não dar conta da documentação_ quando _termina uma consulta e ainda precisa registrar tudo manualmente_."**

Cadeia dos 5 porquês até a raiz emocional:

1. O dentista quer agilidade → porque vive correndo entre pacientes
2. Por que isso incomoda? → documentar rouba tempo e ele atrasa a agenda
3. Por que isso pesa? → ou atende bem e a papelada acumula, ou faz a papelada e leva trabalho pra casa
4. Por que isso dói? → sensação de estar sempre devendo
5. **Raiz:** ansiedade de não dar conta — medo de que algo da consulta se perca, culpa por levar trabalho pra casa

**Atenção:** "agilidade" e "organização" são o que o dentista *deseja* (a solução). O gatilho que move o comportamento é a **dor emocional** acima. Comunicação e recompensa diária devem falar com o **alívio dessa ansiedade** ("você terminou o dia com tudo registrado"), não apenas com "seja rápido".

---

## 3. Mapa do Hook

```
GATILHO  →  AÇÃO  →  RECOMPENSA VARIÁVEL  →  INVESTIMENTO
   ↑                                              │
   └──────────────────────────────────────────────┘
```

### Gatilho
- **Externos:** email D0/D1/D3/D7, card "próxima consulta" no DEX, agenda do dia, notificação de consulta agendada
- **Interno:** a ansiedade de não dar conta da documentação ao encerrar uma consulta (§2)

### Ação
A ação mais simples possível em antecipação à recompensa:
- **Falar durante a consulta** (o dentista já faz isso naturalmente) **+ 1 clique em "Organizar com DEX"**
- Atrito mínimo é proposital — quanto mais perto de "só falar", maior a adoção

### Recompensa variável
O que **varia** a cada uso (e por isso prende):
- **A ficha estruturada que aparece** — cada paciente é diferente, cada ficha é uma pequena "surpresa" de quão bem ficou organizada
- **Dentes marcados automaticamente** e alertas clínicos detectados — varia e surpreende
- **Resumo do dia no DEX** — o que ele realizou, atualizado diariamente
- Tipo de recompensa (Hooked): **Reward of the Self** — domínio e competência, a sensação de "dei conta"

### Investimento
Trabalho que o usuário deposita e que **carrega o próximo gatilho** e aumenta o custo de saída:
- **Primeira sessão:** configurar a tabela de procedimentos (step do onboarding)
- **Uso contínuo:** cada ficha salva enriquece o histórico do paciente → na próxima consulta o DEX já chega com contexto (última queixa, planejamento, alertas) → mais valor, sem esforço extra
- **Assinatura, planejamento e orçamento** — cada artefato criado torna o sistema mais difícil de abandonar e melhora a próxima experiência

---

## 4. Modelo de entrada (decisão MOAT)

> **Modelo escolhido: trial de 14 dias → freemium limitado (read-only).** Não é trial puro.

### Por que trial e não freemium
- O valor está no **uso recorrente** (toda consulta), não esporádico. Freemium deixaria o dentista usar de vez em quando pra sempre, sem nunca formar hábito — péssimo para um produto que precisa virar rotina.
- O DEX **substitui um fluxo de trabalho** (documentação). Não dá pra meio-adotar: ou ele confia a ficha ao DEX, ou não. Freemium fragmenta essa confiança.
- 14 dias ≈ consultas suficientes para o hábito se formar — *desde que a ativação seja precoce*.

### O híbrido (o que já construímos)
No D14, ao expirar o trial:
- **Bloqueia** o Modo Consulta (o ativo central)
- **Mantém** fichas e histórico acessíveis (read-only)

Isso é um **freemium limitado**, não um corte total. Mantém o investimento do usuário visível (custo de saída) e deixa a porta aberta para conversão.

### ⚠️ Risco registrado
**14 dias só funciona se a ativação acontecer nos primeiros 1–2 dias.** Se o dentista só tocar no Modo Consulta no dia 10, o trial expira antes do hábito formar. Por isso:

- `/consulta/demo` no dia 0 **não é "nice to have"** — é o que faz o trial dar certo
- Emails D0/D1 empurrando para o momento de valor são parte estrutural do modelo, não enfeite

O sistema de ativação (demo + emails + checklist de primeiros passos) **é a condição de sucesso do trial de 14 dias.**

---

## 5. Métrica de precificação

**Per-seat (por dentista):** Solo R$249/mês · Clínica R$179/dentista/mês (mín. 3).

A métrica de valor cresce junto com o sucesso do cliente: mais dentistas usando = mais fichas estruturadas = mais valor capturado. Alinhada ao uso real do ativo central.
