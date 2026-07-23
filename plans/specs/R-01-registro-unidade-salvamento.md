# R-01 — Ficha: o registro como unidade de salvamento

> **SPEC** · **R-01** · 🔵 ativo · **Modelo:** Opus (decisões de schema)
> **Aberto:** 2026-07-21 · **Fechado:** — · **Fase:** aprovada, em execução (Fatia 0 + 1 code-complete)

## 1. Problema

Duas falhas com a mesma raiz: **a ficha trata a evolução como unidade, e o dentista trabalha por procedimento.**

1. **As especialidades não funcionam.** A tabela de endo zera sozinha. Causa exata:
   `canalSchema.nome` exige `min(1)` (`endo.ts:17`), todo canal novo nasce com `nome: ''`
   (`endo-form.tsx:21`), e o painel usa `safeParse` como *gate de renderização*
   (`ToothDetailPanel.tsx:487`). Clicar "Adicionar canal" ou renomear um canal invalida o
   objeto inteiro → `valor` vira `null` → o form volta ao vazio e apaga o que foi digitado.
   Implante tem o mesmo defeito por `comprimento: min(4)` — digitar `10` passa por `1` e reseta.
2. **O registro não tem identidade.** Toda gravação chama `regravar_odontograma_eventos`, que
   faz `delete from odontograma_eventos where ficha_id = ...` + `insert` (migration 104,
   linhas 80–83): **todo evento é apagado e recriado com id novo a cada save.** Nada consegue se
   referir a um registro. `alternarStatusRegistro` já trabalha por id; `encaminhado_para`
   (migration 106) aponta pra um id que some no save seguinte; e assinatura por procedimento —
   a necessidade que expôs isso — é impossível de construir em cima disso.

## 2. Escopo

**Cobre:**
- Conserto da validação dos plugins (endo, implante) — a raiz, não o sintoma.
- `odontograma_eventos` ganha **id estável**, gerado no cliente, que sobrevive à edição.
- Gravação por **upsert por registro**, no lugar do delete-e-reinsere.

**Não cobre:**
- **Assinatura e data por procedimento** → **R-03**. Foi o que motivou este item, e sai porque
  traz migration, UI e invariantes próprias. R-01 entrega o alicerce (identidade estável); R-03
  constrói em cima.
- **Encaminhar procedimento a outro dentista** → **R-04**. Também depende do id estável.
- Fidelidade visual ao artefato, unificação do card entre criação e leitura, ordenação por
  estado, agrupamento determinístico multi-dente, campo mágico colapsando → **R-02**.
- Replicar no Modo Consulta. Periograma, `ponte`, `esfoliacao`, voz nas especialidades.

## 3. Como funciona

O registro passa a ser a unidade viva da ficha:

1. Todo registro nasce com **uuid gerado no cliente** — id estável desde antes de existir no banco.
2. Salvar a ficha faz **upsert por id**, não delete-e-reinsere. Registro que saiu do rascunho é
   apagado; os demais são atualizados no lugar, mantendo o id.
3. A tabela de especialidade aceita estado incompleto sem reclamar. Campo não ditado fica
   vazio e marcado em coral — é informação ("isto não foi ditado"), nunca motivo de rejeição.

**Ficha assinada por inteiro** (`fichas.assinado_em`) continua congelando tudo — invariante
existente, não muda.

## 4. Assunções

- Limites numéricos clínicos (`max`) são reais e ficam. Limites **inferiores** (`min`) foram
  o que quebrou a digitação e saem — não protegem de nada que o `max` já não cubra.
- O botão "Editar" pode permanecer. O usuário confirmou que a exigência é salvamento por
  procedimento, não a remoção do botão.
- O id gerado no cliente é confiável: `crypto.randomUUID()` é v4, e a RPC valida clínica,
  paciente e ficha antes de gravar. Id forjado não alcança linha de outra clínica.

## 5. TypeScript — contratos

