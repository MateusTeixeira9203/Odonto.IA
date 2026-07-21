# Spec: Multi-especialidade do dentista

> **Status:** implemented (código) — **migrations 085/086 pendentes de aplicação** (usuário optou por aplicar depois)
> **Data:** 2026-07-04
> **Plano de origem:** nenhum roadmap prévio — pedido direto do fundador nesta sessão (planejamento)

## Escopo

Cobre:
- `dentistas.especialidade` vira múltiplo (o dentista pode ter mais de uma especialidade).
- Tela de Perfil (`/dashboard/perfil`): redesenho do seletor — sai o `<select>` nativo, entra uma grade de chips toggle (mesmo padrão visual já usado em `ArchChips`/seletor de quadrante da ficha, construído nesta mesma sessão).
- Onboarding: o formulário de cadastro inicial também vira multi-select (mesma lista de opções).
- RPC `complete_onboarding`: novo parâmetro `p_especialidade text[]` (troca a assinatura atual de `text`).
- Bot de WhatsApp: a descrição do dentista na lista de agendamento passa a juntar todas as especialidades.

**NÃO cobre:**
- Filtragem/roteamento de pacientes por especialidade no bot (hoje não existe, continua não existindo — só muda o texto exibido).
- Especialidade livre/customizada ("Outro" com campo de texto) — "Outro" continua sendo só mais uma opção da lista, sem sub-campo.
- Qualquer mudança na hierarquia de papéis/planos (o fundador sinalizou que isso vai mudar em breve, separado desta spec).

## Assunções

- **Mínimo 1 especialidade obrigatória** em ambos os formulários (perfil e onboarding) — mantém o comportamento atual de campo obrigatório, só que agora validando array não-vazio em vez de string não-vazia.
- **"Outro" permanece uma opção simples da lista** (sem input de texto livre condicional) — não foi pedido, e adicionar isso seria escopo novo.
- **WhatsApp: junta especialidades com vírgula** (`"Ortodontia, Implantodontia"`) — simples, sem "e" antes do último item; é só uma descrição de linha na lista do bot, não precisa de polish de copy.
- **Dados existentes:** cada dentista com `especialidade` preenchida (string) migra pra um array de 1 elemento (`['Ortodontia']`); quem tem `null` migra pra `'{}'` (array vazio) — sem forçar re-preenchimento retroativo.
- **Ordem de exibição dos chips:** segue a ordem fixa já existente em `ESPECIALIDADES` (Clínico Geral primeiro, Outro por último) — não vira alfabética nem reordena por uso.

## TypeScript — Interfaces & Types

```typescript
// src/lib/especialidades.ts (novo arquivo — fonte única da lista, hoje duplicada em
// perfil-client.tsx e onboarding-client.tsx)
export const ESPECIALIDADES = [
  'Clínico Geral',
  'Ortodontia',
  'Endodontia',
  'Implantodontia',
  'Periodontia',
  'Odontopediatria',
  'Cirurgia',
  'Outro',
] as const;

export type Especialidade = typeof ESPECIALIDADES[number];

// src/types/database.ts — campo em Dentista
export interface Dentista {
  // ...campos existentes
  especialidade: Especialidade[]; // era: string | null
}

// src/lib/get-dentista.ts — DentistaCache
export interface DentistaCache {
  // ...campos existentes
  especialidade: Especialidade[]; // era: string | null
}

// src/app/dashboard/perfil/actions.ts
export interface PerfilData {
  nome: string;
  telefone: string;
  cro: string;
  especialidade: Especialidade[]; // era: string
  cpf: string;
  chavePix: string;
}

// src/services/whatsapp.service.ts
export interface DentistListItem {
  id: string;
  nome: string;
  especialidade: Especialidade[]; // era: string | null
}

// src/app/onboarding/actions.ts
export interface OnboardingInput {
  // ...campos existentes
  especialidade: Especialidade[]; // era: Especialidade (singular)
}
```

## Zod Schemas

```typescript
// src/lib/especialidades.ts (junto com a const acima)
import { z } from 'zod';

export const especialidadesSchema = z.array(z.enum(ESPECIALIDADES)).min(1, 'Selecione ao menos uma especialidade');

// src/app/onboarding/_components/onboarding-client.tsx — troca no schema do form
const onboardingSchema = z.object({
  // ...campos existentes
  especialidade: especialidadesSchema, // era: z.enum(ESPECIALIDADES)
});

// src/app/dashboard/perfil/_components/perfil-client.tsx — mesma validação no submit
// (perfil hoje não usa react-hook-form/zod diretamente — validar manualmente:
//  if (formEspecialidade.length === 0) { toast.error(...); return; })
```

## Componente novo — seletor de chips

```typescript
// src/components/ui/especialidade-chips.tsx (novo — reusa o padrão visual de ArchChips)
export interface EspecialidadeChipsProps {
  selected: Especialidade[];
  onChange: (next: Especialidade[]) => void;
  disabled?: boolean;
}

export function EspecialidadeChips({ selected, onChange, disabled }: EspecialidadeChipsProps): JSX.Element;
// Grade de botões toggle (grid-cols-2 ou flex-wrap), teal quando selecionado,
// mesmo estilo de ARCH_OPTIONS.map(...) em arch-chips.tsx — sem dependência nova.
```

Usado em `perfil-client.tsx` (substitui o `<select>`) e em `onboarding-client.tsx` (substitui o `<Select>` single).

## API Contracts

### RPC `complete_onboarding` (Postgres function via `supabase.rpc(...)`)

| Campo | Valor |
|---|---|
| Auth | required (`auth.uid()`, já validado dentro da função) |
| Rate limit | não (idempotency guard já existe — 1 chamada bem-sucedida por usuário) |

