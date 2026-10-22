# Ficha do paciente v11 — proposta atual
20/10/2026 · Arquiteto de Produto / Curador. Referência: ficha-paciente-v11.html. Proposta visual para revisão no Maestri, não autorização para implementação.

## Resultado e fluxos
- Linhas compactas, observação expandida abaixo, odontograma menor e expansível. Somente os tratamentos da dentista atual, agrupados por dente. Não há seletor de outro profissional nem opção Todos. A ficha permanece uma unidade de tratamento; a visualização não transfere autoria.
- Nome editável com dois cliques pelo responsável, com F2 como alternativa no exemplo. Enter/saída conclui. Outro profissional não edita nome e observação no perfil fictício Sofia.
- Status muda com um clique na linha. O ciclo demonstrado é Planejado → Em andamento → Concluído → Planejado. Transições permitidas, histórico e prevenção de alterações acidentais exigem revisão; não assumir que esse ciclo completo é regra clínica aprovada.
- Encaminhar fica junto ao título Procedimentos. Selecionar procedimento, destinatário e observação → confirmar simulação. Não muda autor nem responsabilidade real.
- Materiais usados por mim abre registros por visita da profissional. Origem desejada: kits registrados no Meu Dia, sem digitar de novo. Nenhuma quantidade ou consumo é inferido.
- Orçamento da ficha abre a proposta de orçamento v6 nesta pasta. Retorno, documentos, PDF, novo atendimento e Apresentar são ilustrativos; preservar seus fluxos reais antes de implementar. Remover menus vagos não autoriza excluir funcionalidades existentes.

## Assinatura do atendimento
Coletar assinatura → escolher a sessão → selecionar somente seus procedimentos → revisar data, profissional, título, observações da sessão e nome/dente/faces/observações dos itens → confirmar leitura e traço fictício → confirmar simulação. No modo com procedimentos, seleção vazia não avança; no modo somente observações, texto da sessão é obrigatório. A v9 associa o documento à identidade da sessão na memória do protótipo; não prova vínculo persistente no produto nem realização de itens planejados. O status atual não é apresentado como estado histórico no documento.

O documento é uma cópia preservada do conteúdo selecionado. A ficha inteira não trava: itens não incluídos continuam editáveis pelo responsável; novos atendimentos permanecem possíveis no produto desejado. Nome e observação de itens assinados não são sobrescritos diretamente. Evolução posterior de status não reescreve o documento assinado; a v9 não inclui status histórico no documento.

Retificar → propor conteúdo corrigido e motivo obrigatório → revisar → nova assinatura. Documento anterior permanece consultável, e o novo identifica a versão que retifica. Cancelar não cria nova versão assinada. A v9 oferece retificação da última versão de cada cadeia, preservando a sessão de origem; múltiplas cadeias simultâneas ainda exigem teste adicional. A retificação é documental e não atualiza campos clínicos ou financeiros automaticamente; definir reconciliação estruturada antes da execução.

## O que não fará
Não assina a ficha inteira; não apaga histórico nem reaproveita uma assinatura para conteúdo novo. Não gera assinatura real, PDF assinado, prova de identidade, envio ou persistência. Não transfere responsabilidade, autoria ou repasse pelo encaminhamento. Não prevê materiais, quantidades, baixa de estoque ou custeio. Não altera o sistema, banco ou produção.

## Permissões e lacunas
Regra desejada: cada dentista vê seus tratamentos e seus registros de materiais. A proposta atual contém somente os procedimentos, materiais e evolução de Sofia; Lucas aparece apenas como destinatário de encaminhamento, sem expor seus tratamentos. Isso não comprova isolamento real: validar leitura e escrita no servidor com duas identidades, inclusive acessos diretos. A visibilidade do restante do prontuário e eventuais exceções de gestão continuam por definir, sem presumir autorização compartilhada.

Encaminhamento: definir quem inicia, aceite/recusa, destino interno/externo, quando muda responsável, notificações e impacto comercial. Materiais: manter autoria por atendimento; encaminhamento não transfere uso passado. Quantidades, composição histórica de kits, correções e estoque seguem indefinidos. Assinatura: identidade/representante, integridade, retenção, permissões, recusas e falhas pendentes. Preservar campos de especialidade e capacidades existentes ausentes no desenho.

