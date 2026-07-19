# Spec Fase 1 · #2 — IA: precisão da estruturação

> **Status:** PRONTA para execução. Criada 2026-07-12.
> **Modelo:** **Opus 4.8** (`/model claude-opus-4-8`) pra C2 (redação do prompt) e C3 (desenho/leitura do eval set — julgamento clínico); **Sonnet 5** (`/model claude-sonnet-5`) pra C1 e C4 (código mecânico). Sugestão: abrir em Opus, escrever prompt+eval, descer pra Sonnet no backstop/rate-limit.
> **Origem:** `roadmap-3-fases-2026-07.md` C1+C2+C4 · `diagnostico-2026-07-12-tres-papeis.md` [B3] (canal do 26 sumiu do orçamento) · `spec-precisao-extracao-consulta.md` (contexto, não re-executar as frentes já feitas).
> **Decisão travada (fundador 12/07):** o **prompt carrega a regra**, o **código é a rede de segurança** com fallback genérico. C1 e C2 são duas metades do mesmo fix — não separar.

---

## 1. Problema (observado ao vivo em 12/07)

Mesma narrativa clínica, salva 2×, deu resultados diferentes:
- **Dente órfão:** `dentes_afetados: [26,14,15]` mas `dentes_observacoes: {"14":..., "15":...}` — **sem o 26** (o canal, procedimento principal). Como `fichaParaItens` e o progresso derivam de `dentes_observacoes`, o tratamento endodôntico **sumiu do orçamento e do progresso** (card mostrou "0/2" contando só as cáries).
- **Diagnóstico virou procedimento:** "Cárie oclusal" entrou em `procedimentos` (é achado, não intervenção — o procedimento é a restauração). Numa rodada, "pulpite irreversível" caiu fora das `anotacoes`.

**Estado do código:** `buildDentalContext()` já usa o `PROCEDIMENTOS_MAP` **inteiro** (o `.slice(0,15)` antigo já foi removido). O prompt de `formatar-evolucao` já manda criar `dentes_observacoes` **para cada sentinela** de arcada (`route.ts:71`) — mas **não** para dentes individuais. É essa lacuna que deixa o 26 órfão.

---

## 2. C2 — Prompt (a regra) · Opus

**Arquivo:** `src/app/api/dex/formatar-evolucao/route.ts` (prompt em `:42-79`).

### C2.1 — Observação obrigatória por dente (fecha o órfão)
Hoje (`:71`): *"Para CADA sentinela em dentes_afetados, crie também a entrada correspondente em dentes_observacoes..."*.
**Mudar para valer pra TODO dente**, individual ou sentinela:
> "Para CADA número em `dentes_afetados` (dente individual **ou** sentinela 97/98/99), crie a entrada correspondente em `dentes_observacoes` com o(s) procedimento(s) daquele dente/região, separados por `\n`. Nenhum dente em `dentes_afetados` pode ficar sem entrada em `dentes_observacoes` — se um dente foi citado, o que se fez nele tem que estar lá."

### C2.2 — Achado ≠ procedimento
Adicionar às regras do prompt (`:66-79`):
> "`procedimentos` lista **intervenções** (o que foi feito ou será feito: restauração, endodontia, exodontia…), **não achados/diagnósticos** (cárie, pulpite, fratura, retração são achados — vão em `anotacoes`/`queixa_principal`, nunca em `procedimentos`). Ex.: relato 'cárie oclusal no 14' → procedimento = 'Restauração com resina composta', não 'Cárie oclusal'."
> "O **diagnóstico/raciocínio clínico** (ex.: pulpite irreversível confirmada por teste) entra em `anotacoes` — não descartar."

### C2.3 — Dicionário: hint de achados (fonte única) · pode ser Sonnet
**Arquivo:** `src/lib/odonto-dictionary.ts` → `buildDentalContext()` (`:211`).
Adicionar um bloco curto ao contexto injetado, logo após `Procedimentos: ...`:
> `ACHADOS (não são procedimentos — descrevem o problema, não a intervenção): cárie, pulpite, necrose, fratura, mobilidade, retração gengival, abscesso, tártaro. Ao ver um achado, o procedimento é a intervenção correspondente (cárie→restauração, pulpite→endodontia).`
Fonte única — nada inline duplicado na rota.

---

## 3. C1 — Backstop determinístico (a rede) · Sonnet

**Arquivo:** `src/app/api/dex/formatar-evolucao/route.ts`, pós-processamento (depois do filtro `isValidFDI`, `:94-96`).

