# Sublotes da atualização — 16/09/2026

**Escopo:** R159c/d, R163c, R140e2, R161f e cadastro piloto R165.
Branch `codex/conclusao-atualizacao`, worktree de integração isolado, base `2b93247`.
Autorização: commits separados/Preview `odonto-ia-teste`; Mateus fará QA manual.
**Não é auditoria completa nem autorização de produção.**

## Implementação

- Recepção usa identidade operacional, Agenda/Pacientes/Pendências e recebimentos por concessão.
- Editor de equipe: proprietário ativo, capacidade por operação, CAS/idem, revogação, bloqueio de autoedição/owner.
  Escopos fora do editor são recusados sem sobrescrever concessões; estoque mantém editor próprio.
- Recebimentos administrativos reutilizam regras financeiras existentes; leitura canônica inclui descontos,
  itens removidos e estado aceito. Não fabrica dentista para o ator administrativo.
- Kits: composição com quantidades decimais, aplicação em conjunto, snapshots/versionamento no backend.
  Gerir kits reutiliza estoque.gerir no mesmo titular, sem exigir concessão invisível adicional.
  Ficha: avulso ou kit, lote/quantidade, declaração, baixa atômica, retomada e correção auditada.
- PDF real com valores persistidos, grupos e desconto; mensagem editável. Mobile usa share de arquivo;
  desktop baixa/abre WhatsApp, anexo manual. “Enviei” é um fato explícito e revalida snapshot/acesso.
- Cadastro R165 disponível apenas no piloto Free: três modelos, pagador individual/centralizado,
  proprietário sem atendimento sem CRO fictício, estrutura comercial pendente e estoque inicializado.
  Preserva metadata do usuário, grava nome próprio; nenhuma assinatura Stripe é criada/cobrada.
- Reativação pessoal no Dex adiada por Mateus; rascunho preservado fora da árvore publicável.

## Banco e preservação

Somente Supabase Free `etlqznuoxiilvxzygpat`. Oficial não foi alterado.
Antes/depois: **7 clínicas, 41 pacientes, 83 pagamentos**. Sem seed, exclusão ou reset neste sublote.
Snapshot de metadata/funções/policies anterior às migrations em arquivo privado:
`/home/mtx/.local/share/odontoia-testes/preservacao-integracao-20260915-152017/free-pre-sublotes-20260916.json`.
Migrations de estrutura aplicadas: R140e2 (10039,11829,13037,23000), R159c (10305), R159d (10437),
R163c (10847,13140,20500), R161f (11540), R165 (14500,21902,23552); prefixo `20260916`.
A trava R165 nasce desligada no banco; alteração/chamada privada por authenticated negadas.
Habilitada explicitamente somente no Free por operação `free_only_enable_r165_pilot`;
essa habilitação ambiental não integra as migrations de produção. O executor SQL era read-only;
a alteração foi realizada pela ferramenta de migration, com alvo Free explícito.
Aplicações conferidas por objetos e chamadas reais; histórico de migrations não usado como única prova.
Correções de funções já aplicadas são forwards, não reescrita do passado.

## Evidência técnica

- Suite serial final: **387/387 testes**; ESLint dos **64 TS/TSX alterados** passou.
- Seis harnesses PGlite passaram: `r140e2-kits-ficha-sql`, `r159c-reception-sql`,
  `r159d-editor-acessos`, `r163c-recebimentos`, `r161f-pdf-manual`, `r165-cadastro-comercial`.
  Exercitam roles/RLS, outro tenant, concessão/revogação, CAS/replay, rollback/auditoria,
  baixa/deficit/correção, capacidade comercial e identidade sem dentista fictício.
- HTTP autenticado Free A/B: recebimentos próprios e rejeição do outro contexto passaram.
  Leitura financeira inicialmente retornou 405/SQL25006 (STABLE chamando FOR SHARE);
  forward 20500 corrigiu para VOLATILE, repetição real passou.
- Kits: owner válido em clínica com estoque ativo retornou 200/ok; outro contexto negado.
  Fixtures A/B antigas têm estoque desativado: SEM_ACESSO esperado pelo estado atual,
  **não são prova positiva do fluxo de kits**. Nenhuma governança foi alterada para forçar teste.
