# Spec — Migration 106: `detalhe` de especialidade nos eventos

> **Modelo de execução:** Sonnet (contrato fechado, sem ambiguidade de design).
> **Status:** **APLICADA em prod 21/07/2026** — OK explícito do Mateus.
> **Origem:** pedido de 21/07 — "preciso que a tabela do endo, do implante e do perio apareçam".
> **Design de referência:** [`ficha-dois-modos-2026-07-21-artefato.html`](ficha-dois-modos-2026-07-21-artefato.html) §02 (três níveis) · [`DESIGN-ficha-a0.md`](DESIGN-ficha-a0.md) §4 (camada 3).

---

## 1. O problema

`odontograma_eventos` grava **o quê / onde / quando / quem**, mas não tem onde guardar o
**dado clínico da especialidade**. Consequência hoje, verificável:

| Especialidade | Aparece? | Motivo |
|---|---|---|
| Restauração | ✅ | faces já são coluna do evento |
| Orto | ✅ | migration 105 criou `fichas.orto_manutencao` |
| **Endodontia** | ❌ | tabela de canais não tem onde ser salva |
| **Implante** | ❌ (só o título) | marca/medidas não têm onde ser salvas |
| **Periodontia** | ❌ | nem campo, nem `tipo`, nem nível de âncora |

## 2. Escopo — o que entra e o que fica de fora

**Entra na 106** (aditivo, nullable, zero risco pra dado existente):

1. `odontograma_eventos.detalhe jsonb` — dado estruturado por especialidade
2. `tipo` CHECK ampliado — `exame_periodontal`, `profilaxia`, `raspagem`, `clareamento`, `fluor`
3. `nivel` CHECK ampliado — `'boca'` (exame de boca toda, profilaxia sem dente âncora)
4. `encaminhado_para uuid null` — de graça agora; evita uma segunda ida a prod

**NÃO entra na 106 — vai pra 107, com teste próprio:**

- **Assinatura por procedimento.** Exige tabela nova (`assinaturas`), coluna de referência no
  evento, alteração da RPC `regravar_odontograma_eventos` e **mudança da invariante #14**
  (hoje ficha assinada congela inteira). Mexer em imutabilidade legal no mesmo dia em que 5
  dentistas começam a testar é risco desnecessário. Fica pra depois do primeiro feedback.

## 3. Realidade de prazo — o que dá pra entregar hoje

A migration destrava as três, mas **a UI de cada uma tem custo diferente**. Sem isso
declarado, a promessa aos 5 dentistas nasce errada:

| Especialidade | Migration destrava | UI é viável hoje? |
|---|---|---|
| **Endodontia** | ✅ | ✅ tabela de 5 colunas, N linhas — o contrato de plugin já existe |
| **Implante** | ✅ | ✅ formulário de 8 campos |
| **Periodontia** | ⚠️ só a âncora (`tipo`/`nivel`) | ❌ **não** — o periograma é 6 sítios × 32 dentes com entrada por teclado e voz, cálculo de NIC e desenho da linha gengival. É a maior peça de todo o roadmap, não sai numa tarde |

**Recomendação:** entregar hoje **endo + implante**. Perio é diferente dos outros dois: suas
medidas **não vão no `detalhe` jsonb** — o roadmap A já havia decidido (§A2) que o periograma
precisa de tabelas satélite (série temporal comparável entre exames), então destravar o perio
de verdade é uma frente própria, não uma continuação desta migration. Ver §5.3 e o alerta
gravado no roadmap.

## 4. Schema

```sql
-- 106_detalhe_especialidade.sql

alter table public.odontograma_eventos
  add column if not exists detalhe jsonb,
  add column if not exists encaminhado_para uuid references public.dentistas(id) on delete set null;

comment on column public.odontograma_eventos.detalhe is
  'Dado clínico da especialidade, validado por Zod na aplicação (um schema por tipo).
   NULL quando o procedimento não tem dado estruturado. Nunca contém cor, rótulo ou
   qualquer coisa derivável — só o que o dentista mediu ou escolheu.';

comment on column public.odontograma_eventos.encaminhado_para is
  'Dentista a quem o procedimento PLANEJADO foi encaminhado. Não transfere autoria:
   a ficha continua do autor (núcleo clínico 3.1).';

-- tipo: vocabulário clínico cresce
alter table public.odontograma_eventos drop constraint if exists odontograma_eventos_tipo_check;
alter table public.odontograma_eventos add constraint odontograma_eventos_tipo_check check (tipo in (
  'carie_restauracao','exodontia','endodontia','lesao_periapical',
  'implante','coroa','ponte','selante','inclusao','esfoliacao',
  'fratura','pino_nucleo',
  -- 106:
  'exame_periodontal','profilaxia','raspagem','clareamento','fluor'
));

-- nivel: exame/procedimento de boca toda
alter table public.odontograma_eventos drop constraint if exists odontograma_eventos_nivel_check;
alter table public.odontograma_eventos add constraint odontograma_eventos_nivel_check
  check (nivel in ('boca','arcada','quadrante','dente','face'));

alter table public.odontograma_eventos drop constraint if exists odontograma_eventos_ancora_valida;
alter table public.odontograma_eventos add constraint odontograma_eventos_ancora_valida check (
  (nivel = 'boca'      and arcada is null and quadrante is null and dente is null) or
  (nivel = 'arcada'    and arcada is not null and quadrante is null and dente is null) or
  (nivel = 'quadrante' and quadrante is not null and dente is null) or
  (nivel = 'dente'     and dente is not null and faces = '{}') or
  (nivel = 'face'      and dente is not null and faces <> '{}')
);
```

