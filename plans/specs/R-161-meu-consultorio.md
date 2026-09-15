# R-161 — Meu Consultório, recepção e organização da clínica

> **SPEC** · **R-161** · ⏳ fila
> **Aberto:** 2026-09-10 · **Revisão:** 3 · **Fase:** navegação/personas confirmadas em 11/09; visual e contratos de implementação pendentes.
> Recorte autorizado: [R-161a](R-161a-realocacao-financeiro-pessoal.md), realocação pessoal sem redesign.

## 1. Problema

Gestão espalhada e recepção sem fila única de confirmações. Organizar pendências da clínica
sem obrigar o dentista a atravessar um painel administrativo antes de atender.

## 2. Decisões confirmadas — 11/09

- Meu Consultório/Minha Clínica é UMA página completa do aplicativo, acessada por ícone
  na barra inferior global existente. Pode ter menu interno lateral; não substitui o shell global.
- Três modelos: colaborativa sem hierarquia automática, proprietário que atende e proprietário
  que não atende. Gestor delegado retirado desta etapa por decisão posterior do usuário.
- Propriedade, atuação clínica e delegação são dimensões independentes na mesma conta/unidade.
  Proprietário dentista atende normalmente e administra; proprietário não clínico não ganha CRO fictício.
- Gestão completa significa operação da clínica; não concede prontuários nem finanças particulares
  dos colegas. Estoque e preços distinguem titular pessoal e clínica, com escopo visível.
- Configurações pessoais permanecem onde estão. Somente configurações da unidade entram na gestão.
- Permissão acionável controla recebimentos e demais operações; não presumir caixa para secretária.
- Atendimento mantém Meu Dia, Agenda, Pacientes e ficha. WhatsApp inicial é contato manual assistido.
- Seção requer implementação e autorização real; endereço direto também é protegido no servidor.
  Mudança visual não altera autoria, regra clínica, campos ou fórmulas existentes.

## 3. Navegação e telas

### Personas e destinos

| Pessoa | Página e conteúdo permitido |
|---|---|
| Dentista individual, colaborativo ou agregado | **Meu Consultório pessoal**: mesma página Financeiro atual, apenas seus dados; preços e estoque próprios/compartilhados permitidos. Não é gestão da clínica; sem Equipe/Recepção. |
| Proprietário dentista | **Minha Clínica**: visão geral, financeiro da unidade, preços, estoque, equipe, recepção e configuração clínica; conserva atendimento completo e escopo pessoal separado. |
| Proprietário não dentista | **Minha Clínica**: mesma gestão da unidade, sem atalhos clínicos ou perfil profissional artificial. |
| Recepção | Agenda, Confirmações, Acompanhamentos e cadastro administrativo de Pacientes; recebimentos somente concedidos. Sem configuração de clínica por padrão. |
| Protético | Seu calendário e confirmação; sem gestão/equipe/financeiro/prontuários por esse perfil. |

Visão geral organiza pendências e atalhos do escopo permitido. Para gestão, pode mostrar
confirmações, cobranças e operação da clínica; números só quando o módulo os fornece.
O proprietário administra a clínica; gestor delegado não integra esta entrega.
Na clínica colaborativa, nenhum membro é promovido a proprietário pelo cargo legado.
Se governança ainda não foi configurada, não inferir modelo: manter caminhos atuais legítimos.

### Rotas e integração propostas

A raiz neutra `/consultorio` fica fora de `/dashboard`, cujo layout hoje exige perfil clínico.
O título varia por contexto; não são dois aplicativos nem duas contas. Componentes de
navegação global são reutilizados com destinos autorizados, sem herdar o guard clínico.
Subrotas propostas: `/consultorio/financeiro`, `/precos`, `/estoque`, `/equipe`, `/recepcao`,
`/acompanhamentos` e `/configuracoes` (todas sob `/consultorio`). Cada área depende de seu contrato;
Financeiro pessoal é SOMENTE realocação: preservar FinanceiroClient, actions, gráficos, cálculos e ações.
Filtro pessoal atual do servidor preservado em gráficos, totais, linhas e exportações;
sem seletor de colegas nem consolidado da clínica para colaborativo/agregado.
A rota piloto `/equipe` permanece válida até a integração e seu redirecionamento serem testados.

