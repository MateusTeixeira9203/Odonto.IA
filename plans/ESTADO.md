# Estado — Odonto.IA

> 16/09/2026 · fluxo completo do orçamento publicado no Preview e CI aprovado.

## Agora

Item ativo: R-169b, montagem e atualização fluida do orçamento contra o artefato aprovado.
Preview publicado em `codex/conclusao-atualizacao`: código `e619a0c`, contrato `d9a65b8`.
Worktree: `/home/mtx/.local/share/odontoia-testes/integracao`.
CI 35118081587 passou: typecheck, 391 testes, lint e build.
Preview principal: `https://odonto-qxp905zmt-mateusteixeira9203s-projects.vercel.app`.
Commits separados autorizados somente para Preview.
Projeto Vercel: `odonto-ia-teste`. Supabase Free: `etlqznuoxiilvxzygpat`.
Nenhuma promoção/main, cobrança real ou escrita no banco oficial autorizada nesta execução.

## Evidência e limites

[Relatório dos sublotes](auditorias/2026-09-16-sublotes-atualizacao.md) é dono dos resultados.
- Base 1906f83: 387 testes unitários e CI completo passaram. Último ajuste UI dos kits
  tem teste focado de edição/CAS; Mateus pediu para assumir os testes restantes.
- Runtime SQL/PGlite: estoque, recepção, editor, recebimentos, PDF e cadastro passaram.
- Treze migrations aplicadas só no Free; objetos conferidos, sem depender do histórico de migrations.
- Contagens preservadas: 7 clínicas, 41 pacientes, 83 pagamentos.
- HTTP autenticado: financeiro A/B e isolamento; leitura de kits pelo proprietário autorizado.
- Build/typecheck completos rodam no [CI da branch](https://github.com/MateusTeixeira9203/Odonto.IA/actions?query=branch%3Acodex%2Fconclusao-atualizacao).
  Follow-up de tipos validado. Conferência de interface pelo Mateus ainda pendente.
- Não houve duas sessões de navegador no novo pacote: isolamento/RLS não está fechado para produção.

## Implementação atual

- Recepção sem CRO/dentista fictício, rotas operacionais e editor de concessões.
- Recebimentos por capacidade, estado canônico, repetição segura e erros recuperáveis.
- Kits: criar/editar composição e quantidades; retirar componente não usado antes de declarar.
  Materiais avulsos/kit na ficha, baixa, retomada e correção.
- Orçamento em PDF real; compartilhar arquivo no celular ou baixar/abrir WhatsApp no desktop.
  Apenas “Enviei” explícito registra envio manual; abrir não confirma pagamento nem aceite.
- Cadastro Free: três modelos, escolha do pagador, R$200/dentista e identidade clínica opcional.
  Cria estrutura comercial pendente e estoque; não inicia cobrança nem altera Stripe vigente.
- Orçamento: montagem ampla 70/30, nomes completos, itens atuais versus disponíveis,
  total ao vivo, preço por arcada visível e retorno ao mesmo fluxo de aceite/acordo.
- Alerta âmbar conta somente procedimento novo não revisado; `Manter orçamento como está`
  persiste a decisão em `activity_logs`, sem remover o procedimento da ficha.
- Reativação pessoal no Dex adiada por Mateus; rascunho fora do código/migrations publicáveis.
- Estabilidade fica por último.

## Decisões pendentes

R165: como contar/aumentar/reduzir vagas e quando ativar cobertura (pago ou avaliação).
Proprietário clínico conta como dentista; não clínico/secretária incluídos com dentistas pagos.
Checkout centralizado, convites/cobertura e transição comercial não estão liberados.
Demais recortes futuros permanecem no [plano de conclusão](PLANO-CONCLUSAO-ATUALIZACAO.md).

## Próximo passo

Mateus testar no Preview a atualização de uma ficha com procedimentos novos e ignorados.
Não promover a produção antes da conferência e do gate de duas contas logadas.

## Continuidade segura

Snapshots privados: `/home/mtx/.local/share/odontoia-testes/preservacao-integracao-20260915-152017`.
Não apagar clínicas/contas de teste nem reverter contextos/governanças existentes.
Root e candidato têm alterações preservadas; não sobrescrever nem usar `db push`.
PC limitado: sem Next/build/tsc completo local; CI remoto para o app inteiro.
