# Spec — Organização dos eventos dentro da ficha

> **Status:** proposta — aguardando aprovação do Mateus.
> **Modelo de execução:** Sonnet (refactor mecânico, contrato fechado aqui).
> **Origem:** pedido de 21/07 — _"organizar isso de uma vez, principalmente os eventos dentro dela"_.
> **Não muda schema.** Nenhuma migration. Nada que o dentista veja muda de lugar — muda
> o que ele **lê** (a palavra do estado) e quanto código sustenta isso.

---

## 1. O mapa atual — todo lugar que toca em evento

### Criação — 3 caminhos previstos, 2 funcionando

| Caminho | Produz | Estado |
|---|---|---|
| **Dex** (`formatar-evolucao`) → `OdontogramaEventoInput` | evento completo | ✅ |
| **`ToothDetailPanel`** — face, raiz, 9 chips | evento por toque | ✅ |
| **Região** (chips Arcada / Q1–Q4 / Boca toda) | — | 🔴 **não cria evento nenhum**; só marca a seleção do modelo v2 legado |

### Persistência — 2 entradas, 1 montador compartilhado

| Entrada | Como grava |
|---|---|
| `salvarFichaConsulta` (Modo Consulta) | `insert` direto |
| `regravarEventosOdontograma` (ficha rápida) | RPC atômica `regravar_odontograma_eventos` |

✅ **Esta camada está sadia** — as duas passam por `montarRowsEventos`, uma função só.
Não mexer.

### Leitura — 2 caminhos

| Tela | Onde busca |
|---|---|
| Modo Consulta | server (`consulta/[agendamentoId]/page.tsx`) |
| Ficha / prontuário | client (`FichasTab.fetchFichas`) |

### Render — 4 componentes, 3 semânticas de agrupamento

| Componente | Agrupa por | Onde aparece |
|---|---|---|
| `tooth-group-list.tsx` | **dente** (1 card por dente, N linhas) | confirmação da consulta |
| `ToothDetailPanel.tsx` | — (lista os eventos de 1 dente) | painel do dente, nas duas telas |
| `FichasTab.gruposDraft` | **dente + tipo + status** | ficha em criação |
| `FichasTab.eventosParaCards` → `RegistroCard` | **dente + tipo + status** | ficha salva |

---

## 2. Os problemas — em número, não em opinião

### 2.1 A mesma regra escrita duas vezes, caractere por caractere

A chave de agrupamento aparece **idêntica** em dois lugares do mesmo arquivo:

```
FichasTab.tsx:264   ?? `m:${ev.ancora.dente ?? …}|${ev.tipo}|${ev.status}`
FichasTab.tsx:415   ?? `m:${ev.ancora.dente ?? …}|${ev.tipo}|${ev.status}`
```

Uma serve o rascunho, a outra a ficha salva. Mudar a regra de agrupamento exige lembrar
das duas — e a segunda foi escrita copiando a primeira.

### 2.2 O mesmo estado tem três nomes diferentes na tela

| Componente | Como chama `status: 'indicado'` |
|---|---|
| `tooth-group-list.tsx:30` | **"A fazer"** |
| `ToothDetailPanel.tsx:52` | **"a fazer"** (minúscula) |
| `registro-card.tsx:57` | **"Planejado"** |
| `FichasTab.tsx` (pill inline do rascunho) | **"Planejado"** |

O dentista dita um canal, vê **"A fazer"** na confirmação da consulta, **"a fazer"** ao abrir
o dente, e **"Planejado"** na ficha salva. É o mesmo dado. São três palavras.

### 2.3 O léxico visual está copiado 3–4 vezes

- `COR_TOKEN` (cor → var CSS): **3 cópias** — `tooth-group-list`, `ToothDetailPanel`, `Odontograma`
- `COR_TOKEN_INK` (cor → cor de texto AA): **2 cópias**
- mapa cor → classes da pílula: **2 cópias** (`registro-card` e inline no `FichasTab`)

Foi exatamente assim que o bug de contraste (cor cheia como texto) voltou depois de já ter
sido corrigido duas vezes: existe mais de um lugar pra errar.

### 2.4 ⚠️ O vocabulário divergiu em três camadas

Depois da migration 106 (aplicada hoje), os três níveis não concordam mais:

| Camada | Tipos | Níveis de âncora |
|---|---|---|
| **Banco** (CHECK da 106) | **17** | 5 — inclui `'boca'` |
| **TypeScript** (`types/odontograma.ts:70,14`) | 12 | 4 — sem `'boca'` |
| **Prompt do Dex** (`route.ts:78,140`) | 10 | 4 |

Consequências reais, não teóricas:
- Os 5 tipos novos (`exame_periodontal`, `profilaxia`, `raspagem`, `clareamento`, `fluor`) são
  **inalcançáveis**: o TS nem os conhece, o Dex não os emite, e não há UI manual.
- `nivel='boca'` idem — então o "card Boca" do artefato não tem como nascer.
- `ponte` e `esfoliacao` existem no banco **e** no TS, mas o prompt **proíbe explicitamente**
  ([route.ts:298](../../src/app/api/dex/formatar-evolucao/route.ts)).

---

## 3. O que esta spec propõe

Uma pasta nova, `src/lib/odontograma/`, com **uma fonte por conceito**. Nenhum componente
ganha lógica; todos passam a importar.

### 3.1 `vocabulario.ts` — o que existe

Move `TipoRegistroOdontograma`, `NivelAncora`, `TIPO_LABEL` pra cá e **sincroniza com o banco**:
os 17 tipos e os 5 níveis da migration 106.