Depois de sanitizar `dentes_afetados` e `dentes_observacoes`, adicionar:
```ts
// Rede de segurança: nenhum dente detectado pode ficar sem observação (senão some do
// orçamento/progresso, que derivam de dentes_observacoes). O prompt (C2) já exige isso;
// aqui é o fallback caso o modelo escorregue. Rótulo genérico — o dentista revisa/edita
// na tela "Confirmar evolução" antes de salvar.
for (const dente of parsed.dentes_afetados) {
  const key = String(dente);
  if (!parsed.dentes_observacoes[key]?.trim()) {
    parsed.dentes_observacoes[key] = 'Procedimento a confirmar';
  }
}
```
**Por que rótulo genérico e não derivar de `procedimentos`:** `procedimentos` é uma lista plana (não sabe qual procedimento é de qual dente). Atribuir a lista inteira ao dente órfão marcaria errado. O genérico garante que o dente aparece **marcável** e o dentista corrige no review (a tela já mostra os campos como PENDENTE antes de salvar). Precisão real vem do C2; isto é só a rede.

**Invariante-chave:** todo dente em `dentes_afetados` tem entrada em `dentes_observacoes` ao fim da rota. **Sempre.**

---

## 4. C4 — Rate-limit no `sugerir-orcamento` · Sonnet

**Arquivo:** `src/app/api/sugerir-orcamento/route.ts`.
É a rota Gemini mais cara e a **única** rota de IA sem `withRateLimit` (as outras 11 têm). Um cliente bugado/malicioso queima cota Gemini à vontade.
**Mudança:** no topo do `POST` (`:22`), antes do `createClient()`:
```ts
const limited = await withRateLimit(req, 'sugerir-orcamento', 20, 60_000);
if (limited) return limited;
```
Import de `@/lib/rate-limit`. Mesmo limite do `formatar-evolucao` (20/60s).

---

## 5. C3 — Eval set de consistência (verificação) · Opus

**Problema:** a inconsistência entre rodadas só aparece rodando o mesmo input N vezes. Precisamos de régua objetiva **antes** de dar o prompt por bom.

**Artefato:** `plans/specs/eval/formatar-evolucao-casos.json` (ou `supabase/tests/`) — 5–8 narrativas reais (não sintéticas: pedir ao fundador áudios/relatos do teste) com o **esperado** por campo:
```json
{
  "id": "canal-26-caries-14-15",
  "texto": "Paciente com dor no vinte e seis, pulpite irreversível...",
  "espera": {
    "dentes_afetados_contem": [26, 14, 15],
    "dentes_observacoes_tem_chave": [26, 14, 15],
    "procedimentos_nao_contem_achado": ["cárie", "pulpite"],
    "anotacoes_contem": ["pulpite"]
  }
}
```
**Harness:** script Node (base: `scratchpad/qa/` da sessão 12/07) que roda cada caso **3×** contra `/api/dex/formatar-evolucao` (autenticado com a conta de teste) e afere:
- todo dente em `dentes_afetados` tem chave em `dentes_observacoes` (o fix C1/C2) — **3/3**;
- `procedimentos` não contém termo de achado;
- estabilidade: os campos-chave não variam entre as 3 rodadas.
**Gate:** rodar antes e depois do C1+C2; registrar o antes/depois no handoff. Vira teste de regressão de IA reutilizável.

---

## 6. Invariantes
1. A IA **não inventa** dente/procedimento/diagnóstico não dito (mantido do CLAUDE.md).
2. **Todo dente em `dentes_afetados` tem entrada em `dentes_observacoes`** ao fim da rota (C1, garantido em código).
3. `procedimentos` = intervenções; achados (cárie/pulpite) vão em `anotacoes`/`queixa`, nunca em `procedimentos`.
4. Dicionário é fonte única — zero cópia inline divergente.
5. `sugerir-orcamento` passa por `withRateLimit`.
6. Saída canônica continua o JSON tipado `EvolucaoFormatada`.

---

## 7. Gates de aceite
- [ ] Narrativa "canal no 26 + cárie no 14 e 15" → `dentes_observacoes` tem chave pra **26, 14 e 15**; o 26 aparece no modal de orçamento e no progresso.
- [ ] "Cárie oclusal" **não** aparece em `procedimentos` (aparece a restauração); "pulpite" aparece em `anotacoes`.
- [ ] Eval set (C3) roda 3× por caso: 100% dos dentes detectados marcáveis; sem achado em `procedimentos`; campos estáveis entre rodadas.
- [ ] `sugerir-orcamento` responde 429 ao estourar 20/60s.
- [ ] `tsc` + `eslint` limpos.

---

## 8. Fora de escopo (registrado)
- Trocar o modelo de estruturação (Llama→Gemini) — a spec-precisao deixou isso como gate "só se prompt+dicionário não bastarem". O eval set (C3) é quem decide se precisa; **não** trocar nesta spec.
- Vínculo extração↔catálogo (procedimento extraído casar com preço do catálogo) — não é dor marcada; o cadastro-na-hora (#7) cobre o caso do teste.
- Prompt do Whisper (`transcrever`) — coberto pela spec-precisao, sem regressão observada agora.
