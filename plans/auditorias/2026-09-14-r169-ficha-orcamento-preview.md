# R169 — ficha e orçamento no preview

14/09/2026. Usuário confirmou o caso Curativo/46 do Dex e autorizou concluir os lotes
restantes, publicar preview e entregar um roteiro único para teste manual ao voltar.
Destino: preview `codex/r169-dex-ficha`, banco principal, somente clínica de teste para QA.
**Preview Ready; testes manuais pendentes.**

[ABRIR PREVIEW](https://odonto-qhiawak4w-mateusteixeira9203s-projects.vercel.app) · commit `00b3c85`.

## Roteiro do dentista

Use a clínica de teste e um paciente de teste. Antes de começar, anote a quantidade de fichas,
os valores do orçamento e o total já recebido para comparar no fim.

1. **Editar nome.** Abra uma ficha existente, edite um procedimento e troque nome e observação.
   Salve, feche e reabra a ficha. Os textos devem permanecer; dente, status e preço não mudam.
   Nome vazio deve ser recusado sem apagar o que você digitou.
2. **Adicionar na própria ficha.** Em Procedimentos, clique **Adicionar procedimentos**, ao lado
   da assinatura. O campo deve abrir ali mesmo. Digite:
   > Realizei gengivoplastia no dente 11.
   Organize, confira o nome/dente/Realizado, ajuste o nome se quiser e adicione à ficha.
   Reabra: o item deve continuar na mesma ficha, sem criar consulta ou ficha nova.
3. **Mais de uma entrada.** Organize o texto abaixo e, antes de salvar, faça outra entrada.
   > Realizei um curativo no dente 46.
   > Indiquei uma restauração no dente 26 para a próxima sessão.
   Os dois devem aparecer com seus próprios dentes/status. Editar o primeiro não pode ser
   desfeito ao organizar o segundo. A tela deve mostrar os novos resultados automaticamente.
4. **Recuperação.** Deixe um texto ou lote sem salvar, feche/reabra a mesma ficha e confira a
   recuperação. Outra ficha/paciente não deve herdar esse rascunho. Cancelar a revisão não
   deve apagar os procedimentos já salvos. Dois cliques rápidos não devem duplicar o lote.
5. **Procedimentos específicos.** Organize:
   > Removi os implantes preexistentes das regiões 46 e 47. Realizei a extração do dente 22.
   > Na região 22, instalei um implante, um pilar protético e uma coroa de cerâmica.
   Esperado: duas remoções de implante e quatro intervenções no 22. Nomes livres devem
   sobreviver ao salvamento; não exigir cadastro nem transformar remoção em instalação.
6. **Orçamento já existente.** Numa ficha que já tenha orçamento, adicione um procedimento novo.
   Só o botão do orçamento dessa ficha deve sinalizar a atualização em âmbar, com quantidade.
   Abra-o: deve explicar qual procedimento da ficha ainda não está no orçamento, com data.
   Adicione apenas esse item e informe seu preço. Os antigos e os pagamentos devem permanecer.
7. **Inclusão parcial e vários orçamentos.** Com dois faltantes, inclua apenas um. O outro deve
   continuar pendente após fechar/reabrir. Se houver vários orçamentos da ficha, escolha o destino;
   o sistema não deve criar outro sozinho nem escolher um pela ordem da lista.
8. **Renomear depois de orçar.** Edite o nome na ficha e abra o orçamento. O mesmo evento não pode
   aparecer como procedimento novo. A descrição comercial só deve mudar após sua confirmação,
   preservando o preço. Renomear não deve acender o destaque de novas inclusões.
9. **Retirar da ficha.** Retire um procedimento não assinado. Ele deve sair da ficha ativa,
   permanecer no histórico e deixar de aparecer como pendente de tratamento. Se estiver orçado,
   confira a opção de revisar também sua retirada do orçamento. Adiar deve manter o aviso.
10. **Retirar só do orçamento.** Retire um item comercial e confira que o procedimento clínico
    continua na ficha. Ao reabrir, ele não deve reaparecer automaticamente como novidade.
    Um item com vários dentes exige revisão do grupo; não deve remover dentes alheios sem aviso.
    No orçamento antigo, escolha explicitamente a linha comercial e os eventos correspondentes
    em **Revisar itens do orçamento**, confirme o vínculo e então revise a retirada.
11. **Orçamento com pagamento.** Repita inclusão/retirada num orçamento de teste parcialmente pago.
    A revisão deve mostrar o impacto antes de confirmar e permitir seguir ao ajuste necessário.
    Valores recebidos, datas e comprovantes anteriores não podem desaparecer ou ser recriados.
    Se o ajuste ficar abaixo do recebido, o sistema deve orientar o acerto, sem estorno automático.
12. **Proteções.** Um procedimento assinado não pode ser renomeado/retirado. Outro dentista não
    pode editar o nome do autor; encaminhamento libera somente os detalhes técnicos permitidos.
    Em duas abas, edite o mesmo nome: a segunda gravação deve avisar o conflito e preservar o texto.
13. **Leitura final.** Reabra ficha, Meu Dia, planejamento e gere documento novo. Nomes e itens
    ativos devem ser coerentes. Documento anteriormente assinado deve continuar igual. No celular,
    confira campo, revisão e salvar com o teclado aberto e com a barra inferior visível.

## Evidências técnicas

- Rename: revisão TypeScript sem HIGH; tsc/lint passaram no recorte inicial.
- Ajustes UX: IDs únicos nos formulários repetidos, foco na recuperação de conflito,
  erro ligado ao campo de nome e alvos ampliados no editor.
- Postgres/WASM isolado: 15 checks de rename/atomicidade/ACL/compatibilidade/rollback,
  retirada preservada pelo salvamento antigo e assinatura recusada para retirados.
- Teste: `scripts/test-r169-editar-nome.mjs`; runtime PGlite externo ao app via `R169_PGLITE`.
- Leitores ativos e documentos novos recebem filtros de retirada e nomes clínicos.
- SQL aplicado no principal, em alterações isoladas: edição de nome, adição, vínculo/retirada
  comercial, preservação de retirados em clientes antigos, criação normal/R157 e ACL do trigger.
  Sem alteração de RLS, sem backfill por nome e sem criar/apagar dados de pacientes nos testes.
- 35 verificações SQL em Postgres/WASM passaram (15 edição/guardas, 5 adição, 7 orçamento,
  8 criação/R157); smoke confirmou filtros ativos em 7 funções financeiras com DDL real.
- 6 testes TypeScript de payload/projeção passaram; formulários repetidos geraram 18 IDs únicos.
- ACL conferida depois da aplicação: RPCs clínicas preservam authenticated/service_role;
  trigger interno não fica disponível a anon/authenticated. Alertas anteriores de RLS/search_path
  permanecem; RPCs novas autenticadas são intencionais e validam o contexto em cada escrita.
- Funções antigas preservadas em `supabase/rollbacks/`. Depois de haver histórico de retirada,
  manter as guardas do banco ao voltar o app; não apagar colunas/histórico para fazer rollback.
- Revisões TypeScript/UX finais sem HIGH/CRITICAL; typecheck passou e lint sem erros no recorte.
- Vercel Ready confirmado: `dpl_6ure7U4qhkRkVFXLEU22toWLbpfU`, SHA `00b3c85a33c882b6b5db7bb73105417a0611139b`.
  Alias da branch atualizado; `target: null` (preview), app em produção não promovido.
- Usuário fará o QA manual; não houve testes de navegação nem gravação de pacientes por automação.

## Retorno manual após o preview 00b3c85

Usuário: destaque âmbar visível, mas clique parece inativo; avisos de orçamento repetidos ao
adicionar/organizar outros procedimentos; contador demora a sair após inclusão. Revisar e adicionar
funcionou. Pediu ação Adicionar à ficha abaixo dos campos e depois de Adicionar mais/Descartar.
Correção sem SQL novo: CTA reaproveita resumo carregado, indica abertura e bloqueia repetição;
a revisão fecha o detalhe antes de abrir a inclusão; montagem não repete a lista de pendências.
IDs confirmados atualizam o contador antes da revalidação. Ação de salvar ficou no rodapé,
com identificação por revisão quando houver vários rascunhos.

Reteste manual no novo preview:
1. Clique uma vez no CTA âmbar: deve indicar abertura e abrir o orçamento correspondente.
2. Revise dois procedimentos faltantes, inclua apenas um: uma janela por vez, sem repetir
   a lista de avisos; depois de confirmar, o contador deve mostrar apenas o restante.
3. Volte à ficha e adicione/organize procedimentos em sequência: orçamento não deve abrir
   sozinho nem sobrepor avisos à captura. Confira também uma ficha com vários orçamentos.
4. Na revisão clínica, confira campos → Adicionar mais/Descartar rascunhos → Adicionar à ficha.
   Com várias revisões, cada botão no rodapé deve identificar a revisão que será salva.

Revisão estática UX final passou sem bloqueadores; diff sem erros de whitespace.
A confirmação visual e os ciclos reais de uso continuam reservados ao usuário no preview.
TypeScript passou; ESLint sem erros nos cinco arquivos de orçamento (27 avisos anteriores no client).

Preview de correção Ready: [abrir](https://odonto-742kqydnk-mateusteixeira9203s-projects.vercel.app), SHA `25f6fd18e0d83ef703fd7dfeb5887042c611d0fc`,
deployment `dpl_BXT4m3wVYdeKQLkmEyWvXqQbf5Mq`. Build concluído, target preview.

## Evolução clínica — retorno manual R169c

Usuário determinou que Complementar evolução edite somente a narrativa da consulta exibida.
Novo botão Editar evolução clínica abre textarea inline com Salvar/Cancelar. Novo atendimento,
Dex, procedimentos e orçamento não participam desse caminho. Reteste: editar/salvar/reabrir;
cancelar; texto vazio; duas consultas distintas; autoria e ficha assinada.

- Typecheck e ESLint passaram nos três arquivos TypeScript alterados.
- Revisões estáticas UX e contrato aprovadas; foco volta ao botão ao fechar o editor.
- PGlite 9/9: escrita textual isolada, CAS, autoria/clínica/papel, assinaturas, automática,
  legado/limpeza, moderna já vinculada, contexto/limites e ACL/rollback.
- RPC `editar_evolucao_clinica` aplicada no principal, security invoker; sem novas tabelas,
  colunas, policies ou dados clínicos de teste. Teste manual autenticado é do usuário.
- Limitação preexistente de PATCH direto/RLS registrada na spec R169c.