## Evidências e limites
PASSA dirigido no HTML: seleção de procedimento, revisão do item escolhido, assinatura fictícia, versão 1, retificação com motivo, segunda assinatura e coexistência das versões 1 e 2. Evidência: ficha-paciente-v6-retificacao.png. Outras interações foram verificadas pontualmente em versões anteriores; não houve regressão integral da v6.
NÃO TESTADO no produto: persistência, recarga, autorização direta, isolamento, integração, validade de assinatura, acessibilidade integral e todos os tamanhos/temas. Protótipo perde dados ao recarregar.


## Ajuste v7 — escopo dirigido
Removida da demonstração a linha clínica de Lucas e os controles para alternar profissional/agrupamento. Odontograma e seleção de assinatura derivam da coleção de Sofia. Encaminhar mantém a seleção dos próprios procedimentos e Lucas como destinatário fictício. Confirmar continua sendo só simulação: não transfere responsabilidade nem passa a exibir tratamento do destinatário. Fluxo de aceite do encaminhamento e saída/continuidade da visualização após transferência permanecem pendentes. Captura ficha-paciente-v6-retificacao.png documenta teste anterior; não é prévia da v7.

## Verificação dirigida v7
PASSA no HTML local: três procedimentos, todos de Sofia; sem seletor de outro dentista; Encaminhar abre somente os três itens próprios e Lucas como destinatário; confirmação fictícia preserva autoria e não expõe dados do destinatário. Clique no dente 36 localiza somente a restauração de Sofia. Prévia: ficha-paciente-v7.png. Assinatura/retificação posteriormente testadas nesta v7, conforme seção abaixo. Isolamento real continua NÃO TESTADO.

## Assinatura e retificação — teste completo v7, 20/10/2026
Ambiente: HTML local na porta 8901, dados fictícios, somente memória. Nenhuma alteração no HTML nem no sistema nesta rodada.

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Seleção restrita na demonstração | PASSA | Apenas três restaurações de Sofia, dentes 26, 36 e 46; nenhum procedimento de Lucas disponível. |
| Assinar somente o escolhido | PASSA | Selecionado apenas dente 46, restauração DO concluída. Revisão e documento 1 contêm só esse item, contexto de Sofia e observação. |
| Assinatura fictícia | PASSA | Confirmação de leitura, traço fictício e confirmação criaram documento 1. Ficha permaneceu aberta. |
| Retificação | PASSA | Complemento fictício na observação do mesmo procedimento e motivo informados; revisão 2 exibiu o conteúdo proposto e exigiu nova leitura/traço/confirmação. |
| Preservação e autoria exibida | PASSA | Documentos 1 e 2 abertos e comparados: original sem complemento; retificação com complemento/motivo. Ambos identificam Sofia e somente o dente 46 selecionado. |

Evidência: ficha-v7-teste-retificacao.png. Não houve falha no percurso exercitado. A seleção usa somente dados de Sofia no exemplo; não há segunda identidade nem backend para comprovar isolamento. A retificação é texto livre e não valida vínculos clínicos mencionados manualmente: não é garantia de que texto arbitrário não possa citar outro profissional ou procedimento. Esse limite já exige reconciliação estruturada antes da implementação. Segurança, persistência, assinatura válida e integração continuam NÃO TESTADOS. Recarregar descarta a sessão.


## Organização introduzida na v8 — histórico
Histórico das sessões recolhível substitui documentos no corpo da ficha. Cada visita mostra data, Sofia, o que foi feito e observação geral da sessão; observação do procedimento continua separada. Concluir um procedimento abre confirmação da data (20/10/2026 como padrão fictício) e acrescenta a conclusão à sessão sem encerrar a ficha. Repetir a mesma conclusão na mesma data não duplica a linha no exemplo; correções de status não apagam o passado. Idempotência real, mudança de data e vínculo por ID precisam de implementação própria.

Nome da ficha editável, obrigatório, independente de Em curso. Não há sugestão automática de nome nesta proposta. Documentos assinados e retificações ficam em Arquivos do paciente; após assinatura, a sessão oferece acesso aos documentos. PDF é destino desejado, não gerado no HTML. Na v8, a seleção usava atendimento fixo de 19/10/2026 e omitia a observação geral; corrigido no protótipo v9, conforme teste abaixo. Alterar observação da sessão no protótipo não reescreve documentos existentes. Arquivos não é um repositório real, não há persistência.

