# Campanha do dentista · QA

ALFA - QA. Somente odonto-qa `uhuxteswtvgdnlixwrdu`; contas existentes Ana, Sara, Bruno, admin e protético. Sem produção, 3000, migration, cleanup automático, push, merge, deploy, IA paga ou envio externo. QA não corrige produto.

## Configuração por ambiente

Não há porta, commit, snapshot ou destino do vault fixados nos roteiros. Configure todos antes da EXECUÇÃO. A descoberta --list não exige variáveis, snapshot existente, registro, ambiente QA nem acesso ao banco:

| Variável | Contrato |
|---|---|
| `DENTISTA_QA_SNAPSHOT` | Nome do snapshot criado por qa:snapshot-up, iniciado por dentista; sem caminho/.. |
| `DENTISTA_QA_COMMIT` | SHA completo (40 hex) revisado e aprovado para esta rodada |
| `DENTISTA_QA_PORT` | Porta do snapshot registrado, dentro da faixa do runner; nunca3000 |
| `DENTISTA_QA_EVIDENCE_DIR` | Caminho absoluto do diretório de evidências escolhido pelo operador no vault |
| `DENTISTA_QA_READY` | Sete primeiros caracteres do SHA + `-odonto-qa` |
| `DENTISTA_QA_WRITE` | `OWN-e026da02`, somente quando houver escrita autorizada |

Exemplo PowerShell para o opt-in, depois de definir SHA/snapshot/porta/evidências:

```powershell
$env:DENTISTA_QA_READY=$env:DENTISTA_QA_COMMIT.Substring(0,7)+'-odonto-qa'
$env:DENTISTA_QA_WRITE='OWN-e026da02'
```

`initialize()` roda no beforeAll (ou explicitamente nos preparadores); só então o guard verifica opt-in por versão, HEAD, registro da porta/snapshot/SHA e `git status --porcelain --untracked-files=all -- src`. As verificações continuam antes/depois dos testes. Importar support não lê ambiente/registro, não roda Git, não cria cliente/diretório nem conecta ao banco. Arquivos novos em src também bloqueiam. O ambiente vem somente do snapshot e passa por exigirHostQa. Credenciais ficam em memória; sem trace, vídeo, HAR, storageState ou captura de login.

O browser usa allowlist no CONTEXTO (inclusive novas abas/popups): somente origem local configurada e HTTPS do host QA; `data:`, `blob:` e `about:` são locais. Todos os outros hosts são abortados, incluindo fontes/telemetria externas. É o padrão de bloqueio geral do Dev2. O observador Supabase aceita apenas GET/HEAD no host QA.

## Execução explícita

Subir um snapshot revisado é comando separado: `npm run qa:snapshot-up -- --nome <nome> --commit <sha> --porta <porta>`. Nunca atualizar código no meio da rodada. Os roteiros não iniciam servidor.

Descobrir sem ENV e sem inicializar o harness (também funciona pelo config global do qa:suite):

`node node_modules/@playwright/test/cli.js test --config e2e/dentista-qa/playwright.config.mjs --list`

Criar a fixture NOVA somente com autorização de escrita e opt-in:

`node e2e/dentista-qa/fixture-setup.mjs`

Aborta se qualquer paciente da faixa existir. Não reaplicar após escrita parcial. A preparação cria as variações, os slots de Dia/recepção/toque e o caso misto Ana/admin com encaminhado. `fixture-rec3a.mjs` e `fixture-touch.mjs` são entradas históricas desativadas antes de Auth/banco; não usar para completar uma rodada parcial.

Executar a rodada aprovada:

`node node_modules/@playwright/test/cli.js test --config e2e/dentista-qa/playwright.config.mjs --workers=1 --retries=0`

Faixa desta versão: **e026da02**, nomes FINAL02. Faixas e026da00 anteriores e e015e800/e015b300, ES, Paciente Exclusao QA e fixtures de outros agentes permanecem intocadas. Repetição de escrita persistida não é retry seguro; verificar evidência/estado primeiro.

## Casos

- 01: Meu Dia, seleção exata/Encaixe em4variações, relato/evolução manual, restauração com faces, persistência, assinatura e export. IA real não chamada.
- 02: criar/editar, novo/antigo/sem dentista/várias fichas, permanentes/decíduos, bloquear restauração sem face, Word colado e DOCX real, data/histórico preservados.
- 03: assinatura real pela tela, novo atendimento com evolução/procedimento, hash do antigo intacto, negativas Auth Ana/Sara/Bruno.
- 04: orçamento/item/preço/aprovação/aceite real/cobrança/PIX/recarga; nome na lista/detalhe/export, OD010; atraso/erro de navegação e export com recuperação. O nome não possui fetch individual: testes de rede operam o carregamento da página.
- Exports: Ficha/Prontuário em7variações e Orçamento, HTTP/conteúdo/nome e abertura no browser. Endpoints entregam HTML imprimível; essa prova não equivale a inspecionar todas as páginas de um PDF binário.
- 10: AST de selects do snapshot; referência de relações em embeds-clinica.test.ts, expandida para todos os embeds.71selects x5Auth =355 no lote já executado. Seis telas e três abas em4pacientes. Continua exigindo200 em TODAS as consultas.
- Sara: métricas/atalhos/filtros/dentistas, todos estados/ações oferecidos, transições e Faltou persistidos; assinatura/cancelar/reabrir/limpar/redesenhar, rede/volta, CRO por autor/sem carimbo; misto e REC-4 preservado; toque nativo CDP e mouse.

