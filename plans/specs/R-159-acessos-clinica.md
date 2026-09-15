# R-159 — Entrada, identidade e permissões por clínica

> **SPEC** · **R-159** · 🔵 ativo
> **Aberto:** 2026-09-10 · **Fase:** contrato · Execução autorizada por recortes nesta conversa.
> Integração e rollout: [R-158](R-158-modelos-clinica-gestao.md).
> Personas/navegação vigentes: [R-161 §2–3](R-161-meu-consultorio.md); gestor delegado fora da etapa atual.

## 1. Problema

O contexto atual exige `dentistaId` para todos. Guards, policies e serviços ainda usam
`admin/dentista/secretaria/protetico` para autorizar operações; secretária ou admin podem
ter privilégios que não representam a organização real de uma clínica.

## 2. Decisões

- Identidade global; vínculo, funções e permissões por unidade; atuação clínica opcional.
- Perfis são presets editáveis, não condições escondidas de autorização. Preset aplicado
  uma vez cria configuração explícita; mudar o preset não altera outras pessoas.
- Uma permissão tem escopo; negar é explícito, ausência é negar nas unidades novas.
- Responsável principal controla a propriedade do acesso; delega administração da equipe
  sem permitir transferência de propriedade ou autoelevação pelo delegado.
- Clínica colaborativa mantém a colaboração atual, sem proprietário técnico automático.
- Nomenclatura confirmada em 11/09: colaborativa; com proprietário dentista; com proprietário
  não dentista. Gestor é função delegada, não quarto modelo. Base não clínica e consulta de
  equipe pertencem ao [R-159c](R-159c-equipe-entrada-gestao.md); demais módulos não estão ativados.

## 3. Fluxos e matriz de permissões

Cadastro: login → criar unidade ou aceitar convite → escolher modelo → dados básicos →
perfil profissional somente se atende → acesso comercial definido → entrada permitida.
Perfis iniciais propostos: proprietário, gestor, dentista, recepção, protético.
Novos gestores/recepção não ganham escrita financeira, tabela ou permissões automaticamente;
o responsável vê a lista e ativa o necessário antes de enviar o convite.
Proprietário gerido tem administração de acessos e gestão da unidade, sem atuação clínica implícita.
Protético fica restrito ao calendário/confirmação neste escopo. A expansão não é autorizada
por um switch genérico; lacuna do consumidor equipe.ler registrada no R-159c §10.

### Catálogo fechado (chaves propostas)

Escopos: **nenhum**, **próprio**, **profissionais selecionados**, **clínica**.
Próprio usa o dentista autenticado para recursos clínicos; sem perfil clínico, não concede acesso.
Selecionados valida cada profissional na mesma unidade. A UI oferece apenas escopos válidos.

| Chave | Ação concedida | Escopos permitidos |
|---|---|---|
| `pacientes.ler` / `pacientes.editar` | Cadastro administrativo, sem evolução/documentos clínicos | nenhum, selecionados, clínica |
| `agenda.ler` / `agenda.editar` / `agenda.confirmar` | Ver, agendar/reagendar ou confirmar | todos |
| `contatos.whatsapp` | Preparar contato autorizado no WhatsApp | todos |
| `acompanhamentos.ler` / `acompanhamentos.gerir` | Consultar/atribuir/adiar/concluir tarefas de contato | todos; próprio usa o responsável pela tarefa |
| `clinico.ler` | Ficha, evolução e documentos clínicos | nenhum, próprio, selecionados, clínica; somente profissional clínico nesta entrega |
| `clinico.registrar` | Registrar atendimento sob responsabilidade própria | nenhum, próprio; exige habilitação clínica do perfil |
| `orcamentos.ler` / `orcamentos.criar` | Consultar ou montar proposta | todos; criador não substitui responsável clínico |
| `orcamentos.aceite` / `orcamentos.cancelar` | Registrar aceite ou cancelar conforme fatos | todos |
| `precos.ler` / `precos.editar` | Consultar/editar tabela da unidade | nenhum, clínica |
| `precos.excecao` | Propor preço fora da tabela/grupo livre | todos; não elimina controle de desconto |
| `descontos.solicitar` / `descontos.aprovar` | Pedir/decidir exceção | todos; limite definido no R-160 |
| `cobrancas.ler` / `cobrancas.gerir` | Pendências, etapas e vencimentos | todos |
| `recebimentos.registrar` | Confirmar dinheiro recebido | todos |
| `recebimentos.corrigir` / `recebimentos.estornar` | Correção ou estorno com motivo | todos, independentes de registrar |
| `financeiro.ler` / `financeiro.exportar` | Caixa/indicadores ou arquivo dos dados permitidos | todos |
| `despesas.ler` / `despesas.gerir` | Ver ou lançar/corrigir despesas | todos |
| `repasses.ler` / `repasses.gerir` | Ver ou registrar repasses manuais | todos; depende de módulo próprio liberado |
| `equipe.ler` / `equipe.convidar` / `equipe.remover` | Operar vínculos | nenhum, clínica |
| `permissoes.gerir` | Alterar acessos dentro do teto de delegação | nenhum, clínica |
| `configuracoes.gerir` | Dados e operação da unidade | nenhum, clínica |
| `auditoria.ler` | Trilha das ações autorizadas | nenhum, clínica |
| `estoque.ler` / `estoque.gerir` / `estoque.ajustar` / `kits.gerir` | Materiais próprios/selecionados/clínica | todos, limitado também pela titularidade do estoque |
| `materiais.confirmar` | Confirmar uso/rastreabilidade sem editar evolução | todos, com vínculo ao atendimento permitido |
| `unidades.consolidar` | Incluir unidade em leitura consolidada | nenhum, clínica; exige permissões de leitura dos indicadores |

