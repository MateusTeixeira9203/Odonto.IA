# Meu Dia v7 — proposta de retomada e fluxos

Data: 18/10/2026. Responsável pela decisão: usuário / dono do produto.
Papel desta entrega: arquitetura de produto e prototipação visual.
Estado: proposta visual atual, com direção aprovada pelo usuário; revisão de design e auditoria técnica pendentes. Não é autorização de implementação. Implementação não iniciada. Artefato: meu-dia-v7.html, derivado da v6. Direção da retomada aprovada visualmente pelo usuário; implementação não autorizada. Não consultar v1–v5 como requisitos.
Responsável técnico pela execução: a designar no novo ambiente. Integração e auditoria: a designar antes da distribuição de tarefas.

## 1. Resultado esperado

Registrar o atendimento em uma superfície contínua, com escrita livre, voz e seleção odontográfica convergindo para procedimentos compactos agrupados por dente. Reduzir formulários e cartões sem perder dados, contexto ou autoria.

Fila compacta → paciente/visita/ficha identificados → atendimento e odontograma lado a lado → materiais opcionais → ficha e orçamento em rascunho.

## 2. Dentro do escopo

- Fila compacta e identidade explícita do paciente, visita, ficha e profissional.
- Área ampla de escrita e revisão, sem Campo Mágico ou revisão em painel separado.
- Procedimentos em linhas por dente; faces na mesma linha. Restauração MOD é um procedimento com três faces. Tratamentos diferentes no mesmo dente não se fundem.
- Nome/faces editáveis na linha. Clique na área de expansão abre observação recuada. Texto livre sem aparência de formulário.
- Excluir procedimento em elaboração por ação discreta ou apagar seu nome e sair da edição; oferecer desfazer.
- Quando o último procedimento sai, retirar o grupo do dente e sua marcação de rascunho. Não apagar dente anatômico, histórico ou registros existentes.
- Odontograma anatômico com seleção múltipla e chips de procedimentos rápidos. Aplicação em vários dentes cria itens independentes nos respectivos grupos.
- Botão opcional “Adicionar materiais”, no rodapé: abrir kits da clínica → selecionar kits usados → confirmar → fechar. Contagem discreta no botão. Sem seção permanente.
- Salvar ficha alimenta orçamento em rascunho; prévia acessível pelo Meu Dia. Proposta aceita fica protegida contra atualização automática.
- Voz integrada à área de atendimento, com revisão humana.

## 3. Fora do escopo desta entrega

Redesign da ficha do paciente, Dashboard, Gestão, landing, Apresentar e Financeiro; migrações, publicação e alteração de produção; previsão de materiais, cálculo de preço por material, baixa automática de estoque; cobrança, pagamento, negociação e aceite completos dentro deste artefato; apagamento de histórico; diagnóstico ou indicação clínica pela IA.

Não adicionar uma seção permanente de materiais, campos de quantidade ou materiais por procedimento: essas propostas foram substituídas pelo botão opcional de kits. Selecionar kit não comprova quantidade consumida.

## 4. Fluxos e regras

### Contexto e escrita

Selecionar atendimento mantém paciente, visita e ficha explícitos. Trocar paciente exige tratar edição não salva; nunca reaproveitar conteúdo em outro paciente silenciosamente. Preservar a origem e a ordem do relato.

“Restauração em resina D26 MOD” → Enter → linha no dente 26, nome e faces reconhecidos. Shift+Enter continua texto. A organização não deve deslocar o cursor durante digitação. Texto incompleto, negado ou ambíguo não vira procedimento automaticamente. Informação ausente permanece ausente. Salvar confirma o registro, não transforma procedimento em realizado.

### Odontograma e chips

Selecionar um ou vários dentes → catálogo/chip → faces aplicáveis → adicionar. Clique novamente desmarca. Preservar os recursos existentes do odontograma completo: histórico, estados, anatomia, especialidades e dentições suportadas; o protótipo só representa parte deles. Inventariar antes de implementar. Tratamento em vários dentes não dispensa revisão de cada indicação.

