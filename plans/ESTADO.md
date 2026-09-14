# Estado — Odonto.IA

Atualizado em 14/09/2026. Este checkout pertence ao pacote R169.

🔵 **R169 — Dex, edição rápida da ficha e revisão do orçamento.** Todos os lotes implementados;
[Preview Ready](https://odonto-qhiawak4w-mateusteixeira9203s-projects.vercel.app), commit `00b3c85`. Usuário fará os testes manuais.

Contrato: [R169](specs/R-169-dex-ficha-edicao-rapida.md) e [R169b](specs/R-169b-ficha-orcamento-ajustes.md).
Roteiro/evidências: [teste integrado](auditorias/2026-09-14-r169-ficha-orcamento-preview.md).

Banco principal `zenfemoxvwerplrjgfqz` recebeu apenas SQL compatível R169. Nenhuma policy nova,
nenhum teste gravou pacientes. Ambiente manual: clínica de teste, preview Vercel.
Branch `codex/r169-dex-ficha`; produção do app não promovida.

Retorno manual: corrigidos clique/avisos repetidos do orçamento, contador após inclusão e ação
Adicionar à ficha no rodapé. Novo preview em preparação; roteiro curto no relatório de teste.
Falta: reteste manual do usuário após essa publicação.
Não reverter colunas/histórico de retirada ao voltar o app; guardas e rollback em `supabase/rollbacks/`.
Outras frentes do checkout principal permanecem fora desta entrega.