Permissões não entregam recursos ainda congelados. Exportar exige também ler; receber exige
ler a cobrança mínima; contato exige acesso ao cadastro/agenda; criar orçamento exige acesso
aos procedimentos selecionados, não o prontuário integral. Dependências aparecem antes de salvar.
O cadastro compartilhado não concede todos os históricos de atendimento ou financeiros.
Em acompanhamentos, próprio usa `responsavel_usuario_id`, inclusive para recepção sem perfil
clínico. A tarefa não concede acesso extra ao orçamento/prontuário de origem; autorização é cumulativa.
Para ler cadastro de profissionais selecionados, exigir relação do paciente com agendamento,
atendimento ou orçamento autorizado na clínica; `pacientes.dentista_id` isolado não define
todo o compartilhamento. Recepção/gestor recebem DTO administrativo mínimo. Orçamento e uso
de material expõem só procedimentos/referências necessários à ação, sem transcrição, anamnese
ou documentos clínicos. Permissão de caixa não libera renda pessoal ou relatório completo.

## 4. Contrato técnico proposto

### Base real e pontos de mudança

- `src/server/auth/clinic.ts`: dividir contexto de membro e contexto clínico; manter adaptador
  do contexto antigo até todos os consumidores clínicos migrarem.
- `src/server/auth/roles.ts`, `src/server/services/team.ts`, `invites.ts`: substituir decisões
  por cargo apenas nos caminhos ativados, incluindo chamadas privilegiadas de provisionamento.
- `src/app/onboarding/actions.ts:iniciarOnboarding` chama `complete_onboarding`, que cria dentista.
  Novo fluxo do gestor deve provisionar unidade/vínculo sem chamar criação clínica artificial.
- `users.active_clinica_id`, `clinica_usuarios`, `dentistas`, `secretarias`, `convites` existem.
  Tipos locais divergem de condições usadas no auth (`suspenso`); conferir constraints online.
- Guards de layout, proxy, billing, menu, pesquisa, PDF, Storage e notificações entram no inventário.
  UI escondida não corrige acesso por RPC ou policy legada permissiva.

```ts
type Escopo = { tipo: 'nenhum' | 'proprio' | 'clinica' }
  | { tipo: 'selecionados'; dentistaIds: string[] };
// Permissao = união literal das chaves da tabela acima; não string arbitrária.
type Acesso = { permissao: Permissao; escopo: Escopo };
type ContextoMembro = {
  usuarioId: string; clinicaId: string; membroId: string; versaoAcesso: number;
  perfilClinico: { tipo: 'dentista'; dentistaId: string } | { tipo: 'nao_clinico' };
  acessos: Acesso[];
};
type Falha = 'INVALIDO' | 'SEM_ACESSO' | 'NAO_ENCONTRADO' | 'CONFLITO'
  | 'CONTEXTO_ALTERADO' | 'ULTIMO_RESPONSAVEL' | 'INDISPONIVEL';
type Resultado<T> = { ok: true; data: T } | { ok: false; codigo: Falha; mensagem: string };
interface AlterarAcessosInput {
  clinicaIdEsperada: string; membroId: string; versaoEsperada: number;
  acessos: Acesso[]; motivo: string; chaveIdempotencia: string;
}
```

