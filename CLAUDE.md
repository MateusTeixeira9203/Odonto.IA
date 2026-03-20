# DentAI

Micro-SaaS odontológico para dentistas autônomos e clínicas pequenas de 1 a 3 cadeiras. Foco principal: geração automática de orçamentos e planos de tratamento via IA, e digitalização assistida de clínicas que ainda usam papel.

Público-alvo: dentistas insatisfeitos com sistemas pesados e caros, ou que ainda operam no papel.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript estrito — nunca use `any` |
| Banco de dados | Supabase Postgres + RLS |
| Autenticação | Supabase Auth |
| Storage | Supabase Storage |
| UI | Tailwind CSS v4 + shadcn/ui |
| Animações | Framer Motion |
| IA | Google Gemini (MVP) → Whisper pós-validação |

---

## Regras de Código

- TypeScript estrito em tudo, sem `any`
- Componentes em `/components`, páginas em `/app`, lógica de negócio em `/lib`, tipos em `/types`
- Supabase sempre server-side via Server Components ou Route Handlers — nunca expor chaves no cliente
- Prefira Server Components. Use Client Components só quando necessário (interatividade, hooks)
- Funções sempre com tipo de retorno explícito
- Erros sempre tratados explicitamente, nunca ignore catch
- Variáveis de ambiente sempre via `process.env` com validação
- Nomeie funções e variáveis em inglês, comentários em português
- Lógica de IA isolada em `/lib/ai`
- Lógica de WhatsApp isolada em `/lib/whatsapp`

---

## Arquitetura Multi-tenant

Toda tabela tem `clinica_id`. RLS garante isolamento por clínica. O dentista autenticado sempre opera dentro do contexto da sua clínica.

Nunca faça queries sem filtrar por `clinica_id`. Nunca confie em `clinica_id` vindo do cliente — sempre buscar do servidor via `getDentistaCached()`.

---

## Estrutura de Pastas
```text
src/
  app/
    (auth)/           login, cadastro, esqueci-senha, redefinir-senha
    onboarding/       setup inicial da clínica e dentista
    dashboard/
      page.tsx        métricas e atividade recente
      pacientes/      listagem, cadastro, perfil com abas
      fichas/         listagem global e detalhe
      orcamentos/     listagem, detalhe e pagamentos
      agendamentos/   agenda e calendário
      configuracoes/  clínica, horários, procedimentos
    api/
      transcricao/    Gemini/Whisper — áudio para texto
      processar-documento/  GPT-4o — extrai texto de PDF/DOCX
      extrair-imagem/ GPT-4o Vision — extrai dados de imagem
  components/
    layout/           sidebar, header, dashboard-shell
    brand/            logo, page-header, empty-state
    dashboard/        metric-card, activity-list
    pacientes/        pacientes-table, FichasTab, DocumentosTab, PlanejamentoTab
    fichas/           NovaEvolucaoPanel
    ui/               shadcn components
  hooks/
    useAudioRecorder.ts
    use-mobile.ts
    use-toast.ts
  lib/
    supabase/         client.ts, server.ts, middleware.ts
    ai/               integrações Gemini/OpenAI
    whatsapp/         Evolution API
    auth.ts
    get-dentista.ts   helper cacheado — usar sempre para pegar clinica_id
    utils.ts          função cn
  types/
    database.ts       tipos gerados do Supabase
supabase/
  migrations/         schema e RLS policies
docs/
  mvp-status.md
  definition-of-done.md
  manual-test-checklist.md
  next-issues.md
  SECURITY.md
```

---

## Buckets Supabase Storage

| Bucket | Uso |
| --- | --- |
| `audios` | Gravações de voz para transcrição |
| `documentos` | PDFs e DOCXs de fichas |
| `fichas` | Fotos vinculadas às fichas |
| `radiografias` | Raio-x dos pacientes |

---

## Design System

### Paleta de Cores