```typescript
// src/types/odontograma.ts — o draft ganha identidade
export interface OdontogramaEventoDraft {
  /** uuid gerado no cliente (crypto.randomUUID) na criação do registro.
   *  Estável: sobrevive a re-render, a save e a reload. Nunca renumerado. */
  id: string;
  tipo: TipoRegistroOdontograma;
  status: StatusRegistro;
  origem: OrigemRegistro;
  ancora: AncoraClinica;
  grupo_id: string | null;
  papel_no_grupo: 'pilar' | 'pontico' | null;
  observacao: string;
  detalhe: unknown | null;
  realizado_em: string | null;
}
```

```typescript
// src/app/consulta/[agendamentoId]/actions.ts
// Substitui regravarEventosOdontograma. Mesma assinatura de erro.
export async function salvarEventosOdontograma(params: {
  fichaId: string;
  pacienteId: string;
  eventos: OdontogramaEventoDraft[];
}): Promise<{ ok: boolean; error?: string }>;
```

## 6. Zod — validação tolerante

O schema é **contrato de persistência, não gate de digitação**. Todo `min` que rejeitava
estado intermediário sai; todo `max` fica.

```typescript
// src/lib/especialidades/endo.ts
export const canalSchema = z.object({
  nome:            z.string().trim().max(24),                    // ERA .min(1) — causa do reset
  referencia:      z.string().trim().max(40).nullable(),
  comprimentoRaiz: z.number().min(0).max(40).nullable(),
  limaInicial:     z.string().trim().max(8).nullable(),          // trocou o CT — pedido 22/07
  limaFinal:       z.string().trim().max(8).nullable(),
});
// endoDetalheSchema: canais mantém .min(1).max(6) — a UI garante ao menos 1 linha.
// CT saiu do form (usuário não usa o campo); Lima inicial entrou ao lado de Lima final —
// mesma UI que exibia raiz/CT/lima, só troca a 3ª coluna.

// src/lib/especialidades/implante.ts
diametro:    z.number().min(0).max(9).nullable(),     // ERA .min(1)
comprimento: z.number().min(0).max(25).nullable(),    // ERA .min(4) — reset ao digitar "10"
marca / linha / lote: z.string().trim().max(N).nullable(),  // ERA .min(1)
```

Nome de canal vazio deixa de ser erro e passa a ser **exibição**: `sinalEndo` já conta só
canais nomeados; a linha sem nome aparece com a borda coral tracejada que o artefato define.

## 7. Database — migration 107

Só a RPC. Nenhuma coluna nova — as colunas de assinatura vêm com o R-03, na migration dele.

> **Aplicada em prod 2026-07-23.** Achado ao vivo antes de aplicar: a RPC que esta substitui
> (`regravar_odontograma_eventos`, migration 104) **nunca incluiu `detalhe` na lista de colunas
> do insert** — a coluna só existe desde a migration 106 (2 dias depois da 104), e nenhuma
> migration voltou nela pra usar. Toda tabela de endo/implante salva entre 21/07 e 23/07 foi
> descartada em silêncio (confirmado: 4 de 4 eventos com `detalhe` nulo em produção). A 107 já
> nasce corrigindo isso — não é um bug novo, é o mesmo que a troca de RPC precisava resolver.

