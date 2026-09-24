# Estado — Odonto.IA

Atualizado em 24/09/2026.

🔵 **R173 — Criação de orçamento confiável.** Patch isolado em
`codex/r173-orcamento-criacao`, baseado em `origin/main` (`ab3883b`), sem recursos que
estão apenas em Preview.

Implementado:

- regra de responsável de evento igual na UI e no banco;
- ID do catálogo atual priorizado sobre vínculo histórico incompatível;
- mensagens seguras e diagnóstico no servidor para recusas da RPC;
- nomes longos legíveis na montagem e na seleção de itens da etapa;
- migrations forward-only `20260924110000_r173_responsavel_evento_orcamento.sql` e
  `20260924153000_r173_corrigir_trigger_titular_financeiro.sql`.

Evidência: `tsc --noEmit`, lint focal e 3 testes unitários passaram. O build foi bloqueado
apenas pela quota temporária de `/tmp` durante o cache do webpack; a tentativa com rede
confirmou que as fontes externas já são alcançáveis. A navegação local chegou ao login e não
há sessão de clínica de teste para validar a gravação sem usar dados reais.

O Preview registrou a causa das respostas 400: `NEW.origem_lancamento` inexistente dentro do
trigger financeiro ao inserir um orçamento. A nova migration usa `to_jsonb(NEW)` para manter
o mesmo trigger compatível com as cinco tabelas. Falta: aplicar a segunda migration e retestar
a criação no Preview.
