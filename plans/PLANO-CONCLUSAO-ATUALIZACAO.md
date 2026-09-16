# Plano de conclusão da atualização — Odonto.IA

16/09/2026 · Levantamento atualizado para organizar a execução, solicitado por Mateus.
**Não é uma nova spec.** Reúne entregas, decisões, lacunas e sequência; os contratos existentes continuam donos das regras.
Execução autorizada por Mateus em 15/09, com agentes Terra. Bloco 0 publicado no Preview com CI concluído; execução dos consumidores novos em andamento. Mateus autorizou commits separados e push apenas da branch de Preview em 15/09; main, banco oficial e promoção permanecem fora desta autorização.

## 1. Resultado que estamos fechando

Uma atualização integrada de **Consultório/Clínica, equipe e permissões, financeiro/orçamentos,
estoque e kits e Pendências/WhatsApp manual**, preservando o atendimento atual.
Dentista comum trabalha com seus dados; proprietário dentista atende e administra; proprietário não clínico administra sem perfil fictício.

**Meta desejada: concluir hoje.** O levantamento não sustenta prometer que tudo será liberável hoje:
há módulos ainda não implementados, decisões comerciais abertas e testes integrados obrigatórios.
Este plano mantém todas as pendências visíveis; não transforma um recorte menor em “atualização completa”.
Terminar significa implementar o escopo confirmado, verificar as jornadas, obter a conferência de Mateus
e preparar/publicar a versão compatível com o banco oficial. Compilar ou aplicar SQL sozinho não encerra a entrega.

## 2. Ponto de partida e evidências

- Candidato: `/home/mtx/.local/share/odontoia-testes/worktree`, branch `codex/testes-integrados`, HEAD `cfd3560` e alterações locais preservadas.
- A referência local `origin/main` está em `dc6523a`. Git aponta 48 commits exclusivos do candidato e 36 da main;
  isso indica divergência de histórico, não 84 funcionalidades diferentes. É preciso reconciliar os conteúdos.
- Checkout principal também tem várias frentes locais misturadas. Não usar `git add .` nem sobrescrever diretórios para integrar.
- Testes online: Supabase Free **etlqznuoxiilvxzygpat** / projeto Vercel de teste. Oficial: **zenfemoxvwerplrjgfqz**.
- A baseline do Free foi preparada em 10/09. Mudanças posteriores da produção, como R169, precisam ser confrontadas no schema do Free.
- Status abaixo usa código, Git e relatórios existentes; não é uma nova auditoria remota de todos os objetos/deployments.
- Os testes antigos continuam como evidência do seu recorte/commit. Não são somados como se provassem a versão integrada atual.

**Documentos antigos divergentes:** R166 ainda aparece como pendente no ESTADO local, mas sua spec em `origin/main`
registra confirmação em produção em 12/09. R167 também registra validação em produção; R168/R169 pertencem à linha publicada.
Specs antigas dizem que estoque/clínicas QA não existiam; relatórios de 12–14/09 registram implementação e fixtures posteriores.
No plano, estes são marcos históricos superados. Objetos e deployments serão reconferidos antes da publicação.

## 3. Decisões que a execução deve preservar