### Editar, observar e excluir

Clicar no nome/faces edita; clicar no expansor abre observação abaixo. Recolher não perde texto. Renomear restauração para faceta pode mudar identidade do catálogo, preço e materiais; não transferir esses atributos silenciosamente. O mecanismo de confirmação precisa ser fechado.

Excluir item novo retira a linha e a prévia financeira correspondente. Último item remove o grupo e sua marcação de rascunho. Desfazer restaura o conteúdo. Exclusão de um procedimento não remove kits do atendimento automaticamente. Registros persistidos, realizados ou vinculados a propostas aceitas precisam de fluxo próprio, preservando histórico; não estão autorizados à exclusão por simples Backspace.

### Materiais opcionais

Botão → kits cadastrados → selecionar usados → confirmar. Reabrir conserva seleção confirmada; cancelar não altera; desmarcar todos e confirmar limpa a seleção. Sem previsão, consumo automático ou estoque. Kits ficam vinculados ao atendimento; vínculo individual por procedimento não foi definido.

### Orçamento e salvar

Prévia antes de salvar é temporária. Ao salvar ficha, criar/atualizar rascunho consistente com os procedimentos vinculados, sem duplicação por repetição ou falha. Proposta aceita não se altera automaticamente.

Fluxo posterior atual: montar proposta → negociar e definir condições → revisar → registrar aceite. Ver ORCAMENTO.md; aceite não equivale a pagamento. Inclusão pela futura tela de orçamento deve vincular também o procedimento clínico, sem presumir realização. Comportamento proposto de versões e aceite está em ORCAMENTO.md; preços, remoção e integração ainda precisam de contrato técnico. A prévia não substitui esse trabalho.

### Voz e falhas

Gravar → transcrever → revisar no mesmo atendimento. Permissão negada, interrupção ou falha da IA não podem apagar texto digitado. Texto original deve ser recuperável; não inventar diagnóstico, faces ou medições. Feedback de processamento deve reutilizar os padrões existentes.

## 5. Inventário técnico antes da implementação

Confirmar baseline real no novo ambiente. Referências de leitura, não lista exaustiva de arquivos a editar:
- src/app/dashboard/meu-dia/_components/meu-dia-client.tsx
- src/components/odontograma/Odontograma.tsx
- src/components/odontograma/tooth-geometry.ts
- src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx
- src/app/globals.css
- docs/PRODUTO.md e pacote da auditoria de 18/10/2026

Levantar contratos atuais de atendimento, ficha, procedimentos, extração, catálogo, kits e orçamento. Preservar anexos, detalhes de especialidade, histórico, autoria, encaminhamento e permissões existentes mesmo quando não aparecem no protótipo. Não supor que o mockup é inventário completo.

Antes de distribuir execução, atribuir módulos/arquivos e responsáveis neste contrato. Não editar índices centrais em paralelo. Nenhuma API/schema final foi definida aqui.

## 6. Decisões técnicas ainda abertas

Modelo de editor e preservação da ordem/origem do relato; extração incremental e confirmação de ambiguidades; identidade de catálogo ao renomear; estados clínicos; deduplicação em seleção múltipla; edição de registros salvos; catálogo/registro real de kits; criação consistente ficha-orçamento; falhas parciais, idempotência, concorrência e propostas aceitas.

As lacunas não autorizam improvisar regras. Fechá-las com o dono do produto antes da implementação dependente. Pode-se preparar a camada visual preservando contratos existentes.

## 7. Critérios observáveis para a implementação

Todos abaixo estão NÃO TESTADOS na aplicação futura. São critérios, não alegação de entrega.

