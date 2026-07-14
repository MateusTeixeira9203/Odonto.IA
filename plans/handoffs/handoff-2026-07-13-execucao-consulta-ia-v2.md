# Handoff — 2026-07-13 (execução: Modo Consulta IA v2 + limpeza de banco)

> Sessão de execução longa: resolveu os 4 problemas de campo do Modo Consulta que o
> Mateus trouxe (transcrição, botão de concluir, ficha que não gerava, cobertura de
> especialidades), rodou um bake-off real entre modelos de IA pra decidir com dado —
> não palpite —, sofreu e corrigiu um hotfix de prod no meio do caminho, incorporou
> feedback de teste ao vivo numa segunda rodada, e fechou limpando o banco de produção
> (13 clínicas de teste → 3 reais). Terminou com um pedido explícito do Mateus: mapear
> **tudo** que está pendente nos roadmaps/specs pra priorizar a semana. Esta seção final
> do handoff é isso.

## Plano / spec de referência
- **Roadmap ativo:** `plans/roadmap/roadmap-3-fases-2026-07.md` — Fase 1 (13–19/07).
- **Spec desta sessão:** `plans/specs/spec-fase1-5-consulta-ia-v2.md` — **implementada e no ar**, incluindo o adendo de feedback de campo (§G/H/I).
- **Spec nova, ainda não escrita:** odontograma multi-especialidade — decisão de escopo tomada ("sistema completo"), mas a escrita foi pausada esperando pesquisa de campo do Mateus na clínica piloto.

## O que trabalhamos
1. **Diagnóstico dos 4 problemas do Mateus** (IA pior que antes, sem botão de concluir, ficha não gerava com muitos procedimentos, falta de cobertura multi-especialidade) — cada um investigado no código antes de propor solução, não assumido.
2. **Bake-off real de modelos** (`plans/specs/eval/bakeoff-organizacao.mjs`, construído nesta sessão): Groq/Llama (baseline) vs Groq `gpt-oss-120b` vs Gemini 2.5 Flash, com e sem thinking, contra 8 casos incluindo 3 "pesados" (boca inteira, odontopediatria, rajadas com ruído). Vencedor: **Gemini Flash, thinking desligado** — 7/8 PASS, zero alucinação/órfão, 2s de latência.
3. **Spec fase1-5 implementada e no ar:** transcrição sobe pra `whisper-large-v3`; gravador ganha bitrate fixo + corte automático por silêncio; organizador migra de Groq/Llama pra Gemini com schema forçado; dicionário ganha ~60 termos cobrindo as 8 especialidades do CFO; botão "Concluir consulta" novo.
4. **Hotfix de prod no mesmo dia:** o prompt do Whisper passou de 896 caracteres (limite duro do `whisper-large-v3`) e **derrubou 100% da transcrição** por ~1h antes do Mateus reportar. Causa raiz achada nos runtime logs da Vercel, corrigida, testada, no ar.
5. **Segunda rodada — feedback de teste ao vivo:** o Mateus testou em prod e trouxe 4 pontos novos; viraram um adendo à spec (nota de planejamento/coordenação não pode virar item de orçamento; painel "detectando ao vivo" tinha dois cérebros dessincronizados — unificado numa rota nova; UI da tela de confirmação reorganizada em 2 colunas). Eval ganhou um 9º caso a partir do relato real do Mateus.
6. **Discussão do odontograma multi-especialidade** — o Mateus trouxe material de estudo do CFO (8 especialidades, cada uma com linguagem visual própria no odontograma). Escopo definido como "sistema completo" (não fatia pequena), mas a escrita da spec foi **pausada de propósito**: faltam respostas de campo (a granularidade real de uso, o que cabe em texto vs precisa de captura própria — periodontia foi identificada como não cabendo no pipeline de voz). Roteiro de perguntas salvo pro Mateus levar na visita.
7. **Limpeza de banco de produção:** 13 clínicas/21 contas (sobra de meses de teste) reduzidas a 3 clínicas reais (Clindent, Império, Vip) com todos os dados preservados. Processo teve fricção real: um gatilho de segurança do banco (`prevent_last_admin_removal`) bloqueou a operação duas vezes até o Mateus autorizar explicitamente desligá-lo pontualmente; duas foreign keys `NO ACTION` (agendamentos.created_by, procedimentos.dentista_id) precisaram de tratamento cirúrgico pra remover uma secretária sem perder dado clínico da clínica que ficou.

## O que concluímos
**Status geral: Completo** para o escopo desta sessão (Modo Consulta IA v2 + limpeza de banco). O odontograma ficou **explicitamente em pausa**, não abandonado.
- Spec fase1-5 + adendo: implementada, testada (eval 9/9), buildada, commitada, **em produção** (`e6fb7bd`, depois de `5619ca0` de hotfix).
- Banco de produção: limpo e verificado — 3 clínicas reais intactas, zero dado clínico perdido.
- Odontograma: escopo decidido, pesquisa de campo encaminhada, spec **não escrita ainda** — depende do Mateus.

