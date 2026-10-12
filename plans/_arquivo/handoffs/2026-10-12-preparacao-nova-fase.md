# Handoff — preparação da nova fase

STATUS: ARCHIVED
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-12
CANONICAL_FOR: nenhum; registro da reconciliação Git

## 1. Identificação

- Tarefa: preservar trabalho local pré-baseline e preparar checkout limpo.
- Área: repositório/documentação.
- Responsável anterior: Coordenação.
- Estado: `DONE` local; sem publicação.
- Branch de preservação: `codex/preservacao-pre-baseline-v2@55d740d`.
- Branch de retomada: `codex/nova-fase-gestao-2026-10-13`, criada de `e44aa3c`.
- Data: 2026-10-12.

## 2. Objetivo e contexto mínimo

O contador de +9.333/−22.979 pertencia ao worktree antigo de preservação, não à
branch `codex/baseline-producao-v2` já sincronizada. Seu estado local incluía
75 arquivos novos, documentos editados, quatro handoffs movidos, 116 specs
marcadas como excluídas e um arquivo temporário da CLI. A base do ramo era
anterior à estabilização publicada; seus documentos não devem reger a fase nova.

## 3. Fonte de verdade utilizada

- `AGENTS.md`, `00_FONTE_DA_VERDADE.md`, `01_BASELINE_E_ESTABILIDADE.md`.
- `plans/ESTADO.md` e `docs/PRODUTO.md` da baseline `e44aa3c`.
- `plans/handoffs/2026-10-11-etapa-02-limpeza-legado.md` do ramo antigo,
  que registrou as 116 exclusões como não classificadas.
- Nenhuma spec de produto foi aprovada por esta operação Git.

## 4. Decisões e arquivos

1. Evidências QA em `plans/auditorias/` preservadas no commit local `2575ea8`.
   Dois registros do e-mail pessoal de QA foram ocultados antes do commit;
   JSON validado. SQL sob `plans/auditorias/evidencias-*` é evidência,
   não migration executada.
2. Documentos V2, produto, Estado, Roadmap e handoffs antigos preservados no
   commit local `b08e555`.
3. Specs antigas/rascunhos preservados no commit local `55d740d`.
4. As 116 exclusões não classificadas não foram versionadas: os arquivos
   foram restaurados do `HEAD` antigo e também existem na baseline atual.
   `supabase/.temp/cli-latest` voltou ao valor rastreado.
5. O worktree passou para a branch nova criada da baseline de fechamento.
   Os três commits de preservação continuam alcançáveis no ramo antigo.

## 5. Fora de escopo; banco / APIs

- Nenhum merge ou cherry-pick do ramo histórico, push, deploy ou mudança de banco.
- Nenhuma mudança de aplicação, schema, API ou funcionalidade.

## 6. Critérios e verificação

- PASSA: os 75 arquivos novos foram classificados e preservados em commits locais.
- PASSA: todas as 116 specs marcadas como excluídas voltaram do Git; sem perda
  de conteúdo rastreado.
- PASSA: a branch nova parte de `e44aa3c` e o checkout está limpo.
- NÃO TESTADO: jornadas funcionais; não houve mudança de código neste preparo.

## 7. Problemas, riscos e próxima ação

O ramo histórico está 39 commits atrás da `origin/main` e contém quatro commits
próprios anteriores a estes três registros. Não fazer merge integral nem
promover seus documentos a requisitos por semelhança. Os dados de auditoria
foram preservados só localmente; revisar privacidade antes de qualquer push.

Na retomada, ler `plans/ESTADO.md` e `docs/PRODUTO.md`, escolher com o usuário
o primeiro marco testável da fase de gestão, definir critérios de aceite e
verificar consumidores diretos. R-198 permanece recorte separado de produto.
Não aplicar migrations ou alterar dados reais por causa deste handoff.

## 8. Estado da documentação

Registro arquivado e linkado pelo Estado. As specs antigas ficam acessíveis no
ramo de preservação, sem substituir os canônicos atuais.
