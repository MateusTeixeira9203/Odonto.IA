# Campanha do dentista · QA

Somente odonto-qa `uhuxteswtvgdnlixwrdu`. Responsável: ALFA - QA. Não executa servidor, migration, cleanup, publicação, IA paga ou envio externo automaticamente. Código de produto não é corrigido por estes roteiros.

## Ambientes autorizados

| DENTISTA_QA_SNAPSHOT | Snapshot | Porta | Código |
|---|---|---|---|
| baseline (padrão) | Odonto.IA-dentistaqa |3012|3d14edb|
| embeds69 | Odonto.IA-dentistareteste |3014|69b5dde, só leitura|
| rec3a | Odonto.IA-dentistarec |3016|3a45088|
| final | Odonto.IA-dentistafinal |3012|DENTISTA_QA_FINAL_COMMIT explícito, fornecido pelo Orquestrador após revisão|

Guard: `DENTISTA_QA_READY=3d14edb-QA`. Escrita inicial/reteste: `DENTISTA_QA_WRITE=OWN-e026da00`; final: `OWN-e026da01`. Sem opt-in, a execução aborta antes de Auth/escrita. Cada cenário confere HEAD e `git diff --exit-code -- src` antes/depois; o ambiente é carregado SOMENTE do snapshot e validado por exigirHostQa. Credenciais QA ficam em memória; sem trace, vídeo, storageState, HAR ou log do login.

Subir snapshot é ação explícita pelo runner `npm run qa:snapshot-up -- --nome ... --commit ... --porta ...`, nunca3000. Não atualizar fonte/snapshot no meio da rodada. Não aplicar mudança de banco durante uma rodada.

## Execução

Configuração própria, sem alterar o playwright.config.ts global:

`node node_modules/@playwright/test/cli.js test --config e2e/dentista-qa/playwright.config.mjs --workers=1 --retries=0`

`--list` só descobre; não certifica comportamento. Usar `--grep` ou arquivo por lote somente para retestes autorizados. Todos os testes na regressão final, sem silenciar a falha conhecida DQ-EMBED-02. O único pulo planejado é orçamento sem responsável PERSISTIDO: coluna NOT NULL, catálogo QA registrado; não alterar schema. Null/undefined são cobertos nos JSX reais da lista/detalhe e builder real do PDF com dados sintéticos, explicitamente em estado isolado. Paciente sem dentista existe de verdade e é exercitado.

Fixtures iniciais: `node e2e/dentista-qa/fixture-setup.mjs`, só com escrita opt-in. Aborta se houver qualquer paciente da faixa: não reaplicar após save parcial. `fixture-rec3a.mjs` foi usado uma vez para o reteste em3016 (paciente9, ficha109,eventos309–311,slots601–607); `fixture-touch.mjs` acrescentou paciente10/ficha110/evento312/slot608. Não repetir esses dois scripts. A fixture da rodada final cria tudo necessário, inclusive casos mistos e toque, em faixa nova `e026da01`, com nomes FINAL01. Não há cleanup automático.

## Casos

- 01: Meu Dia, seleção de paciente exato, quatro variações de Encaixe, relato manual/evolução, restauração com faces, persistência, assinatura e PDF. IA real não chamada; não confundir cenário manual com validação da IA.
- 02: criar/editar evolução, novo/antigo/sem responsável/várias fichas, permanentes/decíduos, restauração sem faces bloqueada, Word colado e DOCX real, histórico/data antiga preservados.
- 03: assinatura real pela tela, novo atendimento com evolução/procedimento após assinatura, hash do antigo intacto, negativas Auth Ana/Sara/Bruno.
- 04: orçamento da ficha, item/preço, aprovação, aceite real com canvas, cobrança, PIX, recarga, responsável na lista/detalhe/PDF e OD-010; estados de rede da navegação e export com atraso/erro e recuperação. O nome não tem fetch separado: atraso/erro são do carregamento da página, sem inventar um estado de erro individual do rótulo.
- PDFs: Ficha e Prontuário de sete variações, Orçamento; HTTP, conteúdo, nome de Ana, abertura em navegador e PNG. Endpoints retornam HTML imprimível: não chamar isso de inspeção de todas as páginas de um arquivo PDF binário.
- 10: AST extrai selects reais do snapshot;71consultas x5Auth reais =355. Todos devem retornar200. A listagem usa embeds-clinica.test.ts como referência de relações e amplia para todos os selects com embeds. Uma falha não interrompe o registro das demais. Telas: Início/Meu Dia/Agenda/Pacientes/Financeiro/Configurações e abas de quatro pacientes.
- Recepção: Sara, métricas/links/filtros/dentistas, todos os status/ações oferecidos (cancelado oculto, faltou sem ação), transições persistidas, menu Faltou, cancelar/reabrir assinatura, limpar/redesenhar, erro de rede sem gravação e recuperação, assinatura real com CRO por autor e sem carimbo na ficha. Misto Ana/admin com CRO próprio; encaminhado permanece pendente (REC-4). Toque nativo via CDP além de mouse, sem gravar no teste de toque.

## Evidência, falhas e gravação única

Vault: `Projetos/Odonto-IA/log/QA-DENTISTA-3d14edb-2026-10-25/`; retestes em subpastas por commit. `resultados.jsonl` inclui PASSOU/FALHOU/PULOU, mensagem e artefato. PNG/DOM de tentativa têm timestamp. `inventario-ids-exatos.json` lista objetos próprios após cada teste. `C10-REST-resultados.json` registra fonte/linha/select/HTTP por perfil, sem respostas clínicas de terceiros.

Não reexecutar cenário com escrita já persistida. Na primeira rodada houve seletores antigos, título de ficha derivado e asserção de pagamento anterior ao fim do save; são falhas do harness preservadas. Continuação foi somente no ponto faltante ou releitura, sem recriar atendimento/orçamento/pagamento/assinatura. Scripts de investigação/continuação foram para `log/.../harness-historico/`; não entram na regressão final. A pasta e2e contém o roteiro final corrigido.

Falha de produto: evidência -> Orquestrador/Dev -> revisão/commit local -> snapshot NOVO -> reteste. Banco, regra, risco alto ou decisão antiga vão ao usuário. Sem correção de produto pelo QA. Não pular DQ-EMBED-02 (42703 em conversas_bot.estado); manter teste exigindo200 até decisão/correção autorizada.

IDs protegidos ES/Paciente Exclusao QA, faixas e015e800/e015b300 e fixtures de outros agentes não são editados. Contas somente Ana, Sara, Bruno, admin e protético existentes. A limpeza futura exige lista explícita dos IDs do inventário, incluindo objetos de assinatura/documentos; nenhum DELETE por prefixo ou paciente fora da lista. Gatilhos permanecem ativos.
