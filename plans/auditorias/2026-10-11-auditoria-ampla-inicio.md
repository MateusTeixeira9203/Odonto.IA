# Auditoria ampla — início e cobertura de leitura

STATUS: ACTIVE / INCOMPLETA
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
CANONICAL_FOR: cobertura e impedimentos da auditoria ampla solicitada após R-188

## Veredito provisório

A migration R-188 foi aplicada diretamente no banco publicado após autorização do usuário.
O objeto e os grants foram reconferidos. O gate principal da RPC com duas contas QA
**PASSOU** em produção; a auditoria ampla permanece **INCOMPLETA**.
Não há base para declarar o sistema estável ou promover itens 🟡 a ✅.
O recorte posterior de três papéis, Ficha por dois caminhos, encaminhamento entre
dentistas, orçamento sintético e pedido/entrega do protético está em
[R-182 M3](2026-10-11-R-182-M3-papeis-clinicos.md); os limites de ambiente ali descritos
continuam valendo.
O [recorte de cadastro e isolamento](2026-10-11-R-182-entrada-isolamento.md)
acrescenta testes diretos de RLS com três papéis e duas clínicas, validação de
entrada e persistência de um paciente QA. O aviso de nome repetido permanece
inconclusivo; não há evidência de linha duplicada.

## Escopo inventariado

O código contém **31 páginas** (`page.ts/tsx`) e **42 endpoints** (`route.ts`). A
auditoria completa, conforme `05_AUDITORIA_E_ESTRESSE.md`, será dividida em marcos:

1. Autorização e financeiro, incluindo R-188, com duas identidades e fixture sintética.
2. Núcleo clínico: paciente, consulta, ficha, orçamento e persistência.
3. Demais módulos e regressão visual/responsiva nos papéis aplicáveis.

## Evidência obtida em 11/10

- **Banco de produção:** após `apply_migration`, projeto `ACTIVE_HEALTHY`, fingerprint
  da RPC `b05d239c7cb52339e6fa7e3de33e22e8`; `authenticated` conserva `EXECUTE`,
  `anon` não o possui. Guardas precedem o primeiro `UPDATE`.
- **Navegador de produção, somente leitura:** 16 rotas estáticas do dashboard tentadas
  com a sessão real da portaria da Clindent (papel secretária). Dez permaneceram na rota;
  seis redirecionaram para o painel
  conforme a restrição desse papel. Não classificar redirecionamento como defeito sem
  comparar com a matriz de permissões.
- **Visual dirigido:** painel e financeiro renderizados em desktop; financeiro conferido
  em light e dark. Financeiro também observado a 390 px de largura, com `innerWidth=390`
  e sem overflow horizontal no documento (`scrollWidth=375`). Tema e viewport originais
  foram restaurados. Nenhuma conclusão para telas/estados não vistos.
- **Arquivos locais:** `git diff --check` passou após registro da aplicação. Action
  `gerarParcelas` continua apenas local, sem deploy.
- **Contas de teste, API publicada:** A (titular, admin da clínica QA) e B (admin de
  outra clínica QA) foram autenticados separadamente com links administrativos sem
  envio de e-mail; `getUser()` confirmou cada identidade. Com JWT próprio, B chamou
  a RPC para um orçamento sintético antigo de A e recebeu `P0001/sem_permissao`;
  A recebeu `P0001/plano_ja_definido` para o mesmo orçamento, que já possui plano.
  Hashes das linhas do orçamento, pagamentos, cobranças e eventos ficaram iguais
  antes/depois; duas parcelas preexistentes permaneceram. **PASSA:** negativa entre
  clínicas e preservação dessas linhas. O resultado de A mostra que sua guarda passou,
  mas não comprova geração legítima de parcelas novas.
- **Acesso QA no site publicado:** o login de A foi validado, mas `/dashboard`
  redirecionou para `/planos?billing=required`. É um impedimento de cobertura nessa
  conta, não um defeito de billing demonstrado. Nenhuma sessão da portaria foi usada.
