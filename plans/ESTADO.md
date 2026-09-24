# Estado — Odonto.IA

Atualizado em 23/09/2026.

🔵 **R-161/R-163 — Meu Consultório e Financeiro da clínica.**

Contrato: [R-163](specs/R-163-financeiro-clinica.md). O Financeiro pessoal atual permanece
intacto, apenas realocado para o hub Meu Consultório. O financeiro da unidade usa titularidade
da clínica e não pode somar os silos pessoais legados.

Contrato visual aprovado: [Meu Consultório V2](artefatos/R-161-meu-consultorio-v2.html).

Migration R-163 aplicada no banco principal em 23/09: titularidade financeira aditiva, custos
fixos recorrentes e RPCs autorizadas. Estrutura e funções confirmadas por consulta de schema;
as telas permanecem locais até preview e validação manual.

Implementação local concluída: shell persistente nas cinco áreas, visão geral com métricas
reais, financeiro pessoal incorporado, financeiro da clínica reorganizado, equipe com convite
pessoal e estoque com detalhe no mesmo contexto. Typecheck, lint, build e 11 testes técnicos
passaram. Falta publicar o preview e fazer a auditoria visual autenticada nos dois perfis.

R-172 está no preview e aguardará a validação de duas contas antes de liberar o estoque para
outras clínicas.
