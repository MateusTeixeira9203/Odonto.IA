# Odonto.IA — regras de trabalho

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: regras de coordenação do setup anterior em AGENTS.md e CLAUDE.md
CANONICAL_FOR: regras locais, segurança técnica e entrada na governança V2

Estas regras valem para qualquer agente, modelo ou chat neste repositório.
O núcleo clínico continua captura → estruturação pela IA → Ficha → planejamento → orçamento.
O [README](README.md) orienta a navegação do repositório. [docs/PRODUTO.md](docs/PRODUTO.md)
define a direção de produto; leia em decisões sobre público, capacidades e evolução.

## Entrada e fonte de verdade

1. Ler [00_FONTE_DA_VERDADE.md](00_FONTE_DA_VERDADE.md) e [plans/ESTADO.md](plans/ESTADO.md).
2. Identificar o canônico da área, a spec aprovada e a baseline descrita no
   [01_BASELINE_E_ESTABILIDADE.md](01_BASELINE_E_ESTABILIDADE.md).
3. Validar status, data e substituições antes de usar uma referência. Histórico e artefato
   arquivado não viram requisitos por semelhança textual.
4. Declarar o papel em atuação. A instrução atual do usuário prevalece; conflito documental
   segue o 00. Se ainda houver ambiguidade de decisão, apresentar as fontes e pedir definição.

Não presumir que a documentação trazida pela baseline Git representa decisões recentes.
O roadmap histórico ainda aguarda conciliação. A visão de produto foi atualizada em 11/10/2026;
ela distingue decisões, hipóteses e lacunas, sem comprovar implantação ou conceder permissões.

## Papéis, escopo e entrega

- **Arquiteto de Produto:** define problema, usuário, fluxo, estados, permissões e critérios;
  segue [08](08_PERSONA_ARQUITETO_DE_PRODUTO.md), sem implementar código.
- **Executor:** implementa a spec aprovada por marcos, sem ampliar escopo; segue
  [09](09_PERSONA_EXECUTOR.md).
- **Auditor:** reproduz, classifica e coleta evidências sem corrigir código; segue
  [05](05_AUDITORIA_E_ESTRESSE.md) e [10](10_PERSONA_AUDITOR.md).
- **Curador de Documentação:** mantém canônicos, status, referências e histórico; segue
  [02](02_LIMPEZA_DE_LEGADO.md) e [11](11_PERSONA_CURADOR_DOCUMENTACAO.md).

Um agente pode mudar de papel em etapas distintas, declarando a transição. Correção não ocorre
durante auditoria. Antes de acionar agentes ou outros chats, propor recorte/equipe e obter o
aval do usuário. Coordenador integra resultados; executores não editam o mesmo panorama.
Selecionar modelo conforme [16](16_MAPA_MODELOS_E_ESCALONAMENTO.md), sem escalonar a tarefa
inteira quando só um problema exige modelo superior. Chats existentes não mudam de modelo
por este arquivo. Contexto do coordenador: [14](14_PROMPT_INICIAL_CEREBRO_DO_PROJETO.md).

Antes de implementar, seguir [03](03_FLUXO_DE_TRABALHO.md): objetivo, escopo, fora de escopo,
comportamento esperado e preservado, arquivos, consumidores, critérios de aceite, riscos e
testes. Mudanças em auth, autorização, tenancy, dados, migrações, APIs centrais ou fluxos
críticos exigem decisão de produto e análise técnica explícitas. Não inventar requisitos.

No máximo duas tentativas automáticas por defeito sem solução: parar, preservar reprodução,
registrar hipóteses/evidências/bloqueio e devolver para revisão. Não variar remendos às cegas.
Só falhas CONFIRMED entram na correção; estética/dívida sem impacto justificado não bloqueia.

Validar regressões pela matriz [07](07_REGRESSAO_E_TESTES.md) na própria spec. Fluxo novo
funcionando com fluxo antigo quebrado não passa. Conclusão segue [13](13_CHECKLIST_DE_ENTREGA.md):
critérios, testes, regressão, documentação, riscos residuais e handoff. Build/lint não bastam.
Usar [04_HANDOFF_TEMPLATE.md](04_HANDOFF_TEMPLATE.md) em toda implementação, auditoria,
decisão relevante ou delegação. Entrega local, integração, publicação e aceite são distintos.

## Debate e simplicidade

Entender a tese, trazer o melhor contra-argumento e opções com trade-offs; não concordar por
reflexo nem abrir com elogio. Citar referências verificáveis quando depender de fatos externos.
Distinguir fato, relato, hipótese e verificação impedida. Escolher a menor solução suficiente;
reusar código e plataforma, sem abstrações especulativas ou dependências gratuitas.

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

- Toda tabela multi-tenant tem `clinica_id` + RLS. Roles por clínica. A direção de uma
  participação ativa por conta não autoriza apagar vínculos legados nem mudar auth; inventariar
  o comportamento real e aprovar contrato próprio antes de alterar vínculos ou papéis.
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
- **Referência visual global ainda não aprovada.** Usar o artefato ativo e aprovado do item;
  preservar tokens e consistência até a definição da régua global.
- Processamento de IA usa **`DexLoader`** (`src/components/ui/dex-loader.tsx`) — já existe, não crie outro loader.
- Motion: **sentida, não percebida.** Hover leve, feedback claro, skeletons consistentes.
- Pipeline de [06_DESIGN_SYSTEM_E_ARTEFATOS.md](06_DESIGN_SYSTEM_E_ARTEFATOS.md) vale
  em toda tela nova; redesign segue seu caminho próprio nesse protocolo.

