import fs from 'node:fs';
import path from 'node:path';

const project = 'C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA';
const log = path.join(project, 'log');
const dir = path.join(log, 'QA-OD008-auth-2026-10-25');
const evidenceFile = path.join(dir, 'evidence.json');
const e = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
const route = e.cases.find(c => c.label === 'PROTETICO acesso UI Agenda para criação');
// Classificação da URL/controles já coletados, sem repetir a ação.
route.passed = route.url === e.base + '/dashboard/protetico' && route.controls.length === 0;
fs.writeFileSync(evidenceFile, JSON.stringify(e, null, 2));
const uiDelivery = e.cases.find(c => c.label === 'PROTETICO entrega real pela tela');
const uiRow = e.final.own.rows.find(r => r.id === e.orders.ENTREGA_UI.id);
const apiRow = e.final.own.rows.find(r => r.id === e.orders.HORA_FORJADA_API.id);
const stats = { passed: e.cases.filter(c => c.passed === true).length, failed: e.cases.filter(c => c.passed === false).length, inconclusive: e.cases.filter(c => c.passed === null).length };
const caseTable = e.cases.map(c => `| ${c.label} | ${c.passed === true ? 'PASSOU' : c.passed === false ? 'FALHOU' : 'INCONCLUSIVO'} | ${c.response ? `${c.response.http}; ${c.response.error?.code ?? 'sem erro'}; ${c.before.own.count}→${c.after.own.count}; hash ${c.before.own.hash === c.after.own.hash ? 'igual' : 'mudou conforme ação'}` : c.note ?? c.status ?? c.exactText ?? c.toast ?? 'ver evidence.json'} |`).join('\n');
const patients = e.patients.map(p => `|${p.label}|${p.id}|${p.clinicId}|`).join('\n');
const appointments = e.appointments.map(a => `|${a.role}|${a.id}|${a.patientId}|${a.date} ${a.time}|`).join('\n');
const orders = Object.entries(e.orders).map(([key, r]) => `|${key}|${r.id}|${e.final.own.rows.some(row => row.id === r.id) ? 'preservado' : 'apagado na prova CRUD exigida'}|`).join('\n');
const identities = Object.entries(e.identities).map(([role, s]) => `|${role}|${s.role}|${s.dentistId}|${s.clinicId}|`).join('\n');
const report = `# PASSOU no recorte de permissões OD-008; itens 5 e 7 com limites de UI

ALFA — QA (Auditor), ${new Date().toISOString()} (UTC; America/Sao_Paulo = UTC−3). Pedido amplo permanece **INCONCLUSIVO nos itens 5/7 estritamente de UI**, conforme a tabela. Nenhuma falha de permissão confirmada nesta rodada. Não é certificação integral de segurança ou publicação.

Ambiente: localhost:3011, snapshot Odonto.IA-depois4 em **e0a2662**, host **uhuxteswtvgdnlixwrdu.supabase.co**. Migração APLICADA por relato do usuário; quatro policies por comando e trigger/função confirmados por consulta ao catálogo efetivo. [Catálogo](QA-OD008-auth-2026-10-25/catalogo-efetivo.json). Não apliquei, reverti ou reapliquei migration. T01–T22 são evidência INFORMADA pelo usuário, não testes repetidos por mim.

## Item → resultado → evidência

|Item solicitado|Resultado|Evidência observada|
|---|---|---|
|1. Protético pendente→entregue pela tela; hora do servidor|PASSOU|Clique Entregue, toast Marcado como entregue!, persistência e recarga. entregue_em=${uiRow.entregue_em}, entre cabeçalhos Date ${uiDelivery.serverBefore} e ${uiDelivery.serverAfter}. Outra fixture recebeu REST com entregue_em/updated_at=1999-01-01: status entregue, entregue_em=${apiRow.entregue_em}, ambos timestamps forjados ignorados.|
|2. Protético criar pedido por API/tela|PASSOU|INSERT REST recusado42501, hash/contagem iguais. Action criarPedidoProtetico com cookie real recusou Você não tem permissão para criar um pedido. A navegação à Agenda redirecionou para /dashboard/protetico, sem controles de criação.|
|3. Outros campos e entregue→pendente|PASSOU|Nove PATCHes separados, todos com transição válida status=entregue E campo alterado: protetico_id, dentista_id, paciente_id, id, observacao, clinica_id, agendamento_id, data_entrega, created_at. Todos42501 e zero alteração. Reversão entregue→pendente também42501. Descrição é a coluna real observacao; não existe descricao no catálogo. updated_at e entregue_em enviados foram substituídos pelo servidor na entrega válida.|
|4. Protético apagar e ler só próprios|PASSOU no recorte|DELETE próprio retornou[]/zero efeito; hash igual. SELECT autenticado sem filtro de dono retornou apenas sua clínica/destinatário; pedidos novos de outro destinatário A e de B ausentes na REST e na tela. Limite: não havia segundo protético A existente; pedido de outro destinatário A usa Carlos/dentista, sem criar nova identidade. A prova é por protetico_id; não certifica login de um segundo protético.|
|5. Ana/Carlos/admin/secretária CRUD pela tela|INCONCLUSIVO para CRUD integral pela tela; PASSOU criação UI e CRUD REST|4/4 criaram por Agenda→Enviar ao protético→Enviar pedido, com toast e linha persistida conferida.4/4 leram/editaram/apagaram por REST autenticada. A UI atual oferece envio/criação e entrega, sem controles de leitura/edição/exclusão de pedidos para a equipe; editar agendamento não foi tratado como editar pedido. Não se inventou uma tela de gerenciamento.|
|6. Bruno B não vê nem altera pedidos A|PASSOU|Sessão real B: SELECT[]; PATCH e DELETE retornaram[] sem alterar contagens/hashes das fixtures A.|
|7. Texto exato quando a trava recusa na UI|INCONCLUSIVO para exibição do erro42501; mensagens reais capturadas|API/trigger42501: O protético só pode marcar um pedido pendente como entregue. A UI só envia a transição válida, sem campos editáveis para provocar esse trigger. Uma recusa REAL com cartão obsoleto exibiu Pedido não encontrado, ou já foi marcado como entregue. (count=0 da action), hash igual. Não confundir essa mensagem com a do trigger nem alegar um erro simulado como prova ao vivo.|

## Sessões e método

Seis logins Supabase Auth signInWithPassword reais, chave pública+sessão de cada identidade. get_my_role/get_my_dentista_id e clínica ativa conferidos; nenhum SET ROLE/JWT SQL foi usado para substituir Auth. Navegadores com contextos/cookies próprios para protético e cada membro da equipe. O teste de criar via Server Action usa cookie real do protético. Service role restrita pelo fetch do observador a GET/HEAD no host QA; nenhuma escrita privilegiada. Consultas SQL somente de catálogo/SELECT no projeto QA.

|Identidade|Papel confirmado|dentista_id|Clínica|
|---|---|---|---|
${identities}

Credenciais/tokens ficaram apenas em memória. Sem storageState, HAR, trace ou vídeo e sem screenshots do login. Nenhum dado de cliente/paciente real usado. [Evidência completa](QA-OD008-auth-2026-10-25/evidence.json) contém apenas fixtures/identidades fictícias, respostas sanitizadas e hashes.

## Contagens, hashes e preservação

Pedidos anteriores: **${e.initial.existing.count}→${e.final.existing.count}**, SHA-256 inicial/final **${e.initial.existing.hash}**, igualdade=${e.existingRowsUnchanged}. São todas as colunas das linhas anteriores ordenadas por id; não é hash de todas as tabelas do projeto.

Fixtures novas:5 pedidos base, depois4 criações UI próprias. Cada uma dessas4 foi editada e apagada somente como ação exigida do teste CRUD; não foi limpeza. Restaram **${e.final.own.count} pedidos novos**,7 pacientes e4 agendamentos preservados. Negativas com before/after: contagem e SHA-256 das linhas próprias iguais em cada recusa; detalhes individuais no JSON. Hash final das5 linhas próprias: **${e.final.own.hash}**. Conta por evento: criar UI5→6; editar6→6 com hash alterado como esperado; apagar6→5. Nenhum pedido anterior alterado/apagado.

Subcasos registrados: **${stats.passed}PASSOU/${stats.failed}FALHOU/${stats.inconclusive}INCONCLUSIVO**. A contagem de subcasos não elimina os limites dos itens5/7.

|Verificação|Resultado|HTTP/contagem/hash ou limite|
|---|---|---|
${caseTable}

## Evidência visual

- [Protético antes](QA-OD008-auth-2026-10-25/protetico-entrega-antes.png) · [depois com recarga](QA-OD008-auth-2026-10-25/protetico-entrega-depois-reload.png).
- [Recusa real e texto exato](QA-OD008-auth-2026-10-25/protetico-recusa-texto-exato.png) · [tentativa de acesso à criação](QA-OD008-auth-2026-10-25/protetico-tentativa-acesso-criacao.png).
- Equipe: pares equipe-ANA/CARLOS/ADMIN/SECRETARIA-criar-antes.png e -criar-depois.png na mesma pasta; cada par corresponde ao respectivo fluxo real. Capturas de viewport, sem afirmar auditoria visual integral.

## Fixtures — IDs para limpeza futura autorizada

Prefixo desta rodada: **${e.prefix}**. Nenhuma rotina de limpeza executada. Ids reservados de tentativa bloqueada/alteração de chave constam em orderIds no JSON; não presumir que cada ID reservado corresponde a linha persistida.

|Paciente|ID|Clínica|
|---|---|---|
${patients}

|Agendamento por papel|ID|Paciente|Data/hora BRT|
|---|---|---|---|
${appointments}

|Pedido|ID|Estado de preservação|
|---|---|---|
${orders}

Observação de fixture: o pedido B usa o destinatário Bruno/dentista (não foi criada outra identidade protética); o teste Bruno×A é como dentista B, conforme pedido. Referências de todos os registros são sintéticas. A limitação de segundo protético foi declarada acima.

## Comandos, ajuste do preparo e entrega

- OD008_QA_READY=e0a2662-APLICADA node e2e/meu-dia/od008-auth.mjs: seis Auth confirmados; primeiro preparo parou ao tentar inserir agendamento de Carlos com sessão de Ana. A RLS corretamente exige profissional do próprio contexto (ou equipe autorizada). Agendamento de Ana já existia; o de Carlos não existia, confirmado pelo observador. Nenhum pedido havia sido criado.
- Retomada explícita OD008_RESUME=fixture-only: preservou pacientes/slot já persistidos, conferiu existência por ID e usou a sessão do responsável para cada agendamento. Não repetiu INSERT do slot existente nem a identidade errada. A rodada de pedidos terminou sem falha.
- OD008_QA_READY=e0a2662-APLICADA node e2e/meu-dia/od008-team-ui.mjs:4 criações UI,4 leituras/edições/exclusões REST e recusa de criação pela action do protético. Sem mocks, migração ou limpeza.
- node --check nos scripts, eslint e2e/meu-dia/od008-*.mjs e tsc -p e2e/tsconfig.json: verificação do roteiro; resultado final informado no encerramento abaixo. Build/suíte global do produto não executados nesta auditoria dirigida.

Arquivos próprios: e2e/meu-dia/od008-support.mjs, od008-auth.mjs, od008-team-ui.mjs, od008-report.mjs; relatório/evidências no vault. Alterações de outros agentes no workspace foram preservadas. Sem produto, commit, push, merge, deploy, alteração de schema ou dados de produção. Snapshot3011 permanece e0a2662; ANTES não alterado.

**Recomendação:** aceitar a prova dirigida de permissões/entrega do protético com os limites explícitos. Para declarar todos os sete itens integralmente cumpridos, é necessária decisão sobre os controles de UI inexistentes e sobre a exigência de exibir a mensagem42501 num caminho que a tela não oferece. Esses limites não foram convertidos em falha da migração nem em passe inventado.
`;
fs.writeFileSync(path.join(log, 'QA-OD008-protetico-auth-2026-10-25.md'), report);
console.log(JSON.stringify({ report: 'QA-OD008-protetico-auth-2026-10-25.md', stats, existingRowsUnchanged: e.existingRowsUnchanged }));
