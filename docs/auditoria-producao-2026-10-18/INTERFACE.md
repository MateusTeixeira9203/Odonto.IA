# Interface — auditoria dirigida de produção

Aplicação `a1722c47c346a4a80c84ad6cd5efd0ee42afbf08`, deployment
`dpl_HxR3nH6QiVZaZUpSuPBBe3Mhdyfa`. Observação em 18/10/2026.
Papel: Auditor na coleta; Curador na organização deste pacote. Nenhum código ou
redesenho aplicado nesta retomada. Prints reais da aplicação, sem reconstrução de telas.

## Escopo e identidade

Conta autorizada `mateusteixeira9203@gmail.com`, clínica exclusiva **Clinica teste**
`eddc5fc6-62b0-4d01-8e6e-3f84f61e64e7`. Usuário administrador ativo, perfil de
Dentista teste 1, plano SOLO com cortesia permanente. A isenção foi publicada antes
desta retomada. Não representa correção geral do ciclo de login.

Objetivo: documentar o produto atual e capturar telas, abas, formulários e estados
acessíveis nessa conta. Escritas dirigidas somente nos registros fictícios abaixo.
Efeitos proibidos: alterar clientes reais, código/design/schema, contratar plano,
assinar documentos, disparar mensagens/convites, executar IA paga ou cobrar dinheiro.

## Cobertura observada

| Área | Estados capturados | Limite |
| --- | --- | --- |
| Pública | Landing, âncora, mockup, planos, FAQ, login, cadastro, recuperação, aviso de e-mail, convite expirado e recuperação sem token | Formulários não enviados; aviso “enviamos” é texto da página, não prova de envio. |
| Dashboard | Sem dados, com dados, pendências, painel de procedimentos, claro/escuro | Visão de recepção não disponível nesse perfil. |
| Meu Dia | Introdução, fila vazia, encaixe/busca, paciente selecionado, Campo Mágico, plano/histórico, anexos, materiais, regiões e seleção de manutenção | Texto/voz/IA não processados; não salvar novo atendimento ao capturar esses controles. |
| Pacientes | Lista vazia/preenchida, novo cadastro, edição, paciente de demonstração | Apenas um paciente QA real no banco; demo é fixture da aplicação. |
| Prontuário / Ficha | Vazio/preenchido, novo atendimento, dente, detalhes de canal, recarga, editor de evolução, menu, encaminhamento, odontograma completo, importação de histórico | Não assinar, excluir, encaminhar ou importar. Estados de outras especialidades não foram todos preenchidos. |
| Orçamento | Vazio, montagem, agrupamento, proposta, atividade, aceite, aprovação de itens, entrada/parcelas e parcelado | Aprovação exibida na UI não equivale a orçamento global aprovado; ver observação abaixo. Não gerada cobrança ou assinatura. |
| Apresentar | Seletor, editor, tipos de bloco, bloco de odontograma, progresso, odontograma, visão geral e investimento | Um bloco sintético persistido. Nenhuma geração IA, imagem clínica ou anotação em imagem. |
| Documentos | Lista vazia, seletores de receita/atestado/exame, formulários de panorâmica, comparecimento, afastamento, receita e TCLE | Não emitir, assinar ou enviar. |
| Agenda | Semana, dia, mês, novo agendamento, compromisso pessoal, retorno | Um encaixe sintético persistido; demais formulários não enviados. |
| Financeiro | Resumo/extrato vazios, entrada, saída, categorias, receita manual persistida, claro/escuro | Nenhum pagamento de orçamento ou despesa salvo; COD-01 reproduzido. |
| Configurações | Consultório, dados, equipe, convite dentista, conta secretária/protético, Meu Perfil, horários, catálogo inteiro por trechos, novo procedimento, importação e Plano | Não criar membros nem enviar convites; horários e catálogo não salvos. |
| Complementares | Menu pessoal, perfil pessoal, painel DEX, arquivo clínico | Sem perguntas pagas, exportação ou envio. |
| Restritas | WhatsApp encaminhou ao plano; protético encaminhou ao Dashboard | Captura do destino não representa tela interna dessas áreas. |

Prints e dimensões: [PRINTS.md](PRINTS.md). São estados de telas, não uma contagem de
funcionalidades aprovadas. O inventário de 31 páginas e 42 handlers tem cobertura
marcada em [rotas.json](evidencias/rotas.json); endpoints não são telas.