| Assunto | Decisão vigente |
|---|---|
| Modelos de clínica | Colaborativa; proprietário que atende; proprietário que não atende. Sem gestor delegado obrigatório. |
| Identidade | Uma conta pode atender e administrar. Proprietário não clínico e secretária não precisam de dentista/CRO fictício. |
| Navegação | Dock inferior preservado. Dentista comum: **Consultório**. Proprietário: **Clínica**. É uma área do app, não outro sistema. |
| Financeiro pessoal | Reutilizar a página atual inteira. Não reinventar gráficos, ações ou cálculos; escopo só do dentista. |
| Proprietário dentista | **Meus resultados** e **Resultados da clínica**, sem misturar caixa particular com caixa da unidade. |
| Procedimentos | Catálogo atual realocado de Configurações; cadastro/importação/valores continuam alimentando orçamento. |
| Recebimentos | Quem atende, quem registra e quem recebe o dinheiro são papéis distintos. Permissões por ação, sem caixa automático para secretária. |
| Titular financeiro | Clínica ou dentista conforme atendimento/orçamento; herança para cobranças/pagamentos; não reatribuir o passado. |
| Orçamento | Grupos/etapas com valor fechado e observação do combinado. Superior 15 mil + inferior 15 mil é exemplo, não tabela obrigatória. |
| Preços geridos | Tabela fixa não exige aprovação de todo orçamento. Exceção/desconto segue autorização; colaborativa conserva catálogo pessoal. |
| Cartão parcelado | Confirmação única; parcelas distribuídas mensalmente sem baixa manual todo mês. Integração bancária/PJ fica para depois. |
| Estoque | Pessoal separado do comum. Proprietário concede cadastro/entrada/consumo/correção; secretária ou dentista podem acumular ações. |
| Colaborativa | Dentistas iguais no estoque comum, estoques pessoais privados; não inventar proprietário obrigatório. |
| Kits | Montar composição reutilizável e usar o conjunto sem selecionar novamente cada material; quantidades reais continuam revisáveis. |
| Consumo na ficha | Confirmar o uso aplica baixa uma vez. Montar orçamento/kit não consome material; falha de estoque não apaga a ficha. |
| WhatsApp | Abertura manual com mensagem preenchida. Abrir ≠ enviar ≠ confirmar presença. Sem API/disparo em lote nesta entrega. |
| Compartilhar orçamento | Incluído por Mateus em 15/09: dentista e recepção autorizada usam mensagem personalizada e acesso ao orçamento para o paciente, dentro do mesmo fluxo manual. Abrir não registra envio nem aceite. |
| Confirmação | Contatos de amanhã aparecem desde o começo do dia atual, pelo calendário BRT; não esperar completar exatamente 24 horas. |
| Reativação | 30 dias configuráveis em 60/90/180 ou desativados. Cada dentista acompanha seus atendimentos; visita/retorno com colega não suprime seu ciclo. |
| Design | Produto atual como referência, claro/escuro/mobile, animação discreta; visual novo passa por conferência antes do código. |

## 4. Inventário — o que existe e o que falta

Atualização de 16/09: ver [evidência dos sublotes](auditorias/2026-09-16-sublotes-atualizacao.md).
Reativação pessoal no Dex foi adiada por Mateus e não é requisito desta publicação.
Checkout real e estabilidade permanecem posteriores ao QA manual do recorte atual.

“Implementado” abaixo informa presença de código; a coluna final diz o que impede fechar o módulo.

