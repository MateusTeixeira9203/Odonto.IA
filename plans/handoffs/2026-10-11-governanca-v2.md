# Handoff — incorporação da governança V2

STATUS: REFERENCE_ONLY
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
REPLACES: nenhum
CANONICAL_FOR: nenhum; evidência da incorporação documental

## 1. Identificação

- Tarefa: incorporar governança V2 na base limpa, conciliando regras técnicas.
- Área: documentação e coordenação.
- Responsável anterior: coordenador deste chat, papel Curador de Documentação.
- Estado: READY_FOR_REVIEW.
- Commit/branch: `ba5b531164c2983b991de27a96f94668fbb7ebda`, `codex/baseline-producao-v2`.
- Data: 11/10/2026. Alterações locais não commitadas.

## 2. Objetivo

Materializar o pacote aprovado em fontes acessíveis aos chats, eliminar instruções de
coordenação conflitantes e preservar as regras técnicas. Não alterar funcionalidades.

## 3. Contexto mínimo

Base limpa alinhada ao commit publicado antes desta tarefa. O trabalho divergente permanece
no worktree de preservação indicado no Estado. Os protocolos instalados não significam que
todo o legado foi classificado ou que um ciclo funcional V2 foi homologado.

## 4. Fonte de verdade utilizada

- Decisão atual: incorporar governança; README e visão de produto ficam para depois.
- Pacote fornecido: `/home/mtx/Downloads/ODONTO_IA_SISTEMA_OPERACIONAL_COMPLETO_V2.md`.
- Canônicos: documentos 00–16 na raiz; regras técnicas locais em `AGENTS.md`.
- Contrato desta alteração documental: pedido do usuário e critérios da seção 9 abaixo.
- Artefato visual: não aplicável. Nenhum HTML foi usado para decidir requisitos.

## 5. Decisões tomadas

1. Materializar 00–16 com status, responsável, revisão e escopo canônico; não criar README agora.
2. Conciliar AGENTS preservando stack, TypeScript, RLS, isolamento, IA, tokens, artefatos e Next.js.
3. CLAUDE é entrada para AGENTS; template legado de handoff é SUPERSEDED e aponta ao 04.
4. Separar auditoria de correção, com limite de duas tentativas e regressão proporcional.
   O 05 foi conciliado com a permissão do AGENTS para mudança explícita de papel entre etapas;
   isso não dispensa a validação independente recomendada para achados S0/S1.
5. Distinguir status documental, estado da tarefa, resultado de teste e publicação. As marcas
   DELETE_CANDIDATE/EXPLORATION_ONLY são classificação, sem autoridade de requisito.
6. Substituir o Estado obsoleto; manter conteúdo do roadmap como REFERENCE_ONLY até conciliação.
   O conteúdo da visão de produto ficou intacto, pendente da próxima etapa acordada.

## 6. Fora de escopo

README, nova visão de produto, classificação/arquivamento em lote, correções clínicas ou
financeiras, configuração de modelos dos chats, mensagens/delegações, commit, push, deploy,
banco, dependências, código de aplicação e testes de produto.

## 7. Arquivos alterados

Três marcos documentais, sem criar lote de publicação:
- Protocolos 00–07: oito arquivos da primeira parte do pacote.
- Personas, sessão, entrega, coordenação, reorganização e modelos 08–16: nove arquivos.
- Conciliação: `AGENTS.md`, `CLAUDE.md`, `templates/handoff.md`, `plans/ESTADO.md`,
  cabeçalho de `plans/ROADMAP.md` e este handoff.

A hierarquia antiga foi substituída por referência ao 00; o pipeline de design detalhado
foi preservado no 06. O limite de exclusão do 02 exige revisão e autorização; instalação de
protocolo não autoriza aplicar as exclusões preexistentes. Recomendação de modelo não muda
configuração nem dispensa autorização para acionar outro chat.

## 8. Banco / schemas / APIs afetados