**Novo parâmetro:**
```typescript
p_especialidade: string[] | null  // era: string | null
```

**Erros esperados (inalterados, mais 1 novo):**
| Código | Condição |
|---|---|
| P0400 | `INVALID_PLAN` / `INVALID_INPUT` (nome clínica/usuário vazio) — já existe |
| P0401 | `UNAUTHENTICATED` — já existe |
| P0404 | `USER_NOT_FOUND` — já existe |
| P0409 | `ALREADY_ONBOARDED` — já existe |
| P0400 | **novo:** `INVALID_INPUT: especialidade é obrigatória` se `p_especialidade` vier `NULL` ou array vazio |

### Server Action `salvarPerfil` (`src/app/dashboard/perfil/actions.ts`)

| Campo | Valor |
|---|---|
| Auth | required (via `requireClinicContext()`, já existente) |

**Input:** `especialidade: string[]` (substitui `especialidade: string` no objeto `PerfilData`)
**Erros:** shape inalterado — `{ error?: string }`. Validação de "ao menos 1" acontece client-side antes de chamar a action (mesmo padrão do `nome` obrigatório já existente).

## Database

### Migration — `dentistas.especialidade`: `text` → `text[]`

```sql
-- 085 — Multi-especialidade: dentistas.especialidade vira array.
-- Dados existentes: string única migra pra array de 1 elemento; null vira array vazio.

alter table dentistas add column especialidade_v2 text[] not null default '{}';

update dentistas
set especialidade_v2 = case
  when especialidade is null or trim(especialidade) = '' then '{}'::text[]
  else array[especialidade]
end;

alter table dentistas drop column especialidade;
alter table dentistas rename column especialidade_v2 to especialidade;

comment on column dentistas.especialidade is
  'Lista de especialidades do dentista (multi-select). Array vazio = nenhuma definida ainda.';
```

### Migration — RPC `complete_onboarding` (nova assinatura, 10 args → 10 args, `p_especialidade` muda de tipo)

```sql
-- 086 — complete_onboarding aceita p_especialidade como text[].
-- Mesma assinatura de 10 argumentos da migration 081, só o tipo do 5º parâmetro muda.
-- DROP explícito da versão text (sobrecarga por tipo, não por aridade — precisa
-- dropar a antiga já que text e text[] não coexistem na mesma posição).

DROP FUNCTION IF EXISTS public.complete_onboarding(text, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_plano          text,
  p_nome_clinica   text,
  p_nome_usuario   text,
  p_cro            text DEFAULT NULL,
  p_especialidade  text[] DEFAULT '{}',
  p_telefone       text DEFAULT NULL,
  p_cidade         text DEFAULT NULL,
  p_estado         text DEFAULT NULL,
  p_email          text DEFAULT NULL,
  p_foco_principal text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- corpo idêntico à migration 081, com 2 mudanças:
--   1. nova validação (bloco 2): IF p_especialidade IS NULL OR array_length(p_especialidade, 1) IS NULL THEN
--        RAISE EXCEPTION 'INVALID_INPUT: especialidade é obrigatória' USING ERRCODE = 'P0400'; END IF;
--   2. INSERT INTO dentistas (...) usa p_especialidade diretamente (já é text[], sem cast)
$$;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text, text[], text, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text, text[], text, text, text, text, text) TO authenticated;
```

**Nota de execução:** rodar 085 antes de 086 (a RPC insere na coluna, precisa que ela já seja array).

## Componentes

### Árvore (arquivos tocados, nenhum componente novo de página)

```
perfil-client.tsx (Client)         ← troca <select> por <EspecialidadeChips>
onboarding-client.tsx (Client)      ← troca <Select> single por <EspecialidadeChips>
especialidade-chips.tsx (novo)      ← componente compartilhado
especialidades.ts (novo)            ← ESPECIALIDADES + tipo + schema, fonte única
```

### Responsabilidades

| Componente | Server/Client | O que faz |
|---|---|---|
| `EspecialidadeChips` | Client | grade de toggle, controlado (`selected`/`onChange`) |
| `perfil-client.tsx` | Client | usa o chips, valida ≥1 antes de submeter |
| `onboarding-client.tsx` | Client | mesmo, dentro do react-hook-form existente |

## Invariantes

- [ ] `dentistas.especialidade` nunca é `NULL` — sempre array (vazio ou com itens).
- [ ] Todo dentista tem **ao menos 1** especialidade ao concluir onboarding ou salvar perfil — validado em Zod (perfil client-side) e na RPC (banco, defesa em profundidade).
- [ ] `ESPECIALIDADES` (a lista de valores válidos) vive em **um único lugar** (`src/lib/especialidades.ts`) — perfil e onboarding importam de lá, não duplicam o array.
- [ ] Bot de WhatsApp nunca quebra se `especialidade` vier vazio — fallback pro texto atual (`'Clínico Geral'`) quando o array é `[]`.

## Gates de aceite

- [ ] Perfil: selecionar 2+ especialidades, salvar, recarregar a página → as mesmas 2+ continuam marcadas.
- [ ] Perfil: tentar salvar com 0 especialidades selecionadas → bloqueia com mensagem, não chama a action.
- [ ] Onboarding: fluxo completo com 2 especialidades → dentista criado com `especialidade = ARRAY['X','Y']` no banco (conferir via SQL).
- [ ] RPC antiga (assinatura `text`) não existe mais após a migration 086 (`\df complete_onboarding` no psql mostra só a versão `text[]`).
- [ ] Bot WhatsApp: dentista com 2 especialidades aparece na lista como `"Ortodontia, Implantodontia"`; dentista com 0 aparece como `"Clínico Geral"`.
- [ ] `tsc` + `eslint` limpos; `next build` sem regressão.
