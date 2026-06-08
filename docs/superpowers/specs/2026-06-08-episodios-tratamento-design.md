# Design — Episódios de Tratamento + Cards Clicáveis + Sync Ficha

**Data:** 2026-06-08  
**Status:** Aprovado  
**Escopo:** Perfil do paciente — FichasTab, PlanejamentoTab (Tratamento), Hero Strip

---

## Contexto

O perfil do paciente hoje tem três problemas:

1. **Cards do Hero Strip** não são clicáveis — exibem informação mas não levam a lugar nenhum.
2. **Sync duplo:** o dentista precisa marcar um procedimento como "concluído" na Ficha Clínica e novamente no Tratamento — trabalho duplicado.
3. **Fichas acumuladas sem estrutura:** com o tempo, uma lista plana de fichas perde o sentido clínico. Não é possível distinguir quais fichas pertencem a qual ciclo de tratamento.

---

## Objetivos

1. Tornar os cards do Hero Strip navegáveis.
2. Eliminar a dupla marcação — só o Tratamento controla status de procedimento.
3. Introduzir **Episódios de Tratamento**: agrupamento explícito e opcional de fichas sob um tratamento nomeado, com início, encerramento e histórico.

---

## Fora do Escopo

- Não altera o fluxo de orçamentos (orçamentos continuam vinculados a fichas, não a tratamentos).
- Não cria tela nova — tudo acontece dentro do perfil do paciente existente.
- Não obriga criação de tratamento — fichas avulsas continuam funcionando normalmente.

---

## 1. Schema

### 1.1 Nova tabela `tratamentos`

```sql
CREATE TABLE tratamentos (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id   uuid NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  paciente_id  uuid NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  nome         text,                              -- opcional (ex: "Faceta de Porcelana")
  status       text NOT NULL DEFAULT 'ativo'
               CHECK (status IN ('ativo', 'concluido')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz                        -- preenchido ao encerrar
);

ALTER TABLE tratamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dentista vê própria clínica"
  ON tratamentos FOR ALL
  USING (clinica_id = (SELECT clinica_id FROM dentistas WHERE id = auth.uid()));
```

### 1.2 Alteração em `fichas`

```sql
ALTER TABLE fichas
  ADD COLUMN tratamento_id uuid REFERENCES tratamentos(id) ON DELETE SET NULL;

CREATE INDEX idx_fichas_tratamento_id ON fichas(tratamento_id);
```

### Invariantes

- Um paciente pode ter **no máximo um** tratamento com `status = 'ativo'` por vez.
  - Enforced no client: antes de criar, verificar se existe ativo.
- `encerrado_em` só é preenchido quando `status = 'concluido'`.
- `fichas.tratamento_id` é nullable — fichas avulsas são perfeitamente válidas.

---

## 2. Episódios de Tratamento (FichasTab)

### 2.1 Iniciar Tratamento

**Entry point:** Botão proeminente "Iniciar Tratamento" no topo da aba Ficha Clínica, visível apenas quando não há tratamento ativo.

Quando há tratamento ativo: substitui por banner teal discreto:
```
● Tratamento ativo · "Nome do Tratamento" · desde 12 jan   [Encerrar]
```

**Modal "Iniciar Tratamento":**
- Campo texto: Nome (opcional, placeholder: *"Ex: Faceta de Porcelana, Ortodontia…"*)
- Lista de fichas existentes do paciente com checkbox (ordenadas por data desc)
- Botão "Iniciar Tratamento"

**Ação ao confirmar:**
```
1. INSERT INTO tratamentos (clinica_id, paciente_id, nome, status) VALUES (...)
2. UPDATE fichas SET tratamento_id = <novo_id> WHERE id IN (<selecionadas>)
3. Refresh local state
```

### 2.2 FichasTab — Estrutura Visual

```
┌─ TRATAMENTO ATIVO ──────────────────────────────────────────────────────┐
│  "Tratamento Ortodôntico"  ·  Desde 12 jan 2026                         │
│                                                                         │
│  [Ficha 1 — 12/01]  [Ficha 2 — 19/01]  [+ Adicionar ficha]            │
│                                                       [Encerrar ▸]     │
└─────────────────────────────────────────────────────────────────────────┘

┌─ FICHAS AVULSAS ────────────────────────────────────────────────────────┐
│  Fichas sem tratamento vinculado (listagem atual)                       │
└─────────────────────────────────────────────────────────────────────────┘

▼  HISTÓRICO DE TRATAMENTOS  (accordion colapsado por padrão)
   ├─ Tratamento 1 · Jan–Mar 2026 · 3 fichas · Concluído
   └─ Tratamento 2 · Abr 2026 · 1 ficha · Concluído
```

### 2.3 Adicionar ficha a tratamento ativo

- Botão "+ Adicionar ficha" dentro da seção do tratamento ativo
- Abre seletor com fichas avulsas existentes do paciente (não vinculadas a nenhum tratamento)
- Opção "Criar nova ficha já vinculada" → abre form de nova ficha com `tratamento_id` pré-preenchido

### 2.4 Encerrar Tratamento

- Botão "Encerrar" no banner/seção do tratamento ativo
- Diálogo de confirmação: *"Encerrar o tratamento '{nome}'? As fichas vinculadas serão mantidas no histórico."*
- Ação:
  ```
  UPDATE tratamentos SET status = 'concluido', encerrado_em = now() WHERE id = <id>
  ```
