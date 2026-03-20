# Smoke Test -- Ficha Clinica

Use este checklist para validar se a refatoracao do modulo da ficha nao quebrou os fluxos principais. O foco aqui e comportamento manual ponta a ponta, com persistencia visivel apos refresh quando aplicavel.

## Pre-condicoes

- Usuario autenticado com acesso a uma clinica valida.
- Paciente existente com ao menos uma ficha clinica criada.
- Buckets do Supabase Storage configurados: `audios`, `documentos`, `fichas` e `radiografias`.
- Ambiente com microfone liberado no navegador para validar gravacao.
- Pelo menos um arquivo de teste de cada tipo necessario:
  - documento `.pdf` ou `.docx`
  - imagem `.jpg` ou `.png` para foto da ficha
  - imagem `.jpg` ou `.png` e opcionalmente `.pdf` para radiografia

## Navegacao

### Abrir ficha

Fluxo: Navegacao
Passos:
1. Abrir o dashboard.
2. Entrar no perfil de um paciente com ficha existente.
3. Abrir a ficha clinica pela lista do paciente.
Resultado esperado: A pagina da ficha abre sem erro, com cabecalho, sidebar e abas `Ficha`, `Planejamento` e `Orcamento` visiveis.
Status: pendente

### Trocar abas

Fluxo: Navegacao
Passos:
1. Com a ficha aberta, clicar em `Ficha`.
2. Clicar em `Planejamento`.
3. Clicar em `Orcamento`.
Resultado esperado: O conteudo acompanha a aba selecionada e nao ocorre quebra visual nem tela em branco. Ao abrir `Orcamento`, o sistema cria orcamento se necessario.
Status: pendente

### Voltar para perfil do paciente

Fluxo: Navegacao
Passos:
1. Na ficha aberta, clicar no botao `Paciente` do cabecalho.
2. Voltar para a ficha e clicar em `Ver perfil completo` na sidebar.
Resultado esperado: Ambos os atalhos levam para o perfil correto do paciente.
Status: pendente

## Ficha Clinica

### Editar anamnese

Fluxo: Ficha clinica
Passos:
1. Alterar `Queixa Principal`.
2. Alterar `Historico Dental`.
3. Alterar `Historico Medico`.
Resultado esperado: Os campos aceitam edicao normalmente e exibem feedback visual de salvamento automatico.
Status: pendente

### Salvar alteracoes

Fluxo: Ficha clinica
Passos:
1. Editar qualquer campo da anamnese.
2. Aguardar cerca de 2 segundos sem digitar.
3. Recarregar a pagina.
Resultado esperado: O valor permanece salvo apos o refresh.
Status: pendente

### Alterar status da ficha

Fluxo: Ficha clinica
Passos:
1. No badge de status do cabecalho, trocar de `Aberta` para `Concluida`.
2. Aguardar o feedback de sucesso.
3. Recarregar a pagina.
4. Reabrir a ficha e voltar para `Aberta`.
Resultado esperado: O status persiste apos refresh e pode ser alternado nos dois sentidos sem erro.
Status: pendente

## Audio

### Iniciar gravacao

Fluxo: Audio
Passos:
1. Na area de `Anotacoes`, clicar em `Gravar`.
2. Autorizar o uso do microfone se o navegador solicitar.
Resultado esperado: O estado muda para gravacao, o botao passa a exibir `Parar` e o timer comeca a contar.
Status: pendente

### Parar gravacao

Fluxo: Audio
Passos:
1. Iniciar a gravacao.
2. Falar uma frase curta.
3. Clicar em `Parar`.
Resultado esperado: O sistema encerra a gravacao, faz upload do audio e entra em estado de processamento/transcricao.
Status: pendente

### Transcrever audio

Fluxo: Audio
Passos:
1. Iniciar e parar uma gravacao valida.
2. Aguardar a conclusao do processamento.
3. Conferir o campo `Anotacoes`.
4. Recarregar a pagina.
Resultado esperado: O texto transcrito aparece em `Anotacoes`, separado como gravacao de voz, e permanece salvo apos refresh.
Status: pendente

## Odontograma

### Selecionar dentes

Fluxo: Odontograma
Passos:
1. Na aba `Ficha`, clicar em alguns dentes no odontograma.
2. Clicar novamente em um deles para desmarcar.
Resultado esperado: A selecao visual acompanha os cliques, incluindo marcar e desmarcar dentes.
Status: pendente

### Atualizar dentes afetados

Fluxo: Odontograma
Passos:
1. Selecionar uma combinacao de dentes.
2. Aguardar alguns instantes.
3. Recarregar a pagina.
Resultado esperado: Os dentes afetados permanecem persistidos apos refresh.
Status: pendente