- Credenciais antigas planejadas de proprietários retornaram login inválido; não foram resetadas.
  A conta de proprietário existente foi validada separadamente. Não somar tentativas falhas como êxitos.
- PDF produzido pelo renderer real, texto extraído e página renderizada conferidos:
  etapa 15.000, desconto 1.000, total 14.000, pago 1.000, restante 13.000;
  sem unidade de preço escondida, item cancelado ou item fora da proposta.
- Revisões Terra de tipos/contratos, editor/PDF e UI operacional realizadas; limitações abaixo.
- Revisão final do estoque encontrou e corrigiu: retomada acima de 50, leitura por item, validade
  sob locks e persistência parcial do legado em retorno negativo. Forward 23000 adiciona
  subtransações/rollback, bloqueia vencidos, conserva replay e alinha gestão de kits ao estoque.
  PGlite de regressão passou para criar/editar kit e declarar com segundo componente inválido,
  consumo/correção vencido, owner/colaborativa/secretária e rejeição sem permissão.
  UI retoma até 50 ou uma pendência individual, para um problema não bloquear as demais.
- Não foi executado build/typecheck completo local (limite do PC). CI executa remotamente.
  Run 35049417230 (`cbb0d4a`) detectou tipos incompatíveis de PromiseLike do Supabase,
  callback da agenda, props Radix em BaseUI e literais BigInt no target existente.
  Follow-up corrige adaptadores async, valida profissionais com Zod, usa props reais do Dialog
  e BigInt(...) sem mudar target/cálculo. Testes focados 7 de recepção e 10 financeiros passaram.
  [CI por branch](https://github.com/MateusTeixeira9203/Odonto.IA/actions?query=branch%3Acodex%2Fconclusao-atualizacao)
  é a fonte do resultado remoto final; não confundir Vercel Ready com typecheck aprovado.
- Nenhuma mensagem WhatsApp/email, contrato Stripe real ou cobrança foi disparada.

## QA manual antes de qualquer promoção

1. Duas contas/sessões e dois contextos: permissões/revogação, outra clínica, pessoal vs comum,
   sem PDF/financeiro/prontuário de colega; testar URL e ação com aba antiga.
2. Kits: criar composição decimal, aplicar na ficha, material avulso, lote, baixa única,
   falha/retry, retomada, falta de saldo e correção com histórico.
3. PDF: desktop baixar/abrir/anexar; popup bloqueado; celular share/cancelar/fallback;
   telefone ausente/inválido, orçamento mudado depois de preparar e Enviei/Não enviei.
4. Recepção: entrada sem CRO; Agenda/Pacientes/Pendências; concessões de recebimento,
   registrar/confirmar/corrigir/estornar e conflito entre duas sessões.
5. Cadastro: três modelos, ambos pagadores nos geridos, nome/equipe, estoque inicializado,
   proprietário sem atendimento chega à Clínica, cadastro clínico continua onboarding existente.
6. Claro/escuro, mobile estreito, foco/teclado/dialogs, botões e feedback no app real.

**Limitações explícitas:** navegador/duas sessões ainda não executados no novo pacote;
check SQL com JWT não substitui esse gate. Não afirmar isolamento visual ou release final aprovados.
Editar/arquivar kits completos ainda não têm UI; correção troca quantidade/lote do mesmo item.
Rastreabilidade de serial/implantável/reutilizável/OCR não integra o consumo simples entregue.
Recebimento em conflito pede atualizar a página; não há recarga orientada própria no diálogo.
Cadastro comercial não inclui checkout/vagas/cobertura ativa, transição, trial ou convites cobertos;
essas decisões permanecem na R165. Estabilidade final posterior ao QA deste recorte.

## Publicação e recuperação

Publicação somente na branch de Preview depois dos ajustes críticos, com commits por assunto.
Migrations separadas de produto/documentação. CI final e deployment devem corresponder ao mesmo SHA.
Em falha no Preview: conservar dados novos, voltar app compatível ou corrigir por forward;
não dropar ledger/histórico nem restaurar snapshot sobre fatos novos. Main/produção intactas.