No desktop, manter dock inferior; no mobile, conservar o padrão global existente de header/drawer
até validação visual de uma mudança. O menu INTERNO da página pode virar seletor no celular;
nunca comprimir sete abas. Não mover Meu Consultório somente para o avatar.

### Mapa do que muda de lugar

| Hoje | Destino proposto | O que preservar |
|---|---|---|
| Configurações → Meu Perfil | Configurações pessoais da conta | Nome, contato, CRO/especialidade de quem atende. |
| Configurações → Clínica e Usuários | Minha Clínica → Configurações / Equipe | Dados compartilhados e regras colaborativas R-97. |
| Configurações → Horários | Agenda → Disponibilidade, com atalho na gestão | Horários por profissional; regra de encaixe/intervalo não muda. |
| Configurações → Procedimentos | Meu Consultório → Preços | Catálogo individual legado; tabela comum conforme R-160. |
| Configurações → Plano | Conta → Assinatura | Cobrança SaaS separada do caixa dos pacientes. |
| Financeiro atual | Meu Consultório → Financeiro | Página inteira atual: gráficos, filtros, lançamentos, ações, CSV e cálculos. Mesmo componente/fonte; escopo exclusivo do dentista autenticado na clínica ativa. |
| Configurações → WhatsApp | Minha Clínica → Integrações autorizadas | Conexão existente; botão manual independe de conexão Meta. |
| Retorno na ficha e Meu Dia | Mantém na ficha/Meu Dia; abre agenda canônica | Vínculo com atendimento e disponibilidade R-150. |
| Materiais/documentos da ficha | Mantém na ficha; atalho para estoque autorizado | Arquivos clínicos não se tornam públicos ao gestor. |

Compatibilidade: URLs antigas válidas encaminham ao destino uma única vez; manter query/filtros
suportados. Em rollout parcial, antigas continuam disponíveis para unidades ainda não migradas.

### Página inicial
Cabeçalho: clínica, escopo pessoal/clínica, período quando aplicável. Na gestão, “Precisa de atenção”:
consultas a confirmar, cobranças vencidas/sem vencimento e solicitações de desconto que o usuário
pode decidir. Lista de hoje/amanhã em seguida; resumo financeiro somente com permissão.
Indicadores usam definições R-163; números de colegas não aparecem em cards/tooltips/badges
para quem não pode abrir o detalhe. Não criar ranking de dentistas nessa entrega.

### Confirmações semanais e WhatsApp assistido
**Local da função:** fila de WhatsApp/contatos fica em Confirmações/Acompanhamentos, não
no Meu Dia. No perfil do paciente, o dentista autorizado tem **Abrir WhatsApp** e
**Delegar contato**. Atalhos de orçamento/visita levam ao mesmo fluxo com origem identificada.
Contato avulso não exige agendamento e não confirma uma consulta por consequência.

- Abrir WhatsApp usa o número cadastrado do paciente: WhatsApp válido prioritário, telefone
  válido como alternativa, sempre exibido antes do envio. Não solicitar redigitar a cada contato.
- Sem número válido: mostrar **Telefone pendente**; quem pode editar cadastro pode completar,
  ou o dentista delega a regularização/contato. Não gerar link vazio nem marcar como enviado.
- Delegar permite escolher recepcionista autorizada da mesma unidade, motivo e data da próxima
  ação. Mostrar também opção fila compartilhada autorizada quando não houver pessoa definida.
  Sem equipe com acesso, informar isso e manter o contato com o solicitante; não dar sucesso falso.
- Confirmações futuras não confirmadas entram automaticamente na lista semanal por consulta
  autorizada; não exigem o dentista delegar uma por uma. Default é Esta semana, agrupada por data.
