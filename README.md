# Odonto.IA

Sistema odontológico com agenda, atendimento assistido por IA, prontuário,
orçamentos e financeiro. A versão em uso é a base do próximo refino.

## Entrada para agentes

Leia [AGENTS.md](AGENTS.md) e [Estado](plans/ESTADO.md). Consulte os demais
somente quando a tarefa precisar:

| Assunto | Documento |
| --- | --- |
| Produto atual e limites | [Produto](docs/PRODUTO.md) |
| Situação e pendências relevantes | [Roadmap](plans/ROADMAP.md) |
| Código, stack e comandos | [Arquitetura](docs/ARQUITETURA.md) |
| Autorização e verificação | [Segurança](docs/SECURITY.md) |
| Auditoria atual e prints disponíveis | [Auditoria de produção](docs/auditoria-producao-2026-10-18/README.md) |

Claude e Codex seguem as mesmas regras. Não há acervo de specs, artefatos,
auditorias ou handoffs antigos no projeto. Não reconstruir esse acervo.
Documentos jurídicos e documentação técnica junto ao código têm finalidade própria.

## Desenvolvimento

Versões e comandos em [package.json](package.json): `npm run dev`,
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
Ambiente e autorização de testes devem ser compatíveis com o risco da mudança.
