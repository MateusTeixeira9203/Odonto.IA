# R-161d — Pendências: confirmação e reativação

> **SPEC** · **R-161d** · 🔵 ativo
> Aberto: 2026-09-13 · Fechado: — · Fase: contrato
> Artefato e execução autorizados pelo usuário em 13/09: “já está aprovado ... pode seguir”.
> Este contrato formaliza essa autorização; escolhas técnicas não são novo aceite visual presumido.

## 1. Problema
Recepção e dentista precisam organizar contatos manuais sem confundir abertura do WhatsApp,
envio da mensagem e confirmação real de presença. Histórico e isolamento entre clínicas são obrigatórios.

## 2. Decisão e recorte
Dois filtros: Confirmar presença e Reativar contatos, além de Todos e busca por paciente.
Kanban A contatar → Esperando resposta → Resolvidos. Ordenação: confirmação por horário,
depois reativação por data de elegibilidade. Sem arrastar livremente estados com efeito na agenda.
Envio manual via wa.me; sem API, disparo em lote ou mensagem real durante QA.
Pagamento atrasado, orçamento/follow-up genérico, painel de proprietário e estoque fora deste lote.

## 3. Funcionamento
Confirmações de amanhã (dia civil America/Sao_Paulo) aparecem desde o começo do dia atual.
Agendamentos scheduled; incluir pendências já abertas enquanto precisarem de resposta.
Reativação: último atendimento finalizado >=30 dias atrás e nenhum agendamento futuro ativo.
Não inferir necessidade clínica pelo procedimento; ausência sem visita não conta como atendimento.
Um contato por origem: consulta+data/hora, ou paciente+dentista+última visita finalizada.
Encerrar uma reativação não recria o mesmo contato no refresh. Nova visita inicia novo ciclo.
Adiar retoma o mesmo contato na data escolhida. Resolvidos mostra conclusões do dia.
Abrir WhatsApp registra tentativa com envio_confirmado=false. Enviei confirma somente envio manual;
Não enviei devolve a A contatar. Presença só muda com ação explícita Confirmar.
Cancelar pede confirmação, preserva histórico e libera agenda; Remarcar só resolve após novo save.
Agendar/Remarcar mantêm ações clínicas existentes; secretária usa ponte autorizada por membro,
com conflitos/expediente/GCal preservados e autoria sem perfil clínico fictício.
Se agenda salva e resposta de conclusão se perde, leitura reconcilia estado pela origem canônica.

## 4. Contratos técnicos
Backend: `src/server/pendencias/{contracts,operations}.ts`; Server Actions finas em rota Pendências.
UI: `src/components/pendencias/`; navegação existente recebe Pendências somente no piloto Free.
Rota principal `/pendencias` (alias clínico `/dashboard/pendencias`); acesso não clínico exige member-context, não perfil fictício.
`PendenciasResult<T> = {ok:true,data:T}|{ok:false,codigo,mensagem}`.
Códigos: SEM_ACESSO, NAO_ENCONTRADO, CONTEXTO_ALTERADO, INVALIDO, CONFLITO, INDISPONIVEL.
`PendenciasBoard`: clinicaId, clinicaNome, items: PendenciaCard[], modelos.
Card inclui IDs da origem, pacienteNome, dentistaNome, telefone autorizado, dataHora/última visita,
status, versao, envioConfirmado, responsável, resultado e capacidades boolean por operação.
`podeVerContato` distingue falta de permissão de telefone ausente. Sem WhatsApp, nenhum modelo
é retornado e a mensagem fica indisponível. Limite atual: 500 cards e 500 modelos por leitura.
Inputs são unknown na fronteira → Zod strict → contexto autenticado → RPC com clinica esperada.
`listarPendencias`, `operarPendencia`, `salvarModelo`; RPCs retornam payload validado também na saída.
Operações: preparar_abertura, registrar_envio, nao_enviei, confirmar_agendamento, cancelar_agendamento, adiar, resolver,
concluir_agendamento. Mutações com versao esperada; conflito preserva rascunho e pede atualização.