| Estado inicial / ação | Resultado esperado | Efeito proibido | Verificação segura |
|---|---|---|---|
| Atendimento sintético A aberto; selecionar B | Contexto muda com proteção da edição | Texto de A em B | Duas fichas sintéticas, antes/depois e recarga |
| Texto explícito de restauração D26 MOD; confirmar | Um item no 26 com MOD | Três cobranças ou dado inventado | UI, persistência e recarga |
| Relato negado/incompleto; organizar | Texto preservado e dúvida explícita | Procedimento afirmado por engano | Casos de avaliação antes/depois da extração |
| Dois dentes selecionados; usar chip | Um item por dente, contexto correto | Aplicar a dente não selecionado | UI + leitura dos registros |
| Item com observação; recolher/reabrir | Texto intacto | Perda de observação | Teclado/mouse e recarga após salvar |
| Último item novo no dente; excluir/desfazer | Some grupo; volta com conteúdo | Apagar histórico do prontuário | Rascunho sintético e comparação |
| Kit confirmado; editar e cancelar | Mantém seleção anterior | Consumo/estoque alterado | UI e ausência de escrita indevida |
| Ficha nova; salvar, repetir e recarregar | Ficha/rascunho consistentes | Duplicação e sucesso parcial silencioso | QA isolado, falha delimitada |
| Proposta aceita existente; mudar ficha | Revisão explícita da mudança | Alterar preço/aceite/pagamento silenciosamente | Cenário sintético, antes/depois |
| Conta de outra clínica; acessar diretamente | Acesso negado sem alteração | Vazamento ou escrita cruzada | Duas identidades autenticadas, servidor/API |
| Texto longo e 20+ procedimentos | Leitura compacta, scroll e cursor utilizáveis | Conteúdo encoberto/perdido | Desktop/mobile, teclado, claro/escuro |

Separar fidelidade visual, paridade funcional e permissões. Compilar não é prova de fluxo. Medir resultados na versão/ambiente executados e registrar PASSA/NÃO PASSA/NÃO TESTADO aqui.

## 8. Artefato: o que demonstra e o que não demonstra

HTML autocontido com dados fictícios. Demonstra seleção de dentes, chips, linhas, edição, observações, exclusão/desfazer, seleção de kits e prévia. Reconhecimento de texto é expressão restrita de exemplo, não IA. Voz e salvar exibem mensagens. Nada persiste ao recarregar. Orçamento mostra valores a definir. Sem catálogo real, validação clínica, validação completa de faces, duplicatas ou API.

Editor ainda é uma simulação de regiões editáveis numa superfície: não um editor clínico estruturado completo. Odontograma reutiliza coroas/raízes do produto, mas não todos os recursos. Esses limites não viram requisitos para retirar capacidades existentes.

Verificações dirigidas da família de artefatos: v4 edição/exclusão/desfazer/prévia; v5 seleção de dois dentes via chip e remoção do último item; v6 abertura de kits, seleção e confirmação com contagem. Não houve regressão completa da versão final. Exclusão apagando nome, todas as combinações de faces, cancelamento/reabertura de kits, mobile e acessibilidade completa ainda exigem verificação.

## 9. Referência visual e preservação

Desktop: máximo 1800px, margem 30px, colunas 1,15:1. Até 1000px empilha. Linhas de 40px; número 19px; texto 15px. Sem cartão por procedimento, sem formulário grande de status, sem seção fixa de materiais.

Escuro: fundo #0d0d0d; superfície #111112; alternada #1c1c1e; borda #27272a; texto #fafafa; secundário #a1a1aa; destaque #5dbeb0.
Claro: fundo #f4f4f6; superfície #ffffff; alternada #dadade; borda #c2c2c6; texto #09090b; secundário #4b5563; destaque #1e7060.

Tokens copiados do CSS do produto e declarados no HTML. Tipografia do protótipo usa Outfit/system-ui e Georgia como fallback; harmonizar com as fontes existentes sem modificar a estrutura aprovada. Na implementação, extrair medidas por DOM/CSS e comparar renderizado em ambos os temas, não aproximar por captura.

