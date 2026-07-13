# DentAI

# CLAUDE.md — CONTEXTO MESTRE ATUALIZADO — ODONTO.IA

# ODONTO.IA

Odonto.IA é um SaaS odontológico moderno focado em:

* velocidade operacional
* experiência premium
* organização inteligente do atendimento
* redução de atrito clínico
* IA útil e contextual

O objetivo NÃO é construir apenas mais um ERP odontológico.

O objetivo é construir:

# um sistema operacional inteligente para consultas odontológicas.

---

# VISÃO DO PRODUTO

O Odonto.IA NÃO deve parecer:

* ERP antigo
* software burocrático
* dashboard genérico
* sistema pesado
* chatbot aleatório com IA

O sistema deve transmitir:

* modernidade
* fluidez
* velocidade
* inteligência operacional
* experiência premium
* evolução contínua

---

# DIFERENCIAL PRINCIPAL

O diferencial NÃO é:

# “ter IA”.

O diferencial é:

* reduzir atrito no atendimento
* acelerar documentação clínica
* organizar consultas automaticamente
* estruturar fichas clínicas
* gerar planejamento consistente
* transformar atendimento em fluxo fluido

---

# PRINCÍPIO CENTRAL DO PRODUTO

O principal ativo do Odonto.IA NÃO é:

* chatbot
* automação isolada
* texto gerado aleatoriamente

O principal ativo é:

# a ficha clínica estruturada automaticamente.

---

# MODO CONSULTA — NÚCLEO DO PRODUTO

O modo consulta é a principal experiência do sistema.

Objetivo:

# permitir atendimento rápido, organizado e fluido.

Fluxo:

Consulta
↓
captura livre
↓
estruturação IA
↓
ficha clínica
↓
planejamento
↓
apresentação visual
↓
orçamento

---

# COMO A IA DEVE FUNCIONAR

A IA NÃO deve:

* inventar diagnósticos
* agir como dentista
* responder excessivamente criativa
* depender de texto livre sem estrutura

A IA deve:

* organizar
* estruturar
* resumir
* acelerar documentação
* melhorar produtividade
* gerar respostas previsíveis

---

# PRINCÍPIO DA IA

# IA operacional > IA conversacional

Priorizar:

* previsibilidade
* velocidade
* estruturação
* contexto clínico
* utilidade real

---

# PIPELINE DE IA

Sempre estruturar:

Whisper/Gemini
↓
correção odontológica
↓
estruturação JSON
↓
ficha clínica
↓
planejamento
↓
texto técnico
↓
apresentação visual

---

# RESPOSTAS DE IA — REGRA OBRIGATÓRIA

NUNCA depender apenas de texto livre.

Sempre preferir estruturas JSON tipadas.

Exemplo:

```json
{
  "queixa_principal": "",
  "dentes": [],
  "procedimentos": [],
  "observacoes": "",
  "prioridade": ""
}
```

---

# DEX — NOVA DIREÇÃO

O Dex NÃO é mais:

* chatbot genérico
* assistente aberto
* “IA conversacional”

O Dex agora é:

# a identidade inteligente do sistema.

---

# O DEX DEVE SER USADO EM

* loaders
* processamento IA
* feedback visual
* modo consulta
* geração de planejamento
* estados inteligentes
* análises clínicas

---

# TOM DO DEX

Transmitir:

* clareza
* inteligência
* velocidade
* confiança
* modernidade

Evitar:

* personalidade infantil
* excesso de humor
* exagero futurista

---

# VISÃO DO PLANEJAMENTO

O planejamento NÃO é apenas documento técnico.

Ele deve funcionar como:

# ferramenta visual de conversão para o paciente.

Objetivos:

* facilitar entendimento
* parecer premium
* melhorar fechamento
* transmitir profissionalismo

---

# STACK PRINCIPAL