### Persistência e segurança
Novas tabelas `pendencias_contatos` e `pendencias_mensagens` com clinica_id+RLS, índices por tenant.
Contato: id, tipo, paciente_id, dentista_id, agendamento_id?, origem_versao, status,
responsavel_usuario_id, envio_confirmado, adiado_ate?, resolucao?, versao, timestamps.
Unicidade por tenant/tipo/paciente/dentista/origem_versao evita duplicação entre duas sessões.
Modelos por clínica/dentista/tipo: ativo, template, versao; fallback textual com dados da clínica.
Dentista edita seu modelo; configuração geral só configuracoes.gerir no escopo clínica.
Secretária usa modelo do profissional do cartão. Desativar tipo não apaga histórico.
Histórico de operações append-only vinculado ao contato; mutação e evento na mesma transação.
RPCs validam auth.uid, users.active_clinica_id, membership ativa e concessões R159 atuais.
`acompanhamentos.proprio` refere-se a responsavel_usuario_id, não ID de dentista.
Ler consulta exige agenda.ler; ler reativação exige pacientes.ler e acompanhamentos.ler autorizados.
Telefone e abertura só com contatos.whatsapp no alvo; workflow com acompanhamentos.gerir.
Confirmar exige agenda.confirmar; cancelar/agendar/remarcar agenda.editar para alvo.
Nenhuma concessão implícita pelas policies legadas largas, por cargo ou user_metadata.
Sem write direto exposto; wrappers invoker e helpers privados estritamente autorizados.
Nenhuma alteração no banco de produção. Aplicação e fixtures só etlqznuoxiilvxzygpat.

## 5. Estados e exemplos
Vazio: “Nenhum contato nesta etapa”; loading com skeleton; erro com tentar novamente.
Sem telefone: informar telefone pendente, não construir link inválido.
Sem permissão: não mostrar botão habilitado; servidor revalida mesmo que chamada forjada.
Rede indisponível: manter formulário; não apresentar sucesso; atualizar antes de repetir ação incerta.
Duas sessões sobre versão 1: primeira muda; segunda recebe conflito, sem duplicar envio/operação.
Amanhã 16h aparece hoje 08h. Paciente 62d sem visita mas retorno futuro não entra em reativação.
Confirmar/cancelar exigem Esperando resposta e envio registrado também no servidor.
Confirmar transforma scheduled→confirmed e resolve; status clínicos posteriores não são revertidos.
Cancelar modal sem salvar não muda consulta. Reagendamento sem save mantém horário original.
Mensagens só aceitam placeholders conhecidos; mensagem avulsa não muda template padrão.
Mudança de clínica invalida ação/formulário do tenant antigo.

## 6. Contrato visual aprovado
Artefato: `plans/artefatos/R-161d-pendencias-kanban-v2.html`. Medidas extraídas pelo DOM.
Título DM Serif Display 40/46px; corpo Outfit 15px; números DM Mono.
Página max1536, padding42px 40px 140px; até1050:30px 24px 135px; até720:26px 16px 112px.
Board 3 colunas iguais, gap20px (12px até1050); até720 uma coluna selecionada por abas.
Card padding18px (15px até1050), radius14px, margem inferior12px, nome18px/600/22.5px.
Controles min44px, radius9px, padding10px14px; subtítulo e metadata13px.
Paleta clara: background#f4f4f6/card#ffffff/foreground#17191a/muted#59636b/border#dedfe3;
brand#217e6c/tint#eaf4f0/lane#ebedef; texto sobre tint#1e7060 (AA 5,28:1); warning#9b500b/#fff2e4; danger#b63e49/#fff0f1.
Escuro: background#121615/card#1c2220/foreground#f1f2ef/muted#adb8b1/border#35413a;
brand#76cdb9/tint#233f35/lane#171d1a; warning#efb371/#3b2f21; danger#f29ba4/#40272c.
Valores em tokens CSS escopados, nunca cores literais em componentes; sem alterar tema global.
Barra inferior existente mantém destinos reais e acrescenta Pendências; não copiar botões fictícios.
Motion150–180ms, reduced-motion; labels/ícones com cor, foco visível, formulários acessíveis.
Dados fictícios, badge “PRÉVIA INTERATIVA” e textos de simulação pertencem só ao artefato.

## 7. Invariantes
Abrir link ≠ envio comprovado ≠ presença confirmada; sem confirmação automática por link.
Sem contatos reais externos durante testes. Sem apagar pacientes, agenda ou histórico de usuários.
Reagendamento preserva validações da agenda e não inventa segundo calendário.
Templates/concessões de outro dentista/tenant permanecem privados conforme escopo.
Erro de autorização/consulta não vira lista vazia nem operação bem-sucedida.

## 8. Gates e ordem de execução
1. Contrato+tokens, backend/migration e testes focados; revisar SQL antes de aplicar no Free.
2. Portar UI aprovada e Server Actions, navegação piloto, reutilização agenda.
3. Testar regra temporal, ciclo sem duplicação, templates, telefone, validações e erros.
4. Aplicar no Free; provar isolamento e CAS em duas contas autenticadas e três modelos de clínica.
5. Browser: filtros, busca, tentativa/manual, confirmar, cancelar abandonado/confirmado,
remarcar falho/sucesso, adiar, encerrar, configurar tipo/texto, mobile/light/dark.
6. Review técnico/UX/design; corrigir achados; relatório distingue harness de Next integrado.
Sem build/Next completo local por limite da máquina. Não declarar gate integrado cumprido por harness.
Commit/push aguardam conferência do usuário; produção permanece intocada.
