# Spec: Secretária cria orçamentos

> **Status:** draft
> **Data:** 2026-07-15
> **Plano de origem:** nenhum (escopo fechado em discussão nesta sessão, sem handoff prévio dedicado)
> **Modelo de execução:** Sonnet — implementação bem definida, sem ambiguidade de produto.

## Escopo

Cobre:
- Secretária consegue criar orçamento (fluxo já existente no sistema — sem upload de
  arquivos, sem extração por IA) em `/dashboard/orcamentos` e no perfil do paciente.
- RLS: liberar `INSERT` em `orcamentos`/`orcamento_itens` para `role='secretaria'`,
  desde que o orçamento seja atribuído a um dentista real, ativo, da mesma clínica.
- Correção de um bug de RLS descoberto durante a investigação (ver Assunções) que hoje
  bloquearia a inserção dos itens do orçamento mesmo depois de liberar o orçamento em si.
- Secretária consegue cadastrar um procedimento novo no catálogo (fluxo "cadastrar
  procedimento" já existente dentro do modal de orçamento, usado quando o item digitado
  não bate com nada do catálogo), **atribuído ao dentista responsável** — mesmo silo por
  dentista que já existe hoje pra procedimentos (cada dentista tem seu próprio catálogo
  de nome+preço; não é catálogo compartilhado da clínica). Confirmado pelo usuário: "o
  procedimento e o valor serão registrados apenas pra o dentista responsável".

NÃO cobre:
- Upload de PowerPoint/Word ou qualquer extração de dados por IA (descartado nesta sessão).
- Registro de pagamento pela secretária (próximo passo do usuário, spec separada).
- Redesenho de status do orçamento (dívida já registrada em handoff anterior, fora daqui).
- Alertas de vencimento (dívida já registrada, fora daqui).

## Assunções

- **Bug adicional encontrado (não fazia parte do pedido original, mas bloqueia o fluxo
  se não corrigido junto):** a policy `orcamento_itens_insert_own` hoje exige
  `o.dentista_id = get_my_dentista_id()`. Mesmo depois de liberar o INSERT em `orcamentos`
  para secretária, o INSERT dos itens (`orcamento_itens`) continuaria bloqueado, porque
  `get_my_dentista_id()` da secretária nunca é igual ao `dentista_id` do orçamento-alvo.
  Resultado sem esse fix: `criarOrcamento` cria a linha em `orcamentos` (sucesso) e falha
  ao inserir os itens — orçamento órfão, sem itens, sem transação para desfazer o insert
  anterior. Esta spec inclui o fix das duas policies com o mesmo helper, para não deixar
  esse buraco aberto.
- `dentistasClinica` (lista de dentistas da clínica, excluindo secretária, só ativos) já
  é buscada client-side em `paciente-detail-client.tsx:208-220` para outro fluxo
  (reatribuição de paciente) — reaproveitada aqui, sem nova query.
- "Dentista real e ativo da clínica" exclui explicitamente outra secretária como alvo
  (`role <> 'secretaria'`) — orçamento sempre pertence a quem trata clinicamente.
- Sem migração de dados existente necessária — mudança é só de policy/contrato,
  nenhuma coluna nova.
- **Segundo bug adicional encontrado, mesma classe do primeiro:** `criarProcedimentoRapido`
  (`actions.ts:690`) hoje (a) é bloqueado pela RLS pra secretária (`procedimentos_write_own`
  exige `is_clinic_dentista()`) e (b) mesmo que a RLS liberasse, a função nem aceita um
  `dentistaId`-alvo — grava sempre `dentista_id: dentistaPerfil.id`, ou seja, o perfil de
  quem chamou. Sem corrigir os dois, a secretária cadastra o orçamento, tenta cadastrar um
  procedimento novo no meio do fluxo, e trava — ou pior, se só a RLS fosse destravada sem
  o parâmetro, o procedimento nasceria siloed pra ela mesma, não pro dentista responsável
  (violaria a confirmação do usuário de que preço/procedimento é por dentista).
- O helper de RLS `can_write_orcamento_as` foi generalizado para `can_act_as_dentista`
  (mesma lógica: "posso agir em nome deste dentista-alvo?") porque agora é reusado por
  duas tabelas (`orcamentos`/`orcamento_itens` e `procedimentos`), não só orçamento.

## TypeScript — Interfaces & Types