| Frente / fontes | Como está implementada | Pendência real |
|---|---|---|
| Ambiente separado — [preparação](specs/ambiente-teste-supabase-free.md) | Schema/Storage/Auth de teste preparados; contas sintéticas; Vercel separado, integrações externas de produção não copiadas. | Atualizar paridade com main, confirmar variáveis/segredos de teste e deployment que contém TODOS os lotes. |
| Agenda multidentista — [R164](specs/R-164-agenda-multidentista-legivel.md) | Faixa de ações retirada dos cards estreitos; ações conservadas no detalhe. No candidato/preview. | Conferir muitas sobreposições, nomes, teclado, celular e demais visões no app integrado. |
| Retorno/Ficha — R150/R168/R169 | R168 preserva responsável, semana correta e ocupados mobile; R169 inclui edição de procedimento/evolução, inclusão e diferenças no orçamento. Linha publicada registrada. | Preservar durante integração; retestar ponta a ponta e os casos MO/restauração, duplicação, retirada e orçamento lento. |
| Orçamentos/financeiro pessoal — [R157](specs/R-157-financeiro-orcamento-por-grupos.md) | Grupos com composição e valor fechado; nota por cobrança; recebimento por etapa; base financeira unificada, filtros, receitas manuais e capacidade estimada. Código no candidato e preview; testes prévios registrados. | Integrar sem perder R166/R167/R169; conferir PDF/aceite/CSV, etapas, filtros, histórico cancelado, desempenho e dados atualizados. |
| Desconto e edição de etapa — R166/R167 | Fórmula de saldo líquido corrigida; edição preserva recebimentos, altera composição/valor final e recompõe previsões. Specs da main registram validação em produção. | Não refazer. Provar que grupos, titularidade e novo cartão não reintroduzem saldo errado ou apagam pagamentos. |
| Consultório — [R161a](specs/R-161a-realocacao-financeiro-pessoal.md), [R161b](specs/R-161b-secoes-consultorio-precos.md), [R161c](specs/R-161c-procedimentos-personas.md) | `FinanceiroContent` e catálogo compartilhado reutilizados, título grande, Procedimentos realocado, links antigos preservados no piloto. Usuário conferiu a navegação. | QA integrado de CSV, catálogo vazio/importado, retorno por links antigos e disponibilidade por persona. |
| Identidade/acessos — [R159](specs/R-159-acessos-clinica.md), a/b/c | Contexto de membro sem perfil clínico obrigatório, catálogo de concessões, armazenamento protegido e consulta de equipe. Verificados em recortes no Free. | Editor operacional, concessão/revogação, convites, desativação, limite de delegação/último responsável e aplicação consistente por operação. |
| Entrada da recepção | R159c implementa entrada sem dentista fictício, shell operacional, Agenda/Pacientes/Pendências por capacidade. | Jornada Next/Server Actions e duas sessões no Preview precisam de QA manual. |
| Proprietários — [R163a](specs/R-163a-resultados-proprietarios.md) | `/clinica`, shell de gestão, Meus resultados reutilizado e agregação administrativa por mês/profissional. Campo de titular herdado e validado. | Dois tenants/contas na jornada integrada, proprietário não clínico completo, suspenso, preços/configurações/recepção e mutações financeiras permitidas. |
| Financeiro clínico amplo — [R163](specs/R-163-financeiro-clinica.md) | A leitura agregada e titularidade estão no recorte R163a. | Não confundir leitura de métricas com caixa operacional completo: registrar/corrigir/estornar por permissão, entradas/despesas da clínica e consistência entre telas. Capacidade física/hora da clínica ainda não entregue. |
| Cartão mensal — [R163b](specs/R-163b-cartao-parcelado-confirmado.md) | Integrado e aplicado no Free; parcelas mensais confirmadas, centavos, repetição e concorrência testados autenticados. | Conferência visual de filtros/métricas no Preview por Mateus. |
| Estoque manual — [R140e1](specs/R-140e1-estoque-base-manual.md), [autorização](specs/R-140e1a-autorizacao-estoque.md), [operações](specs/R-140e1b-operacoes-estoque.md) | Cadastro, lotes/entrada, consumo manual, descarte, contagem, correção e histórico; pessoal/comum, regras flexíveis e três modelos exercitados. | Rollback por falha de auditoria já testado em runtime; falta QA Next/Server Actions e conferência visual integrada. |
| Materiais na ficha — [R140e2](specs/R-140e2-estoque-ficha-kits.md) | Declaração, item/lote avulso ou kit, baixa atômica, retomada e correção auditada implementados; SQL aplicado no Free. | QA visual completo e duas contas; tipos especiais/OCR continuam fora do recorte. |
| Kits — R140e2 | Criar kit com quantidades decimais por componente; aplicar conjunto na ficha; backend versiona composição e conserva snapshots. | Fluxo visual criar/aplicar/corrigir precisa de QA. Editor/arquivamento completo de kits ainda não exposto na UI. |
| Etiquetas e materiais especiais — [R140d](specs/R-140d-rastreabilidade-etiquetas.md), R140e2 | Contratos de captura/revisão, ativos e ciclos; não declarar OCR/rastreabilidade completa entregues. | Extração revisada, vínculo item/lote/serial, repetição, implantáveis, reutilizáveis e uso limitado. Dependem de exemplos reais e ciclo validado. |
| Pendências — [R161d](specs/R-161d-pendencias-kanban.md) | Kanban, filtros, busca, modelos, ativação, WhatsApp manual, envio, agenda, adiamento e histórico. RPCs/UI testados por recorte. | Jornada integrada da recepção, suspensão com JWT existente, conferência final; adaptar a reativação à decisão pessoal posterior. |
| Orçamento pelo WhatsApp — [R161f](specs/R-161f-orcamento-pdf-whatsapp.md) | PDF real, mensagem editável, share mobile e download/abertura desktop, confirmação Enviei explícita e snapshot protegido. | Conferir compartilhamento no celular e anexo manual desktop. Não há API, anexo por wa.me nem link público do prontuário. |
| Reativação no Dex — [R161e](specs/R-161e-reativacao-pessoal-dex.md) | **Adiada por Mateus no recorte final; fora desta publicação.** Somente plano. Dex antigo e Pendências calculam retenção de formas diferentes. | Fonte única, prazo configurável, último atendimento POR dentista, card/atalhos, atualização sincronizada e delegação sem duplicar contato. |
| Cadastro/pagador — [R165](specs/R-165-cadastro-responsavel-assinatura.md) | Cadastro Free dos três modelos, pagador individual/centralizado e estrutura comercial pendente. Proprietário não clínico sem perfil falso; estoque inicializado. | Vagas/ativação, checkout centralizado, cobertura efetiva e transição comercial; nada cobra em produção. |
| Tabela/preços/descontos geridos — [R160](specs/R-160-precos-descontos.md) | Catálogo pessoal existe; tabela publicada da clínica e aprovação de exceções ainda são planejamento. | Configuração/publicação, aplicação em grupos/etapas, limites, aprovação e proteção contra desconto por caminho indireto. |
| Estabilidade/cobrança — [R155](specs/R-155-estabilidade-operacional-acesso-recuperavel.md) | Fix do loop já publicado; recortes locais de reconciliação, sessão/rascunho, ledger, erros e telemetria. Não equivalem a pacote inteiro liberado. | Confirmar o que já entrou na main; ciclos sandbox, recusa real, webhook atrasado/repetido, suspensão, sessão/aba antiga, alertas e rollback. |

