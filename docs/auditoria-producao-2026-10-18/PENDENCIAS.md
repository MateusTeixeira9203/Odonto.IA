# Pendências para o novo ambiente — Odonto.IA

Atualizado em 18/10/2026 após decisão explícita do usuário. Fonte única da destinação
dos achados desta auditoria. Os relatórios técnicos preservam evidência e reprodução;
este documento não é o plano da reestruturação nem autorização para implementar.

## Publicados em 18/10/2026

Deployment `dpl_HiZZiUFuWTtCVa5hawEfdrjp7WrN`, READY, domínio `odontoia.app` confirmado.

| Item | Resultado | Limite restante |
| --- | --- | --- |
| UI-04 — login/loading em ciclo | Publicado. Login com sessão abre e recarrega; Dashboard QA funciona; proteção anônima passa | Novo login por senha e estados comerciais reais ainda NÃO TESTADOS; estados cobertos localmente. |
| Olhinho no login | Publicado; mostrar/ocultar por clique e teclado PASSA | Mobile validado apenas localmente. |
| UI-01 — acessibilidade de senha no cadastro | Publicado; dois nomes distintos e alternância PASSA | Não equivale a auditoria completa de acessibilidade. |
| UI-03 — texto da landing | Publicado; Próxima sessão confirmado | Redesign continua adiado. |
| UI-05 — status da Agenda | Publicado; AGENDADO e nome acessível confirmados | Não gravado status em produção; callback coberto localmente. |

[Resultado completo e evidências](CODIGO.md#publicação-seletiva-e-validação--18102026).
113 prints originais preservados; novas evidências em `evidencias/publicacao/`.
Sem commit/push: fonte publicada é baseline Git + patch de ajustes identificado por hashes.

## Adiados explicitamente pelo usuário

| Item | O que sabemos | Retomar com |
| --- | --- | --- |
| DB-01 — Ficha assinada | Lacuna de proteção na atualização direta confirmada por catálogo; exploração autenticada não testada | Reorganização da Ficha, preservando integridade da assinatura; teste sintético direto de rejeição e recarga. O adiamento não elimina o risco. |
| DB-02 — recebimento antigo | Função antiga com verificação de vínculo mais fraca; exploração não demonstrada | Revisão financeira, duas identidades sintéticas e sessão com vínculo retirado. |
| COD-02 — edição de orçamento avulso | DELETE/INSERT/UPDATE separados; perda não reproduzida | Reestruturação do orçamento/Financeiro; teste de falha em ambiente descartável e operação indivisível. |
| COD-01 — gráfico financeiro | R$ 50 fictícios no resumo/extrato e ausentes no gráfico, mesmo após recarga | Reestruturação financeira; alinhar composição das métricas sem alterar lançamentos. |
| Aprovar tudo / estado global | Itens aceitos na UI, orçamento global em rascunho e pendência no Dashboard | Definir relação entre aceite de itens, aprovação global e cobrança antes de classificar/corrigir como bug. |
| UI-02 — âncora da landing | Título parcialmente encoberto pelo cabeçalho na condição capturada | Nova landing, junto com mudança da proposta comercial. |

## Avaliados, sem alteração remota

**Senhas vazadas:** advisor confirmou proteção desligada. Painel Auth → Sign In /
Providers → Email oferece “Prevent use of leaked passwords”; organização PRO.
O usuário confirmou que esta etapa é de avaliação. Nenhuma senha, sessão, exigência
mínima ou configuração foi alterada. Uma eventual ativação deve afetar somente essa
opção e ser conferida depois; teste de rejeição de senha vazada ainda NÃO TESTADO.
[Documentação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Desempenho:** nova coleta: 83 FKs sem índice de cobertura, 6 alertas de initplan,
38 índices sem uso observado, 75 sobreposições de policies e 1 alerta de conexões Auth.
Na primeira coleta havia 44 índices sem uso; a mudança reforça que esse indicador
não justifica exclusão automática. Contadores agregados de seis tabelas foram lidos,
sem consultas a conteúdo clínico. Não medem latência de tela nem provam gargalo.
Nenhum índice criado/removido, policy modificada, ANALYZE ou carga executados.
Próximo passo: escolher fluxo lento representativo, medir latência e plano de consulta,
então propor ajuste pequeno. [Advisors](https://supabase.com/docs/guides/database/database-linter).

## Cobertura ainda não realizada

Isolamento com duas contas/clínicas; assinatura; recebimentos/estornos e concorrência;
IA/voz; upload/exportação/integrações; recepção/protético/WhatsApp liberado; reconstrução
e restauração de backup. Mobile interno e acessibilidade completa continuam pendentes.
A checagem móvel local do login não resolve a falta de prints móveis da auditoria de produção.

Não aplicar a pasta de migrations local para “igualar” o banco. Catálogo não é backup.
Não executar hooks legados de PowerShell/Windows no Maestri sem revisar configuração.
O plano futuro continua externo, a ser definido tela por tela com o usuário.
