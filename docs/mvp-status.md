# MVP Status -- DentAI

## Implementado

- Autenticacao basica com login, cadastro e logout usando Supabase Auth (`src/app/(auth)/login/page.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/components/layout/sidebar.tsx`).
- Protecao de rotas publicas, onboarding e dashboard com middleware/SSR (`src/proxy.ts`, `src/lib/supabase/middleware.ts`).
- Onboarding inicial que cria clinica (com cidade, estado e telefone), dentista e replica procedimentos padrao para a clinica (`src/app/onboarding/page.tsx`, `src/app/onboarding/actions.ts`, `supabase/migrations/20260319000003_012_clinicas_contato.sql`).
- Recuperacao de senha completa: solicitar via `/esqueci-senha` e redefinir via `/redefinir-senha` com redirectTo correto (`src/app/(auth)/esqueci-senha/page.tsx`, `src/app/(auth)/redefinir-senha/page.tsx`).
- Dashboard com metricas e atividade recente (`src/app/dashboard/page.tsx`).
- Cadastro, listagem, busca e perfil de pacientes (`src/app/dashboard/pacientes/page.tsx`, `src/components/pacientes/pacientes-table.tsx`, `src/app/dashboard/pacientes/[id]/page.tsx`, `src/app/dashboard/pacientes/novo/actions.ts`).
- Listagem geral de fichas em `/dashboard/fichas` com dados reais do Supabase (`src/app/dashboard/fichas/page.tsx`).
- Criacao de ficha a partir do paciente e abertura da tela detalhada da ficha (`src/app/dashboard/fichas/nova/page.tsx`, `src/app/dashboard/fichas/nova/actions.ts`, `src/app/dashboard/fichas/[id]/page.tsx`).
- Edicao da ficha com anamnese, anotacoes, odontograma e alteracao de status (`src/app/dashboard/fichas/[id]/ficha-client.tsx`).
- Gravacao de audio com upload para Storage e transcricao via Gemini/Whisper (`src/hooks/useAudioRecorder.ts`, `src/app/api/transcrever/route.ts`, `src/app/dashboard/fichas/[id]/ficha-client.tsx`).
- Upload e processamento de documentos em texto incluindo `.pptx` (`src/app/dashboard/fichas/[id]/ficha-client.tsx`, `src/app/api/processar-documento/route.ts`).
- Upload, visualizacao e remocao de fotos da ficha e radiografias (`src/app/dashboard/fichas/[id]/ficha-client.tsx`, `src/app/dashboard/fichas/[id]/_components/lightbox.tsx`).
- Galeria de fotos do paciente com upload, lightbox e remocao diretamente no perfil (`src/components/pacientes/PhotoGallery.tsx`, `src/components/pacientes/DocumentosTab.tsx`, `src/lib/storage/uploadPatientPhoto.ts`).
- Planejamento por etapas com criacao, edicao, remocao, status, vinculo a procedimento da clinica e modo apresentacao (`src/app/dashboard/fichas/[id]/ficha-client.tsx`, `src/app/dashboard/fichas/[id]/_components/modo-apresentacao.tsx`).
- Selecao de procedimento da clinica na etapa com preenchimento automatico de titulo e preco unitario (`src/app/dashboard/fichas/[id]/_components/etapa-form.tsx`, `src/app/dashboard/fichas/[id]/actions.ts`).
- Geracao automatica de orcamento a partir do planejamento via `generateBudgetFromPlanning()` com redirect para o orcamento criado (`src/app/dashboard/fichas/[id]/actions.ts`, `src/app/dashboard/fichas/[id]/ficha-client.tsx`).
- Orcamento vinculado ao planejamento com itens, preco unitario, total e status (`src/app/dashboard/fichas/[id]/ficha-client.tsx`, `src/app/dashboard/fichas/[id]/_components/tab-orcamento.tsx`).
- Tela de orcamentos com filtros, resumo mensal e marcacao manual de pagamentos existentes como pagos -- com isolamento por clinica via `getDentistaCached()` (`src/app/dashboard/orcamentos/page.tsx`, `src/app/dashboard/orcamentos/actions.ts`).
- Agenda clinica com calendario, modais de criacao e detalhe de agendamentos conectados ao Supabase (`src/app/dashboard/agendamentos/`).
- Configuracoes da clinica, horarios e catalogo de procedimentos operando sobre `procedimentos` da propria clinica (`src/app/dashboard/configuracoes/`).
- Aba de documentos do paciente com galeria de fotos, filtro por periodo e arquivos de fichas agrupados por tipo (`src/components/pacientes/DocumentosTab.tsx`).
- Estrutura multi-tenant com RLS nas tabelas principais (`supabase/migrations/001_core_tables.sql`, `supabase/migrations/002_modules_tables.sql`).

