# R-161b — Seções do Consultório e catálogo pessoal

Contrato do recorte autorizado em 11/09: continuar abas no preview após conferência do Financeiro.

## Problema e decisão
Consultório já abre Financeiro; falta navegação interna e acesso ao catálogo pessoal existente.
Adicionar **Financeiro / Preços**, conservando o dock inferior e header/drawer globais.
Não inserir seção vazia de estoque; R-140e depende de rastreabilidade. Minha Clínica/equipe,
permissões gerenciais, preços fixos de unidade e descontos R-160 seguem contratos próprios.
Rótulo global **Consultório** conforme decisão do usuário, sem mudar URLs.

## Contrato
- `/dashboard/meu-consultorio/layout.tsx`: navegação interna aditiva; cada página conserva guard.
- `ConsultorioNavigation`: dois links reais, `aria-current=page`, foco visível, 44px mínimo.
  Fonte do ativo é pathname. Ordem Financeiro, Preços. Nenhuma inferência de cargo no cliente.
- `/dashboard/meu-consultorio/precos`: requirePersonalConsultorio + requirePermission(configuracoes),
  leitura somente `procedimentos WHERE clinica_id=clinicId AND dentista_id=dentistaId`;
  ordem por categoria como antes. Erro de leitura é erro recuperável, nunca lista vazia simulada.
- Extrair `ProcedimentosCatalogo({procedimentosIniciais: Procedimento[]})` do ConfiguracoesClient. Usar nas duas rotas, sem duplicar catálogo,
  formulário, edit/import/remove/restore ou actions. Key somente por clínica/dentista. A lista deriva dos props revalidados pelo servidor;
  salvar/refresh não remonta o catálogo nem interrompe modal ou feedback da importação.
- Preservar Configurações?aba=procedimentos e atalhos onboarding/DEX. A aba legada monta o mesmo
  componente; não precisa carregar configurações/equipe/plano para abrir Preços.
- Criar/editar/remover/restaurar continuam actions atuais com filtros de clínica e dentista.
  Acrescentar revalidação da rota Preços somente às mutations do catálogo. Importação continua
  usando modal/API existentes; sem prompt, fornecedor IA ou formato novo.
- O Financeiro permanece exatamente no FinanceiroContent/FinanceiroClient atual.
- Consultório deixa de herdar o cadeado do módulo Financeiro no dock/drawer, pois Preços já existe
  para dentistas sem Financeiro. A seção Financeiro continua com seu gate comercial atual;
  não concede Financeiro a outro plano. Entrada padrão continua Financeiro com navegação disponível.
- Nova UI usa tokens do produto, sem cor literal, fontes novas ou sidebar global.

## Comportamento
Entrar em Consultório → Financeiro atual com menu → Preços → catálogo próprio → salvar →
feedback e estado atualizado → voltar/recarregar mantém item → Financeiro mantém seus números.
A/B: URL não escolhe titular; B não vê item A. Recepção/protético não entram por URL direta.
Novo catálogo vazio: mensagem atual e criar/importar. Erro: retry da rota, sem criar dados de exemplo.
Criar nome duplicado: erro existente. Remover: confirmação e ativo=false, histórico preservado.
Importar: lista é atualizada após onSaved/refresh. Não abrir WhatsApp nem enviar convites/emails.

## Design
Referência é o produto atual e R-158-DESIGN, com complemento R-161b-DESIGN.
Navegação interna superior compacta para DUAS seções (não sete comprimidas), dentro da largura
PageContainer. Layout financeiro interno não muda. Catálogo reutiliza apresentação existente.
As alterações visuais são aditivas, não execução do mockup v2 superado.

## Gates
- [ ] Duas seções, nome curto global, estado ativo, teclado, desktop/390 e claro/escuro.
- [x] Financeiro mantém valores/mês neste lote; recebimentos/links antigos preservam gate R161a.
- [x] A cria procedimento fictício; edita preço/duração; remove e restaura; reload/legado refletem.
- [ ] B não lê nem altera catálogo A. Recepção não ganha preços ou configurações.
- [ ] Importação mantém revisão/seleção e atualiza lista; falha técnica não aparece como sucesso.
- [ ] Typecheck/lint focados; revisão técnica/UX; build nuvem e QA de preview.
- [x] Produção/main e dados reais intocados. Não resetar as novas clínicas do usuário.

## Retorno
Reverter nova navegação/rota restaura acessos antigos. Extração é refactor separado, reversível.
Nenhuma migration ou alteração de RLS. Sem provisão de proprietário/estoque nesta entrega.

Ajustes de aceite UX: catálogo/importação recebem nomes acessíveis, botão de upload nativo
acionável pelo teclado, alvos 44px e header responsivo. HelpTooltip ganha nome acessível.
Esses fixes não alteram dados, payloads ou regra de preço.

## Publicação de teste — 11/09
Candidate `codex/testes-integrados`: `32aac96` (catálogo compartilhado), `11b53de`
(acessibilidade da importação), `64f7de1` (seções/Preços). Typecheck/lint focados
passaram; 49 testes existentes passaram. Revisão técnica e UX estática sem bloqueios.
Build final `f1ced65` passou. CRUD, feedback após revalidação, leitura A/B e bloqueio da
recepção exercitados. [Gate com limites](../auditorias/2026-09-11-r161b-consultorio-precos.md):
importação completa/visual ainda pendentes. Sem release em main/produção.