## 10. Entrega futura e reversão

Entregar mudanças pequenas, testes por critério, evidências da versão, limitações e caminhos de reversão que preservem registros. Separar código visual, regras e eventuais migrações. Não reverter dados clínicos/financeiros para recuperar layout. Publicação requer autorização específica e validação posterior em ambiente identificado. Aceite visual deste pacote não é aceite da implementação.


## Relação com as propostas atuais
Ficha: FICHA.md. Orçamento: ORCAMENTO.md. As exclusões acima são do artefato Meu Dia, não impedem as propostas separadas. Este documento foi transportado e conciliado em 20/10/2026; não houve novo teste funcional do Meu Dia nesta organização.


## Alinhamento conferido em 20/10/2026
Consumidores atuais: ficha v10 (FICHA.md) e orçamento v6 (ORCAMENTO.md). Salvar confirma o conteúdo revisado; na v7, só os itens explicitamente marcados Realizado hoje são representados como concluídos na prévia. Não assina atendimento nem registra aceite comercial. Rascunho financeiro recebe os itens clínicos vinculados; inclusão comercial e valor são conferidos no orçamento. Se já houver aceite, mudanças ficam pendentes para renegociação explícita.

A v7 demonstra retomada, contexto da sessão e separação entre observações gerais e específicas. O destino é uma prévia interna: não há transmissão para a ficha v10. Seleção de kits é explícita e por atendimento/profissional, sem previsão de quantidade ou consumo. Integração e preservação dessas identidades no produto continuam pendentes.


## Retomar tratamento e observações — proposta v7
Esta seção atualiza a lacuna de retomada descrita acima. A direção foi aceita visualmente pelo usuário; integração real continua pendente.

1. Paciente e profissional já identificados. Mostrar ficha em curso e resumo recolhido da última visita. Retomar usa a mesma ficha e seus procedimentos existentes; não cria cópias dos tratamentos.
2. Abrir a sessão atual com identidade própria, data, horário e profissional. No exemplo: Marina / Sofia / 20/10/2026 às 09:00. Clicar novamente em Retomar não abre outra sessão. O exemplo contém apenas uma ficha e uma sessão atual; seleção entre várias fichas não está implementada.
3. Texto geral fica nas observações desta sessão. Observação expandida sob um procedimento fica vinculada à visita e ao procedimento, sem substituir observações anteriores. Texto não estruturado e linha ainda não confirmada são preservados como relato geral ao salvar, sem inventar conclusão clínica.
4. Procedimentos retomados mostram o estado anterior. Marcar explicitamente Realizado hoje é a proposta de confirmação de conclusão para os planejados; salvar sozinho não conclui todos. Outros itens permanecem no plano. A consulta pode conter apenas observações. Tratamentos parciais e outros estados ainda exigem definição.
5. Salvar mostra a prévia do histórico da ficha, com sessão, profissional, observações gerais, itens trabalhados e suas notas. Kits são os selecionados explicitamente nesta visita. Repetir o salvamento atualiza a mesma sessão simulada, sem duplicar. O histórico anterior fica separado.
6. Ver sessão na ficha reabre essa prévia dentro do Meu Dia. Não navega com dados para o HTML da ficha v10: o painel representa o destino desejado, sem persistência ou conexão real. Assinatura deve ocorrer posteriormente sobre a sessão correta pelo fluxo da ficha; salvar não assina nem registra aceite comercial.

### Preservação e limites
No cenário retomado, nomes/faces de registros existentes estão somente para consulta e não possuem exclusão; a v7 propõe essa proteção enquanto não houver contrato de edição persistida. Itens novos mantêm a elaboração da v6. A observação nova não é uma edição de documento assinado. A sessão ainda sem assinatura pode ser revista na demonstração; encerramento, reabertura e correção de sessões assinadas exigem fluxo próprio. Não remover capacidades existentes na implementação com base nessa proteção demonstrativa.

