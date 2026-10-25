# Meu Dia — roteiro QA e reteste de 24/10/2026

Rodada autorizada pelo usuário: ANTES 3010/42c80a5 e DEPOIS 3011/0d5d5b4,
somente odonto-qa. f1-mínima excluída. Resultado e evidências ficam no vault,
`Projetos/Odonto-IA/log/QA-meu-dia-reteste-2026-10-24.md`.
O inventário abaixo descreve cobertura planejada; não equivale a aprovação integral.
R47/R48/R51 ficaram inconclusivos na automação (disclosure fechado); alerta/orto
foram confirmados por SELECT próprio após a asserção procurar o alerta no resumo.
Houve seleção intermitente de outro slot após Encaixe (duas ocorrências observadas);
as fixtures criadas foram preservadas e reutilizadas por ID, sem repetir criação.

Os testes são independentes, sequenciais pela configuração global, sem retries.
`captureState` grava PNG/DOM no output configurado; use output e reporter JSON no
vault para preservar resultados. Não gravar credenciais, sessões ou trace.
`restauracao.spec.ts` cobre OD-001r; `regressoes.spec.ts` cobre chips/consumidores,
pares antes/depois e captura opcional somente leitura da autoria MD-04.

Responsável: ALFA - QA. Somente esta pasta. Configuração global, `@playwright/test`,
package/lock e testes de Ficha/Orçamentos pertencem ao OD - QA 2.
Contrato: inventário R01–R60 e aceites nas notas OD-001/OD-002 do vault.
Este roteiro não substitui esses contratos nem representa um resultado PASSOU.

## Execução, somente depois das duas correções

Não iniciar servidor, testes ou navegador automaticamente. Configuração acordada:
workers 1, retries 0, sem webServer, trace/vídeo desligados. Não salvar storageState,
HAR, cookies ou capturas do login. Reporter não deve expor variáveis de ambiente.

Variáveis em memória, carregadas das contas fictícias de `.env.qa-contas` pelo
operador/configuração do QA2, sem alterar o arquivo ou imprimir seu conteúdo:

| Variável | Uso |
|---|---|
| `MD_RETEST_READY=OD-001r+OD-002g` | Guard aprovado; sem ele cada teste é SKIP antes de login ou escrita |
| `MD_SCOPE=changed` | Padrão. Só MD-01/MD-03/MD-04; não é inventário completo |
| `MD_SCOPE=final` | Rodada final, inclui fluxos e matriz visual |
| `QA_BASE_URL=http://localhost:3011` | Somente snapshots3010/3011; nenhum outro host/porta é aceito |
| `QA_EMAIL`, `QA_PASSWORD` | Dra. Ana QA |
| `QA_CARLOS_EMAIL`, `QA_CARLOS_PASSWORD`, `QA_CARLOS_NAME` | Carlos e nome exato do seletor QA para MD-04 |
| `QA_SECRETARIA_EMAIL`, `QA_SECRETARIA_PASSWORD` | Leitura negativa R59 |

Após a instalação/configuração do QA2, descoberta estática sem executar navegador:
`npx playwright test e2e/meu-dia --list`.
Quando o Orquestrador confirmar OD-001r/OD-002g no snapshot, executar
`npx playwright test e2e/meu-dia --workers=1 --retries=0` com as variáveis acima.
Não confundir `--list`, compilação ou testes SKIP com reteste funcional.

Cada teste cria paciente `QA MD ...` e Encaixe próprios pela UI. IDs do slot e nome
ficam no anexo `registro-sintetico-criado`. Não escreve em F1, ORC1, ORC2 nem fixtures
de terceiros. Não limpa dados automaticamente; conservar evidência de falha. Não
retentar teste com escrita. Timeout no save requer conferir banco/Prontuário antes
de qualquer repetição. `saveOnce` confirma slot registrado, recarga e leitura; não
presume que o foco fique na consulta, pois o app pode avançar para outro slot.

Dex é interceptado com o contrato das rotas de formatar/sugerir evolução, com dados
sintéticos. **IA real: NÃO TESTADA.** Falhas do Dex e offline são simuladas no cliente.
Offline sempre é revertido em finally. Rascunho é conferido na mesma aba/contexto:
trocar o perfil Playwright destrói sessionStorage e não prova defeito do produto.

## Rodada dirigida agora

| Arquivo | Recorte | Resultado que o teste exigirá |
|---|---|---|
| correcoes.spec.ts | MD-01 PSR | S1:0→1→2; remover/desfazer e novo clique3; Ctrl+S e persistência; entrada no consumidor direto Prontuário |
| correcoes.spec.ts | MD-03 dentes |390:32botões≥32px em4×8;900/1440:2×16;768 também medido; claro/escuro e seleção26/27 |
| correcoes.spec.ts | MD-04 autoria | Ana cria/encaminha em paciente novo; Carlos conclui com outra sessão; histórico Ana diz concluído por Carlos; evento comum sem essa indicação |