- Delegar confirmação já listada atribui a mesma pendência; não cria outra. Demais motivos
  geram acompanhamento vinculado à origem; ator/atribuição visíveis para dentista e recepção.
- Permissão de delegar não autoriza mudar acessos do destinatário; a origem só é encaminhada
  para alguém que já possa executar a tarefa. Cadastro incompleto permanece visível para resolução.

1. Abrir **Confirmações** mostra **Esta semana**, em grupos por data com contagem de pendências;
   destacar Hoje/Amanhã e permitir Próxima semana/intervalo. Ordenar cada dia por horário.
2. Filtros de fila: **A contatar**, **Em acompanhamento**, **Confirmados** e **Todos**.
   Consultas canceladas/concluídas não são pendências. “Próximas 24h” é filtro próprio, distinto de amanhã.
3. Linha: horário, paciente, profissional, situação, último contato e pessoa que o iniciou.
4. **Abrir WhatsApp** prepara contato/texto e registra início de contato; tira a linha de
   A contatar e coloca em Em acompanhamento, com rótulo **Envio não confirmado** e opção Desfazer.
5. Secretária envia no WhatsApp. Pode registrar **Mensagem enviada** manualmente; a linha passa
   a **Aguardando resposta**, ainda em acompanhamento. Abrir link não comprova envio/entrega/leitura.
6. Resposta positiva → **Confirmar consulta** → muda status para confirmed. Sem resposta →
   definir próxima tentativa; necessidade de alterar horário → agenda canônica.
7. Popup bloqueado/falha ao preparar contato: não retirar da fila inicial. Quando o navegador
   não consegue saber se o aplicativo abriu, mostrar envio não confirmado e permitir reabrir/desfazer.
8. Nenhuma linha é apagada. Em acompanhamento continua visível no resumo diário; pendência
   sem envio confirmado ou resposta não vira sucesso nem some na mudança de semana.

No retorno à tela, oferecer Enviada / Não enviei, sem exigir abrir modal para cada paciente.
Dois operadores veem contato iniciado por colega; segunda abertura exige ação explícita
para retomar/reabrir. Versão concorrente impede duas tomadas silenciosas do mesmo contato;
isso não garante impedir mensagens externas duplicadas, pois o envio é fora do aplicativo.
Remarcação invalida confirmação do horário anterior e exige nova conferência; não envia mensagem.

Mensagem inicial: “Olá, {primeiroNome}! Podemos confirmar sua consulta na {clinica} no dia
{data}, às {hora}, com {profissional}?” Texto editável, sem diagnóstico/procedimento no lembrete.

### Acompanhamentos e relação comercial
Proposta de apresentação debatida: Tarefas acessível ao dentista e à recepção, com cards
expansíveis por motivo; um aberto por vez, até cinco pacientes e Ver todos. Ações WhatsApp,
Delegar e Lembrar depois usam a mesma fila. Dex mostra contagem/atalho para esses cards,
sem segunda lista independente. Separar retorno combinado vencido, tratamento sem próxima
consulta e revisão de inatividade (30–59/60+ dias); inatividade sozinha não é retorno atrasado.
Quem já tem consulta futura/tarefa ativa não gera nova pendência duplicada. Sem visual aprovado.

Uma fila por data da **próxima ação**, com Hoje, Atrasados, Esta semana e Todos. Separar por motivo:

| Tipo | Gatilho e ação | Quando encerrar |
|---|---|---|
| Pré-atendimento | Tarefa vinculada à consulta; orientação administrativa definida pela equipe | Contato resolvido ou consulta cancelada |
| Pós-atendimento | Dentista/equipe autorizada agenda acompanhamento após a visita | Resposta registrada e encaminhamento ao dentista quando necessário |
| Orçamento em aberto | Pessoa autorizada agenda contato sobre proposta específica | Paciente decide ou equipe registra motivo de encerramento |
| Retorno/reativação | Data definida pela equipe e vinculada ao paciente/visita | Retorno agendado ou motivo registrado |