Pendente: escolha entre múltiplas fichas; duas visitas no mesmo dia; proteção de edição ao trocar paciente; estado parcial; reconciliação estruturada de correções; retomada após recarga; falha e concorrência; persistência/autorização; envio real à ficha e ao orçamento. Voz permanece somente mensagem, sem gravar ou armazenar áudio. Novo item ainda não tem toda a seleção de estado clínico neste protótipo.

### Teste dirigido da v7 — 20/10/2026
PASSA no HTML local: retomar ficha → sessão 20/10 às 09:00 → registrar observação geral → marcar somente dente 26 realizado → registrar nota específica → salvar → prévia mostra ambos os textos na sessão atual. Dente 36 não aparece como realizado. Sessão anterior de 19/10 mantém dente 46 e seu texto. Repetir salvar mantém uma única sessão atual. Evidência: meu-dia-v7-retomada.png. Sem teste integrado com ficha v9, backend, assinatura, recarga persistente, mobile ou regressão integral da v6.


### Sessão somente com observações — teste dirigido em 20/10/2026
Papel: Auditor / Curador. Ambiente: meu-dia-v7.html no navegador local, porta 8901; aba nova, dados fictícios e estado apenas em memória. Nenhum HTML ou código do sistema alterado nesta rodada.

Estado inicial: ficha de Marina/Sofia; dentes 26 MOD e 36 O planejados, sem marcar Realizado hoje; dente 46 DO concluído na visita anterior de 19/10.

Fluxo: Retomar tratamento → escrever apenas observação geral da consulta → Salvar atendimento → conferir prévia do histórico → voltar ao Meu Dia → conferir os tratamentos → reabrir Ver sessão na ficha.

| Critério | Resultado | Evidência observada |
| --- | --- | --- |
| Salvar sem concluir procedimento | PASSA | Prévia exibiu “Consulta registrada sem conclusão de procedimentos”, com a observação integral. |
| Sessão e autoria corretas | PASSA | Nota sob 20/10/2026 às 09:00, Dra. Sofia, ficha de Marina; nenhuma conclusão atribuída à visita. |
| Planejamentos preservados | PASSA | Ao voltar, dentes 26 MOD e 36 O permaneciam planejados; ambos Realizado hoje desmarcados. Nenhuma linha removida. |
| Histórico anterior preservado | PASSA | Sessão 19/10 expandida manteve dente 46 concluído e o texto anterior; não recebeu a nova nota. |
| Reabrir prévia | PASSA | Ver sessão na ficha mostrou novamente a mesma observação e ausência de conclusão. |

Evidência: [sessão somente com observações](meu-dia-v7-so-observacoes.png). Nenhuma falha no percurso exercitado. A consulta pode ser registrada sem realizar tratamentos; a observação pertence à sessão, não muda o planejamento nem reapresenta procedimentos anteriores como realizados hoje.

Limites: esse resultado confirma a simulação interna do Meu Dia. Persistência após recarga, integração e permissões continuam NÃO TESTADOS. Assinatura sem procedimentos foi posteriormente demonstrada e testada separadamente na ficha v10; resultados em FICHA.md. Não criar procedimento para permitir assinatura.

Atualização: a ficha v10 agora demonstra assinatura e retificação de sessão apenas com observações, sem itens clínicos. Ver FICHA.md, seção Assinatura somente das observações. A pendência visual está atendida; integração entre os HTMLs e assinatura real continuam fora da simulação.

Consumidor atual: ficha v11 demonstra duas visitas na mesma data com IDs e horários distintos. O Meu Dia v7 ainda simula uma única sessão; não há transmissão para essas duas visitas. Integração deve retomar pelo ID exato, sem criar ou fundir sessões pela data. Fluxo e teste em FICHA.md.

Estado de entrega: fase de propostas e testes dirigidos encerrada por solicitação do usuário. Referências finais e pendências em LEIA-ME.md; esta proposta não autoriza implementação.