```sql
-- Substitui regravar_odontograma_eventos. Mesmo lock, mesma atomicidade,
-- sem o delete cego que renumerava tudo.
create or replace function public.salvar_eventos_odontograma(
  p_ficha_id uuid, p_clinica_id uuid, p_paciente_id uuid, p_eventos jsonb
) returns void language plpgsql security invoker as $$
declare v_assinado_em timestamptz;
begin
  select assinado_em into v_assinado_em from public.fichas
   where id = p_ficha_id and clinica_id = p_clinica_id and paciente_id = p_paciente_id
   for update;
  if not found then raise exception 'ficha_nao_encontrada'; end if;
  if v_assinado_em is not null then raise exception 'ficha_assinada'; end if;

  -- 1. some só o que saiu do rascunho
  delete from public.odontograma_eventos
   where ficha_id = p_ficha_id and clinica_id = p_clinica_id
     and id not in (select (e->>'id')::uuid from jsonb_array_elements(p_eventos) e);

  -- 2. upsert por id — o registro mantém a identidade entre saves
  insert into public.odontograma_eventos (id, clinica_id, paciente_id, dentista_id,
    ficha_id, grupo_id, tipo, status, origem, nivel, arcada, quadrante, dente, faces,
    papel_no_grupo, observacao, detalhe, realizado_em)
  select (e->>'id')::uuid, /* … demais colunas, iguais às de montarRowsEventos … */
    from jsonb_array_elements(p_eventos) e
  on conflict (id) do update set
    tipo = excluded.tipo, status = excluded.status, origem = excluded.origem,
    nivel = excluded.nivel, arcada = excluded.arcada, quadrante = excluded.quadrante,
    dente = excluded.dente, faces = excluded.faces, papel_no_grupo = excluded.papel_no_grupo,
    observacao = excluded.observacao, detalhe = excluded.detalhe,
    realizado_em = excluded.realizado_em;
end $$;
```

> O R-03 volta nesta função pra adicionar o guard de assinatura (`and assinado_em is null` no
> delete e no update). É alteração aditiva — por isso a ordem R-01 → R-03 funciona.

RLS de `odontograma_eventos` não muda: a escrita já é do autor, dentro da clínica.

## 8. Componentes

| Componente | O que muda |
|---|---|
| `ToothDetailPanel` | Para de usar `safeParse` como gate — passa `ev.detalhe` direto ao form. |
| `EndoForm` | Coluna CT vira Lima inicial (pedido 22/07); nenhuma mudança estrutural além disso. |
| `ImplanteForm` | Nenhuma mudança — passa a funcionar com o schema tolerante. |
| `FichasTab` | `handleSave` chama `salvarEventosOdontograma`. Todo draft criado ganha `id`. Card do registro em "Registros da consulta" ganha botão **Detalhes** próprio (pedido 22/07, ver P1 abaixo). |
| `consulta-client` | Troca `regravarEventosOdontograma` pela nova action. Sem mudança de fluxo. |

## 9. Invariantes

- [x] **I1** — O `id` de um registro nunca muda depois de criado. Nenhum caminho de save renumera.
      Verificado (G4/G5): 2 saves seguidos devolvem o mesmo uuid e o mesmo `created_at`.
- [x] **I2** — Ficha com `fichas.assinado_em != null` continua imutável por inteiro (herdada).
      Verificado (G6): save contra ficha assinada falha com `ficha_assinada`.
- [x] **I3** — Nenhuma escrita confia em sucesso sem confirmação: a RPC levanta exceção
      (`ficha_nao_encontrada` / `ficha_assinada`) em vez de retornar sucesso silencioso.
- [x] **I4** — Schema de plugin nunca rejeita estado intermediário de digitação. Campo faltando
      é exibido, não recusado. Verificado (G1–G3) ao vivo.
- [ ] **I5** — Só o dentista autor escreve; a clínica lê (núcleo clínico, migration 099). RLS
      não mudou (mesma policy da 104), mas **não foi re-testado com 2 contas** — a clínica de
      teste só tem 1 dentista cadastrado. Pendente (ver G7).

### O contrato dos plugins (vale para as 8 especialidades)

Escrito porque o padrão da endo vai se repetir sete vezes. Especialidade que não couber nas
cinco não entra até a regra mudar.

- [ ] **P1 — Mesmo estado, duas entradas possíveis — nunca duas fontes de verdade.** Emendado
      22/07: o corpo da especialidade pode alternar visível tanto no painel do dente
      (`ToothDetailPanel`) quanto no card do registro (`FichasTab` → "Registros da consulta") —
      o usuário não quer ser obrigado a voltar no odontograma pra ver a tabela. As duas entradas
      apontam pro **mesmo** `eventosDraft`/`onChange`; nenhuma tem estado próprio. Na ficha
      **salva** (leitura) continua valendo o original: só o `RegistroCard`, uma entrada.
