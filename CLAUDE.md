# Odonto.IA — regras de trabalho

SaaS odontológico multi-clínica. Núcleo do produto: **modo consulta** — o dentista fala, a
IA estrutura, a ficha clínica nasce pronta (captura → estruturação → ficha → planejamento →
orçamento). O principal ativo é **a ficha clínica estruturada automaticamente**.

> **Visão de produto** (Dex, planejamento como conversão, WhatsApp, retenção, mobile):
> `docs/PRODUTO.md`. Leia quando a conversa for de direção de produto — não carrega regra de código.

**Filtro de toda feature:** isso reduz atrito operacional do dentista? Se não, reavalie.

## Stack (conferido no código em 2026-07-21)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 App Router · React 19 · TypeScript estrito |
| Banco / Auth / Storage | Supabase (Postgres + **RLS**) |
| UI | Tailwind v4 + shadcn/ui · lucide-react |
| Animação | Motion v12 (`motion/react`) |
| IA | Groq (llama-3.3-70b + whisper) e Gemini 2.5 Flash — `src/lib/ai/provider.ts` |
| Infra | Upstash (rate limit) · Resend (email) · WhatsApp Meta API (`src/lib/whatsapp/`) |

Mobile (React Native) é direção futura, **não stack atual**. O que importa hoje por causa
disso: lógica separada da UI, auth centralizada, APIs reutilizáveis.

## Estrutura

```text
src/
  app/         rotas (App Router)
  components/  UI — componentes finos, sem lógica pesada
  hooks/       estado e efeitos reutilizáveis
  lib/         clients e utilitários (ai/, whatsapp/, …)
  server/      autorização e lógica server-side
  services/    regras de negócio
  types/
```

## Regras de código

- TypeScript estrito. **Nunca `any`.** Funções tipadas, erros tratados explicitamente.
- Lógica mora em services/hooks/server — nunca pesada dentro de componente. Fetch centralizado, não espalhado.
- Componentes pequenos e desacoplados. Sem abstração especulativa, sem overengineering.
- Reusar o que existe antes de criar. Evitar duplicação.

## Multi-clínica — inegociável

- Toda tabela multi-tenant tem `clinica_id` + RLS. Roles por clínica; dentista pode estar em mais de uma.
- **Nunca** query sem `WHERE clinica_id = active_clinica_id`.
- Mudança de RLS **só entra com teste de 2 contas logadas** — script não pega furo de policy.
- **Não confie em `supabase_migrations.schema_migrations`** — tem buracos (aplicações via
  editor SQL do dashboard não registram). Pra saber se algo está no ar, cheque o objeto no schema.

## IA

- **IA operacional > IA conversacional.** Organiza, estrutura, resume, acelera documentação.
  Nunca inventa diagnóstico, nunca age como dentista. Respostas previsíveis.
- **Saída sempre JSON tipado** com `responseSchema` (`generateStructuredGemini`) — nunca
  texto livre parseado na mão.
- Providers reais em `src/lib/ai/provider.ts`. Toda chamada passa `feature` (logger mede latência e custo).
- Prompt de extração clínica só muda **com eval rodado antes e depois** — precisão em
  prontuário é inegociável; perda silenciosa de dado é o pior modo de falha.

## Design — regras duras

- **Tokens sempre:** `bg-background` · `bg-card` · `text-foreground` · `text-muted-foreground` · `border-border`.
- **Proibido:** `bg-white`, `text-black`, `gray-*` e qualquer cor hardcoded — quebra dark mode.
- Dark **e** light impecáveis. Light mode tem histórico de contraste ruim — confira sempre os dois.
- **Referência oficial: Dashboard e Tratamento.** Antes de dar tela por pronta, a pergunta
  obrigatória: *"parece feita pela mesma equipe que fez o Dashboard e o Tratamento?"* Se não, não acabou.
- Processamento de IA usa **`DexLoader`** (`src/components/ui/dex-loader.tsx`) — já existe, não crie outro loader.
- Motion: **sentida, não percebida.** Hover leve, feedback claro, skeletons consistentes.
- Pipeline de design do setup (regra 4 do bloco abaixo) vale em toda tela nova.

## Performance

