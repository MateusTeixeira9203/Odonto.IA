# Arquitetura da Ficha -- Sprint 2

Baseado na implementacao atual de `src/app/dashboard/fichas/[id]/ficha-client.tsx` e dos componentes extraidos em `src/app/dashboard/fichas/[id]/_components/`.

## Estados principais

- `ficha`: snapshot principal da ficha para dados centrais como `status` e `audio_url`.
- `anotacoes`: texto livre da ficha, com autosave desacoplado dos demais campos.
- `arquivos`: colecao unica de anexos da ficha; dela derivam `documentos`, `fotosficha`, `radiografias` e `arquivoNomeById`.
- `activeTab`: controla a navegacao entre `ficha`, `planejamento` e `orcamento`.
- `queixaPrincipal`, `historicoDental`, `historicoMedico`: campos de anamnese com autosave individual.
- `salvandoAnamnese`: feedback visual do autosave da anamnese.
- `dentesSelecionados`: estado do odontograma e base para reaproveitar selecao em etapas do planejamento.
- `planejamento`: referencia do planejamento atual, criada sob demanda quando ainda nao existe.
- `etapas`: lista de etapas do planejamento usada tanto na aba de planejamento quanto no orcamento e na apresentacao.
- `novaEtapaOpen`: controla a exibicao do formulario de criacao de etapa.
- `orcamento`: referencia do orcamento atual, criada sob demanda ao abrir a aba correspondente.
- `orcamentoItens`: itens derivados das etapas e usados para precificacao e totalizacao.
- `editandoEtapaId`: identifica a etapa em edicao inline.
- `salvandoEtapa`: feedback de loading para criar e editar etapa.
- `etapaForm`: estado temporario do formulario de etapa (`titulo`, `dentes`, `observacao`).
- `vinculandoEtapaId`: identifica a etapa que esta com seletor de radiografia aberto.
- `signedUrls`: cache local de URLs assinadas para fotos e radiografias no Storage.
- `salvandoAnotacoes`: feedback visual do autosave de anotacoes.
- `processandoTranscricao`: indica transcricao em andamento apos upload do audio.
- `uploadandoDoc`, `uploadandoFoto`, `uploadandoRx`: loading por tipo de upload.
- `concluindoFicha`: loading da troca de status da ficha.
- `lightboxOpen`, `lightboxIndex`: controle do lightbox de radiografias.
- `fotoLightboxOpen`, `fotoLightboxIndex`: controle do lightbox de fotos da ficha.
- `apresentacaoOpen`, `apresentacaoIndex`: controle do modo apresentacao por etapa.
- `recorderStatus`, `timer`: estado vindo do hook `useAudioRecorder` para gravacao de audio.

Estados auxiliares por `ref`:

- `anamneseTimerRef`: debounce do autosave da anamnese.
- `odontogramaTimerRef`: debounce da persistencia do odontograma.
- `anotacoesTimerRef`: debounce do autosave de anotacoes.

## Handlers principais

