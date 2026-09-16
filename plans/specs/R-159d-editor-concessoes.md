# R-159d — Editor de concessões do proprietário

> **SPEC** · R-159 · 🔵 ativo · 15/09/2026 · Primeiro sublote operacional de Equipe.

## Objetivo

Permitir que o proprietário ativo de uma clínica **gerida** conceda e revogue, para um vínculo
ativo não proprietário, somente capacidades que já têm consumidor operacional no piloto. A
edição mantém versão, motivo, idempotência e auditoria da R159b. Não cria convite, não troca
responsável, não suspende nem remove vínculo.

## Contrato

- A identidade vem de `auth.uid()`, `users.active_clinica_id` e `clinica_usuarios` ativos;
  formulário nunca declara ator, titularidade, papel, teto ou capacidade efetiva.
- Proprietário é exclusivamente `clinica_governanca.responsavel_usuario_id`, com
  `modelo_clinica = 'gerida'` e vínculo ativo. Clínica colaborativa, cargo `admin` legado ou
  gestor delegado não habilitam o editor.
- `obter_acessos_editor_membro(clinica,membro)` devolve somente `clinicaId`, `membroId`,
  `versao` e `acessos` para esse proprietário/alvo ativo. Sem linha persistida, devolve a base
  virtual vazia na versão 1; não grava ao ler.
- `configurar_acessos_editor_membro` inicializa essa base e chama a mutação R159b na mesma
  transação. Se a mutação falhar, a linha de bootstrap é removida; não fica vínculo com acesso
  parcialmente criado. Linha existente preserva o comportamento de versão/replay da R159b.
- Alvo não pode ser o proprietário, o próprio ator, membro inativo ou outra clínica. A
  transferência de titular exige fluxo autenticado próprio de duas confirmações e fica fora.

## Matriz efetiva deste piloto

O editor mostra apenas concessões de escopo **clínica**. Qualquer outra chave ou escopo é
rejeitado também na RPC. Capacidades sem consumidor não aparecem como ativas.

| Grupo | Concessões | Dependência ao salvar |
|---|---|---|
| Agenda | `agenda.ler`, `agenda.editar`, `agenda.confirmar` | editar/confirmar exigem ler |
| Pacientes | `pacientes.ler`, `pacientes.editar` | editar exige ler |
| Acompanhamentos e contatos | `acompanhamentos.ler`, `acompanhamentos.gerir`, `orcamentos.ler`, `contatos.whatsapp` | gerir acompanhamentos exige ler; orçamento e WhatsApp são independentes |
| Cobranças e financeiro | `cobrancas.ler`, `recebimentos.registrar`, `recebimentos.corrigir`, `recebimentos.estornar`, `financeiro.ler`, `financeiro.exportar`, `despesas.ler`, `despesas.gerir` | recebimentos exigem cobranças; exportar exige financeiro.ler; gerir despesas exige ler despesas |
| Equipe | `equipe.ler` | sem dependência |

Protético só pode receber `agenda.ler` e `agenda.confirmar`. A RPC de consulta da equipe também
não reconhece `equipe.ler` de protético, para que uma concessão antiga não continue abrindo a área.
O proprietário preserva suas capacidades-base de gestão/financeiro; a autoedição permanece negada.

## Visual

- Artefato-base: `/home/mtx/Documentos/Odonto.IA/plans/artefatos/R-159c-equipe-gestao-v2.html`.
  Tokens extraídos no navegador: fundo `#f4f4f6`, superfície `#fff`, borda `#d9d9de`, tinta
  `#09090b`, secundário `#4b5563`, mudo `#6b7280`, teal `#2f9c85`, teal-pale `#e4f4f1`;
  display `DM Serif Display, Georgia, serif`, corpo `Outfit, system-ui, sans-serif`.
- Adendo visual: no painel de detalhes existente, uma seção “Acessos desta pessoa” com grupos
  de checkboxes, nota de escopo “Toda a clínica”, campo de motivo e botão “Salvar permissões”.
  Em leitura, inatividade ou titular, mostrar texto explicativo, sem controles inertes.
- Mantém sidebar, tema e dock do artefato. Grades continuam uma coluna em viewport estreito e
  toda ação tem foco visível, estado de salvamento e erro recuperável.

## Gates

- Testes unitários do adapter: payload estrito, base virtual, retorno estranho e erro remoto
  nunca autorizam; chave idempotente e versão são preservadas.
- SQL/API: owner gerido ativo salva e revoga; clínica colaborativa, gestor/admin legado, outro
  tenant, alvo suspenso, autoedição e último titular são negados. Bootstrap + falha forçada não
  persiste linha. Configurações fora da matriz, dependências ausentes (inclusive gerir acompanhamentos sem ler) e `equipe.ler` de protético
  são negadas. Duas sessões autenticadas verificam titular e não titular.
- A aceitação manual confere proprietário clínico e não clínico, recepção, protético e tema claro/
  escuro. Convite, suspensão, remoção e transferência de titular seguem na fila R159.