Nenhum. Não houve conexão ao banco nem alteração de fonte, configuração ou ambiente.
A igualdade do código com a baseline não certifica o schema nem a saúde dos fluxos publicados.

## 9. Critérios de aceite

| Estado inicial → ação → resultado e efeito proibido | Verificação | Resultado |
| --- | --- | --- |
| Pacote ausente → materializar 00–16 → 17 canônicos acessíveis, sem README antecipado | Presença, metadados e referências | PASSA |
| Regras duplicadas → conciliar AGENTS/CLAUDE → uma hierarquia, auditor separado do executor | Leitura do diff, referências ao 00/04/05/16 | PASSA |
| Regras técnicas existentes → portar governança → preservar guardas e pipeline sem flexibilizar auth/IA/design | Comparação dirigida com baseline e instruções atuais do usuário | PASSA |
| Código publicado → alterar documentação → código/configuração/ambiente preservados | Hashes dos rastreados fora do escopo, HEAD e diff por caminho | PASSA |
| Snapshot de estado antigo → registrar situação atual → não reativar tarefas antigas nem reivindicar publicação | Estado, cabeçalho do roadmap e este handoff | PASSA |
| Links novos → validar → sem destino quebrado no recorte alterado | Verificador de links locais e referências 00–16 | PASSA |
| README/produto adiados → encerrar etapa → não escrever a visão nem antecipar README | Ausência de README novo e hash inalterado de docs/PRODUTO.md | PASSA |

## 10. Testes executados

Verificação documental dirigida: presença/metadados, links, consistência de referências,
comparação de blocos técnicos, hashes de arquivos fora do escopo e whitespace do diff.
Resultado: 17 protocolos, 23 documentos no recorte, 29 links locais conferidos e 1.347
arquivos rastreados fora do escopo preservados. Estado com 41 linhas; handoff com 15 seções.
Testes unitários, integração, E2E e regressão funcional: NÃO TESTADO, pois não houve mudança
funcional. Não chamar a documentação instalada de ciclo de produto homologado.

## 11. Problemas conhecidos

Confirmados: classificação do legado e mapa de canônicos por domínio ainda incompletos;
conteúdo do roadmap e da visão trazido pela baseline não representa automaticamente o presente.
As duas entradas antigas divergiam até nas telas de referência visual; foi mantida a instrução
atual do usuário de que a régua global ainda não está aprovada.
Não verificados: modelos efetivos dos chats, fluxos publicados e schema atual. Riscos/decisões
R-188 e R-146 permanecem no acervo de preservação para reconciliação por item.

## 12. Riscos de regressão

Risco operacional: setup externo ou skill antiga tentar reintroduzir hierarquia/template
substituídos. AGENTS/00/04 atuais governam o trabalho. Não executar instaladores antigos
para corrigir documentação. Nenhum script do produto ou instalador foi modificado ou executado nesta tarefa.

Reversão documental: revisar o diff deste recorte e reverter só seus caminhos, sem tocar no
worktree de preservação ou em mudanças posteriores. Originais rastreados permanecem em Git;
snapshot adicional em `/home/mtx/.local/share/odontoia-reconciliacao/2026-10-11-v2/governanca-incorporacao`.

## 13. Próxima ação exata

Usuário revisa a governança incorporada. Na etapa seguinte, fechar o README com os caminhos
agora existentes; depois discutir/consolidar visão de produto, conciliando decisões preservadas
com comportamento atual. Não executar funcionalidade a partir deste handoff.

## 14. Não fazer

Não fazer commit/push/deploy, não copiar o worktree preservado em lote, não mudar schema,
não apagar legado, não reabrir R-146/R-188, não usar histórico como requisito atual e não
iniciar chats paralelos sem despacho autorizado.

## 15. Estado da documentação

Governança incorporada e Estado atualizado; handoff salvo no formato 04. CLAUDE e template
antigo redirecionados, roadmap histórico sinalizado. README e visão de produto continuam
adiados. Entrega local pronta para revisão; publicação e aceite do usuário não presumidos.