As referências a versões anteriores nos testes abaixo/acima são evidências históricas, não a proposta atual. A v10 é a entrada vigente; os resultados da v8 abaixo são históricos.

Verificação v8: PASSA dirigido no navegador local — conclusão do dente 26 com data 20/10/2026, nova sessão com Sofia e procedimento, edição da observação da sessão, edição do título e abertura de Arquivos. Evidência ficha-paciente-v8.png. Novo ciclo inicialmente não testado; resultado posterior abaixo, com falha confirmada no vínculo à sessão. Integração com Meu Dia, PDF, persistência e permissões não implementadas.


## Teste assinatura/retificação em Arquivos — v8 — 20/10/2026
Resultado geral: NÃO PASSA para vínculo correto à sessão. Teste somente no HTML local, sem alterar artefato ou sistema.

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Origem da sessão | PASSA observado | Histórico inicial: dente 26 concluído em 20/10; dente 46 na sessão 19/10. |
| Assinatura na sessão correta | NÃO PASSA | Coleta fixa em 19/10 oferece também dente 26 concluído em 20/10. Selecionar 26 gera documento datado de 19/10 e acesso em 19/10, não em 20/10. |
| Documento em Arquivos | PASSA visual | Após assinatura fictícia, documento 1 aparece em Arquivos do paciente; não na lista de sessões. |
| Retificação via Arquivos | PASSA visual | Retificar abre conteúdo e motivo, exige nova revisão/traço fictício, cria documento 2 em Arquivos. |
| Original preservado | PASSA visual | Documentos 1 e 2 abertos e comparados; original sem complemento, segundo com complemento e motivo. |
| Vínculo da retificação | NÃO PASSA | Retificação herda associação errada a 19/10. Não corrige vínculo da origem. |
| Observação geral da sessão no documento | Lacuna confirmada | Documento inclui observação do procedimento; observação geral registrada em 20/10 não aparece. Definir inclusão explícita antes de considerar representação completa da sessão. |

Reprodução: sessão 20/10 com dente 26 concluído → Coletar assinatura → selecionar 26 → revisar/confirmar simulação → acesso aparece na sessão 19/10 → Arquivos → Retificar → complementar observação e informar motivo → nova assinatura fictícia → duas versões com data 19/10. Evidência: ficha-v8-teste-arquivos.png.

Correção proposta na época da v8 e aplicada posteriormente na v9: selecionar/receber identidade da sessão antes dos procedimentos; restringir itens a essa sessão; guardar vínculo imutável de documento e retificação à sessão de origem; filtrar acesso por sessão; evitar data fixa e tratar observação geral separadamente. A limitação antes descrita como atendimento fixo foi reproduzida como falha no cenário multissessão. Não considerar v8 aprovada nesse fluxo. PDF, persistência, isolamento real, autenticação e validade de assinatura continuam NÃO TESTADOS. Nenhum dado de produção foi utilizado.


## Correção introduzida na v9 — sessão e observações — 20/10/2026
Substitui a coleta fixa descrita na v8. Escopo: apenas HTML demonstrativo e estes fluxos; nenhum código do sistema ou dado real alterado.

### Fluxo atual
1. Concluir um procedimento registra a conclusão na sessão indicada. A coleta pede a sessão antes de oferecer os procedimentos daquela visita e da profissional atual.
2. A revisão reúne observações gerais da sessão e observações dos procedimentos selecionados. O documento guarda uma cópia desses textos, título e identificação da sessão no momento da coleta.
3. Confirmar a simulação disponibiliza o documento em Arquivos. O acesso na sessão filtra seus documentos; Arquivos do paciente permite a visão geral.
4. Retificar parte do documento escolhido, mantém identidade/data/profissional da sessão fora do texto editável e exige motivo, revisão e nova assinatura fictícia. O original permanece preservado; a nova versão referencia o anterior. Não troca a sessão nem altera automaticamente a observação clínica original.

### Teste dirigido da v9
Ambiente: navegador local, http://localhost:8901/ficha-paciente-v9.html, dados fictícios, estado em memória.