## Decisões tomadas
| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Organizador: Gemini 2.5 Flash, thinking OFF | Groq `gpt-oss-120b` (schema forçado também existe lá) | Bake-off real: tier gratuito do Groq rejeitou 24/24 chamadas por TPM baixo; Gemini ganhou em precisão E latência com thinking desligado |
| Transcrição continua no Groq (`whisper-large-v3`) | Migrar tudo pro Gemini (áudio direto) | Dentista precisa CONFERIR o texto antes de organizar — é a etapa de auditoria do documento clínico. Áudio-direto elimina essa conferência. Registrado como experimento futuro condicionado a áudio real de teste |
| Sem fallback de provider no organizador | Fallback pro Groq se Gemini falhar | Erro deixa o texto intacto na caixa (custo = 1 clique); fallback manteria um segundo caminho de qualidade inferior vivo pra sempre |
| Nota de planejamento/coordenação vira observação "Planejamento: …", nunca item de orçamento | Tratar tudo que é "procedimento futuro" igual (regra antiga) | Feedback de campo do Mateus: "preparar pro Dr. Fulano" não é intervenção executável — não pode virar orçamento |
| Detecção ao vivo ganha rota própria (`/api/dex/detectar-consulta`) | Continuar reusando `/api/sugerir-orcamento` | O reuso divergia da ficha final (teto de 6 itens, lógica de agrupamento de orçamento) — bug de campo real, não só limitação |
| Limpeza de banco: desligar o gatilho `prevent_last_admin_removal` só dentro da transação | Reescrever em múltiplas etapas sem tocar o gatilho | Guard existe pra clínica que CONTINUA sem admin — não é o nosso caso (a clínica também some). Exigiu 2 tentativas + autorização explícita do Mateus por bloqueio do classificador de segurança |
| Odontograma: escopo "sistema completo", mas spec escrita depois da visita à clínica | Escrever a spec agora com suposições | Periodontia já provou que "parece simples" esconde uma feature inteira (sondagem 6-pontos vs triagem) — melhor não adivinhar |