- **Navegador local, conta QA A:** `localhost:3106`, billing desligado somente nesse
  processo, banco publicado lido sem formulários enviados. Painel, pacientes e
  financeiro abriram com HTTP 200, sem alerta visível nem overflow horizontal no
  desktop. `/dashboard/orcamentos` redirecionou a pacientes, conforme decisão
  explícita do R-153 no código. O financeiro a 390×844 apresentou
  `innerWidth=scrollWidth=390`, sem overflow do documento; captura
  [financeiro QA local, 390 px](evidencias-2026-10-11-auditoria-ampla/financeiro-qa-local-390.png).
  Inspeção visual limitada a esse estado: cards e extrato renderizaram; não foi
  comparado com artefato aprovado nem testada interação.
- **Varredura adicional de leitura QA, localhost:** em desktop claro, painel,
  Meu Dia, agendamentos, pacientes, novo paciente, detalhe do paciente sintético,
  financeiro, arquivo clínico, perfil e configurações terminaram na rota esperada,
  sem erro de página, alerta ou overflow do documento. Em 390×844 escuro, painel,
  pacientes, financeiro e configurações também terminaram na rota esperada, sem
  alerta ou overflow. A rota de usuários redirecionou para configurações conforme
  R-97. A configuração do WhatsApp desta clínica QA tem gate de plano `SOLO` no
  código; o redirecionamento interrompeu a medição da tela, portanto não foi
  classificado como defeito. O servidor dev reiniciou ao alcançar o limite de memória
  durante a compilação; as rotas que perderam conexão por isso são **NÃO TESTADO**,
  não falha confirmada do produto. Nenhum formulário foi enviado nessa varredura.
- **M1 financeiro autorizado, banco publicado:** orçamento sintético novo
  `72a8172b-b605-437d-82dc-6ecb331f52aa`, clínica QA de A, paciente QA preexistente,
  um item de R$ 80, sem plano nem parcelas antes do teste. B foi temporariamente ativado
  como dentista nessa clínica e autenticado com JWT próprio. Sua leitura normal do
  orçamento retornou zero linhas; chamada direta da RPC retornou `P0001/sem_permissao`,
  sem dados e com hashes idênticos nas cinco superfícies antes/depois. A, em sessão
  autenticada própria, recebeu duas parcelas; o banco gravou duas previsões **pendentes**
  de R$ 40, plano `parcelado` de R$ 80 e titular A. Nova sessão de A releu orçamento e
  ambas as parcelas com os mesmos valores e estados. Nenhum recebimento, cobrança por
  etapa ou evento foi criado. B voltou à clínica QA original; vínculo em A `removido`
  e perfil em A inativo, confirmados por leitura. O orçamento e as duas parcelas QA
  permanecem como evidência. Em nova sessão após a restauração, B voltou a ver zero
  linhas, recebeu `sem_permissao` na RPC e não alterou pagamentos.
  [Matriz M1](evidencias-2026-10-11-auditoria-ampla/r188-m1-qa.json).
  **PASSA:** autorização do dono, negativa ao outro
  dentista ativo da mesma clínica, ausência de mutação indevida e persistência/recarga
  via API. **NÃO TESTADO:** clique de geração na UI, secretária QA, sessão revogada e
  outros papéis.
- **Navegador publicado, conta QA B:** assinatura de teste vigente permitiu entrar no
  painel sem mudar billing. As dez rotas centrais verificadas em desktop claro e celular
  escuro responderam 200 na rota esperada, com `scrollWidth=innerWidth` e sem alertas
  visíveis; [matriz de navegação](evidencias-2026-10-11-auditoria-ampla/qa-b-production-navigation.json).
  Rotas que redirecionam não foram contadas como verificação completa. Em Agenda e
  Pacientes, ambas as larguras emitiram `React #418` apesar de renderizarem conteúdo.
- **Achado HID-01 — CONFIRMED S2, duplicado do R-129a:** com navegador em UTC,
  Agenda e Pacientes não emitiram `#418`; em `America/Sao_Paulo`, ambas emitiram.
  Reproduzido no desenvolvimento com servidor UTC: `PacientesTable` renderizou
  `04/10/2026` no servidor e `03/10/2026` no cliente para a data de cadastro de um
  paciente QA; `WeekView` renderizou `15:30` no servidor e `12:30` no cliente para
  um agendamento QA. O React regenerou essas árvores no cliente. Há diferença
  temporal visível potencial antes da hidratação; duração e impacto em cliques não
  foram medidos. [Matriz de fusos](evidencias-2026-10-11-auditoria-ampla/hidratacao-fusos-qa.json).
  Causa localizada em formatação dependente do fuso do processo/navegador; nenhuma
  correção foi feita nesta auditoria.