## Verificações dirigidas e dados mantidos

| Critério / estado inicial → ação | Esperado e efeito proibido | Resultado / evidência |
| --- | --- | --- |
| Clínica sem pacientes → cadastrar nome e observação QA | Persistir só na clínica QA; não incluir contato/CPF real | PASSA no recorte: paciente na UI e consulta restrita ao banco; prints 14–16. Não prova isolamento de outra identidade. |
| Paciente QA sem Ficha → adicionar manualmente Canal no dente 32, detalhes e salvar | Evento/dente/medidas preservados na recarga; não inventar dado clínico | PASSA: detalhe reaberto e consulta do evento coincidem; prints 19–22 e qa-evento-persistido.json. Medidas são exclusivamente fictícias. |
| Ficha com procedimento → montar proposta R$ 100 | Proposta vinculada ao paciente; nenhum dinheiro real | PASSA para criação: uma proposta de R$ 100 persistida; prints 24–31. Aprovação global NÃO TESTADA como concluída. |
| Fila sem atendimento → encaixar paciente QA | Aparecer na fila e Agenda sem comunicação externa | PASSA no recorte: um scheduled persistido; prints 52–54/62; google_event_id nulo, whatsapp_reminder_sent falso. |
| Financeiro sem receita → registrar R$ 50 fictícios e recarregar | Entrada persistir uma vez; resumo/gráfico/extrato consistentes | Persistência PASSA; consistência NÃO PASSA (COD-01), prints 70/71/98. Nenhuma transferência. |
| Editor de apresentação → adicionar bloco odontograma | Bloco acessível, sem IA/imagens reais | PASSA para criação: um bloco persistido; prints 35–41 e qa-apresentacao-persistida.json. |
| Código no início → repetir hashes ao fim | Zero alteração em src e migrations | PASSA: 772 arquivos iguais, sem adição/remoção; preservacao-fontes.json. |

Registros sintéticos **mantidos**, para a próxima equipe reconhecer o cenário:

- Paciente `290b050a-877c-40b7-8cf4-38e3488ce636`, “QA Auditoria 18-10-2026”.
- Ficha `51047d58-ef96-4b54-b6db-95e0e96b81c3`, sem assinatura; rótulo visual “Canal · 32”.
- Evento `738b69e9-f50e-424c-a3c0-55fe5452e8cb`, endodontia indicada no dente 32.
- Orçamento `99909ee0-2e7c-4750-8b12-25890de3e8fb`, R$ 100, status global `rascunho` na consulta final.
- Agendamento `64e04349-a394-47c1-b048-3f1b80fc7ccf`, 18/10 às 19:30 de São Paulo, aguardando.
- Receita manual `040da89c-a835-4978-bb03-7d36942482ba`, R$ 50 fictícios; zero pagamentos de orçamento.
- Bloco `00a7affb-2d11-45db-9421-24054c43d69e`, odontograma, título vazio, pendente.

A ação “APROVAR TUDO” exibiu itens aceitos; o Dashboard continuou indicando orçamento
aguardando e o status global no banco permaneceu rascunho. **Observação a esclarecer**:
aceite de itens e aprovação global podem ter contratos diferentes. Não foi classificada
como falha sem reconciliar esses estados. Não anunciar pagamento ou aprovação integral.

A conta real anteriormente autorizada para prints não foi utilizada nesta retomada.
`prints-privados/` continua vazia. Autofill do navegador foi removido de formulários
não enviados antes de salvar as capturas finais de equipe. Nenhum convite foi enviado.

## UI-01 — Botões de senha sem nome acessível — média

**CONFIRMADO no DOM público.** Cadastro tem dois botões de mostrar/ocultar senha
sem texto, `aria-label`, `aria-labelledby` ou `title`; o SVG tem `aria-hidden=true`.
A árvore acessível apresenta dois “button” sem identificação.

- Reprodução: abrir `/cadastro`, inspecionar botões ao lado de Senha e Confirmar Senha.
- Esperado: cada botão informa sua ação e o campo a que se refere.
- Impacto: usuário de tecnologia assistiva não identifica a finalidade do controle.
- Evidência: [DOM](evidencias/cadastro-botoes.json) e print 10.
- Código: `src/app/(auth)/cadastro/_components/cadastro-form.tsx:182` e `:207`.
- Não foi executada sessão com leitor de tela; ausência de nome foi verificada diretamente.