- `handleAnotacoesChange`: atualiza anotacoes localmente e agenda autosave em `fichas`.
- `handleAnamneseChange`: atualiza um campo da anamnese e agenda autosave em `fichas`.
- `toggleDente`: marca ou desmarca dentes e persiste `dentes_afetados`.
- `handleAlterarStatusFicha`: troca o status da ficha entre `aberta` e `concluida`.
- `handlePararGravacao`: encerra a gravacao, envia audio ao Storage, atualiza `audio_url`, chama `/api/transcricao` e injeta a transcricao em anotacoes.
- `processarArquivosDocumento`: valida, envia documentos ao Storage e chama `/api/processar-documento`.
- `handleDocInputChange`: ponte entre input de documento e o processador de arquivos.
- `handleRemoverDocumento`, `handleRemoverFoto`, `handleRemoverRx`: removem arquivo do Storage, apagam registro em `ficha_arquivos` e sincronizam o estado local.
- `handleUploadFoto`, `handleUploadRx`: validam extensao/tamanho, fazem upload, inserem em `ficha_arquivos` e atualizam a UI.
- `carregarSignedUrl`: gera URL assinada para fotos e radiografias e preenche o cache local.
- `getOrCreatePlanejamento`: garante existencia de um planejamento antes de criar etapas.
- `getOrCreateOrcamento`: garante existencia de um orcamento antes de exibir ou sincronizar itens.
- `syncEtapasToItens`: cria itens de orcamento faltantes a partir das etapas existentes.
- `handleAbrirAbaOrcamento`: ponto de entrada do fluxo de orcamento ao trocar de aba.
- `handlePrecoSalvo`: persiste preco do item, atualiza o item local e recalcula `total` do orcamento.
- `handleStatusOrcamento`: troca o status do orcamento.
- `iniciarNovaEtapa`, `iniciarEdicaoEtapa`, `cancelarEdicaoEtapa`: controlam o modo do formulario de etapa.
- `handleAdicionarEtapa`: cria etapa, atualiza a lista e, se o orcamento ja existir, cria o item correspondente.
- `handleAtualizarEtapa`: persiste mudancas de uma etapa existente.
- `handleRemoverEtapa`: apaga etapa, remove itens relacionados do orcamento local e recalcula total.
- `handleSetStatus`: atualiza status de etapa e sincroniza ficha e orcamento.
- `handleVincularImagem`: associa ou remove uma radiografia de uma etapa.
- `handleTituloEtapaChange`, `handleObservacaoEtapaChange`, `handleUsarSelecaoOdontograma`, `handleRemoverDenteEtapa`: manipulam somente o `etapaForm`.
- `apresentacaoAnterior`, `apresentacaoProximo`: navegam entre etapas no modo apresentacao.
- `handleTabChange`: troca a aba ativa e dispara inicializacao do orcamento quando necessario.

## Props por componente

### `FichaHeader`

- `pacienteId`: usado para construir o link de volta ao perfil do paciente.
- `pacienteNome`: exibido no titulo da pagina.
- `dataFormatada`: data textual da criacao da ficha.
- `status`: estado atual da ficha exibido no badge/select.
- `concluindoFicha`: desabilita a troca de status durante a atualizacao.
- `onStatusChange`: callback para alterar o status no componente pai.

### `FichaSidebar`

- `paciente`: objeto resumido com `id`, `nome`, `telefone` e `whatsapp`.
- `dentista`: objeto resumido com `nome` e `especialidade`.
- `dataFormatada`: repete o contexto temporal da ficha.
- `iniciaisPaciente`: string pronta para o avatar textual.

### `TabFicha`

- Dados de formulario:
  - `queixaPrincipal`
  - `historicoDental`
  - `historicoMedico`
  - `anotacoes`
- Estados de UI:
  - `salvandoAnamnese`
  - `salvandoAnotacoes`
  - `estaProcessandoAudio`
  - `estaGravando`
  - `timerFormatado`
  - `dentesSelecionados`
  - `uploadandoDoc`
  - `uploadandoFoto`
- Dados de anexos:
  - `documentos`
  - `fotosficha`
  - `signedUrls`
  - `docInputId`
  - `fotoInputId`
- Callbacks:
  - `onQueixaPrincipalChange`
  - `onHistoricoDentalChange`
  - `onHistoricoMedicoChange`
  - `onAnotacoesChange`
  - `onStartRecording`
  - `onStopRecording`
  - `onToggleDente`
  - `onDocInputChange`
  - `onUploadFoto`
  - `onRemoverDocumento`
  - `onOpenFotoLightbox`
  - `onRemoverFoto`

### `TabPlanejamento`

- Dados principais:
  - `etapas`
  - `etapaForm`
  - `dentesSelecionados`
  - `radiografias`
  - `signedUrls`
  - `arquivoNomeById`
- Estados de UI:
  - `novaEtapaOpen`
  - `editandoEtapaId`
  - `vinculandoEtapaId`
  - `salvandoEtapa`
  - `uploadandoRx`
  - `rxInputId`
- Callbacks de etapa:
  - `onIniciarNovaEtapa`
  - `onCancelarEdicao`
  - `onAdicionarEtapa`
  - `onAtualizarEtapa`
  - `onEditarEtapa`
  - `onRemoverEtapa`
  - `onStatusEtapaChange`
  - `onVincularImagem`
  - `onAbrirVinculo`
  - `onFecharVinculo`
  - `onTituloEtapaChange`
  - `onObservacaoEtapaChange`
  - `onUsarSelecaoOdontograma`
  - `onRemoverDenteEtapa`
