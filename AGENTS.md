# Odonto.IA — regras de trabalho

STATUS: ACTIVE
LAST_REVIEWED: 2026-10-18
CANONICAL_FOR: regras comuns de Claude, Codex e demais agentes

## Entrada econômica e fase atual

- Leia [plans/ESTADO.md](plans/ESTADO.md). Para contexto funcional, leia
  [docs/PRODUTO.md](docs/PRODUTO.md). [README](README.md) é o mapa de entrada.
- Consulte apenas os arquivos relevantes à tarefa. Instrução mais recente do usuário
  prevalece. O Estado identifica versão e limites; evidência do ambiente prevalece
  sobre relato documental para afirmar o que está em produção.
- Declare o papel: Arquiteto de Produto (debate/contrato), Executor (implementa o
  aprovado), Auditor (reproduz sem corrigir) ou Curador (organiza documentos).
- Fase atual: curadoria e debate, sem código. O plano futuro será arquivo externo
  para download/OneDrive; não duplicá-lo em specs/roadmap. Execução futura exige que
  o usuário forneça a versão aprovada e autorize o recorte. Não reativar ordens antigas.

## Produto e escopo

- Núcleo: captura → estruturação pela IA → Ficha → planejamento → orçamento.
  Preservar agenda, pacientes e financeiro como consumidores diretos.
- Debater com argumentos e trade-offs; não concordar por reflexo ou inventar requisito.
  Em fatos externos/atuais, consultar fontes e distinguir evidência de inferência.
- Antes de mudança não trivial, explicitar resultado, dentro/fora do escopo,
  comportamento preservado, arquivos/consumidores, risco e aceite observável.
  Reutilizar contrato existente, sem checklist concorrente.
- Separar atual, desejado e lacuna; fato verificado, relato, hipótese e verificação impedida.
  Documento/branch/build não comprovam comportamento ou schema em produção.
- Limitar correções a falhas confirmadas. Achado adjacente vira recorte próprio.
  No máximo duas tentativas automáticas por defeito; depois preservar reprodução e revisar hipótese.
- Não implementar durante auditoria. Antes de delegar/acionar outros agentes ou chats,
  propor recorte e obter aval do usuário. Definir contrato único, arquivos, dependências
  e integrador; executores não editam simultaneamente o panorama central.

## Código e arquitetura

- Next.js App Router, React, TypeScript estrito, Supabase, Tailwind/shadcn e Motion;
  versões/comandos em package.json, localização em [Arquitetura](docs/ARQUITETURA.md).
- Nunca `any`. Tratar erros explicitamente. Componentes pequenos; lógica em
  services/hooks/server, fetch centralizado. Reusar antes de abstrair ou adicionar dependência.
- `Promise.all` para fetches independentes; Suspense/skeleton e feedback nas ações
  perceptíveis; otimização exige medição, não impressão.

## Autorização e dados

- Tabelas multi-tenant: `clinica_id` + RLS; consultas limitadas à clínica ativa.
  Papéis são por clínica. Não remover vínculos legados ou mudar auth por direção de produto.
- Identidade e escopo vêm do servidor; autorização também dentro de RPC privilegiada.
  UI, grant ou leitura RLS isolada não provam autorização de escrita.
- Alteração de permissão/RLS exige chamadas diretas com duas identidades autenticadas,
  negativas, isolamento e zero efeito indevido. Provar persistência e recarga quando pertinentes.
- Conferir objetos do schema efetivo; não confiar só em supabase_migrations.schema_migrations.
- Dados reais são somente leitura em auditoria. Escritas QA só com autorização, dados
  sintéticos identificados e efeitos delimitados. Sem carga/falha/destruição sobre reais.
- Preservar Clindent colaborativa e configuração solo da Dra. Léia; não converter pelo planejamento.

## IA e design

- IA operacional: organiza/estrutura; nunca inventa diagnóstico ou age como dentista.
  Saída clínica em JSON tipado com responseSchema/generateStructuredGemini;
  chamadas passam feature por src/lib/ai/provider.ts. Prompt clínico exige eval antes/depois.
- Processamento IA usa DexLoader existente. Preservar texto, autoria, revisão e recuperação de falhas.
- Base visual: sistema atual, conforme decisão de 18/10; Figma fora do processo.
  Próximos debates serão por prints, tela a tela.
- Usar tokens (bg-background, bg-card, text-foreground, text-muted-foreground, border-border).
  Não adicionar bg-white, text-black, gray-* ou cores hardcoded. Verificar claro/escuro e mobile.
- Artefato específico aprovado é contrato visual, sem autorizar regra de negócio.
  Copiar estrutura/medidas; se incompatível, trazer achado. Mudou decisão visual, atualizar artefato antes do código.
- HTML: skill artefato-visual, servir por HTTP e extrair por JS; não deduzir pelo olho,
  não ler HTML como substituto de renderização, não usar file://. Não escolher variante histórica sozinho.
- Fidelidade visual e paridade funcional são gates distintos. Motion discreta e acessível.

## Verificação, entrega e publicação

- Testar recorte e consumidores diretos, com estados iniciais, ação, resultado esperado,
  efeito proibido e evidência segura.
- Registrar PASSA/NÃO PASSA/NÃO TESTADO por ambiente/versão. Build/lint são evidência parcial.
  Segurança e dados exigem Auth direto, antes/depois, repetição/falha/recarga conforme risco.
- Entrega local, integração, publicação e aceite do usuário são estados diferentes.
  Informar resultado, evidências, limites e pendências no chat e atualizar o Estado quando necessário.
- Aprovar contrato/teste não autoriza commit, push, deploy, migration remota, gasto ou
  dados reais. Sem push automático. Mudança local reversível autorizada pode avançar.
- Lotes pequenos; separar schema, docs, refatoração, fix e feature. Acima de ~15 arquivos,
  reexaminar lote; limpeza documental autorizada pode ser mecânica. Não restaurar vulnerabilidade no rollback.
- Publicação autorizada exige conferir versão/ambiente e fluxo representativo depois.

## Documentação

Uma fonte por assunto: Produto descreve capacidades; Estado descreve foco e versão;
Roadmap descreve situação e pendências. Arquitetura e Segurança orientam consulta técnica.
Não duplicar contratos, listas ou regras em novos índices.

A fase anterior foi encerrada: specs, artefatos, auditorias, handoffs e protocolos
redundantes foram excluídos por pedido do usuário. Não recriar acervo, índices de
preservação ou handoffs por sessão. Histórico Git não é requisito atual.

Nesta fase, o plano futuro fica fora do repositório. Para execução, receber o arquivo
aprovado do usuário e seguir um único contrato por recorte. Não gerar uma spec local
concorrente nem transformar ideias em backlog aprovado. Regras antigas de skills que
mandem criar templates, arquivar ou acumular handoffs ficam substituídas por esta decisão.
Nenhuma skill amplia escopo, muda modelo, delega ou publica sem autorização aplicável.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