| Camada        | Tecnologia                  |
| ------------- | --------------------------- |
| Framework     | Next.js App Router          |
| Linguagem     | TypeScript estrito          |
| Banco         | Supabase Postgres + RLS     |
| Auth          | Supabase Auth               |
| Storage       | Supabase Storage            |
| UI            | Tailwind CSS v4 + shadcn/ui |
| Animações     | Framer Motion               |
| Mobile futuro | React Native + Expo         |

---

# REGRAS DE CÓDIGO

* TypeScript estrito
* NUNCA usar `any`
* funções sempre tipadas
* tratar erros explicitamente
* componentes desacoplados
* lógica isolada em services/hooks
* evitar duplicação
* evitar overengineering
* evitar abstrações excessivas

---

# ESTRUTURA RECOMENDADA

```text
src/
  app/
  components/
  hooks/
  services/
  lib/
  types/
```

---

# ARQUITETURA

Priorizar:

* separação de responsabilidades
* services reutilizáveis
* hooks reutilizáveis
* APIs organizadas
* componentes pequenos
* previsibilidade

Evitar:

* lógica pesada dentro de componentes
* middleware excessivamente complexo
* fetch espalhado
* acoplamento forte

---

# MULTI-CLÍNICA

O sistema deve suportar:

* múltiplas clínicas
* troca de clínica
* roles por clínica
* dentistas em mais de uma clínica

Toda tabela multi-tenant deve:

* possuir `clinica_id`
* possuir RLS
* garantir isolamento seguro

NUNCA fazer query sem:

```sql
WHERE clinica_id = active_clinica_id
```

---

# UX — DIREÇÃO PRINCIPAL

O sistema deve parecer:

* rápido
* fluido
* moderno
* limpo
* elegante

Priorizar:

* poucos cliques
* baixa fricção
* clareza visual
* velocidade operacional

---

# DESIGN SYSTEM — REGRAS OBRIGATÓRIAS

SEMPRE usar:

* tokens do design system
* variáveis CSS
* componentes padronizados

NUNCA:

* usar cores hardcoded
* criar componentes inconsistentes
* quebrar dark mode

---

# PADRÃO VISUAL

O sistema deve transmitir:

# software premium moderno.

Evitar:

* poluição visual
* dashboards exagerados
* excesso de cards
* excesso de informações simultâneas

---

# MICROINTERAÇÕES

Sempre priorizar:

* animações suaves
* hover states leves
* feedback visual claro
* loaders elegantes
* skeletons consistentes

Animações devem:

# ser sentidas, não percebidas.

---

# DEX LOADER

Criar e reutilizar:

# DexLoader

Com:

* animação suave
* identidade premium
* suporte dark/light mode
* visual consistente

---

# DARK MODE

Obrigatório funcionar perfeitamente.

NUNCA usar:

* cores hardcoded
* bg-white
* text-black
* gray hardcoded

Sempre usar:

* bg-background
* bg-card
* text-foreground
* text-muted-foreground
* border-border

---

# MOBILE FUTURO

O sistema deve ser preparado para:

# app híbrido futuramente.

Então:

* separar lógica da UI
* evitar dependência excessiva de SSR
* centralizar autenticação
* criar APIs reutilizáveis

---

# PERFORMANCE

Priorizar:

* Promise.all
* loading states
* Suspense
* skeletons
* evitar re-render desnecessário

---

# WHATSAPP

O WhatsApp NÃO deve parecer:

* bot genérico
* automação robótica

Deve parecer:

# extensão natural da clínica.

Prioridades:

* confirmação
* lembrete
* follow-up
* recuperação
* envio de orçamento

---

# RETENÇÃO

Retenção deve vir de:

* experiência excelente
* velocidade operacional
* IA útil
* evolução contínua
* sensação de produto vivo

---

# EVOLUÇÃO CONTÍNUA

O Odonto.IA deve transmitir:

* produto vivo
* melhoria constante
* construção junto com clínicas reais

Implementar:

* changelog
* feedback interno
* melhorias contínuas
* comunicação próxima dos usuários

---

# DIREÇÃO DE COMUNICAÇÃO

Focar em:

* modernidade
* evolução
* fluidez
* inteligência operacional
* proximidade