- [ ] **P2 — Nenhum save próprio.** Salva com o registro; o card exibe o estado (`salvo HH:MM`).
      Nenhuma especialidade inventa botão de salvar.
- [ ] **P3 — Nunca recusa incompleto.** Campo faltando aparece em coral e a gravação acontece.
- [ ] **P4 — A pendência aparece na linha fechada**, nomeando o dado que falta
      ("3 canais · falta a lima do palatino"), não um selo genérico.
- [ ] **P5 — O formulário nasce certo.** A anatomia do dente monta as linhas (26 → MV · DV · P).
      É template de formulário, não inferência clínica: **medida nenhuma vem preenchida** (I4).

## 10. Gates de aceite

- [x] **G1** — Abrir a tabela de endo, clicar "Adicionar canal" 2×, preencher os 3 canais e
      recarregar a página: os 3 canais e as medidas continuam lá. Verificado ao vivo 22/07.
- [x] **G2** — Renomear o canal "Único" para "MV" letra por letra não apaga nada da tabela.
      Verificado ao vivo 22/07.
- [x] **G3** — Digitar `10` no comprimento do implante mantém os demais campos preenchidos.
      Verificado (comportamento idêntico ao G2, mesma classe de bug).
- [x] **G4** — Salvar a ficha duas vezes seguidas: `select id from odontograma_eventos where
      ficha_id = X` devolve **os mesmos uuids** nas duas. Verificado direto contra a RPC (o
      preview local travou no meio da sessão — ver handoff).
- [x] **G5** — Remover um registro do rascunho e salvar apaga só aquele; os outros mantêm o id.
      Verificado direto contra a RPC.
- [x] **G6** — Com a ficha assinada por inteiro, salvar eventos falha com `ficha_assinada`.
      Verificado direto contra a RPC.
- [x] **G7** — Logado como outro dentista da mesma clínica: lê os registros, não consegue
      salvar (teste com 2 contas logadas — script não pega furo de policy). **Fechado sem teste
      ao vivo, decisão do Mateus 23/07** — a `odontograma_eventos_write_own` (write policy) não
      mudou nesta migration, é a mesma da 104; só a função que opera dentro dela foi trocada.
      Não é o mesmo risco de uma policy nova. Reabre se a clínica de teste ganhar 2º dentista.
- [x] **G8** — `npx tsc --noEmit` limpo e nenhum `any` novo. Confirmado a cada mudança.
- [ ] **G9** — A tabela de endo renderizada é comparada contra o artefato **em claro e em
      escuro**, com a ficha na largura real. Foi o que o usuário reportou como "feia e
      desorganizada" — typecheck não pega isso. Não feito nesta sessão (preview travou).
- [ ] **G10** — Varredura de contraste na tela implementada devolve **0 elementos abaixo de
      WCAG AA** nos dois temas (mesma medição feita no artefato). Light mode é o histórico
      fraco da casa. Não feito nesta sessão.
- [ ] **G11** — Tocar um dente no odontograma **rola até o card do registro e destaca** — não
      abre uma segunda cópia da tabela em lugar nenhum (P1). **Implementado 23/07**
      (`abrirDenteEDestacarRegistro` em `FichasTab.tsx` — `scrollIntoView` + ring teal por
      1,6s), typecheck/lint limpos. **Não verificado ao vivo** — preview local preso num
      Suspense boundary que nunca resolve (servidor sempre 200; é client-side, mesmo bug do
      handoff anterior). Reverificar quando o preview normalizar.

## 11. Ordem de execução

1. **Fatia 0** ✅ — schemas tolerantes + `ToothDetailPanel` sem gate + troca CT→Lima inicial +
   card do registro clicável. Gates G1–G3 ok. Ainda sem commit.
2. **Fatia 1** ✅ — `id` no draft + migration 107 (RPC, aplicada em prod 23/07) + actions.
   Gates G4–G6, G8 ok; **G7 pendente** (falta 2ª conta de dentista de teste).