## Planejamento

### Criar etapa

Fluxo: Planejamento
Passos:
1. Abrir a aba `Planejamento`.
2. Clicar em `Nova Etapa`.
3. Informar titulo.
4. Opcionalmente usar `Usar selecao do odontograma` e preencher observacao.
5. Salvar a nova etapa.
Resultado esperado: A etapa aparece na lista, com titulo, dentes e status inicial `Aberto`.
Status: pendente

### Editar etapa

Fluxo: Planejamento
Passos:
1. Em uma etapa existente, clicar em editar.
2. Alterar titulo, dentes ou observacao.
3. Salvar.
4. Recarregar a pagina.
Resultado esperado: A etapa reflete os novos dados imediatamente e continua correta apos refresh.
Status: pendente

### Remover etapa

Fluxo: Planejamento
Passos:
1. Em uma etapa existente, clicar em remover.
2. Confirmar o comportamento esperado na lista.
3. Recarregar a pagina.
Resultado esperado: A etapa sai da lista e nao retorna apos refresh.
Status: pendente

### Alterar status da etapa

Fluxo: Planejamento
Passos:
1. Em uma etapa existente, trocar o status entre `Aberto`, `Pendente` e `Concluido`.
2. Recarregar a pagina.
Resultado esperado: O badge e o valor persistido acompanham a troca de status.
Status: pendente

## Apresentacao

### Abrir modo apresentacao

Fluxo: Apresentacao
Passos:
1. Garantir que exista ao menos uma etapa no planejamento.
2. Na secao de radiografias, clicar em `Apresentar`.
Resultado esperado: O modo apresentacao abre em tela cheia da aplicacao, mostrando a etapa atual.
Status: pendente

### Navegar entre etapas

Fluxo: Apresentacao
Passos:
1. Abrir o modo apresentacao com duas ou mais etapas.
2. Navegar pelas setas laterais.
3. Navegar pelos dots inferiores.
4. Usar teclado com `ArrowLeft` e `ArrowRight`.
Resultado esperado: O indice muda corretamente, com conteudo, imagem e status da etapa atualizados.
Status: pendente

### Fechar apresentacao

Fluxo: Apresentacao
Passos:
1. Com o modo apresentacao aberto, clicar no botao de fechar.
2. Abrir novamente e pressionar `Escape`.
Resultado esperado: O modo apresentacao fecha nos dois casos e devolve o usuario para a ficha sem quebrar a pagina.
Status: pendente

## Orcamento

### Editar item

Fluxo: Orcamento
Passos:
1. Garantir que existam etapas no planejamento.
2. Abrir a aba `Orcamento`.
3. Preencher ou alterar o valor de um item.
Resultado esperado: O item aceita o novo valor e persiste apos refresh.
Status: pendente

### Alterar status

Fluxo: Orcamento
Passos:
1. Na aba `Orcamento`, trocar o status entre `Rascunho`, `Enviado`, `Aprovado` ou `Recusado`.
2. Recarregar a pagina.
Resultado esperado: O badge e o valor persistido do orcamento acompanham a alteracao.
Status: pendente

### Recalcular valores

Fluxo: Orcamento
Passos:
1. Preencher valores em dois ou mais itens.
2. Alterar um dos valores.
3. Remover uma etapa do planejamento e voltar para `Orcamento`.
Resultado esperado: O total e recalculado automaticamente quando valores mudam e quando itens deixam de existir.
Status: pendente

## Uploads

### Enviar arquivo

Fluxo: Uploads
Passos:
1. Na aba `Ficha`, enviar um documento valido.
2. Enviar uma foto da ficha valida.
3. Na aba `Planejamento`, enviar uma radiografia valida.
Resultado esperado: Cada arquivo aparece na sua secao correta com feedback visual de processamento/upload.
Status: pendente

### Visualizar lightbox

Fluxo: Uploads
Passos:
1. Abrir uma foto da ficha.
2. Fechar a visualizacao.
3. Abrir uma radiografia.
4. Navegar entre itens quando houver mais de um arquivo.
5. Pressionar `Escape`.
Resultado esperado: O lightbox abre com a imagem correta, permite navegacao e fecha sem travar a tela.
Status: pendente

### Remover arquivo

Fluxo: Uploads
Passos:
1. Remover um documento.
2. Remover uma foto da ficha.
3. Remover uma radiografia que esteja ou nao vinculada a etapa.
4. Recarregar a pagina.
Resultado esperado: Os arquivos removidos desaparecem da interface e nao retornam apos refresh. Se uma radiografia estava vinculada, a etapa fica sem imagem vinculada.
Status: pendente
