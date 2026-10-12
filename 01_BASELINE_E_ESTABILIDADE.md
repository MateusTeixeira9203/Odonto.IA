# Baseline e Estabilidade

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: proteção da baseline e classificação de problemas

## Baseline atual

A baseline representa o estado estável que já está em produção e funciona nos consultórios atuais.

Ela é a referência de regressão.

## Objetivo

Melhorar o sistema sem transformar a estabilização em uma reescrita permanente.

## Regras

### 1. Congelar comportamento estável

Antes de grandes mudanças:

- listar fluxos críticos existentes;
- registrar comportamento esperado;
- criar ou consolidar testes;
- identificar integrações e dependências.

### 2. Não refatorar por estética durante estabilização

Uma refatoração só entra se:

- elimina risco real;
- reduz complexidade mensurável;
- é necessária para a tarefa;
- possui testes que protegem o comportamento anterior.

### 3. Diferenciar defeito real de dívida técnica

Classificação:

- `BUG_CONFIRMED`
- `REGRESSION`
- `SECURITY_RISK`
- `DATA_INTEGRITY_RISK`
- `PERFORMANCE_ISSUE`
- `TECH_DEBT`
- `STYLE_ONLY`
- `FALSE_POSITIVE`
- `NEEDS_EVIDENCE`

Problemas `STYLE_ONLY` e `TECH_DEBT` não devem bloquear uma entrega funcional sem justificativa.

### 4. Evidência obrigatória

Um problema só deve ser tratado como confirmado se houver ao menos um destes:

- teste falhando;
- comportamento reproduzível;
- exceção/log verificável;
- violação objetiva de requisito;
- incompatibilidade comprovada com contrato/API/schema.

### 5. Estabilidade primeiro

Prioridade:

1. dados;
2. autenticação e autorização;
3. fluxos críticos;
4. regressões;
5. erros funcionais;
6. UX;
7. performance;
8. limpeza técnica;
9. estética interna de código.

## Baseline identificada em 11/10/2026

`odontoia.app`: deployment `dpl_FBHKryftZvhHn7Nz7Sy22LdK7bos`, produção `READY`,
SHA `ba5b531164c2983b991de27a96f94668fbb7ebda`, também retornado pela `main` remota.
Checkout local iniciado desse SHA em `codex/baseline-producao-v2`; a incorporação V2 contém
somente documentação local. Reconfirmar publicação antes de próxima mudança funcional.

A identificação foi conferida neste chat por Vercel e Git. Não houve novo gate funcional,
consulta ao schema ou homologação integral dos fluxos. A matriz de preservação por tarefa
vem de [07_REGRESSAO_E_TESTES.md](07_REGRESSAO_E_TESTES.md), preenchida na spec.