```typescript
// src/app/dashboard/orcamentos/actions.ts — contrato de criarOrcamento não muda de shape,
// mas dentistaId passa a ser validado como obrigatório quando quem chama é secretária.
export async function criarOrcamento(dados: {
  pacienteId: string;
  desconto?: number;
  itens: Array<{
    procedimentoId: string | null;
    descricao: string;
    quantidade: number;
    precoUnitario: number;
  }>;
  dentistaId?: string; // obrigatório em runtime quando o caller é secretária (validado, não no tipo)
  fichaId?: string | null;
}): Promise<{ error?: string; id?: string }>;
```

```typescript
// src/app/dashboard/pacientes/[id]/_components/modals/novo-orcamento-modal.tsx
// Props novas (aditivas — não remove nenhuma existente):
interface NovoOrcamentoModalProps {
  // ...props existentes inalteradas...
  isSecretaria: boolean;
  dentistasClinica: { id: string; nome: string }[];
  dentistaAlvoId: string;
  onDentistaAlvoChange: (id: string) => void;
}
```

```typescript
// src/app/dashboard/orcamentos/actions.ts — criarProcedimentoRapido ganha dentistaId,
// mesmo padrão de criarOrcamento (opcional no tipo, obrigatório em runtime p/ secretária).
export async function criarProcedimentoRapido(dados: {
  nome: string;
  precoPadrao: number | null;
  dentistaId?: string;
}): Promise<{ error?: string; id?: string }>;
```

## Zod Schemas

Não aplicável — `criarOrcamento` é Server Action sem Zod hoje (validação manual existente
mantida); esta spec não introduz schema novo, só a validação runtime abaixo.

## Server Action — `criarOrcamento`

| Campo      | Valor |
|------------|-------|
| Auth       | required (via `requireClinicContext()`) |
| Rate limit | não |

**Validação nova (antes do INSERT):**
1. Buscar `dentistaPerfil` incluindo `role` (hoje só busca `id`).
2. Se `dentistaPerfil.role === 'secretaria'`:
   - Se `dados.dentistaId` ausente → retornar `{ error: "Selecione o dentista responsável pelo orçamento." }`.
   - Validar que `dados.dentistaId` é um dentista `ativo=true`, `clinica_id=clinicId`,
     `role <> 'secretaria'`. Se não encontrar → `{ error: "Dentista selecionado inválido." }`.
   - Isso é defesa em profundidade: a RLS já bloqueia o caso inválido, mas sem essa checagem
     o erro que o usuário vê é a mensagem genérica do Postgres, não uma mensagem de produto.
3. Se `dentistaPerfil.role !== 'secretaria'`: comportamento atual inalterado
   (`dentistaAlvoId = dados.dentistaId ?? dentistaPerfil.id`).

**Erros esperados (retorno `{ error }`, não HTTP status — é Server Action):**
| Condição | Mensagem |
|----------|----------|
| Secretária sem `dentistaId` | "Selecione o dentista responsável pelo orçamento." |
| `dentistaId` não é dentista ativo da clínica | "Dentista selecionado inválido." |
| Falha no INSERT (RLS ou outro erro Postgres) | mensagem de erro já existente (`orcError?.message`) |

## Server Action — `criarProcedimentoRapido`

| Campo      | Valor |
|------------|-------|
| Auth       | required (via `requireClinicContext()`) |
| Rate limit | não |

**Validação nova (mesmo padrão de `criarOrcamento`):**
1. Buscar `dentistaPerfil` incluindo `role` (hoje só busca `id`).
2. Se `role === 'secretaria'`: exigir `dados.dentistaId`, validar que é dentista ativo,
   da mesma clínica, `role <> 'secretaria'` — mesma checagem, mesmas mensagens de erro
   de `criarOrcamento`.
3. `dentistaAlvoId = dados.dentistaId ?? dentistaPerfil.id` — insert usa
   `dentista_id: dentistaAlvoId` no lugar do atual `dentista_id: dentistaPerfil.id`.

**Erros esperados:** mesma tabela de `criarOrcamento` (mensagens idênticas — é a mesma
validação, reaproveitar função/helper interno se fizer sentido no código, não é obrigatório
pela spec).

## Database

### Migration nova: `supabase/migrations/20260715000000_098_orcamentos_secretaria_insert.sql`