| Variável CSS | Hex | Uso |
| --- | --- | --- |
| `--color-teal` | `#2f9c85` | Cor primária, botões, ícones ativos, bordas de destaque |
| `--color-teal-lt` | `#5dbeb0` | Hover de botões, gradientes, estados secundários |
| `--color-teal-pale` | `#e4f4f1` | Background de badges, inputs focados |
| `--color-bg` | `#f5f3ef` | Fundo de todas as páginas (off-white) |
| `--color-surface` | `#ffffff` | Fundo de cards, modais, áreas de conteúdo |
| `--color-surface-alt` | `#eceae4` | Backgrounds alternativos, hover em listas |
| `--color-black` | `#0d0d0d` | Títulos principais, alto contraste |
| `--color-gray-md` | `#8a8a8a` | Textos secundários, labels |
| `--color-border` | `#d4d1ca` | Bordas de cards, divisores, inputs |

### Tipografia

- **Títulos:** `font-serif` → DM Serif Display — h1, h2, títulos de seções
- **Interface:** `font-sans` → Outfit — botões, menus, inputs, textos gerais
- **Dados/Valores:** `font-mono` → DM Mono — valores monetários, IDs, códigos de dentes

### Bordas e Espaçamentos

- `rounded-xl` — botões e inputs
- `rounded-2xl` — cards padrão e modais pequenos
- `rounded-3xl` — containers grandes e modais de destaque
- `p-8` — padding de container de página
- `p-6` — padding interno de card
- `gap-4` / `gap-6` — gaps recorrentes

### Sombras e Efeitos

- **Premium Shadow:** `0 10px 30px -10px rgba(47, 156, 133, 0.1)` — botões e cards flutuantes
- **Glass Card:** `backdrop-blur-md` com transparência — modais e overlays

### Animações Padrão (Framer Motion)
```tsx
// Entrada de página
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}

// Entrada lateral
initial={{ opacity: 0, x: -20 }}
animate={{ opacity: 1, x: 0 }}

// Saída de elementos
exit={{ opacity: 0, y: -10 }}
transition={{ duration: 0.2 }}
```

### Componentes shadcn/ui em uso

`Button`, `Dialog`, `Input`, `Label`, `Select`, `Tabs`, `DropdownMenu`, `Calendar`, `Badge`, `Card`, `Textarea`, `Separator`, `Sheet`, `Skeleton`, `Table`

### Ícones

`lucide-react` — biblioteca padrão para todos os ícones

---

## Decisões de IA

| Funcionalidade | MVP | Pós-validação |
| --- | --- | --- |
| Transcrição de voz | Gemini (gratuito) | Migrar para Whisper |
| Geração de orçamento/planejamento | Gemini 1.5 Pro | Avaliar GPT-4o se necessário |
| Extração de imagem | Gemini Vision | Manter Gemini (3x mais barato) |

Não migrar para GPT-4o antes de ter clientes pagantes.

---

## Funcionalidades Implementadas

- Auth completo: login, cadastro, recuperação de senha (`/esqueci-senha` → `/redefinir-senha`), proteção de rotas via middleware
- Onboarding: cria clínica (com cidade, estado, telefone), dentista e copia procedimentos padrão
- Dashboard com métricas
- CRUD de pacientes com busca
- Perfil do paciente com abas: Visão Geral, Fichas Clínicas, Documentos, Planejamento, Orçamentos
- Listagem global de fichas em `/dashboard/fichas` com dados reais
- FichasTab com odontograma ISO adulto (11–48) e gravação de voz (chama `/api/transcrever` com FormData de áudio bruto, não `/api/transcricao`)
- DocumentosTab com galeria de fotos do paciente (upload/lightbox/remoção), filtro por período e arquivos de fichas agrupados por tipo
- PlanejamentoTab com geração de conteúdo via Gemini
- Seleção de procedimento da clínica na etapa com preenchimento automático de título e preço
- Geração automática de orçamento a partir do planejamento (`generateBudgetFromPlanning`) com redirect para o orçamento criado
- Orçamentos com filtros, métricas, detalhe lateral e isolamento por clínica via `getDentistaCached()`
- Agendamentos com calendário, modais de criação e detalhe conectados ao Supabase
- Configurações de clínica, horários e catálogo de procedimentos operando sobre `procedimentos` da própria clínica
- Sidebar expansível animada (64px ↔ 240px)
- Dark mode completo
- Upload de documentos incluindo `.pptx`

