# Início e retestes — ALFA QA 3

Config global do QA2 preservada. Testes de produto não corrigem código.
Snapshots: 3014/42c80a5 e 3015/afdf3d0; somente host odonto-qa validado pelo runner.

Relatório final e IDs preservados:
C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-OD-005b-inicio-e-retestes-2026-10-24.md

Resultado: Início 13/13 no DEPOIS; ANTES 12 aprovados + 1 não exercitado, consolidando rodada e F06 isolado.
33 unitários dirigidos passaram. Typecheck isolado e lint desta pasta passaram.
O typecheck global final encontrou erro externo em e2e/meu-dia/lacunas.spec.ts.
Retestes NÃO estão integralmente verdes: f1 FALHOU por escrita de Bruno/B com paciente/agendamento A,
também reproduzida em UMA chamada no ANTES. Falha preexistente contra schema QA; produção não testada.
MD01 PSR persistiu; Ficha/edição e MD04 após conclusão não concluídos. Relatório separa toda cobertura.

## Executar apenas leitura do Início

Definir QA_BASE_URL para localhost:3014 ou3015 e INICIO_EVIDENCE_DIR no vault.
node e2e/inicio/run.cjs e2e/inicio/fluxos.spec.ts e2e/inicio/visual.spec.ts --workers=1 --retries=0 --output=<vault>/resultados

run.cjs lê .env.qa-contas em memória e injeta variáveis sem imprimir senhas.
Sem storageState/HAR/trace/vídeo/captura de login. Teste SKIP significa NÃO TESTADO.
Números podem mudar pelo trabalho paralelo no banco QA; não representam invariância global.

## Escritas e comparação histórica

retestes.spec.ts exige INICIO_RETEST_READY=afdf3d0. Fixtures existentes com Ficha são recusadas pelo helper,
evitando repetir save automaticamente. Não rodar a suíte inteira nas fixtures finalizadas atuais.
O caso B1 DEPOIS já foi enviado UMA vez; aguardar correção e liberação antes de novo teste.
Preparar nova rodada com contrato Bruno×A recusado e Ana×A permitido, no commit corrigido indicado.

comparativo-b1.spec.ts exige ANTES e INICIO_COMPARATIVO_B1=1, e recusa execução se comparativo-B1-ANTES.json existir.
A comparação histórica JÁ FOI CONCLUÍDA. NÃO repetir, não remover a trava nem o arquivo para repetir.
Uma preparação anterior parou antes de criar fixture/enviar B; a preparação corrigida enviou UMA chamada.

complementos.spec.ts está preparado, mas NÃO foi executado.
inspecao.cjs apenas SELECT nas fixtures QA INICIO3; nunca limpa ou altera dados.
Todos os IDs, inclusive os criados pelo defeito e uma escrita posterior de autoria não verificada,
estão no relatório e no JSONL. Preservar até nova autorização.

## Cobertura e limites

Normal, saudações, métricas, aviso trial, procedimentos, cancelar realizado, atenção,
recepção/atalhos/filtros e assinatura apenas aberta/cancelada; 1440/900/390 claro/escuro.
Sem aceite integral F01–F23: vazios, loading/erro, sucesso de status/assinatura e todos os estados
exigem complementos. As 24 capturas são de viewport; inspeção dirigida não equivale a olhar
integralmente cada área abaixo da dobra. Artefato próprio do Início não foi definido no contrato.
