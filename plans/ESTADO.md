# Estado — Odonto.IA

> 16/09/2026 · correção de fidelidade da etapa de acordo em execução para Preview.

## Agora

Item ativo: R-170, responsabilidade de procedimento encaminhado.
Preview em `codex/conclusao-atualizacao`: orçamento `e619a0c`, rolagem única do shell `c9c1fe9`.
Worktree: `/home/mtx/.local/share/odontoia-testes/integracao`.
CI 35118081587 passou: typecheck, 391 testes, lint e build.
Commits separados autorizados somente para Preview.
Projeto Vercel: `odonto-ia-teste`. Supabase Free: `etlqznuoxiilvxzygpat`.
Nenhuma promoção/main, cobrança real ou escrita no banco oficial autorizada nesta execução.

## Evidência e limites

[Relatório dos sublotes](auditorias/2026-09-16-sublotes-atualizacao.md) é dono dos resultados.
- Base 1906f83: 387 testes unitários e CI completo passaram. Último ajuste UI dos kits
  tem teste focado de edição/CAS; Mateus pediu para assumir os testes restantes.
- Runtime SQL/PGlite: estoque, recepção, editor, recebimentos, PDF e cadastro passaram.
- Treze migrations aplicadas só no Free; objetos conferidos, sem depender do histórico de migrations.
- Contagens preservadas: 7 clínicas, 41 pacientes, 83 pagamentos.
- HTTP autenticado: financeiro A/B e isolamento; leitura de kits pelo proprietário autorizado.
- Build/typecheck completos rodam no [CI da branch](https://github.com/MateusTeixeira9203/Odonto.IA/actions?query=branch%3Acodex%2Fconclusao-atualizacao).
  Follow-up de tipos validado. Conferência de interface pelo Mateus ainda pendente.
- Não houve duas sessões de navegador no novo pacote: isolamento/RLS não está fechado para produção.

## Implementação atual

- Recepção sem CRO/dentista fictício, rotas operacionais e editor de concessões.
- Recebimentos por capacidade, estado canônico, repetição segura e erros recuperáveis.
- Kits: criar/editar composição e quantidades; retirar componente não usado antes de declarar.
  Materiais avulsos/kit na ficha, baixa, retomada e correção.
- Orçamento em PDF real; compartilhar arquivo no celular ou baixar/abrir WhatsApp no desktop.
  Apenas “Enviei” explícito registra envio manual; abrir não confirma pagamento nem aceite.
- Cadastro Free: três modelos, escolha do pagador, R$200/dentista e identidade clínica opcional.
  Cria estrutura comercial pendente e estoque; não inicia cobrança nem altera Stripe vigente.
- Orçamento: montagem ampla 70/30, nomes completos, itens atuais versus disponíveis,
  total ao vivo, preço por arcada visível e retorno ao mesmo fluxo de aceite/acordo.
- Feedback de Preview registrado: a etapa `Cobranças por etapa` não pode obrigar nova seleção
  dos itens já aprovados. Ela deve herdá-los, deixar `Alterar seleção` como exceção e recuperar
  os controles visíveis de à vista, entrada + parcelas, parcelado, desconto e observação. O painel
  financeiro precisa ganhar espaço no desktop; este é o uso diário do dentista.
- Decisão de 16/09: exclusão física pode remover ficha ou orçamento mesmo com pagamentos e
  assinaturas. Dentista da mesma clínica assume o risco após checkbox explícito; secretaria não
  pode excluir. O Prontuário deve expor `Excluir ficha` fora do menu de três pontos.
- Feedback em teste de 16/09: a secretária Cígias não conseguiu apagar um paciente; isso está
  **pendente de escopo**, pois excluir paciente remove o prontuário e o financeiro inteiro. O
  dentista também não consegue gerar orçamento a partir de uma Nova evolução sem salvar antes;
  deve herdar o salvamento provisório do Meu Dia. A área `Fichas em curso` deve sair; o progresso
  passa a aparecer no título/cartão da própria ficha, em função dos procedimentos dela.
- Evidência de Preview (14:30–14:31): o modal de exclusão de orçamento exige o checkbox, mas
  retorna `Não foi possível excluir o orçamento.` — a RPC `excluir_orcamento_permanentemente`
  ainda não foi aplicada no banco conectado ao Preview. A tela do Prontuário ainda exibe o bloco
  `Fichas em curso` e o chip de contagem; não tratar o item como entregue.
- Novo relato de encaminhamento (16/09), dentro da ficha — não no Meu Dia: depois de o destinatário
  preencher o detalhe e marcar o procedimento como realizado, ele deixa de conseguir manipular ou
  reencontrar os dados; o autor continua com acesso. A RPC de conclusão não apaga `detalhe` nem
  `encaminhado_para`: ela só altera `status` e `realizado_em`. A causa estrutural confirmada é a
  regra de autoria: destinatário só tem escrita estreita de status e, para endodontia/implante,
  detalhe técnico; autor conserva todos os controles. Ainda falta fechar a condição visual que
  oculta o item no caso observado. Diagnóstico adicional: `encaminhado_para` é usado tanto como
  destinatário operacional quanto como responsável do filtro. A conclusão preserva esse campo;
  assim, na visão "Meus" do autor, um procedimento já executado pelo colega fica oculto mesmo com
  `detalhe` salvo. Autor também pode hoje alterar status de evento encaminhado, criando ambiguidade
  sobre quem de fato concluiu. Há também incoerência: a UI oferece adicionar procedimentos a uma
  ficha compartilhada, mas a RPC bloqueia quem não é o autor da ficha. Direção ainda a aprovar:
  ficha aberta como contêiner compartilhado da clínica, autoria preservada por procedimento e
  executor registrado separadamente, e nova ficha somente quando a original estiver assinada. O
  print mais recente ainda mostra os resumos
  `1 atendimento` e `24 pendências` no Prontuário; remover essa faixa sem remover os filtros da
  linha do tempo.
- Contrato de produto detalhado pelo Mateus (16/09): no Meu Dia, a abertura do paciente deve
  mostrar histórico clínico completo em ordem do atendimento mais recente ao mais antigo, com
  filtros por "meus atendimentos" e por cada doutor. Ao abrir uma ficha por um encaminhamento, o
  destinatário lê todos os procedimentos, mas só pode editar/concluir o que recebeu e os novos
  procedimentos que ele próprio adicionar. Enquanto a ficha não estiver assinada, ele pode adicionar
  procedimentos à mesma ficha encaminhada; esses eventos preservam sua autoria. Não pode alterar os
  demais procedimentos da ficha. O autor de origem vê o retorno e os detalhes executados na mesma
  ficha. Decisão adicional: depois de encaminhar, o dentista de origem perde toda escrita sobre
  aquele procedimento (inclusive status); conserva leitura de status e de todos os detalhes
  técnicos/histórico. O destinatário conserva responsabilidade e acesso ao procedimento mesmo após
  marcá-lo realizado.
- Alerta âmbar conta somente procedimento novo não revisado; `Manter orçamento como está`
  persiste a decisão em `activity_logs`, sem remover o procedimento da ficha.
- Reativação pessoal no Dex adiada por Mateus; rascunho fora do código/migrations publicáveis.
- Estabilidade fica por último.

## Decisões pendentes

R165: como contar/aumentar/reduzir vagas e quando ativar cobertura (pago ou avaliação).
Proprietário clínico conta como dentista; não clínico/secretária incluídos com dentistas pagos.
Checkout centralizado, convites/cobertura e transição comercial não estão liberados.
Demais recortes futuros permanecem no [plano de conclusão](PLANO-CONCLUSAO-ATUALIZACAO.md).

## Próximo passo

Implementar R-170 contra a spec aprovada, migrar somente o banco de Preview e testar com dois
dentistas da clínica de teste antes de publicar. Mateus fará o teste manual do Preview; não
acompanhar nem operar o Preview durante o teste. Não promover a produção antes da conferência e
do gate de duas contas logadas.

## Continuidade segura

Snapshots privados: `/home/mtx/.local/share/odontoia-testes/preservacao-integracao-20260915-152017`.
Não apagar clínicas/contas de teste nem reverter contextos/governanças existentes.
Root e candidato têm alterações preservadas; não sobrescrever nem usar `db push`.
PC limitado: sem Next/build/tsc completo local; CI remoto para o app inteiro.