Cada tarefa tem paciente, responsável pelo contato, motivo, origem, próxima ação e histórico.
Ações: abrir WhatsApp, registrar resposta, adiar, atribuir pessoa autorizada e concluir com motivo.
Não transformar abrir orçamento ou finalizar consulta em disparo automático não configurado.
Pós-atendimento não inventa orientação clínica: texto definido pelo profissional; resposta que
precisa de avaliação vira tarefa para ele, sem diagnóstico ou conduta automática pela recepção/IA.
Orçamento aceito/encerrado interrompe a pendência daquela proposta, sem encerrar outros motivos.
Cancelamento/reagendamento atualiza tarefas de pré-atendimento relacionadas, preservando histórico.
Pedido do paciente para não receber aquele contato pausa a tarefa e impede novas tentativas previstas.

**Etapas:** primeiro fila e abertura assistida do WhatsApp; depois automação de envio/respostas
pela integração existente, em recorte próprio com configuração explícita, identificação de mensagens,
retry idempotente e conciliação entre resposta e consulta. Nenhuma entrega/leitura será presumida.
Recall automático continua no R-45; esta atualização organiza o acompanhamento comercial manual.

## 4. Contrato técnico proposto

### Reuso e componentes
- Shell/dock/menu: `src/components/layout/dashboard-shell.tsx`, `floating-dock.tsx`,
  `mobile-drawer.tsx`; recebem contexto e acessos R-159, não apenas `DentistaRole`.
- Inventário existente: configuracoes-client.tsx tem perfil, clinica, horarios, procedimentos,
  plano; configuracoes/usuarios e configuracoes/whatsapp têm ações próprias.
- `src/app/dashboard/agendamentos/actions.ts` fornece criação/status/retorno; guarda atual
  ainda exige dentista em caminhos de recepção. Adaptar via R-159 sem criar perfil fictício.
- Financeiro reutiliza FinanceiroClient e montagem das props atuais; ajustar somente destino
  de mês/filtros e invalidação para a nova rota, preservando guard clínico/pessoal no servidor.
- `src/lib/hora-brt.ts` e helpers atuais definem data; não usar dia UTC ou fuso do navegador.
- `whatsapp_reminder_sent` existente não representa confirmação manual nem pode ser marcado
  ao abrir um link. Providers em src/lib/whatsapp continuam separados desta ação local.

```ts
type SituacaoContato = 'a_contatar' | 'iniciado' | 'aguardando_resposta' | 'confirmado';
interface ConfirmacaoLinha {
  agendamentoId: string; revisao: string; pacienteId: string;
  pacienteNome: string; profissionalNome: string; dataHora: string;
  contato: SituacaoContato; telefoneDisponivel: boolean;
}
interface RegistrarContatoInput {
  clinicaIdEsperada: string; agendamentoId: string; revisaoEsperada: string;
  resultado: 'iniciado' | 'envio_declarado' | 'sem_resposta' | 'nao_enviado';
  observacao: string | null; proximaTentativaEm: string | null;
  chaveIdempotencia: string;
}
```

