# Mapa de Modelos e Escalonamento

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: seleção de modelos e escalonamento

## Objetivo

Usar o modelo mais barato que execute a tarefa com qualidade suficiente e escalar somente quando a complexidade justificar.

## Regra central

**Não usar Astra como padrão.**

A seleção deve seguir:

1. Luna para tarefas mecânicas e documentais de baixo risco.
2. Terra para execução cotidiana de código e trabalho operacional.
3. Sol para análise complexa, auditoria, bugs difíceis e decisões técnicas.
4. Astra para problemas excepcionalmente difíceis, coordenação ampla ou decisões de alto impacto.

## Matriz recomendada

| Chat / Persona | Modelo padrão | Escalar para | Quando escalar |
|---|---|---|---|
| Cérebro / Coordenador | GPT-5.6 Sol | GPT-6 Astra | reorganização ampla, decisões envolvendo vários módulos, impasse entre agentes |
| Arquiteto de Produto | GPT-5.6 Sol, raciocínio alto | GPT-6 Astra | mudança estrutural de produto, arquitetura ou permissões complexas |
| Executor de Código | **GPT-5.6 Terra** | GPT-5.6 Sol | alteração atravessa vários módulos, bug difícil, migração ou contrato complexo |
| Auditor de Código | GPT-5.6 Sol, raciocínio alto | GPT-6 Astra | falha crítica, causa obscura, conflito entre evidências |
| Auditor de Banco de Dados | GPT-5.6 Sol, raciocínio alto | GPT-6 Astra | integridade, concorrência, migração crítica, risco de perda de dados |
| Auditor de Segurança/Permissões | GPT-5.6 Sol, raciocínio alto | GPT-6 Astra | risco crítico ou cadeia complexa de autorização |
| Auditor de Design/UX | GPT-5.6 Terra para primeira passada | GPT-5.6 Sol | inconsistências sistêmicas, redefinição do design system |
| Executor de Testes/Regressão | GPT-5.6 Terra | GPT-5.6 Sol | falhas intermitentes ou regressões difíceis de isolar |
| Curador de Documentação | GPT-5.6 Terra | GPT-5.6 Sol | documentos contraditórios ou decisão arquitetural |
| Limpeza/Arquivamento documental | GPT-5.6 Luna ou Terra | GPT-5.6 Sol | somente se houver ambiguidade relevante |

## Executor de código: regra específica

O **GPT-5.6 Terra é o padrão recomendado** para:

- implementar telas já especificadas;
- criar componentes;
- conectar endpoints;
- ajustes em CRUD;
- correções localizadas;
- testes;
- refatorações pequenas;
- alterações com critérios de aceite claros.

Escalar para **Sol** quando:

- o Executor não consegue localizar a causa após duas tentativas;
- a alteração afeta múltiplos domínios;
- existe migração delicada;
- há risco de regressão em fluxos críticos;
- a especificação deixa margem técnica importante;
- é necessário raciocínio arquitetural.

Escalar para **Astra** apenas quando:

- Sol não for suficiente;
- houver uma decisão de alto impacto envolvendo várias áreas;
- for necessário coordenar diversas investigações simultâneas;
- houver um problema crítico com causa ainda desconhecida.

## Auditoria

Auditoria deve privilegiar precisão sobre velocidade.

### Código / banco / segurança
Padrão: **Sol com raciocínio alto**.

### Design
Primeira passada: **Terra**.
Revisão sistêmica ou decisão de padrão: **Sol**.

### Dupla checagem

Para achados S0/S1, quando economicamente viável:

1. auditor encontra o problema;
2. um segundo contexto independente tenta reproduzir;
3. só então o achado entra como CONFIRMED.

O segundo agente não deve receber a conclusão como fato; deve receber a evidência e tentar validar.

## Política de custo

Nunca escalar um trabalho inteiro só porque um passo ficou difícil.

Escalar **o problema específico**.

Exemplo:

- Terra implementa 90% da tarefa;
- aparece um bug difícil;
- Sol investiga apenas esse bug;
- a execução volta para Terra.

Isso reduz consumo sem sacrificar qualidade.

## Regra anti-desperdício

Se um agente está:

- repetindo a mesma tentativa;
- reexplicando o mesmo problema;
- lendo histórico desnecessário;
- reescrevendo grandes áreas sem evidência;

parar a execução e produzir handoff antes de consumir mais contexto.

## Operação dos chats

Esta matriz recomenda modelos; não altera a configuração dos chats existentes. Conferir
modelo disponível e esforço ao delegar, sem afirmar configuração que não foi verificada.
Acionar ou enviar trabalho a outro chat depende da autorização do usuário; escalar só o
problema delimitado, com handoff e evidência. Uma indisponibilidade não autoriza substituição
silenciosa por modelo mais caro.