Novos contratos server-side: `obterContextoMembro`, `exigirPermissao`, `exigirPerfilClinico`,
`alterarAcessos(AlterarAcessosInput): Promise<Resultado<{versao:number}>>`,
`convidarMembro({clinicaIdEsperada,email,perfil,acessos,chaveIdempotencia})`,
`revogarVinculo({clinicaIdEsperada,membroId,versaoEsperada,motivo,chaveIdempotencia})`.
Inputs Zod: UUIDs, email válido, motivo 1–500 caracteres, profissionais distintos na clínica,
versão inteira positiva, chaves do catálogo, sem concessões duplicadas; teto 200 alvos por escopo.
Identidade/ator e teto de delegação vêm do banco; formulário nunca declara quem autorizou.
Escopos de pacientes não aceitam `proprio`: a lista de escopos por ação é validada no banco;
para dentista, preset pode usar selecionados com seu próprio ID quando autorizado.

### Persistência aditiva proposta, não migration aplicada

| Objeto | Campos/constraints necessários |
|---|---|
| `clinicas.modelo_gestao` | Nullable: `gerida` / `colaborativa`; null representa legado não convertido. |
| `clinica_governanca` | clinica_id PK/FK, responsavel_usuario_id, versao; somente para modelo gerido. FK/vínculo ativo verificados na transação. |
| `clinica_acessos` | id, clinica_id, membro_id, perfil, atua_clinicamente, versao, acessos JSONB validado, teto_delegacao JSONB validado DEFAULT '[]', updated_at; UNIQUE membro; FK composta impede membro de outra clínica. |
| `clinica_acessos_auditoria` | id, clinica_id, ator_usuario_id, membro_id, antes/depois, motivo, chave_idempotencia, payload_hash, resultado, created_at; append-only; UNIQUE clínica+ator+chave. |
| Convite: extensão em tabela própria | clinica_id, convite_id único, perfil, acessos, concedente_usuario_id, versao_concessao; token e expiração reutilizam convite atual. |

Validação de JSON também no banco: rejeitar chaves/escopos inválidos, alvos externos e
perfil clínico sem vínculo profissional válido. Índices por clínica+membro/ator/data.
Configuração sem concessões é válida e nega operações; nunca recair no cargo nesse caso.
Teto de delegação é separado do acesso de uso: somente o responsável principal pode defini-lo;
delegado não altera o próprio teto nem o de terceiros. Vazio não permite conceder acessos.
O hash usa payload validado e canônico, com chaves/permissões/alvos ordenados e UUIDs normalizados;
mesma chave e hash retornam o resultado gravado, payload distinto retorna conflito. Auditoria,
mudança e resultado idempotente pertencem à mesma transação; nenhuma gravação parcial.
Bootstrap gerido cria governança apenas junto à nova unidade e seu criador autenticado;
não busca um admin legado para promovê-lo. Entrada externa depende da cobertura R-165.

### Autorização e transações

1. Autenticar e resolver membro ativo na clínica esperada. Erro de consulta não significa
   cadastro ausente; retornar indisponível, não redirecionar ao onboarding.
2. Ler versão/acessos atuais no banco; verificar permissão, escopo, titularidade e estado do alvo.
3. Bloquear versão alterada; mutation crítica trava membro/governança/alvo em ordem consistente.
4. Validar dependências, teto do concedente e invariantes; gravar fato e auditoria juntos.
5. Retornar resultado tipado e invalidar caches da pessoa/unidade afetada.

- Revogação vale na próxima operação, mesmo com aba aberta/JWT antigo. Leituras sensíveis
  não dependem de claims editáveis pelo usuário nem de cache compartilhado entre membros.
- Proibir autoelevação. Delegado só concede subconjunto de seu teto explícito; não edita
  responsável principal nem remove o último administrador de acessos ativo.
- Transferência do responsável é fluxo próprio de duas confirmações autenticadas (origem/destino)
  e transação final; sem autopromoção por pagar assinatura. Fora da primeira entrega de UI.
- Aceitar convite revalida poderes atuais do concedente e versão: se mudaram, pedir reemissão,
  sem conceder snapshot obsoleto. Replay/duplo clique não duplica vínculo ou perfil.
- Toda policy antiga que usa role precisa de ramo explícito legado/nova governança, inclusive
  permissive OR: não basta acrescentar uma policy mais restritiva.
- UPDATE valida origem e destino; RPCs verificam tenant internamente, inclusive quando privilegiadas.
  Funções auxiliares privadas têm grants mínimos; não liberar writes diretos que contornem transações.
- `registrarLog` atual é fire-and-forget: não serve sozinho como auditoria de concessão/revogação.
- Nenhum delete de usuário/dentista histórico; remover vínculo é desativar. Cancelar assinatura
  é outra ação, com consequência mostrada, não efeito oculto de remover funcionário.

### Legado e billing

Responsabilidade pela assinatura e fluxo comercial do convite: proposta canônica no
[R-165](R-165-cadastro-responsavel-assinatura.md). Pagador e concessão de permissões são independentes.

