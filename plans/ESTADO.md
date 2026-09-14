# Estado — Odonto.IA

Atualizado em 14/09/2026. Este checkout pertence ao pacote R169.

🔵 **R169 — Dex, edição rápida da ficha e revisão do orçamento.** Todos os lotes implementados;
preview final em preparação. Usuário fará os testes manuais ao voltar.

Contrato: [R169](specs/R-169-dex-ficha-edicao-rapida.md) e [R169b](specs/R-169b-ficha-orcamento-ajustes.md).
Roteiro/evidências: [teste integrado](auditorias/2026-09-14-r169-ficha-orcamento-preview.md).

Banco principal `zenfemoxvwerplrjgfqz` recebeu apenas SQL compatível R169. Nenhuma policy nova,
nenhum teste gravou pacientes. Ambiente manual: clínica de teste, preview Vercel.
Branch `codex/r169-dex-ficha`; produção do app não promovida.

Falta: build Ready do pacote, teste manual do usuário e retorno dos casos do roteiro.
Não reverter colunas/histórico de retirada ao voltar o app; guardas e rollback em `supabase/rollbacks/`.
Outras frentes do checkout principal permanecem fora desta entrega.