`Promise.all` em fetches independentes · Suspense + skeletons · loading state em toda ação
perceptível · evitar re-render desnecessário.

## Artefatos

Mockups HTML em `plans/artefatos/R-NN-{slug}.html`. **Como ler e usar: skill `artefato-visual`**
(servir por HTTP local, extrair tokens por JS, escrever em texto na spec — nunca `Read` no
HTML nem `file://`).

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

### 3. Enxuto por padrão — em código **e** em documento
Menos código que resolve > mais código "completo". Siga a disciplina do `ponytail`: YAGNI, reusar o que já existe, stdlib/plataforma antes de dependência nova. Nunca traga abstração especulativa.

**A mesma disciplina vale pro que eu escrevo em `plans/`.** Documento inchado não é zelo — é o modo de falha nº 1 do setup: instrução espalhada por 50 seções deixa de ser instrução, e o modelo cumpre só um pedaço. Quem produz esse volume sou eu, então o limite é meu:

| Documento | Teto | Estourou = |
|---|---|---|
| `ESTADO.md` | ~80 linhas | Está virando handoff. Corte pro que está ativo agora |
| `ROADMAP.md` | ~200 linhas | Detalhe vazou pra dentro do mapa. Manda pra spec |
| Spec | ~300 linhas | **O item é grande demais.** Quebre em sub-itens, não escreva mais |

Teto estourado é **sinal de erro de recorte**, nunca licença pra escrever mais. Nunca repita entre documentos: informação em dois lugares diverge, e aí nenhum dos dois é confiável.

### 4. Design tem pipeline — siga a ordem
Toda tela ou componente novo passa pelo pipeline abaixo. Pular etapas é a causa nº 1 de AI slop.

**Tela nova** — pipeline completo:
1. **Brief** — `design-brief` define paleta exata (161 opções por tipo de produto), estilo visual (catálogo de 71) e font pairing (73 opções). Nunca comece UI sem DESIGN.md.
2. **Exploração** — `design-shotgun` gera 4 variantes com direções radicalmente diferentes antes de commitar. Use quando a direção visual não está clara.
3. **Implementação** — `frontend-design` para telas de marca (landing, hero, marketing). `tailwind-shadcn` + `design-system-tokens` para telas de produto (dashboards, formulários).
4. **Motion** — `motion-react` para implementar animações React (variants, AnimatePresence, layoutId, scroll). `design-motion-principles` para decidir SE e QUANTO animar (frequency gate, Emil/Jakub/Jhey). `gsap-core` só para timelines complexas ou sites vanilla.
5. **Auditoria** — `design-review` no renderizado antes de subir. Agente `design-polish` aplica as correções.

**Redesign de tela que já existe** — caminho próprio, mais curto e mais travado:
`templates/spec-redesign.md`. Ele existe porque mexer no que funciona tem um risco que
tela nova não tem: **quebrar regra de negócio enquanto se muda aparência.**

1. **Inventário** — eu levanto componentes, cores, espaçamentos e onde a lógica está acoplada à apresentação. **Não altero nada.** Você confere.
2. **Trava de segurança (§2)** — o que **não** pode mudar: nomes de campos, regras de negócio, chamadas de API, schema, fluxo de navegação. Por padrão: **apresentação muda, o resto não.**
3. **Você escreve o §3** — "o que eu quero", em português comum, com a tabela *como está / como quero* por elemento. **Essa seção eu não preencho.** Se eu escrever o que acho que você quer, o resto vira ficção — e é exatamente aí que eu alucino.
4. **Tokens (§4)** — se há artefato, extraio com `artefato-visual`; nunca deduzo cor de screenshot.
5. **Uma tela de referência primeiro** — protótipo em artefato → sua aprovação visual → código em **uma** tela → localhost → produção → só então replicar nas demais. Replicar antes da aprovação multiplica o erro.

**Artefato:** ver a skill `artefato-visual`. Nunca `Read` no HTML nem `file://` — serve por HTTP local, abre no browser, extrai os tokens por JS e escreve **em texto** na spec.

**Proibido em qualquer tela:** gradiente roxo/azul→roxo, grid de 3 colunas com ícone em círculo colorido, border-radius bubbly uniforme em tudo, copy genérica ("Unlock the power of…"), Inter como única fonte sem escolha intencional.

