# DentAI

Aplicacao web para operacao basica de clinicas odontologicas, com foco atual em autenticacao, onboarding, pacientes, fichas clinicas, planejamento, orcamentos e configuracoes basicas.

## Estado Atual do Projeto

### Funcionalidades implementadas

- Autenticacao com Supabase Auth para login e cadastro, com protecao de rotas no middleware (`src/app/(auth)/*`, `src/proxy.ts`, `src/lib/supabase/*`).
- Onboarding inicial que cria clinica, dentista e copia procedimentos padrao para a clinica (`src/app/onboarding/page.tsx`, `src/app/onboarding/actions.ts`, `supabase/migrations/20260311001528_003_procedimentos_padrao.sql`).
- Dashboard autenticado com metricas de pacientes, fichas abertas, orcamentos pendentes e atividade recente (`src/app/dashboard/page.tsx`).
- Gestao de pacientes com listagem, busca, cadastro, perfil individual e acesso para criar fichas (`src/app/dashboard/pacientes/*`, `src/components/pacientes/pacientes-table.tsx`).
- Ficha clinica detalhada com anamnese, anotacoes, odontograma, status e navegacao de volta ao perfil do paciente (`src/app/dashboard/fichas/[id]/page.tsx`, `src/app/dashboard/fichas/[id]/ficha-client.tsx`).
- Gravacao de audio com upload para o Supabase Storage e transcricao via OpenAI Whisper (`src/hooks/useAudioRecorder.ts`, `src/app/api/transcricao/route.ts`).
- Upload de documentos com extracao de texto para DOC, DOCX, PDF e TXT (`src/app/dashboard/fichas/[id]/ficha-client.tsx`, `src/app/api/processar-documento/route.ts`).
- Upload, visualizacao e remocao de fotos da ficha e radiografias (`src/app/dashboard/fichas/[id]/ficha-client.tsx`, `src/app/dashboard/fichas/[id]/_components/lightbox.tsx`).
- Planejamento por etapas dentro da ficha, com criacao, edicao, remocao, status, vinculo de radiografia e modo apresentacao (`src/app/dashboard/fichas/[id]/ficha-client.tsx`, `src/app/dashboard/fichas/[id]/_components/modo-apresentacao.tsx`).
- Orcamento vinculado ao planejamento, com geracao de itens por etapa, edicao de preco, recalculo de total e troca de status (`src/app/dashboard/fichas/[id]/ficha-client.tsx`, `src/app/dashboard/fichas/[id]/_components/tab-orcamento.tsx`).
- Tela de orcamentos com filtros, resumo mensal, detalhe lateral e acao para marcar pagamentos existentes como pagos (`src/app/dashboard/orcamentos/page.tsx`, `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`, `src/app/dashboard/orcamentos/actions.ts`).
- Configuracoes basicas da clinica, horarios e procedimentos padrao (`src/app/dashboard/configuracoes/*`).
- Estrutura multi-tenant baseada em `clinica_id` com RLS nas tabelas principais (`supabase/migrations/001_core_tables.sql`, `supabase/migrations/002_modules_tables.sql`, `supabase/migrations/20260311020000_005_fix_dentistas_rls_recursion.sql`).

### Funcionalidades parciais

- Recuperacao de senha tem telas de solicitacao e redefinicao, mas o email de recovery aponta para `/nova-senha` enquanto a rota implementada e `/redefinir-senha` (`src/app/(auth)/esqueci-senha/page.tsx`, `src/app/(auth)/redefinir-senha/page.tsx`).
- A area `/dashboard/fichas` ainda nao lista fichas reais; hoje mostra apenas estado vazio, enquanto a criacao e a tela detalhada funcionam por outros fluxos (`src/app/dashboard/fichas/page.tsx`, `src/app/dashboard/pacientes/[id]/_components/fichas-lista.tsx`).
- A rota para extracao de imagem com GPT-4o existe, mas nao esta conectada a nenhum botao ou fluxo da interface (`src/app/api/extrair-imagem/route.ts`, ausencia de chamadas em `src/app/dashboard/fichas/[id]/ficha-client.tsx`).
- O backend aceita `pptx` em `processar-documento`, mas a validacao do cliente bloqueia esse formato antes do envio (`src/app/api/processar-documento/route.ts`, `src/app/dashboard/fichas/[id]/ficha-client.tsx`).
- O onboarding coleta cidade, estado e dados do consultorio, mas a action persiste apenas o nome da clinica e os dados do dentista; parte do formulario nao vai para o banco (`src/app/onboarding/page.tsx`, `src/app/onboarding/actions.ts`).
- A tela de orcamentos consome e atualiza `pagamentos`, mas o app nao cria esses registros automaticamente a partir do fluxo de orcamento (`src/app/dashboard/orcamentos/page.tsx`, `src/app/dashboard/orcamentos/actions.ts`, `supabase/migrations/002_modules_tables.sql`).
- A configuracao de procedimentos hoje altera `procedimentos_padrao` globais, enquanto o onboarding copia dados para `procedimentos` por clinica; esse fluxo ainda nao esta totalmente alinhado (`src/app/dashboard/configuracoes/actions.ts`, `src/app/onboarding/actions.ts`, `supabase/migrations/001_core_tables.sql`, `supabase/migrations/20260311001528_003_procedimentos_padrao.sql`).

### Funcionalidades planejadas

- Envio de orcamento por WhatsApp / Evolution API.
- Geracao de PDF de orcamento.
- Integracao com Stripe.
- Agenda clinica e calendario operacional.
- Integracao com Google Calendar.
- Automacao de conversas via WhatsApp.

## Stack Atual

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript |
| Banco de dados | Supabase Postgres + RLS |
| Autenticacao | Supabase Auth |
| Storage | Supabase Storage |
| UI | Tailwind CSS v4 + componentes locais/shadcn |
| IA em uso | OpenAI Whisper para audio; rota GPT-4o preparada para imagens |

## Estrutura Relevante

```text
src/
  app/
    (auth)/           telas publicas de autenticacao
    onboarding/       criacao inicial da clinica e do dentista
    dashboard/        area autenticada
    api/              rotas de transcricao e processamento de arquivos
  components/         UI reutilizavel e layout
  hooks/              hooks client-side
  lib/                auth, supabase e helpers
  types/              tipos TypeScript
supabase/
  migrations/         schema e policies
docs/
  mvp-status.md
  definition-of-done.md
  manual-test-checklist.md
  next-issues.md
```

## Configuracao Local

### Pre-requisitos

- Node.js 20+
- Projeto Supabase com Auth, banco e buckets de Storage configurados
- Chave da OpenAI apenas se voce quiser validar a transcricao de audio ou a rota de extracao de imagem

### Variaveis de ambiente

Use `.env.local` com:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
OPENAI_API_KEY=sk-...
```

Observacao: os uploads atuais esperam buckets no Supabase Storage com os nomes `audios`, `documentos`, `fichas` e `radiografias`. A criacao desses buckets nao esta versionada nas migrations do repositorio.

### Setup

```bash
npm install
npm run dev
```

As migrations SQL estao em `supabase/migrations/` e precisam ser aplicadas no projeto Supabase.

## Comandos Uteis

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

## Documentacao Complementar

- `docs/mvp-status.md`: inventario do que esta implementado, parcial ou ausente.
- `docs/definition-of-done.md`: criterio para considerar uma entrega pronta.
- `docs/manual-test-checklist.md`: checklist manual dos fluxos principais.
- `docs/next-issues.md`: backlog recomendado para os proximos ciclos.