`listarConfirmacoes({inicioISO,fimISO,fila,profissionaisIds,cursor})` retorna Resultado com linhas,
nextCursor e totais por dia/fila no escopo autorizado; 50 por página, ordem data_hora+id estável.
Intervalo máximo 31 dias; pendências vencidas têm filtro próprio e não desaparecem ao mudar semana.
`prepararContato({clinicaIdEsperada,agendamentoId,revisaoEsperada})` retorna número/texto
somente após autorizar cadastro+agenda+contato; link criado com texto codificado.
`registrarContato(input)` e `confirmarConsulta({clinicaIdEsperada,agendamentoId,revisaoEsperada,
chaveIdempotencia})` verificam ação e agendamento atual. Nenhuma envia mensagem externa.
Registro iniciado deve ser confirmado pelo servidor antes de mover a linha. Se a abertura for
bloqueada, registrar nao_enviado; falha de persistência não autoriza a UI a ocultar a pendência.
Contato é estado separado de agendamentos.status: iniciado/envio_declarado não mudam scheduled.
Contato avulso usa `prepararContatoPaciente({clinicaIdEsperada,pacienteId})`, com autorização
de cadastro e WhatsApp, sem simular um agendamento. Delegação usa `delegarContato({clinicaIdEsperada,
pacienteId,origemTipo,origemId,responsavelUsuarioId,motivo,proximaAcaoEm,chaveIdempotencia})`;
origem é paciente/agendamento/atendimento/orcamento e o alvo é validado conforme seu tipo.
Usar acompanhamento com tipo confirmacao e UNIQUE parcial por clínica+agendamento enquanto
aberto para atribuição; a agenda permanece fonte da fila e do status. Os eventos de contato
continuam únicos em agendamento_contatos, não duplicados também no histórico de acompanhamentos.
Registrar contato trava o agendamento, verifica e atualiza updated_at para versionar a tomada
da tarefa sem mudar o horário/status. Sem resposta exige próxima tentativa futura, anterior
à consulta; se já não há janela, encaminhar como pendência urgente, sem criar data impossível.
Zod: UUIDs, data válida, observação <=500, cursor opaco validado, profissionais da mesma
clínica. Versão pode usar updated_at atual até existir versão inteira canônica, sem comparar
no cliente como única garantia de concorrência.

Nova tabela proposta `agendamento_contatos`: id, clinica_id, agendamento_id, ator_usuario_id,
resultado, observacao, proxima_tentativa_em, horario_agendamento_no_ato, created_at, chave_idempotencia; FK composta,
UNIQUE ator+clínica+chave, append-only, RLS pelos agendamentos permitidos.
Confirmação continua no status real `confirmed`. Data/hora alterada volta a `scheduled`, com
histórico da alteração; consultas já iniciadas/concluídas não são retrocedidas pela recepção.
Configuração de mensagem padrão pode usar tabela `clinica_mensagens` proposta: clinica_id,
tipo `confirmacao`, texto, versao; sem introduzir integração de envio.

Para acompanhamentos: campos `pacientes.followup_*` e
`src/app/dashboard/pacientes/followup-actions.ts` já existem, mas representam uma pendência
por paciente. Não sobrescrever uma tarefa de pós-atendimento com outra de orçamento.
Proposta aditiva `paciente_acompanhamentos`: id, clinica_id, paciente_id, tipo, origem nullable
(agendamento_id/atendimento_id/orcamento_id), responsavel_usuario_id, proxima_acao_em,
estado (aberto/aguardando/adiado/concluido/pausado), motivo, versao, created_at.
FKs compostas mantêm origem/responsável na clínica; leitura de proposta exige acesso ao orçamento.
Eventos append-only em `acompanhamento_eventos` com clínica, tarefa, ator, resultado,
observação, data e chave idempotente; alteração de estado e evento na mesma transação.
`listarAcompanhamentos({periodo,tipo,responsavel,cursor})` e
`atualizarAcompanhamento({clinicaIdEsperada,id,versaoEsperada,acao,proximaAcaoEm,observacao,
chaveIdempotencia})` usam permissões acompanhamentos.ler/gerir R-159; ações permitidas:
atribuir, contato_iniciado, resposta, adiar, concluir, pausar e reabrir. Adiar exige data futura;
concluir/pausar exige motivo; UUIDs/observação <=500 e clínica esperada são validados no servidor.
Ao adotar, importar pendência followup legada uma única vez com referência à origem, mantendo
campos/histórico originais; leitores antigos passam pelo adaptador, sem duas filas independentes.

Falha de um card não derruba os demais; bloco mostra erro próprio. Cache privado por usuário,
clínica, permissões e filtros; mudança de acessos invalida leituras, inclusive contadores.

## 5. Comportamento