- **Gate local posterior do HID-01:** o Executor ajustou o fuso da data em Pacientes e
  da hora/agrupamento/posição na Semana. Coordenação verificou em `localhost:3107`
  (servidor UTC, conta QA B) Pacientes e Agenda com navegador UTC e São Paulo: quatro
  HTTP 200, fixtures `03/10/2026` e `12:30` visíveis, zero erros de hidratação e de
  console. [Matriz](evidencias-2026-10-11-auditoria-ampla/hid-01-local-gate.json).
  **PASSA localmente no recorte; NÃO TESTADO na versão publicada**, que ainda contém o bug.
  Typecheck também passou após regenerar `.next/types/app`, antes contaminado por
  referências geradas a rotas removidas; a pasta antiga foi preservada fora do checkout.
- **Inspeção visual publicada, conta QA B, 390 px escuro:** capturas de
  [Agenda](evidencias-2026-10-11-auditoria-ampla/agenda-qa-b-producao-mobile-escuro.png),
  [Pacientes](evidencias-2026-10-11-auditoria-ampla/pacientes-qa-b-producao-mobile-escuro.png)
  e [Financeiro](evidencias-2026-10-11-auditoria-ampla/financeiro-qa-b-producao-mobile-escuro.png)
  após renderização. Cabeçalhos, ações principais e cartões apareceram dentro da
  largura de 390 px; não foi identificado corte horizontal no documento. A semana da
  Agenda mostra segunda a sábado por decisão do R-150; domingo ausente não é defeito.
  A inspeção de três estados não comprova usabilidade de todos os controles nem
  fidelidade a um artefato global, ainda inexistente.

## Impedimentos e limites

Produção contém dados clínicos/financeiros reais. A navegação ficou somente leitura;
somente o ensaio M1 expressamente autorizado gravou fixture financeira sintética na
clínica QA. Nenhum formulário real, pagamento, convite ou mensagem foi acionado.
Não há branch isolado nem Postgres local com seed.
Depois da identificação pelo usuário, a aba da portaria foi fechada. Decisão do usuário:
continuar a auditoria **somente com contas criadas para teste**, nunca com essa conta real.
As contas QA históricas do R-188 estão disponíveis. B foi reativado temporariamente
para M1 e voltou ao estado anterior após o teste. A conta de teste citada em auditorias
antigas está hoje sem clínica ativa, e não foi usada.

**NÃO TESTADO:** R-188 pela UI publicada, secretária e outros papéis, submissões de
formulários, interações de todos os botões, permissões dos demais papéis, todas as 31
páginas e 42 endpoints, e quatro combinações visual/móvel/tema por tela.

## Próximo gate

R-188 agora tem o gate principal da RPC aprovado; seguir em recortes com os papéis ainda
não cobertos e com a UI publicada quando houver conta QA elegível ao billing. A auditoria
clínica e visual ampla continua por áreas, sempre com contas e dados de teste. Não
transformar este gate focal em veredito de estabilidade geral.

O [M2/M4 de leitura](2026-10-11-R-182-M2-leitura.md) acrescentou uma jornada clínica
publicada coerente em dois pacientes QA, mas AC-03/04 continuam NÃO TESTADO por falta de
ensaio de escrita autorizado; AC-07 NÃO PASSA pelo achado S1 de teclado [R-193](../specs/R-193-acesso-teclado-acoes-centrais.md).
R-193 passou no [gate local autenticado](evidencias-2026-10-11-auditoria-ampla/r193-mobile-dark-gate-final.json)
para teclado, foco e ponteiro em desktop/light e 390 px/dark; a versão publicada ainda
requer gate após publicação autorizada.

## Triagem provisória

- **Corrigido localmente, pendente de publicação:** R-193 e HID-01/R-129a passaram nos
  recortes locais; ambos requerem publicação autorizada e repetição do gate no site.
- **Planejar:** testes dos papéis restantes e jornadas clínicas com escrita QA,
  verificação dos botões e estados visuais, mais telas/rotas ainda não cobertas.
- **Ignorar/arquivar:** redirecionamento de `/dashboard/orcamentos` (R-153) e de
  `/dashboard/configuracoes/usuarios` (R-97), assim como domingo fora da grade
  semanal (R-150), são comportamento intencional; reinício
  por memória do servidor dev não é achado do produto.
