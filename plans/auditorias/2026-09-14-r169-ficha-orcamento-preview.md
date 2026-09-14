# R169 — ficha e orçamento no preview

14/09/2026. Usuário confirmou o caso Curativo/46 do Dex e autorizou concluir os lotes
restantes, publicar preview e entregar um roteiro único para teste manual ao voltar.
Destino: preview `codex/r169-dex-ficha`, banco principal, somente clínica de teste para QA.
**Implementado; publicação em preparação. Testes manuais ainda pendentes.**

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
- Typecheck e ESLint passaram nos recortes; revisão final/build Vercel registrados na publicação.