| Critério | Resultado | Evidência observada |
| --- | --- | --- |
| Separar sessões | PASSA | Após concluir dente 26 em 20/10, seletor de 20/10 ofereceu somente 26; seletor de 19/10 ofereceu somente 46. Todos de Sofia. |
| Incluir observações | PASSA | Nota fictícia geral de 20/10 apareceu na revisão e no documento, junto da observação do dente 26. |
| Vínculo da assinatura | PASSA | Documento v1 com data 20/10; botão de acesso em 20/10, sem inserir botão em 19/10. |
| Arquivos por sessão | PASSA | Acesso de 20/10 abriu documentos identificados como pertencentes a essa sessão. |
| Retificação e nova assinatura | PASSA | Complemento e motivo revisados; nova leitura e traço fictício exigidos; documento v2 permaneceu ligado a 20/10. |
| Preservação | PASSA | Ambos os documentos abertos em Arquivos: v1 sem complemento, v2 com complemento/motivo; mesma sessão e observação geral. |

Evidências: [original](ficha-v9-teste-original.png) e [retificação](ficha-v9-teste-sessao.png). A falha reproduzida na v8 foi corrigida e retestada neste percurso da v9. Isso não constitui aceite do usuário nem homologação do sistema.

### Limites preservados
Não gera PDF, assinatura válida, envio ou persistência. Recarregar perde a simulação. Isolamento real, autenticação, integridade no servidor, recuperação de falha, múltiplas cadeias simultâneas e integração com Meu Dia continuam NÃO TESTADOS. O exemplo reúne conclusões pela data; visitas distintas no mesmo dia exigem identidade própria no produto e não foram simuladas. As observações clínicas da sessão continuam editáveis no protótipo, sem alterar cópias documentais existentes; regras de revisão e trilha desses textos no produto precisam ser fechadas. Texto livre da retificação não valida semanticamente menções clínicas. O status atual do procedimento não é uma fotografia histórica de cada visita.


## Integração com Meu Dia e orçamento — conferência de 20/10/2026
Referência vigente: Meu Dia v7 → ficha v10 → orçamento v6. São propostas separadas, sem transmissão de dados entre HTMLs. A ficha representa visitas por data; o vínculo de produção deverá identificar sessão e profissional, inclusive duas visitas no mesmo dia. A origem das observações gerais no Meu Dia e a retomada de um procedimento já planejado ainda não estão demonstradas de ponta a ponta.

Materiais exibidos são exemplos fixos de registros de kits por visita, não resultado da seleção no Meu Dia. A coluna “Quantidade: Não informada” não cria requisito para coletar quantidade nem autoriza inferir consumo. Nome de procedimento usa dois cliques/F2 na ficha, enquanto o editor de rascunho do Meu Dia usa edição direta: diferença intencional entre registro e elaboração, sujeita à revisão de usabilidade. Excluir por apagar nome no Meu Dia não se aplica à ficha assinada ou persistida.

Pendências próprias antes de implementar: integração da retomada e das observações já demonstradas no Meu Dia v7; transições de estado sem confundir planejamento com realização; sessão por identidade; encaminhamento e responsabilidade; retificação documental versus correção clínica. Permissões e assinatura real seguem nas lacunas acima. Esses pontos não foram resolvidos por esta conferência documental.


## Entrada pelo Meu Dia v7 — proposta para revisão
A retomada agora é demonstrada no Meu Dia v7: a mesma ficha recebe uma sessão identificada, observações gerais e observações por procedimento daquela visita. Ver MEU-DIA.md, seção Retomar tratamento e observações, como fonte desse fluxo. O painel de destino está no HTML do Meu Dia; não há dados compartilhados com esta ficha v10. Na implementação, a sessão exibida aqui e oferecida para assinatura deve ser exatamente a registrada lá, sem inferir identidade apenas pela data. A assinatura deve copiar as notas da sessão e dos itens selecionados; não buscar a última nota global do procedimento. Proteção contra reescrita de documentos assinados permanece obrigatória.

Pendência visual resolvida na v10: assinatura da consulta somente com observações, sem exigir procedimento. Fluxo e testes abaixo. Integração com o Meu Dia permanece pendente.


## Assinatura somente das observações — v10
Resolve a pendência visual da sessão sem procedimentos. Selecionar a sessão → marcar “Assinar somente as observações desta sessão” (pré-selecionado quando a sessão não tem itens) → revisar data, profissional, ficha e nota → confirmar leitura e traço fictício → confirmar simulação. Não é necessário inventar, selecionar ou concluir procedimento. O documento explicita que nenhum procedimento está incluído. Se houver procedimentos na sessão, esse modo os desmarca e exclui do documento.