## UI-02 — Título encoberto na navegação por âncora — baixa

**OBSERVADO no Chrome.** Clicar “Como funciona” leva a seção ao topo, deixando
parte inicial do título atrás do cabeçalho fixo. Depois da animação, o título tinha
`top=46.94px`, altura 99px, fonte 45px, sob navegação que ocupa a faixa superior.

- Reprodução: landing no viewport registrado → Como funciona → observar título.
- Esperado: início do título inteiro abaixo da navegação.
- Evidência: print 03. Apenas essa âncora foi medida; não generalizar a todas as telas.
- Não houve modificação de CSS, scroll offset ou desenho da página.

## UI-03 — “Próxima seção” no mockup de atendimento — baixa

**CONFIRMADO em produção e código.** A demonstração da Ficha usa “Próxima seção”
para o próximo atendimento. A intenção aparente é “Próxima sessão”.
Fonte: `src/components/landing/passo-ficha.tsx:66`, árvore acessível da landing.
Não é erro clínico persistido: é texto da demonstração pública.

## UI-04 — Ciclo de acesso — alta

**CONFIRMADO pelo navegador e pelo relato do usuário.** Entrar com sessão existente
retorna ao Dashboard; o fluxo alterna com `/bem-vindo-agregado` até
`ERR_TOO_MANY_REDIRECTS`. A tela vazia inicial foi preservada no print 02;
a captura visual da página de erro falhou na ferramenta, portanto não há print dela.

Causa no código e correção local autorizada posteriormente:
[seção Correção de acesso em CODIGO.md](CODIGO.md#correção-de-acesso-autorizada-após-a-auditoria).
Produção ainda não corrigida por esse trabalho; não confundir os testes locais com
publicação ou acesso validado na conta real.

## UI-05 — Status técnico visível na Agenda mensal — baixa

**CONFIRMADO visualmente.** A Agenda mensal exibe `SCHEDULED` para o encaixe QA;
o Meu Dia apresenta “Aguardando”. Reprodução: criar encaixe QA → Agenda → Mês →
selecionar 18/10. Esperado: rótulo legível em português; efeito proibido em eventual
correção: alterar o estado persistido para corrigir apenas o texto.
Evidência: print 62 e árvore acessível correspondente. `month-view.tsx:319` usa
`SelectValue` com opções traduzidas, mas a causa exata da renderização não foi testada.
Não indica perda de agendamento ou execução clínica incorreta.

## Limites explícitos e observações

- Prints desktop: Chrome, normalmente 1521×684; páginas públicas também no navegador
  separado. Capturas longas têm dimensões próprias e não servem de régua de espaçamento.
- Claro e escuro capturados nas telas centrais; não foi testada cada combinação
  de modal, tema, papel, especialidade e breakpoint.
- Mobile interno: DOM em 390×844 sem largura de conteúdo superior à janela no estado
  medido. Ferramenta retornou imagens em escala incorreta e timeout; **não há print
  mobile válido nem homologação responsiva**. Evidência: mobile-viewport.json.
- Recepção, protético, WhatsApp liberado, convite válido, onboarding de nova conta,
  primeiro acesso, checkout e termos pendentes dependem de outro papel/estado. Não se
  modificou a conta, contratou plano ou criou acesso apenas para produzir esses prints.
- Assinatura, envio, recebimento/estorno, anexos com imagens, IA, integrações,
  concorrência, duas contas autenticadas, teclado/leitor de tela completos, contraste
  e performance: NÃO TESTADO de ponta a ponta nesta retomada.
- Agenda observada usa dias úteis/recortes que exigem entendimento das regras; ausência
  de domingo em algumas vistas não foi automaticamente classificada como defeito.
- Landing enfatiza documentação clínica; mudança para gestão é direção futura. Os
  mockups públicos são demonstração, não evidência de atendimento executado.

As capturas descrevem o estado atual. Não são redesign aprovado, plano de correções,
backup restaurável ou certificação de segurança. Abrir um formulário não comprova
sua submissão; “sem achado” só vale para os critérios efetivamente exercitados.
