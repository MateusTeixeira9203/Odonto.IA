# Handoff de discussão — 2026-07-06 15:20

> **Modo da próxima sessão: PLANEJAMENTO.** Este handoff é **raciocínio, não checklist** — captura a tese, o debate, as direções aceitas/descartadas e o que ficou aberto. O planejamento pega isto + `roadmap-polimento.md` e escreve os specs. **Não re-abrir o "se vale a pena"** — só o "como".
> Sessão em **modo debate** (ver memória `feedback_debate_mode`). Começou como revisão de segurança + commits (ver `handoff-2026-07-06-execucao.md` pro estado do código), virou debate longo de produto/fluxo.

---

## Por que esta discussão aconteceu
- **Feedback real:** um dentista veterano usou ~1 mês e **não adaptou** — usou porque o fundador pediu. Sinal de retenção, não só de fricção.
- **Gatilho de prazo:** semana que vem tem visita a uma clínica de **2 secretárias + 5 dentistas** (a config "Clínica" que a hierarquia mirou).
- **Meta do fundador:** chegar com as fricções **observadas** resolvidas pra que os problemas não sejam os mesmos; espera achar outros bugs.

---

## Tese central (o frame do produto)
- **Dois loops:** balcão (registrar/agendar/receber → automação/bot/secretária) vs clínico (do dentista: `consulta → ficha → orçamento → apresentar → retorno`). A fricção nasce quando o **balcão vaza pro clínico**.
- **O dado flui pra frente** — nunca redigitar o que o sistema já sabe.
- **Odontograma como fio condutor** (input na ficha → mapa no acompanhamento → âncora na apresentação) — materializa nos rebuilds, é a visão de longo prazo.

---

## O debate estratégico (a parte mais importante — o raciocínio, incl. onde Claude pressionou e concedeu)
1. **"Isso é o mais importante agora?"** — Claude atacou: polir loop que já funciona = craft-como-procrastinação; o risco real é retenção/pagamento. **Fundador rebateu com evidência:** as fricções vêm de teste real num consultório, e até dentistas **jovens** (fluentes em Instagram) travam → **é o produto, não o usuário**. Benchmark = facilidade nível-Instagram. **Claude concedeu:** o trabalho de fluxo se justifica **como fluxo**, não como estética.
2. **Retido, mais leve:** fluxo-suave é **pré-requisito** pra testar valor/retenção — necessário, talvez não suficiente. "Ficou fácil" ≠ "vão trocar e pagar".
3. **Reframe 2+5:** a vulnerabilidade dominante vira a **camada multi-usuário** (silo, 2 secretárias, encaminhamento, setup de 7). **Fundador rebateu:** "é por isso que vou lá — a visita É o teste multi-usuário". **Claude concedeu**, e reconheceu que o silo já está **pré-verificado** (harness SQL 63/63 + auditoria service-role) — sobra UX, que a visita acha. **🔎 Só vigiar na clínica:** visibilidade cross-dentista (falha de maior custo — PHI/confiança/legal — mesmo que improvável).
4. **A régua da semana:** (a) remove desculpa de "nem consegui usar" no loop central; (b) mexe **pouco** (vai testar versão mal-dogfoodada — cada mudança é bug em potencial na véspera); (c) não desestabiliza o fluxo de dinheiro.

---

## Triagem dos itens (direções consideradas, aceitas/descartadas e por quê)

Base: os 16+ itens do fundador em `roadmap-polimento.md`, filtrados ponto a ponto no debate.

### Entra na semana (sobreviveu à régua)
- **#2 Iniciar consulta sem pré-agendamento** — bloqueio mais óbvio (hoje *keyed* no `agendamentoId`; walk-in bate no muro). Cria agendamento implícito → consulta. *Aberto:* ciclo de vida do "fantasma" abandonado.
- **#5 Botão "Editar" visível** — ataca o eixo da falha (descoberta; o veterano não achou a "canetinha"). Risco ~zero. Conter ao botão, não virar auditoria de ícones.
- **#6 Ficha → Orçamento pré-montado** — **o grande atrito anotado.** Fluxo hoje: `fechar ficha → salvar → orçamentos → novo orçamento → escolher a ficha → scrollar pra achar os procedimentos`. O modal de "novo orçamento" **já existe** (`Dialog` em `orcamentos-client`, já com integração de procedimentos de ficha). Fix = **ponto de entrada**: lançar o modal **a partir da ficha, já mirado** (paciente + procedimentos **visíveis e pré-marcados**, sem scroll).
- **#7 (metade segura)** — borda de atenção (token amber, 2 estados) + alerta/botão fácil quando falta procedimento + auto-salvar no catálogo **com confirm**.
- **#10 Marcar retorno inline** — emprega `retorno_sugerido` (hoje morto). Não é bloqueio (dá pra agendar pela agenda), é cortesia. *Aberto:* onde mora sem o rebuild da ficha.
- **#11 Reordenar abas** — Prontuário · Orçamento · Doc · **Agendamento** (agenda por último). **Reordenar, NÃO remover** (correção: leitura errada anterior de Claude). Risco zero, impacto baixo — "de brinde".
- **Onboarding do primeiro acesso** (novo, ponto final do fundador) — **a definir**. Alta relevância pro 2+5: 1ª impressão de **7 usuários**. Ver `roadmap-polimento` #1 + #6/J.