**Evidência concreta já disponível:** [estoque](auditorias/2026-09-12-r140e1b-estoque-manual.md): 42 testes e 50 gates HTTP no recorte;
[Pendências](auditorias/2026-09-13-r161d-pendencias.md): 20 testes e defeito de confirmação sem envio corrigido;
[Clínica](auditorias/2026-09-14-r163a-resultados.md): 26 testes, recebimentos mistos e negativos na mesma clínica;
[R157](auditorias/2026-09-09-r157-validacao-local.md): testes/CI/preview prévios; [R169](auditorias/2026-09-14-r169-ficha-orcamento-preview.md): publicação registrada em 15/09.
Cada relatório preserva suas limitações; aprovação de um não fecha os demais.

## 5. Ordem de execução até terminar

### Bloco 0 — Consolidar a base e congelar o pacote
1. Preservar alterações dos checkouts e listar entregas por origem; atualizar referência remota antes de integrar.
2. Partir da linha publicada e incorporar recortes do candidato sem regressar R166–R169. Resolver conflitos por regra vigente, não por aceitar um lado inteiro.
3. Montar manifesto de arquivos/commits/migrations por módulo e comparar os objetos reais do Free/oficial, somente leitura na origem.
4. Confirmar Vercel de teste → Free, sem credenciais/integrações live. Preparar preview integrado da base antes de acrescentar módulos.
**Saída:** uma base única reproduzível, com fonte de cada entrega e diferenças de schema conhecidas.

### Bloco 1 — Fechar as decisões que travam implementação
1. Confirmar abrangência desta publicação: o inventário inclui tudo; itens condicionais abaixo não desaparecem por causa do prazo de hoje.
2. Fechar R165: modalidade individual/centralizada, cobertura do proprietário/recepção, vagas e mudança de modalidade.
3. Fechar em R160 autonomia de desconto e operação da tabela; regras propostas não viram política comercial silenciosamente.
4. Definir se hora clínica por cadeira, OCR/tipos especiais fazem parte da publicação imediata ou de uma entrega posterior explicitamente nomeada.
**Saída:** decisões anotadas nos contratos donos já existentes, sem criar uma nova spec geral.