---

# O QUE EVITAR

NÃO transformar o sistema em:

* ERP enterprise complexo
* dashboard genérico
* chatbot de IA aleatório
* sistema burocrático

---

# FILOSOFIA PRINCIPAL

Antes de implementar qualquer funcionalidade, perguntar:

# isso reduz atrito operacional do dentista?

Se NÃO:
reavaliar a feature.

---

# OBJETIVO FINAL

Construir:

# o sistema odontológico mais moderno, fluido e inteligente para consultas clínicas.

<!-- SAAS-BASE-RULES:START — bloco gerenciado pelo setup. Editável, mas o install.ps1 atualiza entre os marcadores. -->
## Regras do setup (SaaS Base)

Estas regras valem em **toda sessão**, antes de qualquer tarefa.

### 1. Debater, não bajular
Não concorde comigo por padrão. Seu trabalho é **afinar o trabalho**, não preservar minha autoestima.

**Sem abertura elogiosa.** Zero "ótima pergunta", "faz sentido", "exatamente", "que ideia interessante" — nem como lubrificante antes de discordar. Se a ideia for boa, vai ficar evidente no mérito.

**Proativo com pontos cegos.** Não espere ser desafiado. Se eu não considerei algo relevante — um risco, uma alternativa melhor, uma premissa errada — traga *antes* de eu perguntar. Esse é o trabalho.

**Quando pressionar:**
- Primeiro entenda a tese, depois pressione. Traga o **melhor contra-argumento** que existe — com fonte real quando for fato.
- Defenda a posição contrária quando ela for mais forte, mesmo que eu prefira a minha.
- Isso vale para **estratégia de implementação, rumo de funcionalidades, e marketing/vendas/posicionamento**.
- Para um debate fundo, use o agente `thinking-partner` (ideias/produto) ou `business-strategist` (mercado/vendas).

> Critério de acerto: saio da conversa com o *trabalho melhor* — não com a autoestima preservada. Se saio com a mesma ideia mas mais fundamentada, ou honestamente abalado, você acertou.

### 2. Discutir antes de implementar
Funcionalidade nova **não começa no código**. O fluxo obrigatório para qualquer feature não-trivial:
1. **Escopo** — qual o problema real, abordagem e trade-offs (`intent-driven-development` se vago)
2. **Spec** — contrato técnico: types, API, schema, invariantes (`spec-driven`, salvo em `plans/specs/`)
3. **Brief de design** — se a feature tem UI nova, `design-brief` antes de qualquer componente
4. **Código** — implementação executa contra a spec, não improvisa
5. **Verificação** — gates de aceite conferidos (`qa-web`)

Se eu pedir pra "já fazer", confirme o escopo em uma linha e avalie se a spec é necessária antes de codar. Features com > 1 arquivo ou qualquer mudança de schema/API sempre passam pela spec.

### 3. Enxuto por padrão
Menos código que resolve > mais código "completo". Siga a disciplina do `ponytail`: YAGNI, reusar o que já existe, stdlib/plataforma antes de dependência nova. Nunca traga abstração especulativa.

### 4. Design tem pipeline — siga a ordem
Toda tela ou componente novo passa pelo pipeline abaixo. Pular etapas é a causa nº 1 de AI slop.

**Pipeline obrigatório:**
1. **Brief** — `design-brief` define paleta exata (161 opções por tipo de produto), estilo visual (catálogo de 71) e font pairing (73 opções). Nunca comece UI sem DESIGN.md.
2. **Exploração** — `design-shotgun` gera 4 variantes com direções radicalmente diferentes antes de commitar. Use quando a direção visual não está clara.
3. **Implementação** — `frontend-design` para telas de marca (landing, hero, marketing). `tailwind-shadcn` + `design-system-tokens` para telas de produto (dashboards, formulários).
4. **Motion** — `motion-react` para implementar animações React (variants, AnimatePresence, layoutId, scroll). `design-motion-principles` para decidir SE e QUANTO animar (frequency gate, Emil/Jakub/Jhey). `gsap-core` só para timelines complexas ou sites vanilla.
5. **Auditoria** — `design-review` no renderizado antes de subir. Agente `design-polish` aplica as correções.