A sessão de 20/10 presente na v10 é um exemplo fictício equivalente ao cenário do Meu Dia, não uma transferência real entre HTMLs. Documento segue para Arquivos ligado à sessão. Retificar preserva identidade da sessão, exige motivo e nova assinatura e mantém o original. Uma nova coleta das mesmas observações já assinadas direciona para retificação. Observação vazia tem bloqueio no artefato; negativa exercitada no teste complementar abaixo. Não bloqueia nem conclui tratamentos planejados. Assinatura não altera o orçamento.

Teste local v10: PASSA — assinar sessão 20/10 sem itens; revisão contém somente observações/contexto; 26 e 36 continuam planejados; Arquivos contém v1; retificação com complemento/motivo e nova assinatura gera v2 da mesma sessão; ambas abertas e comparadas, original intacto. PASSA — repetição da coleta bloqueada com orientação para retificar. Evidência: ficha-v10-observacoes.png. NÃO TESTADO — regressão completa do modo com procedimentos nesta versão, múltiplas cadeias, integração real, persistência, PDF, identidade e validade da assinatura. Nenhum código do sistema alterado.

A edição livre da observação clínica continua separada da cópia assinada; integridade/trilha no servidor e reconciliação de retificação permanecem pendências de implementação. Texto livre não valida conteúdo clínico. Esta seção substitui a pendência anterior de permitir assinatura sem itens, somente no nível de proposta visual.


## Teste complementar v10 — vazio e assinatura com procedimento — 20/10/2026
Papel: Auditor / Curador. Ambiente: HTML local na porta 8901, abas novas, dados fictícios em memória. Nenhuma alteração no HTML ou no sistema nesta rodada.

| Cenário / ação | Resultado | Evidência |
| --- | --- | --- |
| Apagar toda a observação de 20/10; coletar somente observações; Revisar documento | PASSA | Permanece na seleção com “Registre as observações da sessão antes de assinar.” Não abre revisão/traço. |
| Sessão de 19/10, modo com procedimentos, tentar revisar sem seleção | PASSA | Mensagem “Selecione ao menos um procedimento desta sessão.” |
| Selecionar dente 46 e revisar | PASSA | Data 19/10, Sofia, restauração DO, observação geral e nota do procedimento; sem incluir 26 ou 36. |
| Confirmar leitura, traço fictício e assinatura | PASSA | Documento v1 de 19/10 disponível em Arquivos; aberto e conferido. |
| Preservar demais tratamentos | PASSA | Dentes 26 e 36 permanecem planejados após a coleta; 46 mantém estado concluído anterior. |

Evidências: [bloqueio vazio](ficha-v10-bloqueio-vazio.png) e [documento com procedimento](ficha-v10-procedimento-assinado.png). O teste com procedimento foi concluído em aba limpa após uma interrupção de interação com seletor/tecla Escape na primeira aba; recuperação desse percurso de teclado não foi validada. Não houve correção durante a auditoria.

Conclusão dirigida: os dois modos funcionam nos percursos exercitados, com bloqueio de conteúdo vazio no modo somente observações e seleção obrigatória no modo procedimentos. O teste de vazio não impõe observação geral obrigatória quando há procedimento selecionado. Conteúdo composto só por espaços, regressão completa, múltiplas cadeias, persistência, integração, PDF e assinatura real continuam NÃO TESTADOS.


## Pendências atuais de integração — reconciliação do pacote
- Sessão: Meu Dia v7 mostra data/horário e uma identidade fixa demonstrativa; ficha v10 exibe data e mantém fixtures próprias. Duas visitas no mesmo dia não estão demonstradas em conjunto. Identificar sessão por ID, não por data, antes de implementar.
- Observações: o Meu Dia propõe notas específicas por visita; a assinatura com procedimentos na ficha lê as notas da coleção demonstrativa de procedimentos. Ainda não há modelo integrado que garanta a fotografia da nota daquela visita. Não interpretar o teste de fixture como prova dessa integração temporal.
- Estado clínico: Meu Dia usa Realizado hoje; ficha demonstra ciclo de status. Fechar transições, conclusão parcial e correção sem apagar histórico. A aprovação do layout não resolve essas regras.
- Retificação: documento corrigido não atualiza automaticamente evolução clínica, itens ou orçamento. Regras de reconciliação e trilha persistente precisam de definição.
- Interação: recuperação após Escape no seletor, espaços em branco, múltiplas cadeias, responsividade e acessibilidade completas seguem pendentes. Os testes dirigidos aprovados acima não são regressão integral.


