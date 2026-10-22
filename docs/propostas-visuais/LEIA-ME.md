# Odonto.IA — propostas atuais para o Maestri
FASE ENCERRADA — propostas visuais e testes dirigidos.

Atualizado em 20/10/2026 · Pacote de propostas no repositório. Propostas visuais para revisão e preparação; não autorizam implementação, alteração de dados ou publicação.

## Entrada atual
| Tela | Artefato vigente | Fonte dos fluxos e pendências |
| --- | --- | --- |
| Meu Dia v7 | [Abrir](meu-dia-v7.html) | [MEU-DIA.md](MEU-DIA.md) |
| Ficha v11 | [Abrir](ficha-paciente-v11.html) | [FICHA.md](FICHA.md) |
| Orçamento v6 | [Abrir](orcamento-v6.html) | [ORCAMENTO.md](ORCAMENTO.md) |

Servir esta pasta por HTTP: dentro dela, executar `python3 -m http.server 8901 --bind 127.0.0.1` e abrir http://localhost:8901/. Versões anteriores e imagens dos testes são evidências históricas, não referências vigentes. Não é necessário ler versões antigas para entender o fluxo atual.

## Fluxo consolidado
Meu Dia retoma a mesma ficha, identifica a visita e separa observações gerais das notas por procedimento. Salvar não realiza todos os tratamentos: a conclusão exige marcação explícita. Consulta só com observações é permitida. Kits usados são informados pelo profissional, sem previsão ou baixa de estoque.

A ficha organiza sessões e tratamentos próprios. A assinatura pode incluir procedimentos selecionados ou somente observações; nesse segundo modo, nota vazia bloqueia a coleta. Documentos e retificações ficam em Arquivos, associados à sessão, com versões anteriores preservadas. Assinar não conclui tratamentos nem representa aceite comercial.

O orçamento recebe os procedimentos vinculados como direção de integração. Preço e inclusão comercial exigem conferência. Novo item não altera proposta aceita: renegociar, revisar e registrar novo aceite preservando o anterior. Aceite não significa recebimento; desmarcar item comercial não apaga procedimento clínico.

## O que foi verificado
| Recorte | Estado e limite |
| --- | --- |
| Retomada e observações no Meu Dia | PASSA nos testes locais registrados, incluindo consulta sem conclusão e salvamento repetido; destino é prévia interna. |
| Assinatura e retificação só de observações | PASSA na ficha v10; sessão correta, original preservado e duplicação bloqueada. |
| Nota vazia e assinatura com procedimento | PASSA nos testes dirigidos v10; seleção obrigatória no modo procedimentos e demais planejamentos preservados. |
| Renegociação e novo aceite | PASSA no teste local v6 registrado; resumo atualizado e aceite anterior preservado. |
| Integração entre as três telas | NÃO TESTADO / não implementado: HTMLs independentes, sem estado compartilhado. |

A conferência atual reconciliou documentos, versões e referências locais. Não repetiu testes de navegador nem alterou HTMLs. Resultados acima vêm das evidências identificadas nos documentos de cada tela. Nenhum teste de protótipo homologa o produto.

## Pendências e fonte responsável
| Tema | Onde fechar antes da implementação |
| --- | --- |
| Múltiplas fichas, troca de paciente, sessão e retomada após recarga | MEU-DIA.md |
| Sessões no mesmo dia; notas por visita versus nota global do procedimento; transições clínicas e encaminhamento | FICHA.md |
| Sincronizar inclusão, renomeação, faces e exclusão; inclusão iniciada no orçamento; pagamentos existentes | ORCAMENTO.md |
| Identidade do signatário, PDF, integridade, retificação clínica e documental | FICHA.md; aceite comercial em ORCAMENTO.md |
| Kits por visita/profissional, composição histórica e correções | MEU-DIA.md e FICHA.md |
| Permissões reais, exceções de gestão, persistência, falhas e concorrência | Contratos das três telas, com teste no servidor antes de homologar |
| Percursos de teclado, lista longa, mobile e acessibilidade completa | Limites de verificação em cada documento |

Não confundir diferenças deliberadas com inconsistência: editor de itens novos no Meu Dia permite edição direta; registros retomados estão protegidos no exemplo; ficha permite edição por responsável; assinatura clínica e aceite comercial são documentos distintos. Seus controles não substituem autorização no servidor.

## Uso no Maestri
Cérebro lê esta entrada e o documento da tela; designer avalia os HTMLs renderizados; auditor confronta a proposta com o produto atual. Fechar lacunas por recorte e pedir autorização de implementação. Manter uma fonte por tema, sem criar backlog paralelo a estes fluxos.

Dados, nomes, datas e preços são fictícios. Recarregar descarta alterações. Não há API, banco, assinatura válida, PDF gerado, integração financeira ou transmissão de dados entre os HTMLs. A prévia de sessão no Meu Dia não altera a ficha v10.

PNG ao lado dos arquivos são evidências locais; MANIFESTO.sha256 identifica o pacote. Documentação de produção e auditoria do sistema permanecem no repositório, separadas destas propostas. Nenhuma modificação no sistema foi realizada nesta curadoria.

Atualização vigente: ficha v11 representa duas sessões na mesma data, com horários e IDs separados. Assinaturas e observações independentes testadas; detalhes e limites em FICHA.md. Meu Dia v7 e orçamento v6 permanecem vigentes.


## Fechamento desta fase
Referências finais: Meu Dia v7, ficha v11, orçamento v6. Último teste PASSA: retificação das 09h preservou original e sessão das 14h30; acesso por sessão em Arquivos exibiu somente seus documentos. Evidências em FICHA.md. Não é necessário continuar expandindo estes protótipos nesta fase.

Próxima etapa no Maestri: revisar propostas e pendências contra o produto existente, fechar contratos técnicos por recorte e obter autorização antes da implementação. Em 22/10/2026 o usuário autorizou commit e push deste pacote documental. Isso não autoriza implementação, deploy ou migração. Protótipos, documentação e evidências estão nesta pasta; o sistema permaneceu inalterado.

## Versionamento em 22/10/2026
Este pacote foi incorporado ao Git por solicitação do usuário. Apenas HTMLs finais e evidências documentais; versões exploratórias não são entradas de implementação. O guia de organização do Maestri permanece como entrega externa. Resultados de navegador são os testes registrados na fase anterior; não foram repetidos para este commit.