```sql
-- Libera secretária para criar orçamentos (INSERT em orcamentos + orcamento_itens) e
-- para cadastrar procedimentos novos no catálogo (INSERT em procedimentos), sempre em
-- nome de um dentista real, ativo, não-secretária, da mesma clínica. Também fecha um
-- gap: a policy de orcamento_itens_insert_own exigia o.dentista_id = get_my_dentista_id(),
-- o que bloquearia os itens mesmo depois de liberar o orçamento em si.

create or replace function public.can_act_as_dentista(target_dentista_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select target_dentista_id = public.get_my_dentista_id()
    or (
      public.get_my_role() = 'secretaria'
      and exists (
        select 1 from public.dentistas d
        where d.id = target_dentista_id
          and d.clinica_id = public.get_my_clinica_id()
          and d.ativo = true
          and d.role <> 'secretaria'
      )
    )
$$;

revoke execute on function public.can_act_as_dentista(uuid) from public;
grant execute on function public.can_act_as_dentista(uuid) to authenticated;

drop policy if exists "orcamentos_insert_own" on public.orcamentos;
create policy "orcamentos_insert_own" on public.orcamentos for insert
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

drop policy if exists "orcamento_itens_insert_own" on public.orcamento_itens;
create policy "orcamento_itens_insert_own" on public.orcamento_itens for insert
  with check (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from orcamentos o
    where o.id = orcamento_itens.orcamento_id
      and can_act_as_dentista(o.dentista_id)
  ));

-- procedimentos_write_own (FOR ALL, já existente) não é tocada — permanece exigindo
-- is_clinic_dentista() no with check, o que preserva UPDATE/DELETE restrito ao próprio
-- dentista. Em vez de afrouxar essa policy combinada, uma policy adicional só de INSERT
-- libera a secretária, sem mexer em superfície de update/delete (blast radius menor).
drop policy if exists "procedimentos_insert_secretaria" on public.procedimentos;
create policy "procedimentos_insert_secretaria" on public.procedimentos for insert
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));
```

Não altera `orcamentos_update`/`orcamentos_delete_own`/`orcamento_itens_update`/
`orcamento_itens_delete_own`/`procedimentos_write_own` (UPDATE/DELETE) — fora de escopo
(secretária editar/excluir orçamento ou procedimento já existente não foi pedido;
`orcamentos_update` já usa `is_own_clinical_record`, que já libera secretária para
leitura/atualização de status, não é o gap desta spec).

## Componentes

### Árvore (arquivos tocados, não nova hierarquia)

```
orcamentos/page.tsx                  ← Server: só ajusta canEdit
orcamentos-client.tsx                ← handleCadastrarProcedimento passa dentistaId
paciente-detail-client.tsx           ← libera botão + passa props de dentista pro modal
  └─ modals/novo-orcamento-modal.tsx ← ganha seletor de dentista quando isSecretaria
```

### Responsabilidades

| Componente | Mudança |
|------------|---------|
| `orcamentos/page.tsx` | `canEdit` passa a considerar `role`, não só `plano` |
| `orcamentos-client.tsx` | `handleCadastrarProcedimento` (linha ~578) passa `dentistaId: isSecretaria ? novoOrcDentistaId : undefined` pra `criarProcedimentoRapido` — já tem `novoOrcDentistaId` no escopo (usado em `criarOrcamento` na mesma tela) |
| `paciente-detail-client.tsx` | remove gate `role !== 'secretaria'` do botão "Novo Orçamento"; `handleCriarOrcamento` passa `dentistaId` quando secretária; valida seleção antes de enviar; corrige `dentista_id` do objeto otimista; `handleCadastrarProcedimento` (linha ~930) passa `dentistaId: role === 'secretaria' ? novoOrcDentistaAlvoId : undefined` |
| `novo-orcamento-modal.tsx` | novo `<Select>` "Dentista responsável" visível só quando `isSecretaria`, mesmo padrão visual do seletor já existente em `orcamentos-client.tsx` |

### Mudanças pontuais nos arquivos existentes

**`src/app/dashboard/orcamentos/page.tsx:106`**
```diff
- const canEdit = !isUserOverride && dentista.plano === 'SOLO';
+ const canEdit = !isUserOverride && (dentista.plano === 'SOLO' || dentista.role === 'secretaria');
```

**`src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx:1457`**

Remover o gate `role !== 'secretaria' &&` por completo — o botão "Novo Orçamento" passa
a ser sempre visível (quem não tem permissão de `orcamentos` já nem chega nesta aba,
via `permissions.ts`).

**`handleCriarOrcamento` (mesmo arquivo, ~linha 944):**
- Adicionar validação: se `role === 'secretaria'` e nenhum dentista selecionado no modal
  → `setOrcError('Selecione o dentista responsável.')` e `return`, espelhando o padrão de
  `novoOrcPacienteId` em `orcamentos-client.tsx:601-604`.
