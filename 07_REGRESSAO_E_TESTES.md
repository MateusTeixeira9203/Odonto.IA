# Regressão e Testes

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: matriz de regressão e testes por tarefa

## Princípio

Mudança nova não pode invalidar silenciosamente um fluxo que já funcionava.

## Matriz mínima por tarefa

Antes de implementar, registrar:

| Fluxo | Pode ser afetado? | Teste necessário |
|---|---:|---|
| Login |  |  |
| Sessão |  |  |
| Criação de clínica |  |  |
| Seleção/troca de clínica |  |  |
| Permissões |  |  |
| Cadastro de usuário |  |  |
| Agenda |  |  |
| Paciente |  |  |
| Ficha/prontuário |  |  |
| Orçamento |  |  |
| Financeiro |  |  |
| Relatórios |  |  |
| Configurações |  |  |

## Tipos de teste

1. Unitário
2. Integração
3. Contrato
4. E2E
5. Manual orientado
6. Regressão

## Regra para alteração em componente compartilhado

Se um componente é utilizado em N fluxos relevantes, a tarefa deve identificar os consumidores antes de editar.

## Regra para schema/API

Mudanças de schema, contrato ou payload exigem:

- compatibilidade;
- migração;
- fallback quando aplicável;
- atualização de consumidores;
- testes de contrato.

## Regra de conclusão

Se a funcionalidade nova funciona, mas os testes de regressão relevantes falham, a tarefa permanece incompleta.

## Uso seguro da matriz

Preencher na própria spec; não manter segunda matriz concorrente. A lista é triagem, não
prova de que cada capacidade existe no produto. Marcar não aplicável com justificativa quando
couber. Verificar estado inicial, ação, resultado, efeito proibido e evidência por critério.
Para dados persistentes conferir antes/depois, recarga, repetição e falha quando pertinentes.
Seguir os limites de dados e ambiente de [05_AUDITORIA_E_ESTRESSE.md](05_AUDITORIA_E_ESTRESSE.md).
