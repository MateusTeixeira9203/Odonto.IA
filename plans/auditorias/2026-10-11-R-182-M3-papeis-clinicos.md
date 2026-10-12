# R-182 M3 — papéis QA e jornadas clínicas dirigidas

STATUS: INCOMPLETA
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
CANONICAL_FOR: evidência do ensaio com secretária, segundo dentista e protético sintéticos

## Ambiente e limite

Clínica `QA Odonto Clínica B 2026-10-01` (`53eefdac-401b-484c-8ad4-a6cdd78b1a69`),
paciente sintética `823604f0-ca7f-48fe-bac1-c89e4ffa2baf`. Contas próprias de QA,
sem uso da portaria da Clindent. Site publicado `https://odontoia.app` para secretária
e protético; localhost `3106` com cobrança desligada só nesse processo para o segundo
dentista, ligado ao banco publicado. Nenhuma integração externa foi acionada. Nenhuma
migration, commit, push ou deploy neste ensaio.

## Resultado por critério

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Perfis QA | **PASSA** | Auth, vínculo e perfil ativo nos três papéis; `secretarias` operacional criado, sem senha temporária. Login independente conferido. Senhas QA giradas após um envio nativo prematuro do formulário local registrar uma delas em log. |
| Isolamento visual por papel | **PASSA parcial** | Secretária abre Pacientes/Agenda e Meu Dia a redireciona ao painel; protético entra só em `/dashboard/protetico` e Pacientes o redireciona. Isso não substitui teste direto de API/RLS. |
| Segundo dentista no site publicado | **NÃO TESTADO** | `/planos?billing=required` impede a jornada por falta de assinatura de teste. Localmente, com cobrança desligada, abriu Meu Dia e perfil da paciente. Depois, uma variável QA separada passou no localhost **com billing ligado**: login autenticado abriu `/dashboard` e `/dashboard/meu-dia`. A isenção antiga publicada está protegida como segredo na Vercel e não foi substituída. A versão publicada ainda não recebeu o novo código nem a variável. |
| Ficha pelo perfil | **PASSA no recorte** | Duas submissões sintéticas feitas durante diagnóstico de recarga geraram fichas `90ac38c5-8e57-402a-8e13-941096a9ab16` e `98a49424-a1a5-4a31-af29-0a698e277166`, ambas do dentista QA, origem `manual`, marcador QA persistido e visível após nova abertura do perfil (`4 → 6` atendimentos). A segunda submissão foi redundante porque a primeira leitura do banco ocorreu antes da confirmação; manter ambas como evidência, sem apagar registros. |
| Ficha pelo Meu Dia | **PASSA no recorte** | Encaixe sintético para a paciente QA; submissão única criou `4d9b0c44-eb3f-4d7d-b570-583ad734ca13`, origem `modo_consulta`, marcador QA e dentista QA persistidos (`6 → 7` fichas). Após recarga, Meu Dia exibe “Atendimento já registrado”; perfil mostra a evolução. IA, áudio, odontograma e assinatura não foram testados. |
| Orçamento após Ficha | **PASSA no recorte encaminhado** | As três fichas novas sem procedimento bloquearam corretamente a criação. Na ficha QA anterior `d24c2638-ffac-4a6f-b094-65d8f749cea0`, o segundo dentista viu só seu procedimento encaminhado; o compositor excluiu os nove do autor original. Criou orçamento sintético `bf5bc6c1-88f2-4eef-8a88-e9f975c6fc06` de R$ 100, um item e somente o evento encaminhado vinculado. `pagamentos=0`; após recarga, a aba Orçamentos mostrou a proposta de R$ 100. Não testa aprovação, parcelas ou recebimento. |
| Encaminhamento de procedimento entre dentistas | **PASSA no recorte API + UI local** | Usuário esclareceu que o encaminhamento é de um dentista para outro. Evento QA `8a1e5059-4515-413c-8d56-e5a29e0b7171`, indicado, não assinado e sem orçamento, foi a fixture. Chamada direta autenticada da secretária recebeu `sem_permissao`, sem mudança. Autor QA encaminhou ao segundo dentista; autoria permaneceu, o destinatário leu pela própria sessão. Na UI local, o destinatário viu “Responsável clínico” e marcou “Realizado”; banco persistiu status e data `2026-10-11`, autoria e destino intactos, visível após recarga. |
| Pedido ao protético e resposta | **PASSA no recorte** | Secretária QA enviou pedido interno `ef566731-c839-450c-994d-6379f23c7f6c` do agendamento QA antigo; banco `pendente`, protético de destino correto. Protético QA viu pedido em 13/10, marcou “Entregue”; banco gravou `entregue` e `entregue_em`, UI manteve o estado após recarga. Não houve mensagem externa ou arquivo protético. |
| Usabilidade do destinatário | **NÃO PASSA** | No formulário da secretária, o protético selecionado apareceu como UUID `d19b107b-48be-4d4b-8683-05fc45fc423d`, em vez de nome legível. Pedido foi gravado com o destinatário correto; corrigir em item próprio de UI. |

## Próximo gate

Preservar o encaminhamento clínico exclusivo entre dentistas. Repetir a jornada completa
na versão publicada depois de resolver o acesso comercial da conta QA, e testar
aprovação/parcelas/recebimento em banco isolado. As migrations financeiras
R-184/R-189/R-194 seguem fora do aceite. Não classificar R-182 como estável.
O localhost usa o mesmo projeto Supabase publicado: desligar billing só naquele
processo não altera a produção, mas aplicar migrations por essa conexão alteraria o
schema de produção. A allowlist de isenção publicada não foi modificada.
