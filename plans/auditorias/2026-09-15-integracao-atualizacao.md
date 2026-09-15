# Integração da atualização — 15/09/2026

Execução autorizada com Terra. Este relatório cobre a consolidação e os testes descritos;
não declara a atualização completa nem substitui QA do app integrado.

## Base e preservação

- Integração: `/home/mtx/.local/share/odontoia-testes/integracao`, branch `codex/conclusao-atualizacao`.
- Base publicada: `origin/main` em `dc6523a2e8ade0f290910433e9c4669e289481b1`.
- Candidato original: `codex/testes-integrados`, HEAD `cfd3560`, incluindo mudanças locais.
- Snapshots dos dois checkouts originais, patches e manifestos SHA256 preservados em
  `/home/mtx/.local/share/odontoia-testes/preservacao-integracao-20260915-152017`.
- Integração feita por conteúdo sobre a main. Onze conflitos resolvidos manualmente;
  originais preservados. Sem commit/push e sem escrita no banco oficial nesta execução.

## Correções durante a integração

- Ficha/retorno conservam edição de evolução/procedimentos R169, guardas de responsável,
  disponibilidade e navegação semanal, além do vínculo inicial da ficha do candidato.
- Orçamento conserva grupos/composição/notas/titular e descontos/edição/retirada R166–R169.
- PDF e cálculo de saldo ignoram itens retirados e consideram descontos das cobranças.
- Hook de orçamento conserva eventos confirmados ao adicionar itens; contexto do titular
  não volta a ficar indisponível quando o modal já está aberto.
- Plano global oculto não é aplicado ao salvar grupos. Servidor e triggers também recusam
  combinar grupo ativo com novo acordo/plano/pagamento global. Cobrança por etapa permanece.
- Alteração de cobrança invalida também as páginas de financeiro no Consultório e na Clínica.
- Testes legados atualizados para o contrato real de cobranças e a configuração R169 já publicada;
  nenhum prompt clínico foi alterado durante esta integração.

## Banco Free e compatibilidade

Alvo único de escrita: **etlqznuoxiilvxzygpat**. Produção consultada somente por metadados.
Não foi usado `db push`, reset ou cópia de pacientes da produção.

Aplicadas as sete migrations R169, na ordem 14204853 → 14210000 → 14210240 →
14210511 → 14213000 → 14214000 → 15001500.
A terceira inicialmente abortou com `42P16`: `o.*` incluía o novo titular antes das
colunas calculadas da view. A transação reverteu. A variante compatível explicita
as 25 colunas antigas e anexa titular na posição 30, preservando as 29 anteriores.
Não houve DROP CASCADE nem renomeação de contrato público.

Adaptador reproduzível: `scripts/migrations/free-r169b-compatible.sql` na integração.
O SQL histórico publicado permanece intacto. Esta adaptação é específica da ordem
efetiva do Free; não aplicar cegamente na produção, que já contém R169.

Pós-flight: 19 funções R169 conferidas por assinatura/hash; view com `security_invoker=true`,
filtro de itens retirados e titular; triggers de titularidade R163 preservados.
Também aplicadas no Free: `20260915164545_r163b_cartao_parcelado_confirmado.sql` e
`20260915183139_r157_bloquear_plano_global_grupos.sql`.

Contagens antes/depois do schema, **antes das fixtures financeiras**:

| Tabela | Antes | Depois |
|---|---:|---:|
| pacientes | 40 | 40 |
| fichas | 1 | 1 |
| odontograma_eventos | 4 | 4 |
| orcamentos | 29 | 29 |
| orcamento_itens | 36 | 36 |
| pagamentos | 61 | 61 |
| estoque_movimentos | 38 | 38 |

## Verificação executada

