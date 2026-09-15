# Estado — Odonto.IA

> 15/09/2026 · execução da atualização autorizada com agentes Terra.

## Agora

Bloco 0 do [plano de conclusão](PLANO-CONCLUSAO-ATUALIZACAO.md): base integrada sobre
`origin/main` dc6523a, preservando os checkouts originais.
Worktree: `/home/mtx/.local/share/odontoia-testes/integracao`.
Branch: `codex/conclusao-atualizacao`.

Mateus autorizou **commits separados e push somente para Preview** nesta branch.
Não há autorização de promoção/main nem escrita no banco oficial nesta execução.
Preview publicado; próximo gate: CI completo e QA autenticado no aplicativo integrado.

## Evidência atual

Detalhes em [integração de 15/09](auditorias/2026-09-15-integracao-atualizacao.md).
- Onze conflitos reconciliados, preservando R166/R167/R169 e candidato.
- Free `etlqznuoxiilvxzygpat`: R169 aplicado com adaptador compatível da view R163.
- R163b cartão e guarda global/grupos aplicados somente no Free.
- Contagens originais preservadas antes das fixtures; sem reset, exclusão ou backfill.
- Suite focada 195/195; typecheck das ações sem erro; 18 bundles leves de UI passaram.
- Cartão autenticado: parcelas mensais/centavos/métricas/repetição/concorrência/boleto/estorno passaram.
- Complemento autenticado: 72 checks de grupos, outra conta/clínica e item retirado passaram.
- Saúde da sessão integrada: falha técnica não expira sessão; cookie ilegível do projeto isolado.
- QA auth atualizado: 6/6; rejeição do SDK e URL inválida recuperáveis. Revisão técnica de sessão/financeiro passou.

## Revisão antes do Preview

Versão antiga de billing excluída; webhook/serviço conservam a versão publicada.
Branch publicada com commits separados de schema, produto e documentação; produção intacta.
Preview: https://odonto-ia-teste-git-codex-c-1e4d83-mateusteixeira9203s-projects.vercel.app
Typecheck remoto passou após ajustes BigInt/env. Runner corrigido: 340/340 testes locais; CI final pendente.
QA no navegador pendente: Vivaldi não mantém preenchimento; IAB pede login Vercel.
Rollback de estoque com falha forçada de auditoria passou em PostgreSQL isolado.
Secrets write-only de integrações externas não foram revelados nem alterados.
Sem envio real de WhatsApp/e-mail durante os testes.

## Decisões aguardadas

- R165: assinatura individual nesta release ou proprietário pagando vagas; sem inventar preços.
- R160: autonomia de desconto e aprovação por concessão nas clínicas geridas.
- Rastreabilidade ampliada/hora clínica por cadeira precisam de recorte confirmado.
- Visuais novos de kits/reativação pessoal não têm aceite presumido.

## Próximos passos do plano

Após Preview da base: entrada da recepção/equipe, operações de clínica, kits/consumo na ficha,
reativação pessoal por dentista e compartilhamento manual de orçamento; ordem e dependências
permanecem no plano único. Código anterior não equivale a módulo completamente verificado.
R155 restante (rascunho/reconciliação/alertas) ainda requer integração e testes sandbox.

## Cuidados de continuidade

Snapshots privados: `/home/mtx/.local/share/odontoia-testes/preservacao-integracao-20260915-152017`.
QA financeiro usa fixtures identificadas; manifestos privados em `/home/mtx/.local/share/odontoia-testes`.
Não apagar clínicas/contas de teste nem restaurar contexto/governança antigos.
Não sobrescrever root ou candidato; CLI antiga pode apontar ao oficial. Nunca usar db push.
PC limitado: sem Next/build/tsc completo local; usar infraestrutura remota para o app completo.
Somente testes de duas contas logadas no app fecham o gate de isolamento/RLS.