---

## Funcionalidades Parciais (prioridade de correção)

| Problema | Arquivos |
| --- | --- |
| Pagamentos não são criados automaticamente ao gerar orçamento | `orcamentos/actions.ts` |
| Rota `/api/extrair-imagem` não tem botão na UI para disparar | `fichas/[id]/ficha-client.tsx` |

---

## Decisões Técnicas Documentadas

| Decisão | Arquivos |
| --- | --- |
| FichasTab chama `/api/transcrever` (FormData) em vez de `/api/transcricao` (JSON) — comportamento correto para gravação inline | `components/pacientes/FichasTab.tsx` |

---

## Segurança

### Políticas RLS obrigatórias

Toda tabela multi-tenant deve ter:
1. Política `FOR ALL` com `auth.uid()` + `clinica_id`
2. Foreign key para `clinicas(id)` com `ON DELETE CASCADE`
3. Teste de isolamento: usuário de clínica A não acessa dados da clínica B

### Tabelas críticas a validar

| Tabela | RLS | Testado |
| --- | --- | --- |
| `pacientes` | [ ] | [ ] |
| `fichas` | [ ] | [ ] |
| `orcamentos` | [ ] | [ ] |
| `procedimentos` | [ ] | [ ] |
| `pagamentos` | [ ] | [ ] |
| `agendamentos` | [ ] | [ ] |
| `horarios_disponiveis` | [ ] | [ ] |
| `conversas_bot` | [ ] | [ ] |
| `mensagens_bot` | [ ] | [ ] |
| `configuracoes_clinica` | [ ] | [ ] |

### Variáveis de ambiente sensíveis

- `SUPABASE_SERVICE_ROLE_KEY` — nunca exposta no cliente
- `OPENAI_API_KEY` / `GEMINI_API_KEY` — apenas server-side
- `EVOLUTION_API_KEY` — apenas server-side

---

## API Routes

| Endpoint | Método | Função |
| --- | --- | --- |
| `/api/transcrever` | POST | Recebe FormData com áudio bruto — usado pela FichasTab para gravação inline |
| `/api/transcricao` | POST | Recebe JSON com ficha_id + audio_url — fluxo de transcrição vinculada a ficha existente |
| `/api/processar-documento` | POST | Recebe PDF/DOCX, extrai texto |
| `/api/extrair-imagem` | POST | Recebe imagem, extrai dados via Gemini Vision |
| `/api/whatsapp/webhook` | POST | Recebe mensagens da Evolution API (planejado) |
| `/api/whatsapp/enviar` | POST | Envia mensagem ativa para paciente (planejado) |

---

## Funcionalidades Planejadas

- Conectar todas as telas ao Supabase (substituir mock data)
- Orçamento automático: `generateBudgetFromPlanning()` cruza planejamento com tabela de procedimentos
- Geração de PDF de orçamento em linguagem simples para o paciente
- Agenda com integração Google Calendar (OAuth2 bidirecional)
- Bot WhatsApp via Evolution API: agendamento automático, confirmações, lembretes
- Envio de PDF via WhatsApp
- Stripe para billing e planos

---

## Configuração Local

### Pré-requisitos

- Node.js 20+
- Projeto Supabase com Auth, banco e Storage configurados
- Chave Gemini ou OpenAI para transcrição e processamento

### Variáveis de ambiente
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role
NEXT_PUBLIC_GEMINI_API_KEY=sua_chave_gemini
OPENAI_API_KEY=sk-...
```

### Setup
```bash
npm install
npm run dev
```

Aplicar as migrations em `supabase/migrations/` antes de rodar.

## Comandos
```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run lint       # lint
npm run typecheck  # checagem de tipos
```

---

## Documentação Complementar

- `docs/mvp-status.md` — inventário do que está implementado, parcial ou ausente
- `docs/definition-of-done.md` — critério para considerar uma entrega pronta
- `docs/manual-test-checklist.md` — checklist manual dos fluxos principais
- `docs/next-issues.md` — roadmap completo por sprints
- `docs/SECURITY.md` — checklist de segurança e RLS por tabela