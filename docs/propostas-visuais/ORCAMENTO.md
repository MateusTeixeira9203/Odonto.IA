# Orçamento v6 — proposta atual
20/10/2026 · Proposta visual escolhida pelo usuário para levar ao Maestri. Artefato: orcamento-v6.html. Revisão técnica e de design precede implementação; não é autorização para mudar o sistema.

## Organização visual
Desktop: 60% procedimentos e 40% negociação, descontado o espaço entre colunas. Linhas compactas, avisos suaves e total menor (21 px). Só a lista de procedimentos rola quando necessário; negociação, total e ações ficam visíveis. Após aceite, campos dão lugar a resumo das condições, total aceito e Renegociar. Histórico abre sob demanda em diálogo, sem ocupar a página. Até 620 px de largura ou 570 px de altura, admite rolagem normal para evitar cortes. Lista longa e todos os tamanhos ainda não foram verificados.

## O que vai fazer — direção proposta
1. Representar orçamento em rascunho associado à ficha. Procedimentos clínicos confirmados chegam vinculados, sem duplicação. A integração ainda é simulada por botão.
2. Exibir apenas os tratamentos/itens do dentista atual; exemplo: Sofia. Isso exige autorização real no servidor, não filtro visual.
3. Permitir conferir valores e selecionar itens da proposta. Desmarcar não apaga procedimento da ficha nem altera execução clínica.
4. Negociar desconto em reais, forma combinada, entrada, parcelas do restante e observação opcional. Entrada zero aparece como Sem entrada. Valores em centavos; diferença de arredondamento fica na última parcela.
5. Revisar itens, valores e condições; confirmar leitura e traço fictício no protótipo; registrar aceite da versão apresentada. Aceite não é recebimento.
6. Depois do aceite, proteger valores e seleção; exibir só resumo e Renegociar, com histórico acessível.
7. Renegociar exige motivo e abre revisão editável. Versão antiga continua aceita até nova confirmação. Novo aceite torna a revisão vigente, preserva a anterior no histórico e retorna automaticamente ao resumo.

## Novo procedimento
Rascunho: novo canal chega destacado, desmarcado e sem preço presumido. Conferir valor e incluir comercialmente. Seleção sem valor bloqueia aceite.
Aceito: novo item permanece pendente e não altera o total aceito. Abrir renegociação para incluir, definir condições e colher novo aceite. Repetir a simulação não duplica a linha. Adicionar procedimento nunca transfere a assinatura anterior para conteúdo novo.

## Limites e o que não fará
Sem código do sistema, API, banco, autenticação, persistência, estoque, cobrança, recebimento, repasses, alteração clínica, assinatura válida ou envio externo. Recarregar descarta a sessão. O cenário Aceite fictício existente é pré-carregado para testar, não uma assinatura coletada. Só usar traços fictícios.
Não apaga aceites anteriores. Não consolida dados de outros dentistas. Não altera valores aceitos silenciosamente. Não transforma negociação ou entrada combinada em dinheiro recebido.

## Decisões abertas antes de implementar
Identidade/representante do signatário, integridade/retencão/evidências, permissões, exceções de gestão, datas, juros, múltiplos meios, cancelamento de revisão, desistência/aceite parcial e impacto sobre parcelas ou pagamentos existentes. A inclusão manual de procedimento a partir do orçamento e seu vínculo clínico ainda precisam de fluxo definido; o protótipo somente demonstra chegada da ficha. Autorizações e isolamento exigem identidades autenticadas distintas, testes diretos e negativas. Validar contratos atuais e preservar consumidores financeiros antes de executar.

## Teste completo da v6 — resultado atual
Ambiente: HTML local, dados fictícios, sem persistência. PASSA no recorte:
- Versão 1 aceita: dois itens de R$ 350 + R$ 250, total R$ 600, sem entrada/Pix.
- Renegociar com motivo abre campos e mantém indicação do aceite anterior.
- Novo canal no dente 36 incluído por R$ 1.200; revisão total R$ 1.800.
- Resumo de aceite mostra somente nome do procedimento, sem aviso de rascunho.
- Leitura e traço fictício confirmados; versão 2 protegida e retorno automático ao resumo de R$ 1.800.
- Histórico aberto e comparado: versão 1 com dois itens/R$ 600 preservada; versão 2 com três itens/R$ 1.800 vigente.
- Fechar histórico retorna à tela compacta.
Evidências: orcamento-v6-teste-resumo.png e orcamento-v6-teste-historico.png. Nenhuma falha no recorte exercitado. As imagens são de teste anterior à organização desta pasta, com o mesmo comportamento visual.

Verificações complementares anteriores: bloqueio de item sem valor e deduplicação no botão de simulação. NÃO TESTADO: backend, persistência, segurança, assinatura real, integração ficha-orçamento, lista longa, todos os tamanhos, zoom e acessibilidade integral. Resultado visual não homologa produção.


## Alinhamento conferido em 20/10/2026
Origem proposta: Meu Dia v7 e ficha v11. “Procedimento confirmado” significa registro clínico revisado/salvo, não tratamento realizado nem item comercial aceito. Rascunho automático não implica preço automático ou seleção comercial de todo item novo. A chegada ao orçamento não exige assinatura do atendimento; os dois documentos têm finalidades distintas.

Desmarcar na proposta não exclui da ficha. Mudanças em nome, faces, preço ou exclusão de item já vinculado precisam de reconciliação definida, especialmente depois do aceite. Kits do Meu Dia não alteram preços nem geram cobranças. O link de retorno aponta para ficha v11, mas não transporta estado. A inclusão manual iniciada no orçamento continua pendente, sem inventar procedimento clínico silenciosamente. Novo aceite não recalcula pagamentos já realizados nesta proposta.

Consulta somente com observações e assinatura clínica não representam novo item comercial. O pacote não propõe gerar cobrança nem alterar aceite por esses eventos; sincronização real permanece não implementada.

Estado de entrega: fase de propostas e testes dirigidos encerrada por solicitação do usuário. Referências finais e pendências em LEIA-ME.md; esta proposta não autoriza implementação.