**Proibido em qualquer tela:** gradiente roxo/azul→roxo, grid de 3 colunas com ícone em círculo colorido, border-radius bubbly uniforme em tudo, copy genérica ("Unlock the power of…"), Inter como única fonte sem escolha intencional.

### 5. Ritual de sessão (abre e fecha)
- **Abertura:** quando eu cumprimentar pra começar ("bom dia", "boa tarde", "boa noite", "tudo bem Claude"), rode a skill `session-start` — leia o último handoff em `plans/handoffs/` e me dê o recap (onde paramos, próximo passo, erros em aberto, o que eu cogitava) antes de tocar em código.
- **Fechamento:** quando eu disser que vou parar ("vou dormir", "terminamos por hoje", "encerra"), rode a skill `handoff` e salve em `plans/handoffs/` — o que concluímos, os erros, **como eu estava pensando em resolver**, o que ficou e o que eu cogitava.
- A pasta `plans/` é **append-only** — é a memória do projeto, nunca apague. Organizada por tipo: `plans/handoffs/` (handoffs de sessão), `plans/specs/` (contratos técnicos), `plans/roadmap/` (planos mestres).

### 6. Modos de trabalho — discussão, planejamento, execução
Existem três modos, e eles **não se misturam** (o atrito nº1 é discutir, planejar e codar meio a meio na mesma sessão). **Quem ativa o modo é o usuário**, quando achar necessário — eu não tento adivinhar pela saudação nem pelo handoff anterior.

- **Discussão** — debater ideia, direção de produto, arquitetura ou mercado, **sem compromisso ainda**. Não escreve spec, não coda. A regra 1 vale com força total aqui: traga sempre **outro ponto de vista**, cubra várias possibilidades — o objetivo é abrir opções, não fechar decisão cedo.
- **Planejamento** — discute, escopa, decide, **escreve spec** (regra 2). Não coda produção — no máximo investigação read-only ou spike descartável.
- **Execução** — coda + testa + commita/deploya contra a spec (as tarefas são derivadas dela na hora, não de um checklist separado). **Não re-escopa** — o que não estiver especificado volta pro planejamento.

**Equipe de cada modo — quem eu aciono:**

| Modo | Agentes | Skills de apoio |
|---|---|---|
| **Discussão** | `thinking-partner` (ideia/produto), `business-strategist` (mercado/vendas) | `research`, `_obsidian` |
| **Planejamento** | `planner` (plano + spec) | `intent-driven-development`, `spec-driven`, `design-brief` (se UI) |
| **Execução** | *(eu, thread principal, codo)* | `next-app-router`, `supabase-patterns`, `tailwind-shadcn`, `zod-validation`, `ai-integration`, `error-handling`, `saas-patterns`, `ponytail` |
| **Auditoria** *(gate antes de commitar/mergear)* | `typescript-reviewer`, `ux-reviewer`, `design-polish` | `qa-web`, `design-review`, `ponytail-review`, skill `/security-review` |

**Regra de acionamento:** ao entrar num modo eu **proponho** qual equipe vou acionar e por quê, e **espero seu ok** — nunca disparo um subagent sozinho. Agentes não se coordenam entre si; **eu** os aciono na ordem e junto os resultados. A **Auditoria** é o gate final da execução: reviewers rodam antes do commit/merge, `design-polish` aplica os fixes que o `design-review` diagnostica, `qa-web` valida no fim.

### 7. Autonomia — quando agir e quando parar
Decisão **reversível** (código ainda não commitado, arquivo local, escolha que dá pra desfazer): aja com o melhor julgamento, não pare pra perguntar. Decisão **cara ou irreversível** (push, deploy, apagar dado, mudar schema em produção, gastar dinheiro): pare e confirme antes. Na dúvida sobre qual é, trate como cara.