## Desvios do plano original
| Item do plano | O que aconteceu na prática | Impacto |
|---|---|---|
| Spec fase1-5 previa só A-F (transcrição/gravador/organizador/dicionário/fluxo/eval) | Ganhou um adendo G/H/I no mesmo dia, motivado por teste ao vivo do Mateus em prod | Nenhum — o adendo é aditivo, mesmo padrão de validação (eval, typecheck, lint, build) |
| Nenhum plano prévio de mexer em banco de produção nesta sessão | Limpeza completa de 13→3 clínicas, motivada por pedido do Mateus no meio da sessão | Resolve o **H7** da dívida técnica do roadmap-3-fases (limpar contas de teste) — já pode ser riscado de lá |
| Spec do odontograma era esperada para esta sessão (era o item #2 crítico do handoff anterior) | Virou sessão de discussão + pesquisa de campo, não spec escrita | Spec continua pendente — ver prioridades abaixo |

## Erros encontrados e como pensei em resolver
| Erro / problema | Causa | Como resolvi | Resolvido? |
|---|---|---|---|
| Transcrição 100% quebrada em prod (~14h de 13/07) | `whisper-large-v3` rejeita prompt de vocabulário > 896 caracteres (o `-turbo` anterior aceitava mais, então o limite nunca doeu); nossa expansão de dicionário passou de 972 chars | Prompt enxugado pra 760 chars (mantém FDI + termos foneticamente traiçoeiros, corta o que o ASR já acerta sozinho) + `.slice(0,896)` como cinto de segurança na rota | Sim — commit `5619ca0`, confirmado nos runtime logs |
| Gatilho `prevent_last_admin_removal` bloqueou a exclusão de clínicas inteiras | Guard de negócio genérico não distingue "admin removido mas clínica continua" de "clínica inteira sendo apagada junto" | Desligar o gatilho só dentro da transação (autorizado explicitamente pelo Mateus após bloqueio do classificador de segurança), religar antes do commit | Sim |
| `DELETE` de `public.users` falhou com FK `NO ACTION` em `agendamentos.created_by` e depois `procedimentos.dentista_id` | A secretária removida (`aerodonto@hotmail.com`) tinha criado um agendamento e tinha cópia própria do catálogo dentro da clínica que ficou (Clindent) | `UPDATE ... SET created_by = null` + `DELETE FROM procedimentos WHERE dentista_id = ...` antes de apagar a conta — zero dado clínico perdido, só a atribuição "criado por" | Sim |
| Painel "Detectando ao vivo" mostrava dentes/procedimentos diferentes da ficha final | Dois cérebros: regex client-side só cobria dente permanente (perdia decíduo 51-85) + reuso de `/api/sugerir-orcamento` com teto de 6 itens e lógica de agrupamento de orçamento | Regex ganhou decíduos; nova rota `/api/dex/detectar-consulta` com o mesmo prompt-família do organizador | Sim |

## Arquivos alterados
**Commit `1af9b55`** (spec fase1-5 base) — `src/app/api/transcrever/route.ts`, `src/app/api/dex/formatar-evolucao/route.ts`, `src/lib/ai/provider.ts`, `src/lib/odonto-dictionary.ts`, `src/hooks/useAudioRecorder.ts`, `src/app/consulta/[agendamentoId]/_components/{consulta-client.tsx, finalize-consultation-dialog.tsx (deletado)}`, eval novo (`plans/specs/eval/bakeoff-*`).

**Commit `5619ca0`** (hotfix) — `src/lib/odonto-dictionary.ts`, `src/app/api/transcrever/route.ts`.

**Commit `e6fb7bd`** (adendo feedback de campo) — `src/app/api/dex/formatar-evolucao/route.ts`, `src/app/api/sugerir-orcamento/route.ts`, `src/app/api/dex/detectar-consulta/route.ts` (novo), `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`, `plans/specs/eval/{formatar-evolucao-casos.json, run-formatar-evolucao.mjs}`, `plans/specs/spec-fase1-5-consulta-ia-v2.md`.

**Sem commit (não é código do app):** limpeza de banco de produção via SQL direto (Supabase MCP) — 13→3 clínicas, convites da Clindent zerados, `aerodonto@hotmail.com` removida.

**Novo, não commitado neste handoff:** `plans/specs/perguntas-clinica-piloto-odontograma-2026-07-13.md` (roteiro de pesquisa de campo).

> `git status` no fim da sessão: working tree limpo, `origin/main` = `e6fb7bd`.

---

## O que ficou pendente — mapa completo pra priorizar a semana

> O Mateus pediu explicitamente esse mapa. Reality check antes da lista: o roadmap
> `roadmap-3-fases-2026-07.md` foi desenhado como **3 semanas** (13–19, 20–26, 27+/07).
> "Deixar tudo 100% essa semana" cobre só a Fase 1 com folga — Fases 2 e 3 têm WhatsApp,
> pagamento recorrente e um rebuild de núcleo clínico, cada um facilmente uma semana
> própria. Recomendo tratar a lista abaixo como **menu pra escolher**, não checklist
> único.

### 🔴 CRÍTICO — decisão do Mateus antes de codar mais
1. **Odontograma multi-especialidade** — escopo já decidido ("sistema completo"), mas a spec não existe ainda. Precisa das respostas da visita à clínica piloto (`plans/specs/perguntas-clinica-piloto-odontograma-2026-07-13.md` — as 7 perguntas ⭐ mínimas). Sem isso, qualquer spec escrita agora é chute.
2. **Hierarquia de papéis** (`plans/specs/spec-hierarquia-papeis-planos.md`) — spec já existe, marcada "PRONTA para execução" desde 04/07, mas o Mateus mencionou uma conversa nova que vai mudar como as 3 clínicas atuais (Clindent/Império/Vip, todas `admin`) se relacionam. **Não toquei nela nesta sessão** — encontrei "Criador" já referenciado em 4 arquivos do front (`usuarios-client.tsx`, `floating-dock.tsx`, `perfil-client.tsx`, `clinic-switcher.tsx`), mas não confirmei se a mudança de RLS (§3 da spec, "o coração da mudança" — silo por dentista) já foi migrada ou não. **Auditar isso é o primeiro passo antes de decidir o que a nova conversa muda.**

### 🟠 Fase 1 (13–19/07) — o que falta do roadmap ativo
Restam os blocos **D** (unificar o componente DEX — hoje 4 implementações rivais), **E** (animações da estruturação/DexMark), **G1/G2** (adiantar paciente pra vaga cancelada + limpeza da tela da secretária). Blocos A/B/C/F já estavam feitos antes desta sessão (confirmado no handoff de 12/07). Gate de saída da Fase 1 (dogfood completo, design-review, CI verde) ainda não foi rodado formalmente.

### 🟡 Fase 2 (20–26/07) — dinheiro e canal
- **Pagamento (P1-P6):** decidir o modelo de trial (hoje 12/12 clínicas em trial infinito), Zod nas actions de dinheiro, provider (AbacatePay vs troca).
- **Manutenção mensal / recorrência (M1-M4):** feature grande, precisa spec própria antes de codar — mecânica compartilhada com o motor de pagamento.
- **WhatsApp (W1-W5):** 4 stubs do `meta.ts` ainda não implementados (`sendText`, `sendFile`, `sendInteractive`, `downloadMedia`), credenciais Meta pendentes, `UPSTASH_REDIS_REST_*` — **achado nesta sessão**: o Redis do rate-limit está OFFLINE em prod agora (`frank-sponge-87179.upstash.io` não resolve, cai pro fallback em memória sem quebrar nada, mas suja logs e enfraquece o rate-limit). Recriar o banco Upstash ou remover as envs é ação manual do Mateus.

### 🟢 Fase 3 (27/07+) — retenção, núcleo clínico, endurecimento
Maior bloco do roadmap: e-mails de retenção (R1-R4), rebuild do cockpit ficha+tratamento (Fx1 — feature grande, precisa design-brief), apresentação redesenhada + loop de conversão (Ap1-Ap2), reorg real da tela da secretária (X2), 8 itens de endurecimento técnico (H1-H8 — testes, Sentry, bump do Next, acessibilidade, `supabase gen types`).

### ✅ Riscado nesta sessão
- **H7 do roadmap** ("Limpar contas de teste em prod") — **feito**. Confirmei: paciente "Maria Souza Teste" também sumiu (estava numa das clínicas apagadas). Pode remover da lista de dívidas.

## O que eu estava planejando / cogitando
- **Odontograma — arquitetura que propus e não fechei:** manter um odontograma-base igual pra todo mundo, e cada especialidade "pluga" seus overlays (símbolo de implante, linha de canal, periodontograma) por cima — em vez de redesenhar o componente do zero. O Mateus topou a ideia geral, mas os detalhes (quais overlays entram na primeira fatia, se periodontia fica de fora do pipeline de voz) dependem 100% das respostas de campo.
- **Periodontia é o ponto de maior risco do odontograma:** sondagem de 6 pontos por dente ditada em voz é onde "não pode ter erro" quebra de verdade — um número trocado é dado clínico falso. Minha recomendação (ainda não validada com o Mateus) é tirá-la do pipeline de voz na v1 e dar um modo de captura próprio (grade tocável ou voz com ordem fixa).
- **Ortodontia** ("a parte de aparelho", a mais diferente) — minha hipótese é que a manutenção mensal é 1 linha simples de registrar (arco/ativação/elástico) e o overlay relacional (giroversão, diastema, classificação de Angle) pode esperar. Não testei essa hipótese ainda — é o Bloco 5 do roteiro de perguntas.
- **Experimento em aberto, não descartado:** Gemini com áudio direto (pula a transcrição Whisper) — só vale testar quando o Mateus trouxer 3-5 áudios reais de consulta (inclusive um com ruído de fundo). Critério de decisão já definido: mesmo bake-off, precisão > latência.
- **Hierarquia:** não tenho contexto da conversa que o Mateus teve — não posso especular o que muda. Primeiro passo da próxima sessão é ouvir isso antes de tocar em `spec-hierarquia-papeis-planos.md`.

## Como retomar
```bash
cd "C:/Users/mateu/Desktop/Odonto.IA-main"
git log --oneline -3   # confirma e6fb7bd no topo, working tree limpo
```
Primeiro passo: perguntar ao Mateus (a) o que a conversa sobre hierarquia mudou, e (b) se ele já fez a visita à clínica piloto (`plans/specs/perguntas-clinica-piloto-odontograma-2026-07-13.md`). As respostas decidem se a próxima sessão é discussão (hierarquia), planejamento (spec do odontograma) ou escolha de prioridade dentro da Fase 1/2/3.

## Dívidas técnicas registradas
- [x] ~~Contas de teste em prod~~ — resolvido nesta sessão (limpeza de banco).
- [ ] Redis do Upstash offline em prod (`frank-sponge-87179.upstash.io`) — fallback em memória funciona mas rate-limit fica por-instância, não global; achado nesta sessão nos runtime logs.
- [ ] Confirmar se `spec-hierarquia-papeis-planos.md` já foi (parcialmente?) implementada — "Criador" aparece em 4 arquivos do front, RLS silo (§3 da spec) não conferida.
- [ ] 24 erros de eslint `set-state-in-effect` pré-existentes — Fase 3/H5.
- [ ] `openai` órfão no `package.json`; 59 casts `as unknown as` — Fase 3/H5.
- [ ] Bump `next` 16.x (advisories reais) — Fase 3/H3, com CI verde antes.
- [ ] Instabilidade ~9% de detecção do sentinela de arcada (97/98/99) — registrada em sessão anterior, não re-testada nesta (o organizador trocou de modelo desde então; vale re-rodar o eval antigo pra ver se ainda se aplica ao Gemini).