**Sem índice GIN por ora.** Busca do tipo "todos com lima #40" ainda não é requisito; o índice
entra quando for, sem migration de dado.

## 5. Contratos TypeScript / Zod

Um schema por especialidade, no plugin correspondente (`src/lib/especialidades/*.ts`).
`detalhe` **nunca** é lido sem `safeParse` — dado de banco não é confiável por tipo.

### 5.1 Endodontia — `endo.ts`

```ts
export const CanalSchema = z.object({
  nome:             z.string().min(1).max(24),   // "MV", "DV", "P", "Único"
  referencia:       z.string().max(40).nullable(),  // "Cúspide MV"
  comprimentoRaiz:  z.number().min(0).max(40).nullable(),  // mm
  ct:               z.number().min(0).max(40).nullable(),  // comprimento de trabalho
  limaFinal:        z.string().max(8).nullable(),  // "#35"
});

export const EndoDetalheSchema = z.object({
  canais:     z.array(CanalSchema).min(1).max(6),
  obturacao:  z.string().max(60).nullable(),  // "condensação lateral"
  cimento:    z.string().max(60).nullable(),  // "AH Plus"
});
```

**Invariantes:** campo não ditado fica `null`, jamais inferido. CT sugerido = raiz − 1mm,
mas **o dentista decide** — a sugestão nunca preenche sozinha.
**Sinal (nível 1):** `"${canais.length} canais"`.

### 5.2 Implante — `implante.ts`

Campos pedidos pelo Mateus em 21/07 ("nome do implante que vai usar, algumas informações técnicas").
`lote` entra por rastreabilidade — implante tem recall, e o número do lote é o que permite
localizar o paciente afetado.

```ts
export const ImplanteDetalheSchema = z.object({
  marca:       z.string().max(40).nullable(),   // "Straumann", "Neodent"
  linha:       z.string().max(40).nullable(),   // "BLT", "Grand Morse"
  diametro:    z.number().min(1).max(9).nullable(),    // mm — 4.1
  comprimento: z.number().min(4).max(25).nullable(),   // mm — 10
  plataforma:  z.enum(['cone_morse','hexagono_externo','hexagono_interno','outro']).nullable(),
  torque:      z.number().min(0).max(80).nullable(),   // Ncm de inserção
  carga:       z.enum(['imediata','precoce','tardia']).nullable(),
  lote:        z.string().max(40).nullable(),
});
```

**Sinal (nível 1):** `"${diametro} × ${comprimento}"` quando ambos existem; senão a marca; senão nada.

### 5.3 Periodontia — âncora agora, medidas NÃO entram nesta migration

**Correção em relação à primeira versão desta spec:** o roadmap A (§A2, decisão anterior a
esta migration) já havia fixado que o periograma **não é JSONB no evento** — é série temporal
comparável entre exames, e isso exige tabelas satélite (`perio_exames` / `perio_medidas`,
especificadas na spec v3 §1.8). Um `PerioDetalheSchema` dentro de `detalhe` contradiria essa
decisão e criaria dois lugares pra guardar o mesmo dado. Corrigido aqui antes de virar código.

**O que a 106 entrega pro perio:** só a **âncora** — `tipo='exame_periodontal'`,
`nivel='boca'` agora é uma combinação válida (antes era rejeitada pela constraint). Isso deixa
o card "Exame periodontal" aparecer na ficha com data/autor, mas **sem tabela de medidas**.

**O que falta, e é grande:** as tabelas satélite, o motor determinístico (Web Speech +
teclado, zero LLM nos números — invariante herdada da Fatia C), o cálculo de NIC na leitura
(nunca persistido), e a UI de 192 células com avanço de cursor. Isso é a A2 do roadmap,
`Risco: ALTO`, com spec própria — **não sai desta migration nem desta sessão**. Ver o alerta
gravado em `roadmap-A-plugins-especialidade-2026-07-20.md` §A2.

**Sinal (nível 1), quando a A2 existir:** `"${n} bolsas ≥4mm"` — contagem de sítios com
PS ≥ 4. Pill âmbar.

### 5.4 Despacho

```ts
// registry.ts — o plugin decide seu próprio schema
export function parseDetalhe(tipo: TipoRegistroOdontograma, raw: unknown): unknown | null {
  const plugin = pluginPorId(tipo);
  if (!plugin?.detalheSchema) return null;
  const r = plugin.detalheSchema.safeParse(raw);
  return r.success ? r.data : null;   // detalhe corrompido degrada pra "sem tabela", nunca quebra a ficha
}
```

## 6. Gates de aceite

1. `npx tsc --noEmit` e `npx eslint src/` limpos
2. Evento de endo com 3 canais: salva → recarrega → tabela renderiza com os 3, lima vazia continua vazia
3. Evento de implante: salva → recarrega → sinal mostra `4.1 × 10`
4. Evento com `detalhe` corrompido (JSON à mão no banco): card renderiza **sem** a tabela, ficha não quebra
5. Evento antigo (`detalhe` NULL): renderiza igual a hoje — zero regressão
6. Ficha assinada continua recusando regravação (invariante #14 intacta nesta migration)
7. **Compartilhamento:** dentista A cria ficha com endo; dentista B lê a tabela e **não** consegue editar

## 7. O que esta migration NÃO resolve

- Periograma (UI) — próxima frente, a maior de todas
- Assinatura por procedimento — migration 107
- Interface de encaminhamento — a coluna existe, a UI não
- Perfil da região (profilaxia/raspagem à mão) — o `tipo` e o `nivel` agora permitem; a UI não existe
