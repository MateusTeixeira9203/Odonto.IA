# Estado — Odonto.IA

Atualizado em 18/10/2026. Fonte do foco atual, não histórico de sessões.

## Agora

Pacote da auditoria dirigida entregue: [relatórios e 113 prints](../docs/auditoria-producao-2026-10-18/README.md).
Foco atual: ajustes pontuais autorizados em 18/10, publicados seletivamente — login/loading
em ciclo, olhinho no login, nomes acessíveis das senhas no cadastro, texto “Próxima sessão”
e rótulos de status da Agenda. 13 testes dirigidos aprovados; lint zero erros/um aviso
preexistente; typecheck integral passou com heap de 6144 MB. Navegador local conferiu login, botões, mobile do login, texto e callback
do MonthView real com dados isolados. Publicado sem commit/push/migration.
Produção: login com sessão/recarga, Dashboard QA, proteção anônima, olhinho, cadastro,
texto e status PASSAM. Novo login por senha e estados comerciais reais NÃO TESTADOS.
Contrato e evidências: [Código](../docs/auditoria-producao-2026-10-18/CODIGO.md#ajustes-pontuais-selecionados-em-18102026).

Usuário adiou Ficha assinada e RPC financeira antiga (inclusive validação dos riscos),
orçamento avulso, gráfico financeiro, Aprovar tudo e redesign. Senhas vazadas e desempenho
foram apenas avaliados: proteção disponível/desligada; sem índices/policies alterados.
Fonte única da destinação e limites: [Pendências](../docs/auditoria-producao-2026-10-18/PENDENCIAS.md).
A conta QA mantém paciente/Ficha/evento, proposta de R$ 100, encaixe, bloco de apresentação
e receita manual fictícia de R$ 50; zero pagamentos de orçamento. IDs em INTERFACE.md.

Limpeza de contas de teste concluída em produção, por autorização específica do
usuário após revisão da lista e dos dados vinculados: 19 contas excluídas, incluindo
Paula, Achelle e as quatro contas Mateus restantes. Também removidos cinco cadastros
de clínicas de teste, cinco pacientes de teste, quatro fichas, quatro orçamentos,
11 pagamentos registrados de teste, dois agendamentos e dois arquivos antigos,
além das dependências de cadastro, estoque e governança autorizadas.
Após a limpeza restaram 11 contas nas clínicas Clindent, Vip, Lea Mara e Samira.
Verificação pós-operação: zero contas-alvo em Auth/public.users; nenhuma clínica-alvo;
hashes dos registros fora do escopo preservados nas transações com dados clínicos;
503 objetos restantes no Storage com o mesmo hash anterior à remoção dos dois alvos.
Oito triggers tratados na última transação foram restaurados e conferidos; nenhuma
proteção permaneceu desativada. Limpeza não publica a correção local de login.

Nova conta QA criada pelo usuário e conferida: usuário
`523d1c6d-087c-4d51-9a44-7ec4f9b639ac`, clínica exclusiva "Clinica teste"
`eddc5fc6-62b0-4d01-8e6e-3f84f61e64e7`, administrador ativo, sem assinatura.
Isenção autorizada e configurada: `STRIPE_BILLING_QA_EXEMPT_CLINIC_ID` em production
aponta para a nova clínica; única variável alterada entre as 45 existentes.
Override de banco `812f4c42-01bf-43b4-b636-e025f2060499`, restrito ao usuário/clínica,
sem expiração. O gate comercial do banco não está habilitado globalmente; não foi
alterado. Quatro verificações isoladas da função de isenção passaram.
Republicação autorizada e concluída, mesma SHA: isenção confirmada no navegador em
Configurações → Plano, com "Cortesia permanente" e "Acesso de cortesia". Zero
assinaturas QA no banco; agora 12 contas e 5 clínicas. Evidência no print 11.
O redeploy não incluiu a correção local de login nem a limpeza documental.

Conta real autorizada SOMENTE para prints: navegação/captura sem editar, salvar,
iniciar atendimento, processar IA, cobrar ou enviar. Prints reais irão para
`docs/auditoria-producao-2026-10-18/prints-privados/`, fora do Git. Pasta ainda vazia.

## Referência de produção

Aplicação: `odontoia.app`, deployment `dpl_HiZZiUFuWTtCVa5hawEfdrjp7WrN`, READY.
Fonte: SHA base `a1722c47c346a4a80c84ad6cd5efd0ee42afbf08` + patch de seis fontes e teste,
publicado por CLI em 18/10/2026. Não há nova SHA/commit. Alias conferido pela API.
Identidade reprodutível em `docs/auditoria-producao-2026-10-18/evidencias/publicacao/`.
Banco Supabase `zenfemoxvwerplrjgfqz`: catálogo vivo consultado nesta auditoria.
78 tabelas públicas com RLS e 5 buckets privados; isso não certifica isolamento.
Objetos do banco podem ser posteriores ao commit. Git não é backup do banco.

## Limites e próximo passo

- Publicação seletiva concluída. Incorporar patch no próximo commit para manter Git e produção alinhados.
  Novo login por senha e cenário comercial real seguem pendentes; limites em CODIGO.md.
- Achados adiados não foram resolvidos nem reclassificados como seguros; ver Pendências.
- A limpeza excluiu specs, artefatos, auditorias/handoffs e protocolos antigos.
  Não recriar acervo histórico. O pacote atual é uma auditoria nova pedida pelo usuário.
- Plano da atualização continua externo para download/OneDrive após debate de telas.
- O worktree `/home/mtx/.codex/worktrees/odonto-preservacao-v2/Odonto.IA` tem trabalho
  anterior não commitado, não integra produção e não foi alterado nesta tarefa.
- Produto descreve capacidades; Roadmap mantém situação e pendências, sem duplicar
  os critérios/achados que estão no relatório atual.
