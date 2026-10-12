# Estado — Odonto.IA

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-12
CANONICAL_FOR: foco atual, bloqueios e decisões pendentes

## Agora

**Estabilização do core encerrada operacionalmente em 12/10 por decisão do
usuário**, com testes remanescentes adiados para quando houver mais tempo.
Isso libera o planejamento da próxima fase; não significa cobertura de 100% nem
converte critérios não testados da [R-182](specs/R-182-baseline-verificavel.md)
em PASSA. A [auditoria dirigida](auditorias/2026-10-12-R-182-estabilizacao-dirigida.md)
guarda as evidências. Os cenários adiados ficam 🧊 congelados até o usuário retomar
os testes. Usar só dados sintéticos; nunca a conta real da portaria Clindent.

O banco Supabase publicado recebeu as migrations aprovadas R182-EST-01 e R-197.
A R-197 passou com duas identidades autenticadas, negativas de permissão,
vínculos/IDs preservados, recarga e zero resíduo das fixtures. Seu editor passou
no Preview `5cbd956` ao alterar preço e quantidade e ao rejeitar uma segunda aba
desatualizada. A entrada global de Orçamentos redireciona; não representa uma
segunda jornada atualmente alcançável. O atalho legado R-194 não foi exercitado pela UI.

R-195 passou no Preview para `A fazer → Realizado`, com UI imediata, banco e
recarga; reabertura/negativa não foram repetidas. R-196 passou no Preview:
secretária selecionou Beta por teclado, ID persistiu, Beta viu o pedido e
Alfa recebeu zero linhas. R-199 passou no
Preview desktop e em 390×844 reais, claro/escuro: diálogo e ações alcançáveis,
com 45 px de rolagem horizontal interna funcional, registrados como limite.

R-200 passou no Preview `dpl_KKAAtPXXdEKjEsFhuHj1ANHsyjDh` (`89f20ff`)
nos recebimentos geral e por etapa: resumos imediatos, um pagamento/log,
recomposição, banco e recarga. Erro definitivo teve efeito zero. Em 12/10, o
gate local integrado em `a1722c4` também **PASSOU**: Auth real, Action/RPC,
falha de releitura após commit, retry R-189 sem duplicação, bloqueio da etapa
preservado ao fechar/reabrir e reconciliação após reload (§12.20). Nenhum código
de aplicação foi alterado; o laboratório contém somente dados sintéticos.

No domínio publicado, um recebimento QA de R$ 40 passou com UI imediata,
pagamento/log únicos, `operacao_id` preservada e recarga; a fixture foi
removida. O incidente `ENOTFOUND` do Upstash foi corrigido em 12/10: Redis
Free criado pelo usuário, duas variáveis atualizadas e mesmo commit republicado.
Uma chamada pública ao Dex retornou HTTP 200 e incrementou o contador no novo
Redis; login HTTP 200 e nenhum warning/error nos logs consultados. Outros
consumidores e jornadas autenticadas não foram repetidos nesse gate de infra.

[R-198](specs/R-198-ficha-colaborativa-por-profissional.md) está elegível para
planejamento após este fechamento, sem autorização nova de execução: B adicionará
procedimentos próprios à Ficha de A após encaminhamento; a Ficha será agrupada e haverá
orçamento por dentista. Contrato pronto; implementação não iniciada.

## Testes adiados por decisão do usuário

O usuário fará sua revisão manual com mais tempo. Retomar de modo dirigido:
sessão expirada/retomada (AC-06); lote com Ficha assinada usando Auth real;
exceção de transporte do editor R-197; feedback imediato na reabertura R-195.
Esses pontos são **NÃO TESTADOS no recorte integrado indicado**, não defeitos
confirmados. O atalho legado R-194 não está alcançável pela rota redirecionada.

Data futura pelo teclado nativo, Financeiro, recarga e estorno por etapa
**PASSARAM** no laboratório. AC-10 passou no ensaio lógico sintético (§12.19):
124 tabelas/26 linhas recuperadas, replay sem duplicação, retomada financeira
e clínica. Zero diferença em 2.271 entradas de schema da aplicação; 54
diferenças de owner/ACL de extensões do runtime nativo foram documentadas.
Backup físico real e arquivos Storage não foram testados. Auth e UI passaram
em laboratório separado (§12.20); não são prova de restauração do Auth real.

O gate pós-publicação passou em `odontoia.app` no deployment
`dpl_J2pcmJBWwf4f6eR5ZRBnGD6SfC7p`, `main@d66a326`. A publicação atual é
`dpl_3LzHS31AvnGY6hertJtgChPJfyCb`, `main@a1722c4`, READY, alias
`odontoia.app` confirmado em 12/10 às 20:53 UTC; republicação autorizada
apenas das variáveis Upstash, sem código ou migration. Publicação e aceite
da baseline permanecem estados distintos.

## Preservação

Worktree anterior `codex/preservacao-pre-baseline-v2@41d0a83` em
`/home/mtx/.codex/worktrees/odonto-preservacao-v2/Odonto.IA`: reconciliar por
item, sem reaplicar o lote. A coordenação integra os chats Implementar e Auditor;
nenhum deles edita este panorama.
