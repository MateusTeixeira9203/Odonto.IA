# Arquitetura — mapa de entrada

STATUS: ACTIVE
LAST_REVIEWED: 2026-10-18
CANONICAL_FOR: localização das responsabilidades técnicas da baseline de aplicação

Mapa de leitura dirigido do código `a1722c4`; não é certificação do schema publicado.

| Área | Onde começar |
| --- | --- |
| Rotas e Server Actions | `src/app/` (Next.js App Router) |
| Componentes e interação | `src/components/`, `src/hooks/` |
| Sessão e clínica ativa | `src/server/auth/clinic.ts`, `src/lib/get-dentista.ts` |
| Autorização | `src/server/authorization/` e checks internos das RPCs; ver [Segurança](SECURITY.md) |
| Clientes e integrações | `src/lib/` (Supabase, IA, WhatsApp, billing etc.) |
| Domínio servidor | `src/server/`, `src/services/` |
| Tipos e validação | `src/types/` e schemas usados pelos consumidores |
| Captura/estruturação IA | `src/lib/ai/provider.ts`, `src/components/fichas/`, rotas Dex |
| Ficha e perfil | `src/app/dashboard/pacientes/[id]/`, `src/components/pacientes/` |
| Meu Dia | `src/app/dashboard/meu-dia/`, `src/server/dashboard/get-meu-dia.ts` |
| Orçamento/financeiro | `src/app/dashboard/orcamentos/actions.ts`, `src/lib/orcamentos/`, `src/app/dashboard/financeiro/` |
| Schema versionado / testes DB | `supabase/migrations/`, `supabase/tests/` quando existir; catálogo vivo é autoridade sobre instalação |

## Stack e comandos

Next.js 16.3.3 / React 19.2.3 no package.json desta baseline; TypeScript estrito,
Tailwind v4, shadcn/ui e Motion. Supabase para Postgres/Auth/Storage; IA Groq/Gemini;
Upstash, Resend, WhatsApp Meta e Stripe têm consumidores/configuração próprios.
Existir integração no código não comprova credenciais, plano ou funcionamento atual.

`npm run dev` inicia Next com webpack; `npm run typecheck`, `npm run lint`, `npm test`
e `npm run build` são os scripts disponíveis. Escolher verificação proporcional ao recorte.
Antes de escrever Next.js, ler o guia aplicável em `node_modules/next/dist/docs/`.

## Fronteiras a preservar

UI não decide autorização nem duplica cálculo financeiro. A IA estrutura dados para
revisão profissional, sem inventar fatos clínicos. Orçamento, realização, pagamento e
repasse são estados distintos. Toda mudança persistente deve considerar concorrência,
idempotência, recarga, falha e reversão conforme o risco.
Consulte o [Estado](../plans/ESTADO.md) para a versão de referência. Código de
outro checkout não integra automaticamente esta baseline.