### 5. Ritual de sessão e memória do projeto (`plans/`)
- **Abertura:** quando eu cumprimentar pra começar ("bom dia", "boa tarde", "boa noite", "tudo bem Claude"), rode a skill `session-start` — leia `plans/ESTADO.md` (e o último handoff se precisar do raciocínio) e me dê o recap antes de tocar em código.
- **Fechamento:** quando eu disser que vou parar ("vou dormir", "terminamos por hoje", "encerra"), rode a skill `handoff` — salva o handoff da sessão **e reescreve `plans/ESTADO.md`**.
- **Estrutura de `plans/` — cada arquivo é dono de um dado, sem sobreposição:**
  - `ESTADO.md` — **o agora**: item ativo, o que falta nele, o que trava, decisões esperando o usuário. Reescrito toda sessão. Nunca lista a fila nem os concluídos.
  - `ROADMAP.md` — **o mapa**: fila, status de cada item, histórico. Nunca detalha o interior do item ativo. **Roadmap é mapa, spec é conteúdo** — detalhe duplicado nos dois diverge, e aí nenhum é confiável.
  - `specs/R-NN-{slug}.md` — contrato do item; 1 doc que cresce em fases (debate → plano → contrato → aprovada).
  - `artefatos/R-NN-{slug}.html` — mockups gerados pelo Claude. Cabeçalho obrigatório em comentário HTML (item, rota alvo, componente alvo, data, status). **Nunca lidos pro contexto** — abrem no browser pra comparar com a tela real. Os tokens que a implementação segue ficam na spec, em texto.
  - `auditorias/YYYY-MM-DD-{escopo}.md` — relatórios de auditoria completa.
  - `handoffs/` — só os 3 mais recentes; o resto vai pro arquivo no fechamento.
  - `_arquivo/` — specs, handoffs e artefatos de itens fechados. Mover é `git mv`; **deletar é proibido**.
- **Fechar item é ato atômico:** marcar ✅ no `ROADMAP.md` e mover spec + artefato pro `_arquivo/` acontecem na mesma edição — nunca separados.
- **Precedência — quando duas fontes discordam, esta é a ordem:**
  1. **O que você acabou de dizer nesta conversa** — sempre vence documento
  2. **Spec `aprovada` do item ativo** — o contrato do que estamos fazendo
  3. **`CLAUDE.md`** — as regras permanentes do projeto
  4. **`ROADMAP.md` / `ESTADO.md`** — o mapa e o agora
  5. **Handoffs e `_arquivo/`** — histórico. **Nunca** governam decisão presente

  Nada fora dessa lista é fonte. Se eu achar conflito, **paro e te mostro os dois** em vez de escolher sozinho e seguir.
- **O que você me mostra vira texto na hora.** Print, gravação de tela ou coisa apontada ao vivo **não sobrevive à sessão** — some do contexto e a próxima sessão não tem como saber. No momento em que você mostra, eu registro a **observação em texto** (não a imagem) no `ESTADO.md` ou na spec: *"botão de salvar fica atrás do teclado no mobile"*. Se eu não escrever, você vai ter que mostrar de novo.
- **Status (vocabulário fechado):** ⏳ fila · 🔵 ativo (máx **1** no projeto) · 🟡 no ar mas **não verificado** · ✅ no ar **e verificado** · 🧊 congelado (com motivo e condição de voltar) · ✂️ cortado (com motivo). **Código escrito ≠ código verificado** — 🟡 se trata como não-feito. Typecheck, lint e build não pegam o que quebra de verdade.

### 6. Modos de trabalho — discussão, planejamento, execução
Existem três modos, e eles **não se misturam** (o atrito nº1 é discutir, planejar e codar meio a meio na mesma sessão). **Quem ativa o modo é o usuário**, quando achar necessário — eu não tento adivinhar pela saudação nem pelo handoff anterior.

- **Discussão** — debater ideia, direção de produto, arquitetura ou mercado, **sem compromisso ainda**. Não escreve spec, não coda. A regra 1 vale com força total aqui: traga sempre **outro ponto de vista**, cubra várias possibilidades — o objetivo é abrir opções, não fechar decisão cedo.
- **Planejamento** — discute, escopa, decide, **escreve spec** (regra 2). Não coda produção — no máximo investigação read-only ou spike descartável.
- **Execução** — coda + testa + commita/deploya contra a spec (as tarefas são derivadas dela na hora, não de um checklist separado). **Não re-escopa** — o que não estiver especificado volta pro planejamento.