## Performance

`Promise.all` em fetches independentes · Suspense + skeletons · loading state em toda ação
perceptível · evitar re-render desnecessário.

## Artefatos

Mockups HTML em `plans/artefatos/R-NN-{slug}.html`. **Como ler e usar: skill `artefato-visual`**
(servir por HTTP local, extrair tokens por JS, escrever em texto na spec — nunca `Read` no
HTML nem `file://`).

### Artefato aprovado é a base — inegociável

Quando existe artefato **aprovado por mim**, ele deixa de ser referência e passa a ser **o
contrato visual da implementação**. Ele já foi debatido, ajustado e moldado pro que eu quero: a
decisão visual **já aconteceu**, e reabrir ela no código é desfazer trabalho pago.

- **A implementação COPIA o artefato, não "se inspira" nele.** Estrutura, hierarquia, ordem dos
  blocos, espaçamento, geometria — tudo. Se algo do artefato não couber, isso é um **achado pra
  me trazer**, não licença pra improvisar uma variação.
- **Divergiu do artefato = está errado**, mesmo que o resultado pareça bom isolado. A pergunta na
  hora de dar a tela por pronta não é "ficou bonito?", é *"está igual ao artefato aprovado?"*.
- **Nunca deduza do artefato pelo olho.** Tokens, medidas e algoritmo se extraem por JS
  (`artefato-visual`) e viram texto na spec. Aproximar layout no olho já produziu tela **pior que
  a produção** (22/07: o artefato aproximou em vez de portar `calcularFaixas`).
- **O artefato é fonte de verdade só do visual.** Regra de negócio, nome de campo, chamada de API
  e schema continuam vindo da spec — artefato bonito não autoriza mudar comportamento.
- Vale pra toda tela nova **e** pra redesign. Se o artefato ficou desatualizado depois de uma
  decisão minha, **o artefato se atualiza primeiro** — nunca se implementa contra um artefato
  que a gente sabe que está velho.

## Rotina local e documentos

O usuário escolhe discussão, planejamento ou execução; não inferir pela saudação. Discussão
não produz código/spec; planejamento produz contrato; execução cumpre o aprovado e testa.
`/pontual` serve para texto, espaçamento, config ou bug óbvio: schema/API/auth/RLS, mais de
aproximadamente três arquivos/50 linhas ou mudança de comportamento em uso sai dessa faixa
e vira item de planejamento. A incorporação documental V2 tem seu próprio escopo autorizado.

- Saudação de abertura: skill `session-start`, ler Estado e dar recap antes de código.
- Encerramento pedido: skill `handoff`, usar o formato 04 e reescrever Estado.
- Plano do dia: [12](12_PLANO_DE_SESSAO.md), com até três resultados principais.
- `plans/ESTADO.md`: foco, bloqueios e decisões atuais, aproximadamente 80 linhas; não é fila.
- `plans/ROADMAP.md`: mapa/status/histórico, aproximadamente 200 linhas; não duplica a spec.
- `plans/specs/`: contrato único por item, aproximadamente 300 linhas. Se ultrapassar,
  reexaminar o recorte, sem criar checklist concorrente.
- `plans/artefatos/`: artefatos por item. Tokens/medidas extraídos ficam em texto na spec.
- `plans/auditorias/`: evidências e limites; `plans/handoffs/`: passagem no formato 04.
- No fechamento, manter os três handoffs mais recentes; arquivar os demais segundo 02,
  preservando links e sem apagar evidências. Não limpar outros trabalhos automaticamente.
- Fechar item: status no roadmap e arquivamento da spec/artefato na mesma edição.
- Observações de print/áudio/vídeo viram texto na spec ou Estado no momento da apresentação.

Status operacional: ⏳ fila · 🔵 ativo (paralelismo com responsáveis/escopos/dependências
explícitos) · 🟡 no ar não verificado · ✅ no ar e verificado · 🧊 congelado com condição de
retomada · ✂️ cortado com motivo. `READY_FOR_REVIEW`/`DONE` do handoff não substituem esses
estados de publicação. Critério de teste: PASSA, NÃO PASSA ou NÃO TESTADO.

## Publicação, segurança e reversão

Alterações locais reversíveis autorizadas podem avançar sem confirmação repetida. Aprovar
spec/teste não autoriza commit, push, deploy, migration em produção, gasto ou dados reais;
confirmar quando não explicitamente pedidos. Nunca push automático.

Dados reais são somente leitura em auditoria. Escritas de QA precisam de dados sintéticos,
autorização e efeitos delimitados; nunca carga, falha ou destruição sobre dados reais.
Preservar registros e evidências. Verificar identidade e isolamento diretamente no servidor,
com contas distintas, negativas, persistência e recarga quando pertinentes.

Um commit por mudança reversível de forma independente. Separar schema/migration, plans,
refatoração, dependência, fix e feature; acima de aproximadamente 15 arquivos reexaminar o lote.
Migration vai primeiro e sozinha quando houver; permissão/RLS exige duas contas autenticadas.
Antes de publicar, conferir base e dependências, revisar o diff e executar auditoria dirigida
proporcional ao risco. Reviewers de código/UX e design-polish só são acionados após autorização,
com correções separadas da auditoria. Auditoria completa não é exigência automática de cada ajuste.

Preferir lotes pequenos. Ter contenção/reversão que não restaure vulnerabilidade; depois de
publicação autorizada confirmar versão e fluxo afetado. Aprovação visual não autoriza alterar
negócio, schema ou permissões. Nenhum documento/skill amplia silenciosamente o escopo concedido.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