### Defere pro pós-teste (com razão)
- **#1 DEX mostra o dia/pulsa** — net-new, fora do caminho central; "delight" se adiciona depois de saber que retém.
- **#12 Deletar extrair-imagem** — zero valor de teste; `ficha_arquivos` provavelmente viva (upload escreve) → `DROP TABLE` destrutivo na véspera é risco puro. Rota+SDK seguros de deletar, sem pressa.
- **#6b auto-preço** (match nome-falado → catálogo) e **#7-dedup** (similaridade) — as metades difíceis; mal-feitas confiam no preço errado / corrompem catálogo.

### Rebuild (pós-teste, é a visão de longo prazo, não a semana)
- **#3 Ficha unificada** (criar↔acompanhar numa superfície; odontograma como **input**; hoje o D12 só unificou o *layout* de leitura, não o criar↔acompanhar).
- **#4 Embutir o Modo Consulta na ficha** (com modo captura focado, preservando o "teatro" de estruturação — o uau é a transformação, não a tela separada). Depende de #3.
- **#9 Apresentação** (present mode fullscreen; abrir no **odontograma** e não no card de quadrante; imagens **grandes** image-first; antes/depois v1 lado-a-lado + v2 desenhar/coroa; edição rica de **conteúdo** com layout templado; fechar o loop `apresentar → aceitar → agendar`). Esqueleto já existe e é auto-gerado — **proteger isso** (nunca virar editor do zero).

---

## Decisões travadas nesta discussão
| Decisão | Por quê |
|---|---|
| **#8 "engessado" funde no #6** | O exemplo concreto do fundador foi 100% **fluxo** (os 6 cliques + scroll), não rigidez estrutural. Claude **retirou** a hipótese de "#8 = causa-raiz model-mismatch". *Aberto:* confirmar se há rigidez **depois de pronto** (fasear, plano A/B, desconto). |
| **#11 = reordenar, não remover** | Correção de leitura errada de Claude (a aba Agenda carrega dados reais — remover seria regressão; reordenar é trivial). |
| **extrair-imagem: deletar (pós-teste)** | Rota morta (0 callers); a ideia futura fica no git. |
| **storage por-clínica** (não por-dentista) | Já decidido antes (registrado na `spec-hierarquia` §3): por-dentista via join faria o arquivo acompanhar o paciente no encaminhamento, contra a regra "a ficha não acompanha". |

---

## Aberto pro planejamento decidir (com o código na frente)
- **Orçamento — rota do #6:** **leve** (deep-link: botão na ficha → orçamento com paciente/ficha pré-selecionados e modal abrindo pronto — semana-safe, mas sai do prontuário) **vs pesada** (extrair o `Dialog` + estado `novoOrc*` de `orcamentos-client` pra componente compartilhado e renderizar **na** tela do prontuário — fica 100% no prontuário, mas refatora o fluxo de dinheiro na véspera). **Depende do acoplamento do `orcamentos-client`.**
- **#2** — ciclo de vida do agendamento-fantasma.
- **#10** — ponto de inserção do "marcar retorno" sem rebuild da ficha.
- **#8** — confirmar rigidez estrutural além do fluxo.
- **Onboarding primeiro acesso** — definir o que está quebrado (convite/setup dos 7? primeiro login? explicação do sistema?).

---

## Lentes transversais (valem pra tudo, agora e nos rebuilds)
1. **Persona = dentista veterano** → affordance **explícito** (botão rotulado > ícone), sem poluir (clareza calma).
2. **Oferecer, não forçar** (nada de wizard obrigatório).
3. **O dado flui pra frente.**
4. **Odontograma como fio condutor.**
5. **Auto-gerar + refinar** (o sistema faz o peso, o dentista põe a alma).

---

## Estado do código / repo (contexto, não trabalho desta sessão)
- Branch `feat/fase1-onboarding-persona-loop`; **6 commits locais, nada pushado**; **prod DB à frente do código** (migrations 089–094 vivas; segurança commitada mas **não deployada**). Detalhe em `handoff-2026-07-06-execucao.md`.
- **Nada foi construído nesta discussão** — só este handoff em `plans/`.

## O que eu (Claude) estava cogitando / não resolvido
- **Onboarding é o menos definido e talvez o mais impactante pro 2+5** — é o primeiro contato de 7 pessoas; se for rugoso, colore o teste inteiro. Vale definir cedo no planejamento, não "por último".
- A **validade do teste** é um risco em si: quanto mais você mexe na véspera, menos você sabe o que está testando. O planejamento deveria reservar tempo pra **você dogfoodar** o que entrar, não só codar.

## Próxima sessão
- **Modo:** planejamento.
- **Ler primeiro:** este handoff + `roadmap-polimento.md`. Pro estado do código: `handoff-2026-07-06-execucao.md`.
- **Produzir:** specs dos itens 🟢 da semana, resolvendo os 🗣️ abertos com o código na frente. Definir o onboarding cedo.