### Bloco 2 — Concluir identidade, acesso e equipe
1. Completar entrada dos três modelos; login, troca de unidade, logout e proprietário sem perfil clínico.
2. Resolver guard/rotas da secretária nova; Agenda/Pacientes/Pendências têm destinos utilizáveis e autorizados.
3. Editor de concessões por ação/escopo; consulta, convite, aceite, suspensão/remoção e revogação com aba aberta.
4. Proteger último proprietário, impedir autoelevação e delegação de poder superior ao permitido; não remover autoria/histórico ao sair da equipe.
5. Aplicar a mesma regra em servidor/RPC; esconder botão não é a implementação da permissão.
**Saída:** dentista trabalha; proprietário administra; recepção opera o que foi concedido; protético mantém apenas seu calendário permitido.

### Bloco 3 — Concluir cadastro e cobertura comercial
1. Implementar os modelos de contratação confirmados em R165 sem alterar assinaturas atuais automaticamente.
2. Convite informa quem paga; validar cobertura antes de liberar acesso; evitar cobrança/vaga duplicadas em repetição.
3. Proprietário não clínico recebe cobertura administrativa explícita; não criar dentista fictício nem desligar billing em produção.
4. Testar saída/entrada de membros e regularização sem bloquear quem não pertence à assinatura afetada.
**Saída:** novos modelos podem ser contratados e recuperados, além de funcionarem com fixtures.

### Bloco 4 — Concluir procedimentos, tabela e orçamento
1. Preservar catálogo pessoal/importação e realocação. Catálogo vazio precisa orientar cadastro/importação, não parecer erro de rede.
2. Implementar tabela comum nas clínicas geridas e manter a individual nas colaborativas.
3. Aprovar descontos/exceções conforme permissões, inclusive nos caminhos de grupo, valor final e edição de etapa.
4. Integrar e retestar R157/R166/R167/R169: seleção por arcada, grupos, aceite parcial, nota do acordo, edição e PDF.
**Saída:** proposta, aceite, etapa e preço autorizado concordam sem alterar procedimento clínico ou recebimento passado.

### Bloco 5 — Fechar financeiro e cartão mensal
1. Conferir entradas manuais, despesas, saldo, filtros, gráfico, privacidade e CSV na mesma fonte; manter estimativa pessoal de hora clínica rotulada.
2. Completar operação do caixa da clínica pelas permissões de registrar/corrigir/estornar, separada da leitura das métricas.
3. Retomar R163b após integração: aplicar SQL revisado só no Free; validar três caminhos e concorrência com chamadas legadas.
4. Caso de cartão: R$100 em 3x = 33,33 / 33,33 / 33,34; cada mês recebe sua parcela, sem total no mês da venda nem baixa manual mensal.
5. Provar edição de etapa, desconto, estorno e parcela futura; boleto/acordo direto continuam pendentes. Não converter contratos antigos.
6. Resolver o HIGH de recebimentos externos sem `cobranca_id`: hoje abatem o agregado, mas não liquidam etapa definida.
   Se esse canal não integrar a release, bloqueá-lo explicitamente nela; não escolher etapa arbitrariamente nem misturar com assinatura Stripe do software.
**Saída:** ficha, etapa, financeiro pessoal e clínica concordam em todos os cenários, sem nova integração PJ.

### Bloco 6 — Fechar a base de estoque manual
1. Conferir operação com proprietário/recepção/dentista e igualdade no comum da colaborativa, mantendo pessoais privados.
2. Provar rollback real quando auditoria falha; entrada/consumo/correção não podem deixar meio movimento.
3. Testar cadastro simples, lote, saldo, histórico, falta de permissão e concorrência no app integrado.
**Saída:** base manual validada para sustentar uso clínico e kits.

### Bloco 7 — Materiais na ficha e kits
1. Registrar uso no atendimento com identidade estável, quantidades/unidades e origem pessoal/comum.
2. Confirmar baixa uma vez; erro/perda de resposta produz pendência recuperável sem apagar a ficha nem repetir consumo.
3. Criar/editar/arquivar kits e conservar a versão utilizada. Kit pessoal pode usar o comum permitido, nunca estoque privado de colega.
4. “Usar kit” preenche o conjunto; dentista confirma numa ação e só ajusta o que mudou, sem selecionar cada material novamente.
5. Correção mantém histórico e compensação; regularização administrativa não concede leitura de prontuário à secretária/proprietário.
**Saída:** caso completo kit → atendimento → consumo → saldo/histórico → correção, incluindo duplo clique e componente sem saldo/acesso.