**Fora dos modos: trabalho pontual (`/pontual`).** Bug óbvio, ajuste de texto, espaçamento, config — coisa pequena que não justifica spec. Sem item de roadmap, sem spec, **com limite rígido**: schema/API/auth/RLS, mais de ~3 arquivos ou ~50 linhas, ou mudança de comportamento que alguém usa → **paro e vira item ⏳**. Estourar o limite não é motivo pra pedir permissão e seguir; é motivo pra fechar a faixa rápida. Obrigar spec pra ajustar um espaçamento faz o setup ser ignorado — e setup ignorado apodrece igual à bagunça.

**Equipe de cada modo — quem eu aciono:**

| Modo | Agentes | Skills de apoio |
|---|---|---|
| **Discussão** | `thinking-partner` (ideia/produto), `business-strategist` (mercado/vendas) | `research`, `_obsidian` |
| **Planejamento** | `planner` (plano + spec) | `intent-driven-development`, `spec-driven`, `design-brief` (se UI) |
| **Execução** | *(eu, thread principal, codo)* | `next-app-router`, `supabase-patterns`, `tailwind-shadcn`, `zod-validation`, `ai-integration`, `error-handling`, `saas-patterns`, `ponytail` |
| **Auditoria** *(gate antes de commitar/mergear)* | `typescript-reviewer`, `ux-reviewer`, `design-polish` | `qa-web`, `design-review`, `ponytail-review`, skill `/security-review` |

**Regra de acionamento:** ao entrar num modo eu **proponho** qual equipe vou acionar e por quê, e **espero seu ok** — nunca disparo um subagent sozinho. Agentes não se coordenam entre si; **eu** os aciono na ordem e junto os resultados. A **Auditoria** é o gate final da execução: reviewers rodam antes do commit/merge, `design-polish` aplica os fixes que o `design-review` diagnostica, `qa-web` valida no fim.

**Dois níveis de auditoria — não confundir:**

| | `/auditar` (gate) | `/auditar completa [área]` |
|---|---|---|
| **Quando** | Antes de commitar/mergear o item ativo | Periódica — antes de release, ou quando os 🟡 acumulam |
| **Escopo** | Só o que o item mudou, contra os gates da spec | Todas as rotas, todos os botões, todos os fluxos |
| **Saída** | Passa / não passa | Relatório em `plans/auditorias/`, achados viram ⏳ na fila, 🟡 verificados viram ✅ |

A auditoria completa é a **única máquina que promove 🟡 → ✅**. Ela usa a skill `auditoria-completa` e **roda em localhost com seed ou clínica de teste** — nunca clica em botão que cria/altera/apaga dado em produção.

### 7. Autonomia — quando agir e quando parar
Decisão **reversível** (código ainda não commitado, arquivo local, escolha que dá pra desfazer): aja com o melhor julgamento, não pare pra perguntar. Decisão **cara ou irreversível** (push, deploy, apagar dado, mudar schema em produção, gastar dinheiro): pare e confirme antes. Na dúvida sobre qual é, trate como cara.

**Commit e push (`/commit`).** Um commit por mudança que **possa ser revertida sozinha**. Nunca misturam: migration/schema · `plans/` · refactor · dependência nova · fix vs. feature. **Teste do "+":** se a mensagem precisa de "+", de "e" juntando assuntos, ou de dois prefixos `tipo(escopo)`, são N commits — a mensagem está confessando. Acima de ~15 arquivos, pare e reexamine.

**Push nunca é automático.** Antes de propor: o que sobe está verificado (não só compilando), migration vai primeiro e sozinha, mudança de RLS/permissão passou por teste com 2 contas logadas. **Com usuário real em produção, lote pequeno e frequente ganha de lote grande** — represar commits maximiza a superfície de mudança e destrói a chance de isolar o que quebrou. Se eu não sei como voltar atrás, esse é o motivo pra não subir ainda.
<!-- SAAS-BASE-RULES:END -->