| Recorte | Resultado / limite |
|---|---|
| Suite serial orçamento/financeiro/odontograma/auth/estoque/pendências/clínica | 195/195 após corrigir fixture legada sem `cobrancas`. |
| Complemento grupos/agenda/Meu Dia/reconciliação/ficha | 27/27. Há sobreposição; não somar como testes únicos. |
| Dex/retorno adicional | 50/51 inicial; única falha era teste estrutural desatualizado de R169; arquivo corrigido passou 2/2. |
| Typecheck focado nas ações financeiras/orçamento | Zero diagnóstico nos alvos e dependências; não equivale ao projeto inteiro. |
| Parse TypeScript / bundle leve | 138 arquivos sem erro de sintaxe; 18 entradas de UI resolvidas por esbuild. Não é build Next. |
| ESLint nos conflitos revisados | Zero erro; avisos preexistentes no client de paciente. |
| Guarda R157 em PostgreSQL WASM isolado | 5/5, incluindo impedir etapa→pagamento global e permitir etapa. |
| QA autenticado cartão no Free | Três caminhos, distribuição mensal, repetição, corrida cartão/legado, boleto, cancelamento e estorno passaram. |

R163b: R$100 em 3 parcelas em 31/01, 28/02 e 31/03/2027 resulta em 33,33/33,33/33,34.
As métricas da clínica aumentaram exatamente 3333/3333/3334 centavos por mês, sem aumentar
receita particular nem pendência de recebimento. Repetição conservou três parcelas/uma cobrança.
Corrida concorrente entre cartão e legado teve um vencedor e um plano; o outro foi negado.
Os sete orçamentos sintéticos e seus lançamentos foram preservados para conferência.

Logs/manifestos privados, sem segredos no Git:
`integracao-tests-final.log`, `integracao-type-actions.log`, `integracao-lint.log`,
`r163b-cartao-parcelado-manifest.json` e `r163b-cartao-parcelado-run.log`, todos em
`/home/mtx/.local/share/odontoia-testes`.

## Publicação e próximos gates

- Vercel `odonto-ia-teste`: Supabase URL aponta ao Free; APP_URL/SITE_URL ao domínio de teste.
  Valores secretos de integrações externas ainda não conferidos. Nenhuma mensagem real enviada.
- Preview integrado publicado na branch `codex/conclusao-atualizacao`; main/produção não promovidas.
- Autorização de commits/push limitada ao Preview. Publicação inicial `b4aea32`, correções CI `74988a6`.
- Complemento Free: 72 checks autenticados passaram (grupo, etapa, outra conta/clínica, item retirado), sem mutação nas recusas.
- Saúde da sessão integrada; 6/6 testes incluindo rejeição do SDK e URL inválida. Revisão corrigiu três HIGH antes do commit.
- R155 completo ainda não integrado: mapa privado separa sessão, rascunho e reconciliação comercial.
- Na revisão final, patch antigo do candidato que reativava vínculos removidos foi excluído.
  Webhook/serviço de assinatura conservam a versão publicada; não substitui a reconciliação atômica futura.
- Build/Next, duas contas logadas no app, QA de personas, visual/mobile e fluxos completos continuam pendentes.
- Cadastro/cobertura comercial e autonomia de desconto aguardam respostas; kits/ficha e reativação
  pessoal/compartilhamento de orçamento continuam no [plano de conclusão](../PLANO-CONCLUSAO-ATUALIZACAO.md).

## Validação após publicação

- Vercel publicou o Preview; landing e login carregaram. Build ignora TypeScript por configuração existente; o CI separado é obrigatório.
- Typecheck remoto passou após substituir literais BigInt por construtores e tipar explicitamente o ambiente do piloto. Revisão sem HIGH.
- Descoberta automática de Node20 só executava seis scripts manuais R169, sem runtime PostgreSQL, e omitia testes TS de src. Runner stdlib corrigido para descobrir src/**/*.test.ts e executar serialmente: 70 arquivos, 340/340 testes locais; CI final pendente.
- Rollback do estoque: trigger de auditoria falha, zero movimentos/operações/auditorias, saldo zero e versão original; nova entrada posterior passa. Fixture PGlite local, autorização stubada, sem escrita remota.
- Automação Vivaldi: campos seguem vazios após fill/teclado, cliques e screenshot com timeout. IAB exige login Vercel. Sem evidência de login autenticado neste Preview ainda.
