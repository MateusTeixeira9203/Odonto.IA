# Protocolo de Auditoria e Estresse

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: protocolo de auditoria e estresse

## Princípio

Auditoria produz evidência. Auditoria não produz correção.

## Fluxo

### 1. Definir escopo

Nunca auditar "o sistema inteiro" sem dividir em áreas.

Exemplos:

- autenticação;
- criação de clínica;
- permissões;
- prontuário;
- ficha;
- financeiro;
- relatórios;
- navegação;
- responsividade;
- API;
- persistência.

## 2. Para cada achado

Registrar:

- ID;
- título;
- severidade;
- tipo;
- arquivo/fluxo;
- pré-condição;
- passos para reproduzir;
- esperado;
- observado;
- evidência;
- confiança;
- impacto;
- sugestão de investigação.

## 3. Status

- `CONFIRMED`
- `PROBABLE`
- `NEEDS_EVIDENCE`
- `FALSE_POSITIVE`
- `NOT_A_BUG`
- `DUPLICATE`

Somente `CONFIRMED` deve entrar automaticamente na fila de correção.

## 4. Severidade

- `S0` — risco crítico / dados / segurança.
- `S1` — fluxo crítico quebrado.
- `S2` — funcionalidade importante degradada.
- `S3` — problema secundário.
- `S4` — cosmético / melhoria.

## 5. Prevenção de alucinação

Não aceitar afirmações como:

> "Pode haver um problema de concorrência."

Sem:

- cenário concreto;
- código relacionado;
- mecanismo plausível;
- evidência ou teste.

## 6. Limite de correção

Após auditoria, encaminhar a correção ao Executor, em etapa separada. O Auditor não
corrige durante a auditoria. Conforme AGENTS.md, uma pessoa/agente pode assumir papéis
em momentos distintos, declarando a transição; validação independente é recomendada
para achados S0/S1 conforme o mapa 16. Acionar outro chat exige autorização.

Máximo de duas tentativas automáticas por achado.

Se continuar falhando, gerar relatório de bloqueio em vez de insistir.

## 7. Auditoria de estresse

Para fluxos críticos, testar:

- dados ausentes;
- dados duplicados;
- latência;
- refresh;
- navegação rápida;
- múltiplas abas quando aplicável;
- permissões diferentes;
- estados incompletos;
- erros de API;
- retries;
- sessão expirada;
- mudança de clínica;
- concorrência quando relevante.

## 8. Saída

A auditoria deve terminar com três listas:

### Corrigir agora
Apenas falhas confirmadas de maior impacto.

### Planejar
Débitos e melhorias.

### Ignorar/arquivar
Falsos positivos, duplicados ou problemas sem relevância atual.

## Limites de execução

Testes clínicos, financeiros, de concorrência, estresse e falha usam ambiente e dados sintéticos
delimitados. Dados reais são somente leitura. Escritas de QA em produção exigem autorização
explícita, identificação e efeitos conhecidos; não executar carga ou destruição em dados reais.
Para autorização/RLS, usar identidades autenticadas distintas, negativas e ausência de mutação.
Saída, persistência e recarga são evidências separadas. Logs não substituem reprodução quando
esta for necessária; build, lint e testes unitários não provam a jornada completa.