- `criarOrcamento({ ..., dentistaId: role === 'secretaria' ? novoOrcDentistaAlvoId : undefined })`.
- Objeto otimista (linha ~985): `dentista_id: role === 'secretaria' ? novoOrcDentistaAlvoId : dentistaId`
  (hoje sempre usa `dentistaId`, que é o dentista da página/contexto — errado quando a
  secretária está criando para outro dentista).

**Novo estado em `paciente-detail-client.tsx`:** `novoOrcDentistaAlvoId` (reaproveita o
`dentistasClinica` já existente no componente, linha 208, como fonte da lista).

**`handleCadastrarProcedimento` (as duas telas):** se `isSecretaria`/`role==='secretaria'`
e nenhum dentista-alvo selecionado ainda no modal → bloquear com o mesmo erro de "selecione
o dentista" em vez de deixar `criarProcedimentoRapido` falhar na validação do server. Ordem
de UX: o seletor de dentista fica no topo do modal, então na prática ela sempre escolhe o
dentista antes de chegar nos itens/cadastro de procedimento — mas a validação client-side
tem que existir mesmo assim (defesa contra editar itens antes de selecionar).

## Invariantes

- [ ] Toda linha nova em `orcamentos` com `dentista_id` != dentista logado só pode ser
      criada por `role='secretaria'`, e o `dentista_id` alvo tem que pertencer à mesma
      clínica, estar ativo, e não ser outra secretária — garantido pela RLS
      (`can_write_orcamento_as`), não só pela UI.
- [ ] Nenhum orçamento fica sem itens por falha silenciosa de RLS — o INSERT de
      `orcamento_itens` usa a mesma função `can_act_as_dentista`, nunca diverge do
      INSERT de `orcamentos`.
- [ ] Dentista (`role='dentista'`) e admin continuam criando orçamento exatamente como
      hoje — zero mudança de comportamento pra eles (regressão proibida).
- [ ] Secretária nunca consegue criar orçamento para um dentista de outra clínica, nem
      para si mesma como "dentista responsável" (RLS bloqueia `role='secretaria'` como alvo).
- [ ] Procedimento cadastrado pela secretária nasce sempre com `dentista_id` do dentista
      responsável selecionado — nunca com o `id` do perfil dela. Preço/nome continuam
      isolados por dentista (nenhum catálogo compartilhado é criado por esta spec).
- [ ] Secretária não consegue UPDATE/DELETE de procedimento existente de nenhum dentista
      (fora de escopo — `procedimentos_write_own` continua exigindo `is_clinic_dentista()`
      pra esses comandos; só o INSERT foi liberado via policy nova).

## Gates de aceite

- [ ] Login como secretária → `/dashboard/orcamentos` → botão "Novo Orçamento" visível
      independente do `plano` da clínica.
- [ ] Secretária cria orçamento em `/dashboard/orcamentos` selecionando um dentista da
      clínica → sucesso, orçamento aparece na lista com itens e dentista corretos.
- [ ] Secretária cria orçamento pelo perfil do paciente, seleciona dentista no modal →
      sucesso, mesmo resultado.
- [ ] Secretária tenta criar sem selecionar dentista (nas duas telas) → erro de validação
      client-side, nenhuma chamada de rede.
- [ ] Query manual (`select count(*) from orcamentos o left join orcamento_itens oi on
      oi.orcamento_id = o.id where oi.id is null and o.created_at > <momento do teste>`)
      confirma zero orçamentos órfãos criados durante o teste.
- [ ] Login como dentista (`role='dentista'`) → cria orçamento normalmente, sem seletor
      de dentista, sem regressão.
- [ ] Tentativa via SQL editor de INSERT em `orcamentos` com `dentista_id` de outra
      clínica, autenticado como secretária → bloqueado pela RLS (opcional, teste manual).
- [ ] Secretária, com dentista já selecionado no modal, digita um procedimento novo
      (sem match no catálogo) e clica "cadastrar" → sucesso, procedimento aparece
      vinculado ao dentista selecionado, com o preço digitado.
- [ ] Conferir no banco (`select dentista_id from procedimentos where nome = '<nome do
      teste>'`) que o `dentista_id` gravado é o do dentista selecionado, não o da
      secretária.
- [ ] Secretária sem dentista selecionado tenta cadastrar procedimento → bloqueado
      client-side, mesma mensagem do bloqueio de orçamento.
