# Design System e Artefatos

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: governança de design e artefatos

## Problema que este protocolo resolve

Evitar que uma tela nova reutilize um artefato antigo ou incompatível apenas porque ele possui relação textual com a funcionalidade.

## Regras

### 1. Um artefato ativo por objetivo

Cada fluxo/tela deve apontar para:

- artefato ativo;
- versão;
- status;
- data;
- telas cobertas.

### 2. Artefato antigo não é requisito

Status:

- `ACTIVE`
- `SUPERSEDED`
- `ARCHIVED`
- `DRAFT`
- `REFERENCE_ONLY`

`EXPLORATION_ONLY` é finalidade: manter o artefato como `DRAFT` ou `REFERENCE_ONLY`.

Somente `ACTIVE` pode dirigir implementação.

### 3. Design System antes de mockup

Antes de criar componente novo, verificar:

- tipografia;
- espaçamento;
- grid;
- botões;
- inputs;
- tabelas;
- cards;
- modais;
- menus;
- estados vazios;
- alertas;
- feedback;
- responsividade.

### 4. Consistência entre telas

Antes de aprovar tela nova:

- comparar com telas equivalentes;
- eliminar padrões concorrentes;
- reduzir densidade visual;
- reutilizar componentes.

### 5. Critério de simplicidade

Se duas soluções atendem igualmente ao requisito, escolher a com:

- menos estados;
- menos cliques;
- menos componentes novos;
- menos regras especiais;
- menor custo cognitivo;
- menor superfície de regressão.

### 6. Artefato de design

Cada artefato deve declarar:

```text
STATUS:
FLOW:
TARGET_USER:
RELATED_REQUIREMENT:
REPLACES:
DO_NOT_COMBINE_WITH:
```

### 7. Auditoria visual

Avaliar:

- hierarquia;
- densidade;
- alinhamento;
- espaçamento;
- consistência;
- feedback de ações;
- estados vazios;
- acessibilidade;
- responsividade;
- excesso de informação;
- ações primárias concorrentes.

## Pipeline local preservado

Toda tela ou componente novo passa pelo pipeline abaixo. Pular etapas é a causa nº 1 de AI slop.

**Tela nova** — pipeline completo:
1. **Brief** — `design-brief` define paleta exata (161 opções por tipo de produto), estilo visual (catálogo de 71) e font pairing (73 opções). Nunca comece UI sem DESIGN.md.
2. **Exploração** — `design-shotgun` gera 4 variantes com direções radicalmente diferentes antes de commitar. Use quando a direção visual não está clara.
3. **Implementação** — `frontend-design` para telas de marca (landing, hero, marketing). `tailwind-shadcn` + `design-system-tokens` para telas de produto (dashboards, formulários).
4. **Motion** — `motion-react` para implementar animações React (variants, AnimatePresence, layoutId, scroll). `design-motion-principles` para decidir SE e QUANTO animar (frequency gate, Emil/Jakub/Jhey). `gsap-core` só para timelines complexas ou sites vanilla.
5. **Auditoria** — `design-review` avalia o renderizado sem corrigir; `design-polish` aplica correções em etapa de execução separada, seguida de nova verificação.

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

A referência visual global ainda não foi aprovada. Preservar tokens e consistência;
apenas o artefato ACTIVE e aprovado do item pode governar sua implementação.
Fidelidade visual e paridade funcional são gates independentes. Publicar a tela de referência
exige autorização; a sequência acima não concede push ou deploy automaticamente.
