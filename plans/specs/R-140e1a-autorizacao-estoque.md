# R-140e1a — Autorização operacional do estoque

> Contrato · 12/09/2026 · execução autorizada no teste; push apenas ao final.
> Recorte do R-140e1: ativação explícita e concessões. Sem tela ou movimentações neste bloco.

## 1. Decisão e fronteiras
Usuário confirmou ações independentes e configuração flexível por pessoa na clínica gerida.
Na colaborativa, dentistas têm o próprio estoque privado e as mesmas permissões no comum.
As seis ações são estoque.ler/gerir/receber/consumir/descartar/ajustar. Kits ficam fora.
Dentista ativo administra seu próprio estoque nos dois modelos. Nenhum acesso pessoal alheio
é concedido neste recorte, nem ao proprietário. Sem dentista ativo, não há estoque pessoal.
Na gerida, proprietário ativo administra o comum e concede ações comuns a membros ativos.
Na colaborativa, todo dentista ativo administra o comum; também pode configurar ações comuns
da recepção. Não pode reduzir/ampliar individualmente as ações de outro dentista colaborativo.
Recepção não concede permissões; não se cria hierarquia entre dentistas colaborativos.
Cargo admin legado não prova propriedade. Proprietário é o responsável explicitamente cadastrado
na governança de uma clínica com modelo gerida. Suspensão/remoção do vínculo nega tudo.

## 2. Persistência e compatibilidade
Reutilizar clinica_governanca e clinica_acessos; não criar ACL paralela.
- clinica_governanca.modelo_estoque: nullable colaborativa/gerida; legado permanece null.
- clinica_governanca.estoque_ativo: boolean false; true exige modelo definido.
- clinica_acessos.acessos_estoque_ativos: JSONB [] com as seis chaves, somente escopo clinica,
  sem duplicatas e com estoque.ler obrigatório quando qualquer ação estiver presente.
- clinica_acessos.versao_estoque: inteiro positivo default1, independente da preparação geral.
- Auditoria existente ganha origem default preparacao; novo valor estoque distingue concessões
  e identifica que versao_anterior/nova e snapshots pertencem somente ao estoque.
Preparar_acessos_membro continua editando apenas acessos preparados; jamais ativa estoque.
Nenhuma permissão preparada é copiada automaticamente para acessos_estoque_ativos.
Usar versao_estoque incrementada em cada concessão; preservar versão geral, perfil,
teto e acessos preparados. Não conceder UPDATE/SELECT direto adicional nas tabelas existentes.
Governança global continua preparacao, com responsável técnico pré-existente preservado;
o contexto de estoque ignora esse responsável no modelo colaborativa. Não alterar a nulabilidade
nem os guards globais R-159 neste recorte. estoque_ativo habilita somente o consumidor de estoque.
Ativação/modelo não recebem endpoint livre: neste piloto são configuração explícita de fixtures
QA via canal SQL administrativo normal. Onboarding/conversão de clientes permanece R-159.
Não criar endpoint em que usuário existente se autodeclare proprietário ou converta a clínica.

## 3. Contexto autenticado e respostas
RPC obter_contexto_estoque(p_clinica_id_esperada uuid) retorna Resultado<ContextoEstoque>.
Contexto: clinicaId, membroId, modelo (colaborativa/gerida), dentistaId nullable,
permissoesPessoais: Acao[], permissoesCompartilhadas: Acao[], podeGerenciarCompartilhado:boolean.
Modelo não definido/inativo e vínculo inválido retornam SEM_ACESSO; contexto trocado retorna
CONTEXTO_ALTERADO. Sessão/identidade vêm de auth.uid e users.active_clinica_id, nunca do formulário.
Dentista exige vínculo ativo com role dentista/admin e dentistas ativo, mesma clínica e usuário.
Não retornar dados pessoais de colegas, catálogo, pacientes, saldo ou permissões de outros módulos.
Helper privado resolve o mesmo contexto para uso por futuras RPCs de movimentos; cliente não autoriza.

## 4. Concessão operacional
RPC configurar_acessos_estoque(p_clinica_id uuid,p_membro_id uuid,p_versao_esperada integer,
p_acessos jsonb,p_motivo text,p_chave_idempotencia uuid) retorna Resultado<{versao:number}>.
Adapter TS aceita unknown com Zod estrito: clinicaIdEsperada,membroId,versaoEsperada,
acessos,motivo(1–500 após trim),chaveIdempotencia. UUID normalizado; versão inteira positiva.
Coleção vazia revoga tudo no comum. Mutação não pode conceder proprio/selecionados ou outras chaves.
Grantor: owner explícito na gerida; dentista ativo na colaborativa. Alvo ativo na mesma clínica,
sem autoalteração de autoridade. Owner gerido e dentista colaborativo possuem base igualitária
não editável individualmente por esta RPC; recepção nunca recebe poder de conceder.
Obrigatório validar teto limitado a seis ações comuns e dependência ler; nunca editar teto global.
O próprio dentista não precisa de grants comuns para administrar o pessoal.

Ordem de locks: governança, memberships por UUID, users por UUID, perfis clínicos, configuração; revalidar
clínica ativa, vínculo, perfil clínico e autoridade depois dos locks. Versão divergente conflita.
Reutilizar auditoria imutável com origem estoque; hash inclui nome da operação e payload canônico.
Chave igual/payload igual retorna versão anterior sem regravar; diferente conflita. Replay exige
autoridade atual e alvo ainda válido. Concessão + auditoria são uma transação; falha reverte tudo.
Se configuração de acesso não existir, retornar NAO_ENCONTRADO; não criar membership disfarçado.
Funções privilegiadas ficam privadas; wrappers autenticados invoker com ACL explícita.
Tabela de estoque segue sem acesso direto. Não ampliar grants para anon/service_role.

## 5. Gates
- TS: schemas estritos, respostas inválidas/erro de rede tratados, sem expor mensagens internas.
- SQL: normalização, dependência ler, limite por ação/escopo, versão/replay/conflito e auditoria.
- Navegador: dois dentistas ativos na mesma colaborativa recebem seis ações iguais no comum,
  cada um com dentistaId próprio; proprietário não clínico recebe pessoal vazio.
- Gerida: recepção recebe ler+gerir+receber, sem consumir/ajustar; alteração e revogação refletem
  na próxima consulta autenticada sem renovar JWT. Tentativa de autoelevação é negada.
- Clínica trocada/alvo externo/membro suspenso são negados; preparação antiga permanece igual.
- API direta das tabelas continua negada. Modelo null/inativo falha fechado. Sem dado real.
- Revisão técnica antes de commit; schema e código em commits separados, sem push.

## 6. Próximo recorte
Gate deste recorte aprovado no Free: [evidências e limite herdado](../auditorias/2026-09-12-r140e1a-autorizacao-estoque.md).
Cadastros e movimentos consumirão este contexto dentro da transação, com checagem por titular.
A interface e testes integrados do app ficam após operações reais; harness de autorização não é UI.
