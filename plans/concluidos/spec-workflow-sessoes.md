# Spec — Workflow de sessões: planejamento vs execução

**Status:** Aprovada (2026-07-03). Fonte no setup: `CLAUDE.md` **regra 6**. Rituais: skills `session-start` e `handoff`.

## Objetivo
Separar **decidir** de **construir**. O atrito nº1 era planejar e codar meio a meio na mesma sessão — o que gera código sem spec, escopo mudando no meio, e retrabalho. Cada sessão passa a ter **um modo**.

## Os dois modos

| | **Planejamento** | **Execução** |
|---|---|---|
| Faz | discute, escopa, decide, **escreve spec** | **coda + testa + commita/deploya** |
| NÃO faz | não coda produção (só read-only / spike descartável) | não re-escopa (o não-especificado volta pro planejamento) |
| Entra com | roadmap + o que o fundador trouxe | handoff de execução + specs |
| Sai com | roadmap/specs atualizados + **handoff de execução** | código no ar + handoff (narrativo) |

## Artefatos e relação
```
PLANEJAMENTO  →  spec (contrato) + roadmap atualizado + handoff de execução
                                    ↓
EXECUÇÃO      →  lê roadmap (porquê) + spec (o quê) + handoff (faz agora) → coda
```
- **Roadmap** (`plans/roadmap/`) — o "porquê/priorização", persistente entre sessões (ex: `roadmap-polimento.md`).
- **Spec** (`plans/specs/`) — o **contrato** de um item: arquivos, mudanças exatas, tipos/API, invariantes. **Criado no planejamento _detalhado_** de um item (não no triage). Fix trivial (1 arquivo, óbvio) **dispensa** spec (regra 2).
- **Handoff de execução** (`plans/handoffs/handoff-AAAA-MM-DD-execucao.md`) — **camada fina acionável**: checklist do que codar, com arquivos, agrupado por bloco. **Aponta** pros specs/roadmap, **não repete** (evita drift). Só lista itens **especificados**.
- **Handoff narrativo** — fecho de execução/dia (formato padrão do skill `handoff`).

## Rituais (quais skills)
- **Fechar planejamento** → `handoff` gera a **variante de execução** + declara o modo da próxima sessão (campo "Próxima sessão").
- **Abrir execução** → `session-start` lê o modo declarado e carrega **roadmap + spec relevante + handoff de execução** (panorama completo) antes de codar.
- **Detecção de modo:** automática pelo campo "Próxima sessão" do último handoff. Fallback: o usuário declara; `session-start` pergunta se ambíguo.

## Invariantes
1. Planejamento **nunca** commita código de produção.
2. Execução **nunca** inventa escopo — item sem spec/instrução volta pro planejamento.
3. Handoff de execução **não duplica** spec/roadmap — aponta.
4. Todo handoff **declara o modo da próxima sessão**.
5. `plans/` continua **append-only**.

## Fora de escopo
- Automação via hook (o modo é semântico, model-driven — os skills bastam).
- Novos skills (reusa `session-start` e `handoff` — evita sprawl).