O aceite completo MD-01 ainda exige conferir/editar o código3 no formulário da
Ficha nova em conjunto com QA2; o teste atual abre e captura esse consumidor,
sem presumir seletores novos da OD-003f. A parte ausente fica NÃO TESTADA até isso.
OD-001r deve ser comparada com seu contrato/commit disponibilizado pelo Orquestrador;
o guard não comprova sozinho que o snapshot contém as correções.

## Inventário: roteiro automatizado e complemento da rodada final

“Preparado” significa código escrito e revisado estaticamente, **não executado**.
Não rotular um R inteiro como PASSA quando apenas uma parte foi verificada.

| Inventário | Preparado nesta pasta | Complemento necessário antes de fechar R |
|---|---|---|
| R01–R06 | encaixe novo/existente; seleção explícita; status com recarga; arrasto mouse/Enter/Espaço | prioridade automática?ag/em-atendimento; arrasto toque real; fila vazia/primeira sessão em conta isolada |
| R07–R09 | nome QA e alerta; bloqueio de atendimento registrado após salvar | idade/contagem; todos registrados sem pendentes; perfil/primeira sessão |
| R10–R14 | save comum/Ctrl+S; sem rascunho; limites; recarga | duplo acionamento sem duplicação; save durante áudio; falha parcial visita salva/odontograma não; SELECT finalizado/completed e notificação única |
| R15–R19 | mock tipado; lote; observações; alerta/orto com recarga; endo/implante abertos | conferir Conduta integral e especialidades preenchidas no histórico; complemento endo real simulado com contrato próprio |
| R20–R22 | TXT no input real; Dex502/offline preserva texto | microfone/silêncio/áudio pendente se houver dispositivo; PDF/DOCX; sugestões locais e escolha de tipo ambíguo; PDF500 antigo continua separado |
| R23–R27 | editar nome/face; lote/desfazer; encaminhar rascunho; ficha nova | remover/desfazer linha; quatro situações e condição pré-existente; tratamento aberto; persistência desses caminhos |
| R28–R30 | evolução sugerida→revisão→save | Marcar retorno com horário livre/pedido protético; Gerar orçamento a partir do Meu Dia até voltar. Financeiro detalhado é QA2 |
| R31–R40 |32dentes/seleção/medidas; três tabelas; PSR | Dentes/Regiões, decíduos, legenda/símbolos, lote com4situações/multiface/ponte/ausente/catálogo/regional/orto; abrir detalhe e Escape; ditado reabre dente |
| R41–R46 | PSR editável/desfazer; edição de face na linha; endo/implante visuais | mapa5faces cicla3estados; raizendo/chips; continuar aberto; catálogo/preço; próxima/data/detalhes/observação/remover; histórico do dente |
| R47–R52 | plano A fazer/Próxima/Desfazer/recarregar/Registrar hoje; concluir encaminhado em2identidades | encaminhar plano salvo viaRPC; ler tudo/orto; importar histórico Word em ficha própria |
| R53 | anexarTXT no campo | Documento de base→Usar este documento de base, sem persistência indevida; não confundir com o anexo do campo |
| R54–R56 | nenhum teste altera onboarding compartilhado | conta isolada antes da primeira ficha; exemplo/Agora não; marcos e Clínica em formação |
| R57–R60 | offline/Dex502; matriz visual; secretária sem botão e redirecionada | loading/error boundary; recusa servidor com sessão secretária; isolamento Carlos/outro tenant autenticados e ausência de efeito indevido |

Roteiros complementares que gravam devem usar os próprios registros anexados e ser
automatizados/validados com os seletores finais antes da rodada completa. O código
preparado não cobre todas as ramificações acima; essa tabela torna a lacuna explícita.

## Matriz visual e uso final

`visual.spec.ts`:390/768/1440, claro/escuro pelo botão real; vazio,22procedimentos,
PSR+endo+implante abertos, histórico salvo. Cada tabela ganha captura na própria
posição de rolagem. DOM mede largura da página/tabelas/dentes. Depois do save,
mesmo registro é aberto nos dois snapshots para pares antes/depois somente leitura.
Isso não equivale a pares de rascunho idêntico em layouts antigos/novos: montar tais
pares por seus respectivos controles e estado equivalente na rodada final.
Usar screenshot de viewport em modais/fixos; fullPage altera geometria e pode limpar
canvas de assinatura. Screenshot não substitui inspeção de recorte/sobreposição,
foco/contraste, rolagem interna e tamanho dos demais alvos de toque.

Artefato v8 do vault deve ser servido por HTTP e medido por DOM na rodada visual;
não file://, nem leitura de HTML como substituto de renderização. Os resultados
e prints vão ao vault/relatório por tela, sem adicionar acervo ao repositório.

Roteiro de uso:3pacientes QA novos, um restaurador, um endo e um orto. Para cada um:
abrir/encaixar, escrever/organizar, revisar odontograma/tabela, salvar, conferir
histórico, abrir Ficha/gerar orçamento (QA2 cobre detalhe financeiro), voltar ao Meu
Dia. Anotar atrasos/confusões/botões/cortes. Não declarar essa jornada concluída
apenas porque os testes isolados passaram. Slots antigos17:09/17:26 são checkpoints
conhecidos, não pacientes para repetir criação ou save às cegas.