```ts
/** Espelha o CHECK de odontograma_eventos.tipo (migration 106). */
export const TIPOS = [
  'carie_restauracao','exodontia','endodontia','lesao_periapical','implante','coroa',
  'ponte','selante','inclusao','esfoliacao','fratura','pino_nucleo',
  'exame_periodontal','profilaxia','raspagem','clareamento','fluor',
] as const;
export type TipoRegistroOdontograma = typeof TIPOS[number];

/** Tipos que o Dex PODE emitir hoje — subconjunto de TIPOS. */
export const TIPOS_EMITIVEIS_PELA_IA: readonly TipoRegistroOdontograma[] = [ … ];

/** Tipos sem dente âncora (nivel 'boca' ou 'arcada'). */
export const TIPOS_DE_REGIAO: readonly TipoRegistroOdontograma[] = [
  'profilaxia','raspagem','clareamento','fluor','exame_periodontal',
];
```

**Invariante:** o enum do prompt e o validador `TIPOS_FATIA_A` passam a **derivar** de
`TIPOS_EMITIVEIS_PELA_IA` — deixam de ser listas soltas digitadas à mão. É isso que impede a
divergência de voltar.

### 3.2 `estado.ts` — como o estado se chama e se pinta

Uma tabela só, e **uma palavra por estado**:

```ts
export const ESTADO = {
  coral: { rotulo: 'A fazer',      token: '--color-coral', ink: '--color-coral-ink' },
  teal:  { rotulo: 'Feito',        token: '--color-teal',  ink: '--color-teal-ink'  },
  slate: { rotulo: 'Pré-existente', token: '--color-slate', ink: '--color-slate-ink' },
} as const;
```

**Decisão de produto embutida:** adoto **"A fazer" / "Feito" / "Pré-existente"** — a linguagem
do dentista falando da boca, que é como o odontograma já rotula a legenda. "Planejado" some.

E um componente único `<EstadoPill cor={…} />` substituindo as 4 pílulas copiadas.

### 3.3 `agrupar.ts` — as duas semânticas, nomeadas

```ts
/** 1 card por procedimento: grupo_id, ou dente+tipo+status com faces unidas. */
export function agruparPorProcedimento(eventos): GrupoProcedimento[];

/** 1 card por dente, N linhas dentro. */
export function agruparPorDente(eventos): GrupoDente[];
```

**As duas continuam existindo** — não é bug ter as duas, é contexto diferente:
a confirmação da consulta revisa **dente a dente** (você confere o que o Dex ouviu);
a ficha salva lê **procedimento a procedimento** (fiscalização, 1 linha por registro).
O que era erro é cada tela ter **reimplementado** a sua.

### 3.4 `sinal.ts` — o nível 1 da densidade

Hoje o cálculo do sinal ("3 canais", "4.1 × 10") vive dentro do `ToothDetailPanel`.
Sai pra cá, e a ficha salva passa a mostrar o mesmo sinal — que é o que o artefato
[`ficha-dois-modos`](ficha-dois-modos-2026-07-21-artefato.html) §02 especifica e hoje só
metade das telas cumpre.

---

## 4. O que NÃO entra

- **Schema.** Nenhuma migration. A 106 está correta.
- **A camada de persistência.** `montarRowsEventos` já é compartilhada — não tocar.
- **Mudar a semântica de agrupamento de cada tela.** Consulta segue por dente, ficha por
  procedimento. Decisão já tomada em 21/07.
- **O buraco da região** (chips que não criam evento) — a spec deixa o vocabulário pronto
  (`TIPOS_DE_REGIAO`, `nivel='boca'`), mas a UI do perfil da região é frente própria.
- **Extractors de voz** (endo/implante) — frente própria, blocos 3 da §0 do roadmap.

---

## 5. Gates de aceite

1. `npx tsc --noEmit` e `npx eslint src/` limpos.
2. **Zero cópias:** `grep -c "COR_TOKEN = {"` em `src/` → **1**. Idem para o mapa de rótulo e
   para a chave de agrupamento.
3. **Uma palavra por estado:** o mesmo evento indicado mostra **"A fazer"** nas três telas
   (confirmação da consulta, painel do dente, ficha salva). Verificar ao vivo, não por leitura.
4. **Paridade de vocabulário:** o enum do prompt deriva de `TIPOS_EMITIVEIS_PELA_IA`; a lista
   literal em `route.ts` deixa de existir.
5. **Zero regressão visual:** ficha com eventos renderiza igual antes/depois (mesmos cards,
   mesmas cores) — só a palavra do estado muda.
6. **Dark mode + AA:** nenhuma cor cheia como texto (o `-ink` vem do `ESTADO`, não de string solta).

---

## 6. Por que fazer isto agora — e o argumento contra

**A favor:** as três próximas frentes da ficha (perfil da região, encaminhamento, periograma)
**todas** adicionam tipos, telas e pílulas de estado. Cada uma, no código de hoje, significa
tocar 4 lugares e ter 4 chances de divergir. O refactor se paga na primeira delas.

**Contra, e é honesto:** isto é **arrumação, não funcionalidade** — o dentista não ganha nada
que ele consiga apontar, exceto parar de ver três palavras para o mesmo estado. Numa semana
cuja meta é _"matar tudo do dentista"_, isso compete com trabalho que ele **veria**.

**Minha recomendação:** fazer **§3.1 (vocabulário) agora** — porque ele não é arrumação, é
**pré-requisito**: sem ele os tipos da 106 seguem inalcançáveis e o perfil da região não tem
onde nascer. O resto (§3.2–3.4) entra junto com a primeira frente que tocar esses arquivos,
não numa passada dedicada.