### Bloco 8 — Pendências e orçamento pelo WhatsApp

Passos 2–5 e critério de acompanhamento independente adiados com R161e por decisão de Mateus.
Nesta rodada executar apenas integração da recepção e compartilhamento manual de PDF.
1. Fechar Kanban/rota/navegação R161d com a nova recepção e com dentista sem secretária.
2. Alterar elegibilidade e reconciliação para o último atendimento de CADA dentista; retorno de colega não exclui o ciclo pessoal.
3. Prazo 30/60/90/180, ativação e mensagem por profissional; contatos encerrados não renascem a cada atualização.
4. Aprovar artefato do Dex; implementar resumo expansível e abrir a mesma fila/contato, sem outro motor de retenção.
5. Delegar à pessoa autorizada mantém origem e histórico; envio/resposta/agendamento são fatos separados.
6. Reaproveitar o botão **Enviar orçamento por WhatsApp** no detalhe do orçamento: escolher a proposta,
   conferir número e mensagem preenchidos, editar se necessário, abrir WhatsApp e registrar **Enviei/Não enviei**.
7. Reusar a configuração de mensagens para o tipo orçamento; versão/valor/grupos/condições do documento
   vêm do orçamento persistido. Texto livre não muda preço, aceite ou cobrança.
8. Compartilhar **arquivo PDF**, conforme R161f confirmado: celular via share de arquivo quando
   suportado; desktop baixa e abre WhatsApp para anexo manual. Sem link público, token público ou API.
9. Autorizar por orçamento/clínica/responsável e capacidade de WhatsApp, tanto para dentista quanto recepção.
   Sem telefone válido ou acesso, orientar correção; não marcar enviado. Abertura não comprova entrega/leitura nem aceite.
10. Não prometer anexo automático: `wa.me` prepara texto/texto, não anexa PDF. Download/compartilhamento
    de arquivo, se oferecido, terá fallback explícito conforme o dispositivo; não é envio por API.
**Saída:** sem secretária o dentista resolve sozinho; com equipe não duplica a mesma tarefa; dois dentistas mantêm acompanhamentos independentes.
Orçamento compartilhado deve abrir para o paciente sem login profissional e mostrar somente a proposta autorizada.

### Bloco 9 — Rastreabilidade ampliada, se incluída na publicação
1. Conferir etiquetas reais e definir o ciclo de cada tipo; implementar captura/extração/revisão e vínculo inequívoco.
2. Implantáveis: serial/lote não pode ir para dois atendimentos; reutilizáveis e uso limitado precisam de seus estados/ciclos.
3. Fotografia repetida/extração errada não confirma uso; nunca inventar fabricante, lote ou validade.
**Saída:** gates R140d/R140e2 completos. Sem isso, entregar somente estoque/consumo/kits e declarar rastreabilidade ampliada pendente, se Mateus concordar com esse recorte.

### Bloco 10 — Fechar proteções de acesso e atualização
1. Reconciliar os patches locais R155 com o que já está publicado; não reintroduzir loop no proxy/guards novos.
2. Provar webhook atrasado/repetido/fora de ordem, pagamento confirmado no provedor e banco atrasado, recusa e regularização no sandbox.
3. Falha técnica não gera falsa dívida; suspensão não atinge colega; nenhum teste dispara cron global contra clientes.
4. Testar sessão expirada/ilegível, aba antiga após deploy e recuperação de rascunho no mesmo usuário/clínica/paciente.
5. Conferir alerta operacional e procedimento de retorno à versão anterior; console sem canal verificado não equivale a alerta entregue.
**Saída:** os novos perfis e a versão nova não recriam o bloqueio relatado pela pagante nem perdem trabalho em andamento.