- Callbacks de radiografia e apresentacao:
  - `onUploadRx`
  - `onAbrirApresentacao`
  - `onOpenLightbox`
  - `onRemoverRx`

## Responsabilidades por componente

### `ficha-client.tsx`

E o orquestrador do modulo. Centraliza estado, regras de negocio, autosave, derivacoes de dados, chamadas ao Supabase Storage, mutacoes nas tabelas (`fichas`, `ficha_arquivos`, `planejamentos`, `planejamento_etapas`, `orcamentos`, `orcamento_itens`) e integracoes HTTP com as rotas de transcricao e processamento de documentos.

### `FichaHeader`

Renderiza o contexto superior da ficha: retorno ao paciente, identificacao da ficha e troca de status. Nao contem regra de negocio alem de disparar o callback recebido.

### `FichaSidebar`

Renderiza contexto auxiliar do paciente e do dentista. Funciona como painel informativo e de navegacao secundaria, sem acesso direto ao estado complexo da ficha.

### `TabFicha`

Agrupa a UI da anamnese, anotacoes, odontograma e anexos. Atua como composicao visual entre `AnamneseCard`, `OdontogramaCard` e `AnexosCard`, recebendo todo o estado pronto e apenas repassando callbacks.

### `TabPlanejamento`

Agrupa a UI de planejamento por etapas e o painel de radiografias. Controla apenas a organizacao visual do formulario inline, lista de etapas e secao de apresentacao/anexos, sem possuir persistencia propria.

## Fluxo de dados

1. `page.tsx` entrega para `FichaClient` os dados iniciais da ficha, paciente, dentista, arquivos, planejamento, etapas e orcamento.
2. `FichaClient` inicializa o estado centralizado e deriva subconjuntos como `documentos`, `fotosficha`, `radiografias` e `arquivoNomeById`.
3. O estado e distribuido para `FichaHeader`, `FichaSidebar`, `TabFicha`, `TabPlanejamento` e `TabOrcamento` via props.
4. Interacoes do usuario nos filhos sobem via callbacks para `FichaClient`.
5. Os handlers do pai atualizam primeiro o estado local para manter a interface responsiva.
6. Em seguida, os handlers persistem no Supabase:
   - `fichas` para anamnese, anotacoes, odontograma, audio e status
   - `ficha_arquivos` e Storage para documentos, fotos e radiografias
   - `planejamentos` e `planejamento_etapas` para o fluxo de planejamento
   - `orcamentos` e `orcamento_itens` para status, itens e total
7. Quando necessario, `FichaClient` faz chamadas HTTP internas:
   - `/api/transcricao` apos upload de audio
   - `/api/processar-documento` apos upload de documento
8. Os resultados retornam ao estado centralizado e sao redistribuidos aos filhos, mantendo uma unica fonte de verdade na tela.

## Pontos de atencao futuros

- `ficha-client.tsx` ficou mais legivel, mas ainda concentra muitos subdominios: ficha, audio, anexos, odontograma, planejamento, apresentacao e orcamento.
- `TabFicha` e `TabPlanejamento` sao componentes de apresentacao, mas continuam altamente dependentes de props do estado global; a quantidade de props indica acoplamento do pai com a forma exata da UI.
- O fluxo de arquivos ainda mistura responsabilidades de validacao, upload, persistencia e atualizacao de interface no mesmo componente pai.
- O fluxo de planejamento e orcamento continua acoplado: criar/remover etapa afeta `orcamentoItens` e `orcamento.total` dentro do mesmo handler.
- A abertura da aba `Orcamento` carrega comportamento de inicializacao de dominio, o que cria dependencia entre navegacao de UI e consistencia de dados.
- O modo apresentacao, os lightboxes e a navegacao por teclado continuam vivendo no mesmo componente que faz mutacoes de banco.

Possiveis proximos isolamentos:

- Extrair hooks de dominio como `useFichaAutosave`, `useFichaArquivos`, `usePlanejamento` e `useOrcamento`.
- Mover a orquestracao de audio para um hook dedicado que encapsule gravacao, upload e transcricao.
- Criar um adaptador para anexos com validacao por tipo de arquivo fora do componente.
- Separar sincronizacao entre etapas e orcamento em uma camada de servico ou hook especifico.