| Estado | Tela/operação |
|---|---|
| Vazio | Nenhuma confirmação pendente para data/filtro; mostrar como alterar filtro. |
| Carregando | Skeleton estável, ação pending e foco preservado. |
| Sucesso | Linha atualizada e histórico manual; confirmação some das pendências. |
| Inválido | Telefone/data/observação com erro; nenhuma mensagem enviada. |
| Sem permissão | Seção ausente e rota negada; sem nomes/contadores de escopo proibido. |
| Não encontrado | Consulta cancelada/removida não recebe confirmação tardia. |
| Conflito | Horário foi alterado após abrir mensagem: atualizar e pedir nova conferência. |
| Falha técnica | Retry por bloco; texto preparado permanece; não marcar contato ou confirmação. |

Exemplos: abriu WhatsApp → saiu de A contatar, ficou Em acompanhamento sem envio confirmado;
Não enviei → volta a A contatar; enviou sem resposta → Aguardando resposta; paciente confirmou
→ confirmed; reagendou → volta a confirmar o novo horário. Pós-atendimento e orçamento do mesmo
paciente permanecem tarefas distintas; concluir uma não remove a outra.

## 6. Referência visual

[Brief R-158](../design/R-158-modelos-clinica-gestao-DESIGN.md) é estrutural.
Inventário de redesign é obrigatório antes de remover/realocar controles existentes. Artefato
aprovado para uma tela primeiro, extração de tokens e conferência desktop/mobile/dark/light.

## 7. Invariantes

Envio manual é manual; abrir link não é entrega; gestor não ganha prontuário pelo dashboard;
uma fonte financeira; cadastro/consulta não são bloqueados por estoque ou painel indisponível.

## 8. Gates de aceite

QA navegador com dados fictícios, 390px/desktop, light/dark e teclado; nenhuma mensagem a paciente real.
- [ ] Todos os estados §5 testados, inclusive indisponibilidade de um card.
- [ ] Personas da §3 chegam à área esperada; proprietário dentista funciona sem gestor delegado.
- [ ] Financeiro pessoal preserva a página atual inteira e não expõe valores de colegas em gráficos, linhas ou CSV.
- [ ] Protético permanece no calendário, inclusive por URL/RPC direta; Meu Dia não vira fila de WhatsApp.
- [ ] Dentista abre contato pelo número cadastrado; avulso não muda status de consulta.
- [ ] Sem telefone continua pendente; completar cadastro libera contato sem criar tarefa duplicada.
- [ ] Delegar reaproveita confirmação existente; destinatário sem acesso é rejeitado; fila semanal dispensa delegação manual por consulta.
- [ ] Permissão removida elimina seção/dados e bloqueia acesso direto.
- [ ] Semana por datas, Amanhã e próximas 24h respeitam BRT; atraso não some ao virar semana.
- [ ] Abrir WhatsApp muda só a fila de contato; não confirma envio, consulta ou recebimento.
- [ ] Popup bloqueado/Não enviei devolve à fila; envio não confirmado permanece localizável.
- [ ] Duas recepcionistas veem quem iniciou; conflito exige revisão antes de retomar.
- [ ] Recepção padrão não vê configurações administrativas, tabela, equipe ou financeiro não concedido.
- [ ] Pós-atendimento e proposta coexistem; adiar/concluir/pausar não perde tarefa nem duplica legado.
- [ ] Acompanhamento de orçamento proibido não vaza valor/observação na fila ou pelo endpoint.
- [ ] Reagendamento concorrente não confirma horário antigo; observação manual preservada.
- [ ] URLs antigas/atalhos da ficha e filtros continuam funcionando sem ciclo de redirects.
- [ ] Trocar contexto com edição aberta não perde conteúdo; navegação cabe no celular.
- [ ] Agenda/retorno preservam paciente, profissional e atendimento de origem R-150/R-146.
- [ ] Lista paginada não perde/duplica agendamento; latência registrada no ambiente de teste.

## 9. Fora de escopo

WhatsApp automático, bots, campanhas, envio em massa, redesign da ficha, novo motor de agenda,
automação de estoque antes dos gates [R-140e](R-140e-estoque-rastreavel.md) (base manual separada de OCR), cálculo financeiro duplicado ou gráficos sem definição.