### Bloco 11 — Auditoria integrada e teste de Mateus
1. Preview com o pacote inteiro conectado ao Free; typecheck/testes/lint/build na infraestrutura que comporte, sem forçar Next completo neste PC.
2. Revisão técnica, permissões, UX e design; correções e reexecução dos cenários afetados.
3. Matriz abaixo em duas contas logadas/duas clínicas; usar os modelos QA já existentes quando adequados, criando apenas o que falta.
4. Entregar um único link de preview, contas por persona e roteiro com resultados esperados. Mateus testa antes do push final/promoção.
**Saída:** nenhum erro crítico/alto aberto nos fluxos liberados, relatório por versão e aceite do usuário. Harness isolado não substitui essa etapa.

### Bloco 12 — Migração oficial e publicação
Seguir a sequência da seção 7; ativar por unidade/recorte verificável, preservando o plano de conclusão completo.
**Saída:** código e schema compatíveis, smoke de produção, estado final registrado e possibilidade de reversão operacional.

## 6. Matriz mínima de testes finais

| Jornada | Resultado a comprovar |
|---|---|
| Colaborativa, A/B na mesma clínica | Igualdade no comum; pessoal/financeiro de A não aparece para B por tela, URL ou RPC. |
| Proprietário dentista | Atende e consulta Meus resultados/Clínica com titularidade separada. |
| Proprietário não clínico | Login/gestão/preços/equipe/estoque/caixa concedido sem onboarding de dentista. |
| Recepção nova | Entra em Agenda/Pacientes/Pendências sem perfil falso; registra pagamento só quando concedido. |
| Membro suspenso/removido | JWT antigo e aba aberta não mantêm capacidade de operar. |
| Duas clínicas e troca de contexto | Nenhum dado, contador, rascunho ou ação fica apontado para a unidade anterior. |
| Orçamento superior/inferior | Grupos/preço fechado/observação/aceite/PDF corretos; receber superior não quita inferior. |
| Desconto e edição com recebimento | Saldo líquido correto; acordo não desconta duas vezes; fatos recebidos preservados. |
| Cartão parcelado | Cada parcela confirmada no mês, centavos fechados, repetição não duplica; boleto permanece pendente. |
| Financeiro | Lista, cards, gráfico e CSV concordam por mês/responsável/titular; ocultar valores inclui tooltip. |
| Estoque manual/kit/ficha | Uma baixa, pessoal/comum separados, recuperação após falha, correção auditada. |
| Agenda cheia/retorno | Nome legível, ações no detalhe, responsável/horário corretos, conflito/expediente preservados. |
| Confirmação de amanhã | Aparece hoje BRT; abrir WhatsApp não confirma; negar/adiar/remarcar preservam agenda e histórico. |
| Orçamento pelo WhatsApp | Mensagem/modelo corretos; Enviei registra envio manual e Não enviei não registra. PDF real anexado manualmente; snapshot revisado e falta de autorização impedem marcar envio, sem divulgação de prontuário. |
| Reativação A/B | Prazo pessoal; consulta com B não retira A; mesmo contato não duplica entre Dex e Pendências. |
| Consulta/Dex/Ficha | Relato MO, inclusão/retirada/renomeação e evolução preservados; orçamento não duplica evento. |
| Falhas de rede/duplo clique | Erro explícito, rascunho preservado, retorno persistido reconciliado antes de repetir. |
| Billing/atualização | Pago reconhecido, erro técnico distinguido, acesso recuperável e aba antiga sem perda silenciosa. |
| Desktop/mobile/claro/escuro | Dock, modais, teclado/foco, nomes, botões e feedback utilizáveis; medir lentidão do orçamento sem atribuí-la à internet por suposição. |

Usar fixtures sintéticas identificadas, registrar antes/depois e não apagar/resetar as clínicas que Mateus criou.
Sem WhatsApp/e-mail reais em QA. Testes destrutivos/rollback só em infraestrutura de teste apropriada.

## 7. Como vai para o banco oficial

**Não trocar o banco oficial pelo de teste e não copiar pacientes fictícios.** Levar código e migrations de estrutura compatíveis, conservando os dados reais.