- O episódio passa para a seção Histórico (accordion)

### 2.5 Histórico

- Accordion colapsado por padrão no final da FichasTab
- Cada item exibe: nome do tratamento, período (created_at → encerrado_em), nº de fichas, badge "Concluído"
- Expandindo: lista as fichas daquele episódio (somente leitura do agrupamento — fichas ainda abrem normalmente)

---

## 3. Cards Clicáveis (Hero Strip)

| Card | Comportamento |
|---|---|
| **Próxima Consulta** | Div inteiro clicável → `handleTabChange('agenda')`. Já tem botões internos que previnem bubbling. |
| **Tratamento** | Div inteiro clicável → `handleTabChange('tratamento')`. `ChevronRight` discreto no canto superior direito. |
| **Pendências — Aguardando aprovação** | Badge vira `<button>` → `handleTabChange('orcamentos')` |
| **Pendências — Follow-up** | Sem mudança — já tem "Concluir" e "Adiar" |

**Implementação:** Wrapper `onClick` no `<div>` de cada card + `cursor-pointer`. Elementos internos com ação própria chamam `e.stopPropagation()`.

---

## 4. Sync Tratamento → Ficha (opção C)

### 4.1 FichasTab — remover controle de conclusão

- Remove o botão/checkbox de toggle "concluído" de cada procedimento listado na FichasTab
- Os procedimentos ficam em modo leitura apenas
- `handleToggleProcedimento` pode ser removido do componente

### 4.2 PlanejamentoTab — updateProcStatus com sync

Ao chamar `updateProcStatus(procId, newStatus)`:

**Se `newStatus === 'concluido'` e `planProc.fichaRef !== null`:**
```typescript
// fichaRef = "fichaId::dente::lineIndex"
const [fichaId, dente, lineIndex] = planProc.fichaRef.split('::');
const fichaKey = `${dente}_${lineIndex}`;

// Fetch procedimentos_concluidos atual
const { data } = await supabase
  .from('fichas')
  .select('procedimentos_concluidos')
  .eq('id', fichaId)
  .single();

const current: string[] = data?.procedimentos_concluidos ?? [];
if (!current.includes(fichaKey)) {
  await supabase
    .from('fichas')
    .update({ procedimentos_concluidos: [...current, fichaKey] })
    .eq('id', fichaId)
    .eq('clinica_id', clinicaId);
}
```

**Se `newStatus !== 'concluido'` e `planProc.fichaRef !== null` (desmarcar):**
```typescript
// Remove fichaKey do array procedimentos_concluidos
await supabase
  .from('fichas')
  .update({
    procedimentos_concluidos: current.filter(k => k !== fichaKey)
  })
  .eq('id', fichaId)
  .eq('clinica_id', clinicaId);
```

**Se `fichaRef === null`:** nenhum sync (procedimento adicionado manualmente no tratamento).

### 4.3 Erro handling

- Sync para ficha é **best-effort**: falha silenciosa com `console.warn` (não bloqueia a UI do tratamento)
- O status em `planejamento_procedimentos` sempre é atualizado normalmente

---

## 5. Componentes Afetados

| Arquivo | Tipo de mudança |
|---|---|
| `src/components/pacientes/FichasTab.tsx` | Major — adiciona zonas de episódio, remove toggle de conclusão |
| `src/components/pacientes/PlanejamentoTab.tsx` | Medium — `updateProcStatus` ganha sync com ficha |
| `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` | Small — cards clicáveis, passa tratamento ativo como prop |
| `src/app/api/` | New — endpoint ou server action para CRUD de `tratamentos` |
| Supabase | Migration — nova tabela + coluna em fichas |

---

## 6. Fluxo de Dados

```
Dentista abre perfil do paciente
  │
  ├─ GET tratamentos WHERE paciente_id AND status = 'ativo'  → tratamento ativo (ou null)
  ├─ GET fichas WHERE paciente_id (inclui tratamento_id)
  └─ GET tratamentos WHERE paciente_id AND status = 'concluido' → histórico
  
Inicia tratamento:
  INSERT tratamentos → UPDATE fichas (vincula)

Encerra tratamento:
  UPDATE tratamentos SET status='concluido', encerrado_em=now()

Marca procedimento como concluído (Tratamento tab):
  UPDATE planejamento_procedimentos SET status='concluido'
  → se fichaRef: UPDATE fichas SET procedimentos_concluidos = array_append(...)

Clica no card Tratamento:
  handleTabChange('tratamento')
```

---

## 7. Ordem de Implementação Sugerida

1. **Migration Supabase** — tabela `tratamentos` + coluna `fichas.tratamento_id`
2. **Server action** — `criarTratamento`, `encerrarTratamento`, `vincularFichas`
3. **Cards clicáveis** — mudança cirúrgica no Hero Strip
4. **Sync tratamento → ficha** — `updateProcStatus` no PlanejamentoTab
5. **FichasTab — episódios** — reorganizar layout em zonas + modal de criação + histórico

---

## 8. Não-Regressões a Verificar

- Fichas existentes (sem `tratamento_id`) continuam aparecendo normalmente
- Orçamentos não são afetados
- `planejamento_procedimentos` com `ficha_ref = null` não quebram o sync
- RLS em `tratamentos` isola por clínica
- Dark mode em todos os novos componentes
