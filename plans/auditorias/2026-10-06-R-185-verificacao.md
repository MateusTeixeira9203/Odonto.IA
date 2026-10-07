# R-185 — verificação dirigida do lote de restauração

**Baseline conferida antes da edição:** `main` em `b63775f5dafad270f9fb78177521231fdd24bba3`; checkout já continha alterações documentais não relacionadas, preservadas. Execução local em Next `127.0.0.1:3106`, somente neste processo com `STRIPE_BILLING_ENABLED=false`, usando a clínica QA `c959f510-c490-410d-9eb6-8c1dfa5b4080` e o paciente sintético `723e6d23-48fd-4850-8619-811dba34b457`, sem contato. Nenhum deploy ou alteração de schema. A confirmação abaixo **não prova o deploy**.

## Resultado e evidência reproduzível

Antes, a auditoria de confiabilidade nesta clínica havia reproduzido D15+D25, faces V+O: 4 eventos após aplicar, 8 após repetir, 8 persistidos em um save e 8 itens no orçamento QA. Isso demonstra o defeito nesse fluxo, sem identificar o gesto ocorrido na ficha da cliente real.

Depois, o contrato aprovado nesta conversa considera a segunda aplicação idêntica a mesma intenção apenas no rascunho atual. A chave compara dente, faces, data, status/origem/momento, autor, encaminhamento, procedimento, grupo, observação e detalhe. Diferença explícita preserva outro evento; assinado ou identidade antiga incompleta não é descartado. A proteção usa atualização funcional do estado no `FaixaLote` compartilhado por Prontuário/Ficha e Meu Dia. A contagem visual agrupa V+O em um cartão por dente; a contagem bruta abaixo vem do payload e do banco.

| Caminho QA | Rascunho e ação | Payload enviado | Persistido / recarga | Orçamento |
|---|---|---|---|---|
| Prontuário → novo atendimento | D15+D25, V+O; reaplicar e clique duplo: 4 eventos brutos, 2 cartões agrupados | 4 IDs únicos; um POST `salvarAtendimentoDoProntuario` | Ficha `b405af3e-656f-4472-bc64-03a4e3f17ce4`: 4 linhas, mesmos IDs; recarga mostra 4 procedimentos | 4 candidatos; orçamento QA `b1116fbf-1275-4b1e-9d10-4f68d6c29f2d`, `rascunho`, 4 itens × R$ 100 = R$ 400 |
| Meu Dia → novo encaixe do mesmo paciente QA | D15+D25, V+O: 4; reaplicar/clique duplo: 4; escolher “Próxima sessão” e aplicar: 8, pois há 4 novas intenções | 8 IDs únicos; 4 `sessao_atual` + 4 `proxima_sessao`; um POST `salvarVisitaMeuDia` | Ficha nova `57f94ea5-7ac1-4de0-af76-dd99dd7b38a0`: 8 linhas, 4 por momento; recarga mostra 8 procedimentos | Modal mostrou 8 candidatos distintos; cancelado sem criar outro orçamento |
| Ficha → data clínica editada | D35 V realizado: reaplicar em 06/10 manteve 1. Editar o primeiro para 05/10 e aplicar em 06/10 mostrou 2 eventos no detalhe (o cartão agrupado ainda diz “1 registro”) | Teste do montador de payload conferiu 05/10 + 06/10, sem metadados transitórios | Ficha `75d469a8-7529-4527-ac3f-69cbdda82ded`: IDs `7064cca1-3e7d-40b6-adc7-12abc5fd147d` e `6a9d453b-931e-4457-815c-743aabd1510c`, datas respectivas 05/10 e 06/10; recarga mostrou 2 procedimentos | Modal mostrou 2 registros clínicos disponíveis e 2 selecionados; cancelado |

Payload capturado temporariamente na entrada das duas server actions, limitado ao ID do paciente QA e somente IDs/dente/face/momento; instrumentação removida após a medição. Consulta às tabelas reais `odontograma_eventos`, `orcamentos` e `orcamento_itens`, sempre filtrada para esta clínica/paciente QA. Não se inferiu schema produtivo das migrations.

## Arquivos e checagens

Código: `src/lib/odontograma/lote-multidente.ts`, `src/components/odontograma/faixa-lote.tsx`, `src/app/dashboard/meu-dia/_components/registrar-painel.tsx`, `src/types/odontograma.ts`. Testes: `src/lib/odontograma/lote-multidente.test.ts`. Contrato: `plans/specs/R-185-lote-restauracao-idempotente.md`. `FichasTab` não é renderizado no perfil atual e foi deixado intacto; o perfil usa `ProntuarioTab → useRegistrarPainel → FaixaLote`.

`tsx --test` nos testes do lote e do dedup existente: 19/19 passaram (inclui regressão da data realizada editada). ESLint focal: passou. Typecheck global numa cópia limpa isolada, com `.next` gerado nela: passou com heap Node de 4 GB. O typecheck do checkout encontra referências geradas obsoletas em `.next/types`; a primeira checagem da cópia limpa bateu no limite de memória Node de 2 GB, não em erro de tipos. Isso não foi usado para declarar aceite funcional; os caminhos reais acima foram executados.

## Limites e reversão

O teste é local contra dados sintéticos no banco de produção; não valida o artefato implantado, eventos históricos nem a causa da ficha da cliente. Duas abas foram investigadas à parte em `2026-10-06-R-185-duas-abas.md`. O contrato protege só a entrada do lote no rascunho: não há deduplicação global ou limpeza retrospectiva. Os metadados transitórios de autor/data não persistem para comparação em um editor antigo que reimporte eventos já salvos. Reverter o commit de código `2ff31a1`; os dados QA gerados são registros sintéticos de auditoria, não devem ser apagados por um `git restore`. Nenhum push, migration, deploy, mensagem ou cobrança foi feito neste recorte.