1. Relacionar exatamente tabelas, colunas, índices, triggers, funções, grants/RLS e Storage afetados. Conferir o catálogo real dos dois bancos, não apenas schema_migrations.
2. Ensaiar a sequência das migrations sobre base representativa e dados sintéticos, inclusive preservação das chamadas antigas e rollback operacional.
3. Definir ativação de produção: hoje há gates presos ao Free e billing desligado no piloto. Substituir conscientemente por liberação server-side autorizada, sem hardcode do Free e sem desligar cobrança oficial.
4. Antes da escrita oficial, backup/snapshot verificável e plano de restauração compatível com o serviço disponível; não presumir backup automático do plano gratuito.
5. Após aceite de Mateus, aplicar migrations aditivas/revisadas na ordem de dependência. Sem reset/baseline integral nem DML que reatribua pagamentos/donos ou apague usuários.
6. Conferir objetos/grants e preservar app antigo compatível; publicar o código correspondente, com variáveis de produção corretas, e liberar unidades conforme cobertura/permissões confirmadas.
7. Smoke de login/acesso, rotas e leituras; observação de erros de banco/webhook. Não testar escrita clínica aleatória em clientes.
8. Se houver falha: interromper liberação, voltar deployment compatível, preservar fatos novos e corrigir aditivamente. Não dropar o histórico novo nem restaurar snapshot por cima das consultas realizadas depois.

**Push de preview e push final não são a mesma coisa:** para usar CI/Preview, pode ser necessário publicar a branch de teste antes da conferência.
Mateus autorizou esse push somente de Preview em 15/09. A conferência antes da publicação final permanece; nenhuma promoção é automática.

## 8. Decisões e limites que não podem sumir

1. **R165:** preço/cobertura confirmados em 16/09; faltam vagas e transição comercial. Impede liberar novas contratações completas; não impede trabalhar estoque ou reativação no Free.
2. **R160:** confirmar política inicial de autonomia/desconto. Tabela pessoal realocada não resolve tabela gerida.
3. **R163:** capacidade por sala/cadeira e rateio não estão implementados. Sem definição, hora clínica da unidade fica indisponível, nunca um número inventado.
4. **R140d/e2:** etiquetas/tipos especiais têm dependência de exemplos e validação do ciclo. Kits não equivalem a OCR nem a esterilização rastreada.
5. **Integrações externas:** assinatura Stripe do software, recebimento de paciente e WhatsApp são três fluxos distintos; consertar um não verifica os demais.
6. **Exclusões:** migração/QA não apagam usuários. Regras atuais de exclusão deliberada de orçamento e novas guardas de histórico de materiais precisam ser compatibilizadas sem mudança silenciosa de produto.

Itens mantidos para depois por direção já expressa: conexão bancária/PJ/open source, WhatsApp por API/lote,
consolidado de franquias/múltiplas unidades [R162](specs/R-162-multiplas-unidades.md), repasse automático e lucro contábil.
Gestor delegado obrigatório não integra os três modelos escolhidos. App nativo/ficha móvel futura não é requisito oculto desta release.
R146 e demais alertas de contexto clínico entram na regressão de [R156](specs/R-156-regressao-funcional-fluxos-clinicos.md): se reproduzidos no caminho liberado, bloqueiam a release; não tratar cabeçalho antigo como correção feita.

## 9. Forma de acompanhar a conclusão

Após cada bloco registrar: **o que mudou, qual versão, qual banco, cenários executados, falhas abertas e próximo bloco**.
Um integrador conserva a base; módulos independentes podem ser divididos depois das fundações, com revisão antes da integração.
Separar commits de migration, funcionalidade/correção e documentação; não juntar a atualização inteira num commit irreversível.
Os detalhes permanecem nas specs/relatórios ligados; este documento é o roteiro de fechamento, com snapshot datado.

**Ação atual:** finalizar CI/Preview dos sublotes, depois QA manual de Mateus.
Base integrada, treze migrations novas no Free e implementação dos consumidores constam no relatório de 16/09.
Pendências de produção/cobrança e itens adiados não são considerados concluídos pelo Preview.