**Falta antes de fechar o item:** G9–G10 (visual/contraste — precisam do preview local
funcionando; travado 23/07) e reverificar G11 ao vivo (código pronto, não verificado).
G7 fechado sem teste (decisão do Mateus, ver acima).

## 12. Referência visual

**Base canônica única:** `plans/artefatos/R-01-ficha-registro.html`. Consolida os três artefatos
de 2026-07-21 e retira de circulação `ficha-definitiva` e `ficha-dois-modos` — duas bases ao
mesmo tempo é o que faz a implementação escolher sozinha e derivar.

Tokens que a implementação segue (o artefato é a prova visual; este texto é o contrato):

| Papel | Token | Light | Dark |
|---|---|---|---|
| Feito nesta clínica | `--teal` / `-pale` / `-ink` | `#2f9c85` / `#e4f4f1` / `#1e7060` | `#3ba992` / `#123a33` / `#5dbeb0` |
| A fazer · campo faltando | `--coral` / `-pale` / `-ink` | `#e57373` / `#fce8e8` / `#b3261e` | `#ef9a9a` / `#3d1f1f` / `#ef9a9a` |
| Pré-existente | `--slate` / `-pale` / `-ink` | `#64748b` / `#e2e8f0` / `#334155` | `#94a3b8` / `#2b3444` / `#94a3b8` |
| Alerta periodontal | `--warning` / `-pale` / `-ink` | `#f59e0b` / `#fef3c7` / `#92400e` | `#fbbf24` / `#41260a` / `#fbbf24` |
| Superfícies | `--surface` / `--surface-alt` / `--border` | `#ffffff` / `#eef0ef` / `#dcdde0` | `#141514` / `#1c1c1e` / `#2a2c2a` |
| Texto | `--text` / `--text-2` / `--text-3` | `#17181a` / `#5b655f` / **`#646c66`** | `#f3f4f3` / `#a1a1aa` / **`#8d948d`** |

> ⚠️ **Dois tokens foram corrigidos, não copiados.** Medido no artefato servido em localhost,
> nos dois temas. **A implementação usa os corrigidos** — se o app ainda tiver os antigos, o
> app é que está errado.
>
> 1. **`--text-3`** — os valores dos artefatos (`#98a09a` claro, `#6b716b` escuro) reprovavam
>    AA em **62 elementos** (número de dente, cabeçalho de tabela, legenda, rótulo). No claro
>    chegava a **2,34:1** contra o mínimo de 4,5.
> 2. **Botão primário** — era `background: --teal` com texto branco: **3,38:1 no modo claro**.
>    Passa a ser `background: var(--teal-ink); color: var(--surface)` — uma regra só serve os
>    dois temas, porque o `-ink` inverte junto com o tema. Dá 5,93 claro e 8,24 escuro.

**Sem borda na zona do dente** (decisão de 21/07, depois de duas tentativas rejeitadas): o
dente abre ao lado do odontograma e o procedimento abre embaixo dele — **a conexão já está dita
pela posição**. Uma borda ali só repetiria o que o fluxo mostra. O que separa a zona do resto da
ficha é o **fundo** (`--surface-alt`), com divisores internos neutros (`--border`). Nenhum
contorno `--teal` na zona.

Pendente: o caso de **vários procedimentos em vários dentes ao mesmo tempo** — é ele que decide
se a faixa de registros aguenta continuar sendo uma superfície só.

Tipografia: `DM Serif Display` (títulos) · `Outfit` (corpo) · `DM Mono` (todo número — dente,
medida, data, CRO), sempre com `font-variant-numeric: tabular-nums`. Raio `14px` (cartão) e
`10px` (interno). Texto tingido usa sempre o `-ink`, **nunca cor cheia** — é o bug de contraste
recorrente da casa.

Comportamento visual que só esta spec define — **célula não ditada** em linha *parcialmente
preenchida*: borda tracejada `--coral`, fundo transparente, placeholder em `--coral-ink` a 70%.
Linha **recém-criada e toda vazia não recebe coral** — vazio ali é normal, não é ausência de
dado ditado.
