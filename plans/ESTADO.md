# Estado — Odonto.IA

Atualizado em 24/09/2026.

🔵 **R-164 — Repasses e financeiro pessoal na clínica gerida.**

Contrato V2 aprovado: [R-164](specs/R-164-repasses-e-financeiro-pessoal.md). Artefato
aprovado: [R-164 V5](artefatos/R-164-financeiro-e-gestao-v5.html). V1–V4 permanecem históricos.

**Decisões fechadas para V2**

- Caixa e pagamentos pertencem à clínica gerida; o dentista recebe somente por repasse.
- Acordo estruturado por profissional: percentual de recebimentos confirmados, diária explícita
  ou mensal fixo. Contrato PDF fica fora do cálculo.
- Repasse previsto é obrigação. Só o pagamento cria uma despesa no caixa da clínica.
- Proprietário ou `repasses.gerir` administra; dentista vê somente os próprios valores;
  secretaria não vê acordos ou repasses.
- Clínica colaborativa mantém o financeiro pessoal existente sem novo cálculo.
- O R-164 V2 usa três leituras: Visão geral com filas, Meu Financeiro pessoal e Financeiro da Clínica para gestão.
- Margem e desempenho individual sem custo/hora real exibem ausência de base; não haverá estimativa escondida.
- Meu Financeiro preserva o card aprovado de Custo por Hora Clínica do dentista e o fluxo de caixa pessoal; acrescenta orçamentos aprovados, atendimentos, horas e atalhos. O cálculo exige custos fixos atribuídos e horas disponíveis por dentista.
- Financeiro da Clínica recebe tendências de receita/despesas, margem e custo/hora de cada dentista no desempenho da equipe. O proprietário que atende aparece como `Você · proprietário`.

**Já concluído antes deste item**

- R-163 está 🟡 no ar: migration aplicada no banco principal, caixa clínico separado e preview
  publicado. Falta validação manual dirigida com duas contas.
- Estoque do Meu Consultório foi validado manualmente pelo usuário.

**Estado técnico e próximo passo**

- A implementação local adiciona a separação explícita de lançamentos pessoal/clínica, a RPC do
  Meu Financeiro, o adaptador que não confunde movimento com saldo bancário e as listas acionáveis
  da Visão geral (reativação, cobrança e orçamento) com WhatsApp apenas preparado.
- A migration `20260924023000_r164_painel_operacional_financeiro.sql` ainda não foi aplicada no
  banco principal. Typecheck e lint passaram localmente; falta validar a migration, as filas
  acionáveis e o fluxo manual com duas contas antes de novo preview.

**Achados da validação manual (24/09)**

- A visão geral não incluiu dois pacientes esperados, nem refletiu retorno recém-agendado; as
  filas de reativação, pagamentos vencidos e orçamentos sem retorno precisam abrir listas de
  trabalho com ação de WhatsApp quando aplicável.
- O financeiro pessoal gerido exibiu acordo e histórico de repasses, contrariando a decisão do
  usuário: ele deve voltar a ser o caixa pessoal do dentista, com hora clínica em destaque.
- O artefato V4 omitiu os botões existentes de entrada e saída da clínica; o V5 os mostra no topo do financeiro da unidade, com formulários e regra para evitar duplicar recebimentos de pacientes.
- O financeiro da clínica deve concentrar acordos, repasses, produção, hora clínica por dentista
  e resultado da unidade. Não calcular margem individual sem despesa atribuída ao profissional.
- Há estados legados de pagamentos exibidos como "não informado/cancelado"; investigar o
  mapeamento de status no preview atual, sem atribuir a cache de preview.
- No estoque, o cadastro inicial de material exige uma segunda ação para informar saldo e não
  captura custo. O usuário pediu quantidade inicial e custo unitário no mesmo cadastro; a tela de
  movimentações também apresenta desalinhamento visual entre quantidade e botão "Corrigir".
- Regra de gestão em debate: compra de estoque reduz o caixa da clínica; consumo e descarte devem
  compor o custo operacional sem duplicar essa despesa. Custos fixos da clínica devem ser
  recorrentes, com previsão mensal automática e confirmação de pagamento separada.
- Direção visual do financeiro da clínica em debate: gestão deve responder resultado da unidade,
  caixa e cobrança, desempenho comparável por profissional e custos atribuídos. Acordo e
  acompanhamento de repasses serão uma única área; "repasse pago" significa somente valor pago
  ao dentista, enquanto pagamento do paciente deve alimentar caixa e recebimento vinculado.