## Duas sessões na mesma data — v11 — proposta atual
A v11 representa duas visitas fictícias de Sofia em 20/10/2026, às 09:00 e 14:30. Cada visita tem ID próprio, observação própria e associação independente aos documentos. Data e horário aparecem no histórico, seletor de assinatura, revisão, Arquivos e contexto de retificação. Horário identifica visualmente; o vínculo interno usa ID, não igualdade de data/horário.

Fluxo: escolher a sessão pelo horário → conferir sua observação → revisar e assinar → documento fica associado apenas à visita escolhida. Assinar a outra visita exige nova revisão e traço; não copia assinatura nem substitui a anterior. Acesso a Arquivos a partir da sessão filtra por ID. Retificação herda ID/data/horário do documento original. A conclusão de procedimento passou a oferecer seleção explícita das duas sessões demonstrativas, em vez de agrupar por data.

### Teste dirigido no navegador
PASSA: sessão 14:30 revisada e assinada com texto “Consulta da tarde”; em seguida sessão 09:00 revisada e assinada com texto “Consulta da manhã”, sem bloqueio indevido pela assinatura da tarde. Arquivos exibiu dois documentos independentes, abertos e comparados, com horários e notas corretos. Dentes 26 e 36 continuaram planejados. Evidência: ficha-v11-duas-sessoes.png.

Limites: numeração v1/v2 ainda é sequencial global da demonstração, não indica que a sessão da manhã retifica a tarde; o vínculo de retificação é independente. Revisar nomenclatura/numeração por documento na próxima revisão visual. Filtro por sessão e retificação entre duas cadeias foram exercitados no teste final abaixo; conclusão em cada horário continua não testada. A criação de novas sessões, remarcação, horários iguais, fusos, persistência, autorização e ligação com Meu Dia continuam NÃO TESTADOS. As duas visitas são pré-carregadas, não originadas do Meu Dia. Não foi alterado o sistema.

Esta seção substitui a lacuna visual de duas visitas no mesmo dia; implementação e integração seguem pendentes. Notas por procedimento ainda precisam de modelo histórico por sessão: não confundir o isolamento das observações gerais demonstrado aqui com validação dessa integração.


## Teste final e encerramento da fase — ficha v11
Papel: Auditor / Curador. Teste no HTML local, dados fictícios em memória. A sessão existente continha assinatura das 14:30 (documento v1) e das 09:00 (v2).

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Retificar somente 09:00 | PASSA | Conteúdo acrescido de complemento exclusivo da manhã e motivo; revisão e nova assinatura mantiveram data/horário/identidade da sessão. |
| Preservar original | PASSA | Documento v2 da manhã permaneceu sem complemento; retificação v3 contém complemento e motivo. |
| Filtrar Arquivos às 09:00 | PASSA | Acesso pelo histórico das 09:00 mostrou somente v2 e v3, sem documento das 14:30. |
| Manter tarde intacta | PASSA | Nota da sessão e documento v1 das 14:30 mantêm o conteúdo original, sem complemento ou motivo da manhã. |
| Filtrar Arquivos às 14:30 | PASSA | Acesso pelo histórico das 14:30 mostrou somente v1, sem os documentos das 09:00. |

Evidências: [manhã e retificação](ficha-v11-final-manha.png), [tarde preservada](ficha-v11-final-tarde.png). Arquivos do paciente, aberto pelo botão geral, continua sendo visão de todas as sessões; o filtro é aplicado pelo acesso de uma sessão específica. Retificação documental não reescreve automaticamente a observação clínica da sessão.

Não houve modificação de HTML, código, banco ou produção nesta rodada. A fase de propostas e testes dirigidos está encerrada a pedido do usuário. Não equivale a homologação de implementação ou segurança. Preservam-se as pendências descritas: integração, persistência, identidade/assinatura válida, PDF, permissões, observações de procedimentos por visita, estados clínicos, conclusão em cada horário e regressão completa. A numeração global v1/v2/v3 do protótipo continua exigindo refinamento visual; não confundir documento de outra sessão com retificação.