Unidades sem nova governança usam comportamento legado observado, sem reinterpretar `admin`.
Conversão futura compara permissões efetivas antes/depois, pede adesão e não move dados.
No piloto novo, exigir política comercial explícita para gestor não dentista; não criar
assinatura de dentista falsa, trial infinito ou acesso gratuito implícito. Essa decisão bloqueia
liberação externa do cadastro gerido, não testes locais com contas fictícias autorizadas.

## 5. Comportamento

| Estado | Tela e operação |
|---|---|
| Vazio | Membro sem concessões vê acesso limitado e contato com responsável; não erro. |
| Carregando | Salvar desabilitado e feedback; edição preservada. |
| Sucesso | Resumo do acesso efetivo, unidade e versão atual; auditoria persistida. |
| Inválido | Erro por campo; não grava concessão parcial. |
| Sem acesso | Mensagem neutra, sem revelar conteúdo do alvo; chamada direta também negada. |
| Não encontrado | Alvo externo/inexistente não revela identificação ou cadastro. |
| Conflito | Outra pessoa alterou acessos: recarregar e revisar; não sobrescrever. |
| Falha técnica | Não confundir falha de rede/banco com usuário sem clínica; preservar formulário. |

Caminho: Equipe → pessoa → permissões → escolher ação+escopo → conferir dependências →
salvar com versão → validação transacional → acesso atualizado nas próximas operações.

Exemplos: recepção sem receber consulta agenda mas não grava PIX; dentista autorizado recebe;
gestor sem perfil clínico edita tabela mas não assina evolução; gerente da A não acessa B;
dois administradores tentam se remover simultaneamente e a clínica mantém responsável ativo.

## 6. Referência visual

Brief R-158. Editor de permissões por seção, switches nomeados e seletor de escopo adjacente;
resumo “Pode / Não pode” antes de enviar convite; sem tela com dezenas de switches sem agrupamento.
Artefato de cadastro/equipe ainda precisa de aprovação; não alterar tela existente sem inventário.

## 7. Invariantes

Sem autoelevação, cargo como bypass, perfil dentista fictício, acesso cross-clínica, concessão
por JWT editável, exclusão de histórico ou clínica gerida sem responsável de acessos.

## 8. Gates de aceite

Todos obrigatórios: testes de contrato/transação + duas contas reais autenticadas na clínica QA.
- [ ] Cadastro dos três modelos, retomada/interrupção/convite repetido preservam identidade.
- [ ] Gestor sem dentista abre área permitida; rota clínica direta nega sem loop.
- [ ] Recepção desautorizada falha via UI, Action, REST/RPC; dentista autorizado registra.
- [ ] Read, PDF, busca, export e URLs de arquivos não revelam dados fora do escopo.
- [ ] Revogar em A bloqueia próxima operação de A, sem afetar vínculo em B.
- [ ] Campo clinicaId adulterado e duas abas com mudança de unidade não gravam no destino errado.
- [ ] Chave repetida com mesmo payload repete resultado; com payload diferente retorna conflito.
- [ ] Último responsável, autoelevação e convite concedido antes da revogação são bloqueados.
- [ ] Cada estado da §5 foi reproduzido; auditoria e transação falham juntas quando necessário.
- [ ] Clínicas legadas mantêm matriz observada; comparação de fatos existentes não muda.

## 9. Fora de escopo

Novo preço/plano SaaS, conversão massiva de clínicas, acesso clínico por gestor não dentista,
permissões entre marcas, transferência de propriedade por suporte sem fluxo auditável.

## Complemento de estoque — planejamento delegado em 11/09
Catálogo operacional detalhado em [R-140e1](R-140e1-estoque-base-manual.md). Adicionar
estoque.receber/consumir/descartar, com escopos nenhum/proprio/selecionados/clinica, a TS e SQL.
Atualizar teto fixo42 para cardinalidade45 e testes de paridade. estoque.gerir passa a significar
somente metadados; não ampliar concessões preparadas sem revisão. Em estoque, clinica significa
apenas titular clínica, não contém estoque pessoal dos profissionais.

Decisão de 12/09 substitui a proposta de responsável exclusivo de estoque na colaborativa:
todos os dentistas ativos têm as mesmas ações no comum; cada um administra seu estoque pessoal.
Não concede poderes sobre materiais pessoais, prontuário ou financeiro de colegas.
Na gerida, o proprietário libera ações de estoque comum para dentistas ou recepção.
Contrato de ativação/concessão, reutilizando governança e acessos: [R-140e1a](R-140e1a-autorizacao-estoque.md).