## Falhas esperadas e limites

**DQ-EMBED-02 (`conversas_bot.estado`) é achado antigo decidido pelo usuário, FORA do envio atual. Não é pulado nem silenciado.** O C10 mantém5falhas HTTP400/42703, uma por conta, e continua vermelho. O relatório da rodada deve confirmar que estas são as únicas falhas desse lote: send-pdf200nos5 e nenhuma nova falha. Não declarar C10 integral verde, nem reabrir schema/regra por esse achado.

O único pulo planejado é orçamento sem responsável PERSISTIDO: coluna NOT NULL no catálogo QA. Não alterar schema/migração. Os JSX reais de lista/detalhe e builder real de export recebem null/undefined em testes de estado isolado; são prova distinta de Auth/UI persistida. Paciente sem dentista é permitido e exercitado de verdade.

DQ-REC-02 rede ainda depende de correção/revisão/novo snapshot. Regra REC-4 permanece: recepção não assina encaminhado. Casos antigos decididos não viram correção autônoma.

## Evidência e manifesto de limpeza

Destino vem de DENTISTA_QA_EVIDENCE_DIR. resultados.jsonl contém PASSOU/FALHOU/PULOU, motivo, artefato e horário; PNG/DOM por tentativa com timestamp. Nunca imprimir env, senha, cookie, JWT, sessão ou trace.

`inventory.mjs` faz somente SELECT em transação READ ONLY no QA:

- começa na lista exata de pacientes e nas auditorias/cópias desses pacientes;
- expande filhas pelas FKs EFETIVAS, incluindo compostas, até fechar os vínculos;
- enumera PKs/IDs/chaves compostas de ficha_arquivos, ficha_evolucoes, atendimento_eventos, orcamento_eventos, orcamento_cobranca_itens, documentos e demais filhas;
- enumera notificações por referências a entidades próprias ou nome completo FINAL02; guarda os IDs exatos, nunca autoriza DELETE por texto;
- enumera referências de assinatura/PDF/anexos e objetos Storage por id/bucket/path, incluindo órfãos nos diretórios exatos de pacientes próprios, sem baixar binários;
- escreve inventario-ids-exatos.json com dados e `_cleanup`: chaves por tabela, objetos e referências; avisa/bloqueia limpeza sem PK. Nenhum DELETE, TRUNCATE ou storage remove é executado.

A coleta lê QA_DB_URL via lerVariavel, sem carregar outras variáveis do arquivo compartilhado. Conexão validada por exigirHostQa. O manifesto NÃO autoriza cleanup: limpeza futura só com IDs/chaves/paths enumerados e respeito a retenção/gatilhos. Nunca prefixo, nome ou clínica como critério de exclusão.

Fluxo por bug: evidência -> Dev -> revisão/commit LOCAL -> snapshot NOVO -> reteste. Rodada final de TODOS os roteiros no commit final fornecido pelo Orquestrador. Falhas anteriores do harness ficam no log da campanha, sem reproduzir gravação persistida nem esconder tentativa inválida.


## Rodada limpa FINAL02 (após commit local pelo Revisor)

A primeira execução e026da01 é HISTÓRICO, com triagem de13falhas no vault; não é veredito. Esta versão exige namespace e026da02 e WRITE=OWN-e026da02, preservando integralmente e026da00/e026da01. Produto continua no snapshot final aprovado; commit dos testes não muda o HEAD do produto servido.

A ordem lexical dos13arquivos faz parte do contrato, com workers=1/retries=0: criação/aceite do orçamento -> pagamento/exports -> 04-pos-orcamento-estados-isolados; recepcao-01-fluxos -> recepcao-02-toque -> recepcao-03-mista-releitura. --list deve mostrar62corpos nessa ordem; não rodar preparadores e releituras fora da sequência numa faixa nova.

As esperas de save exigem resposta completa e estados finais. A assinatura mista aguarda os dois autores antes do baseline; ordena registros por id para hashes estáveis. Seletores Sara incluem o nome completo FINAL02, distinguindo faixas antigas sem tocar nelas. O coletor usa arrays text[] do catálogo e falhas do inventário/guard entram no resultado FALHOU do hook, não como PASSOU prematuro.

Config principal mantém62corpos. Dois complementos reais REC-03/04 estão em zz-final-assinaturas.spec.mjs e usam config separado: playwright-assinaturas.config.mjs. Executar depois dos62, sem retries; criam somente fichas109/111 e slot609 próprios da faixa02 e usam ficha103 própria para o dono. A prova REC-04 é chamada HTTP da Server Action com cookies Auth reais e PNG desenhado no canvas real; salvarAssinaturaConsulta não tem chamador UI no snapshot. Não descrever essa prova como um botão diário testado.