## Parcialmente implementado

- Controle de pagamentos: a tela de orcamentos exibe e atualiza `pagamentos`, porem o fluxo atual nao gera registros de pagamento ao criar um orcamento (`src/app/dashboard/orcamentos/page.tsx`, `src/app/dashboard/orcamentos/actions.ts`).
- Extracao de imagem com IA: ha uma rota para processar foto da ficha/radiografia com Gemini Vision, mas a interface nao dispara esse endpoint (`src/app/api/extrair-imagem/route.ts`, ausencia de chamadas em `src/app/dashboard/fichas/[id]/ficha-client.tsx`).

## Nao implementado

- Envio de orcamento por WhatsApp, apesar de o README antigo prometer esse fluxo; nao existe integracao com API de envio nem acao correspondente no codigo (`README.md` antigo, ausencia de codigo em `src/`).
- Integracao com Evolution API / WhatsApp; o README antigo citava variaveis e stack de WhatsApp, mas nao ha cliente, service ou route handler para isso (`README.md` antigo, `.env.example`, ausencia de codigo em `src/`).
- Integracao com Stripe; o README antigo citava Stripe e variaveis de ambiente, mas nao ha fluxo de checkout, webhook ou cobranca (`README.md` antigo, ausencia de codigo em `src/`).
- Geracao de PDF de orcamento; a coluna `pdf_url` existe no schema, mas nao ha rota, action ou UI para gerar o arquivo (`src/types/database.ts`, `supabase/migrations/001_core_tables.sql`).
- Integracao com Google Calendar; nao existe codigo nem configuracao para sincronizacao de agenda (`ausencia de codigo em src/`).
- Bot de atendimento / historico de mensagens via WhatsApp; as tabelas `conversas_bot` e `mensagens_bot` existem apenas no banco e nao sao usadas pela aplicacao (`supabase/migrations/002_modules_tables.sql`, ausencia de codigo em `src/`).

## Depende de terceiros

- Supabase Auth para sessao, cadastro, login e reset de senha (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/app/(auth)/*`).
- Supabase Postgres + RLS para persistencia de clinicas, dentistas, pacientes, fichas, planejamentos, orcamentos e configuracoes (`supabase/migrations/*.sql`).
- Supabase Storage para audio, documentos, fotos da ficha, fotos do paciente e radiografias; os uploads esperam buckets `audios`, `documentos`, `fichas` e `radiografias` (`src/app/dashboard/fichas/[id]/ficha-client.tsx`, `src/app/api/transcrever/route.ts`, `src/app/api/processar-documento/route.ts`, `src/lib/storage/uploadPatientPhoto.ts`).
- Gemini para transcricao de audio e geracao de planejamento/orcamento (`src/app/api/transcrever/route.ts`, `src/lib/ai/`).
- OpenAI GPT-4o para a rota de extracao de imagem, ainda sem uso na UI (`src/app/api/extrair-imagem/route.ts`, `.env.example`).
- WhatsApp apenas como deep link `wa.me` para contato manual com o paciente; nao existe integracao oficial de envio automatizado (`src/app/dashboard/pacientes/[id]/page.tsx`, `src/app/dashboard/fichas/[id]/ficha-client.tsx`).
