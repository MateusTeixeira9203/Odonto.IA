# HANDOFF

## 1. Identificação
- Tarefa: R-182, Upstash e AC-10. Responsável: Coordenação.
- Estado: READY_FOR_REVIEW; ensaio lógico local PASSA, R-182 continua aberta.
- Produção: `main@a1722c47c346a4a80c84ad6cd5efd0ee42afbf08`; 12/10/2026.

## 2. Objetivo
Corrigir Redis sem custo adicional e demonstrar recuperação representativa local.

## 3. Contexto mínimo
Usuário autorizou duas variáveis Vercel/republicação e, depois do login CLI,
exportação schema-only e restauração local. Ambos os recortes foram executados.

## 4. Fonte de verdade utilizada
`00_FONTE_DA_VERDADE.md`, `plans/ESTADO.md`, `plans/specs/R-182-baseline-verificavel.md`;
evidência em `plans/auditorias/2026-10-12-R-182-estabilizacao-dirigida.md`, §§12.17–12.19.
Sem artefato visual aplicável.

## 5. Decisões tomadas
Redis Free, mesmo commit; nenhum serviço pago. Exportação via credencial temporária
CLI em sessão somente leitura, sem dados reais; recuperação em PG17 nativo local.

## 6. Fora de escopo
Código, migrations/publicação adicionais, restauração sobre produção, cópia de
registros reais, backup físico hospedado, arquivos Storage e teste de login/UI local.

## 7. Arquivos alterados
Estado, adendos de auditoria, resultado AC-10 na spec e este handoff. Alteração
anterior de contas QA na spec preservada. Artefatos privados fora do Git.

## 8. Banco / schemas / APIs afetados
Vercel: duas variáveis Upstash; deployment `dpl_3LzHS31AvnGY6hertJtgChPJfyCb`.
Supabase real: exportação schema-only, catálogo somente leitura, acesso temporário CLI.
Local: bancos de ensaio sintéticos; nenhum schema de aplicação remoto alterado.

## 9. Critérios de aceite
Resultados no relatório: Upstash PASSA; AC-10 PASSA no ensaio lógico representativo.
Zero diferença em 2.271 entradas da aplicação; 54 diferenças de owners/ACL de
extensões nativas registradas. Equivalência integral da plataforma não comprovada.

## 10. Testes executados
Infra: PING, limite sintético, alias/SHA/READY, Dex com contador, login HTTP e logs.
Restore: 3.318 entradas de catálogo e 124 tabelas/26 linhas iguais entre bancos
locais, replay idempotente, negativas cruzadas em contextos SQL simulados, novo
recebimento, saldo e edição clínica persistentes em conexão nova. Auth não exercitado.

## 11. Problemas conhecidos
Recuperação física/Storage real não testada; runtime nativo experimental PG17.11,
origem PG17.6. Comparações não abrangem globals/configuração completa da plataforma.
R-200 no componente e demais critérios R-182 não são concluídos por este ensaio.

## 12. Riscos de regressão
Endpoint Redis antigo quebrado não é rollback. Não extrapolar o teste SQL para
login/UI. Não usar laboratório sintético como backup de registros reais.

## 13. Próxima ação exata
Revisar §12.19 e prosseguir pelos gates restantes do Estado, sem refazer o ensaio
sem necessidade. Evidências em `~/.local/share/odontoia-qa/restore-lab-20261012/`.
Para retomar: nesse diretório, executar CLI `../native-supabase/supabase` com
`SUPABASE_EXPERIMENTAL_STACK=1 start --stack-id
41f92c656af7c620596fa568f3880e711c82f148af32ee9fc9cef83a0b8ee95e`.
Os bancos locais estão preservados. O harness recusa sobrescrever o alvo existente.

## 14. Não fazer
Não contratar, copiar dados reais, restaurar produção, revelar tokens, redefinir senha,
reaplicar migrations históricas ou apontar a aplicação de produção ao laboratório.

## 15. Estado da documentação
Estado, spec e auditoria atualizados; evidências anteriores preservadas e bloqueio
de exportação superado explicitamente. Sem novo commit/push/deploy nesta rodada.
Publicação, verificação de infra e aceite do usuário permanecem distintos.
