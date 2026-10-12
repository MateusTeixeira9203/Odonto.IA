# Estado — Odonto.IA

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-12
CANONICAL_FOR: foco atual, bloqueios e decisões pendentes

## Agora

Prioridade: fechar a estabilização do core antes de ampliar gestão. A
[R-182](specs/R-182-baseline-verificavel.md) continua aberta; a
[auditoria dirigida](auditorias/2026-10-12-R-182-estabilizacao-dirigida.md)
registra evidências e limites por fluxo. Usar somente contas e registros
sintéticos da clínica QA B; nunca a conta real da portaria Clindent.

O banco Supabase publicado recebeu as migrations aprovadas R182-EST-01 e R-197.
A R-197 passou com duas identidades autenticadas, negativas de permissão,
vínculos/IDs preservados, recarga e zero resíduo das fixtures. Seu editor passou
no Preview `5cbd956` ao alterar preço e quantidade e ao rejeitar uma segunda aba
desatualizada. A entrada global de Orçamentos redireciona; esse caminho específico
permanece **NÃO TESTADO**.

R-195 passou no Preview para `A fazer → Realizado`, com UI imediata, banco e
recarga; reabertura/negativa não foram repetidas. R-196 passou no Preview:
secretária selecionou Beta por teclado, ID persistiu, Beta viu o pedido e
Alfa recebeu zero linhas. R-199 passou no
Preview desktop e em 390×844 reais, claro/escuro: diálogo e ações alcançáveis,
com 45 px de rolagem horizontal interna funcional, registrados como limite.

R-200 passou no Preview `dpl_KKAAtPXXdEKjEsFhuHj1ANHsyjDh` (`89f20ff`)
nos recebimentos geral e por etapa: resumos imediatos, um pagamento/log,
recomposição, banco e recarga. Erro definitivo teve efeito zero. Resposta
perdida depois da RPC, retry R-189 e bloqueio da etapa após fechar/reabrir
continuam **NÃO TESTADOS em runtime**. Montar o componente localmente exigiria
adicionar infraestrutura de testes ausente; esse recorte não foi ampliado.
As fixtures desta rodada foram removidas, com zero resíduo delimitado.

No domínio publicado, um recebimento QA de R$ 40 passou com UI imediata,
pagamento/log únicos, `operacao_id` preservada e recarga; a fixture foi
removida. Logs de `/api/dex/alerts` confirmam `ENOTFOUND` do Upstash e
fallback de rate limit em memória; impacto fora dessa rota **NÃO TESTADO**.

[R-198](specs/R-198-ficha-colaborativa-por-profissional.md) está na fila
**após** a estabilização, por decisão do usuário: B adicionará procedimentos
próprios à Ficha de A após encaminhamento; a Ficha será agrupada e haverá
orçamento por dentista. Contrato pronto; implementação não iniciada.

## Próximos gates

1. Concluir o teste de resultado incerto do R-200 com componente montado,
   sem induzir falha em dados reais.
2. Diagnosticar o Upstash usado pelo rate limit, mantendo a configuração
   atual até haver alternativa testada.
3. Fechar os ACs restantes da R-182: data futura no controle nativo,
   restauração AC-10 e revisão manual do usuário.

O gate pós-publicação passou em `odontoia.app` no deployment
`dpl_J2pcmJBWwf4f6eR5ZRBnGD6SfC7p`, `main@d66a326`, READY e com alias
confirmado em 12/10. Commits posteriores alteraram somente documentação;
verificar o alias atual antes de nova ação. Publicação e aceite da baseline
permanecem estados distintos.

## Preservação

Worktree anterior `codex/preservacao-pre-baseline-v2@41d0a83` em
`/home/mtx/.codex/worktrees/odonto-preservacao-v2/Odonto.IA`: reconciliar por
item, sem reaplicar o lote. A coordenação integra os chats Implementar e Auditor;
nenhum deles edita este panorama.
