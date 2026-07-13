# Spec Fase 1 · #3 — Identidade do DEX (unificação) + Motion

> **Status:** PRONTA para execução. Criada 2026-07-12.
> **Modelo:** **Sonnet 5** (`/model claude-sonnet-5`) — swaps mecânicos de componente + motion já brief'ado. **Gate obrigatório:** `design-review` no renderizado (dark+light) antes de fechar; consultar a skill `design-motion-principles` na parte de motion (regra 4 do CLAUDE.md).
> **Origem:** `roadmap-3-fases-2026-07.md` D + E1/E2 · lista do fundador #8 ("unificar o DEX, tem 2 designs") · `DESIGN-KL.md` §3a/§4 (motion diferido, agora liberado).
> **Escopo travado (12/07):** unificar no **DexMark existente** (não desenhar rosto novo). Motion fica em **E1+E2** — sem espalhar micro-interações (E3 adiado).

---

## 1. Problema

O DEX tem **três rostos diferentes** no app:
- `DexMark` (`src/components/dex/dex-mark.tsx`) — o **canônico**: SVG refinado, `shape` circle/squircle, expressões `neutro|pensando|feliz|atento`, motion + `prefers-reduced-motion`. Só o onboarding usa.
- `DexAvatar` (`src/components/ui/dex-avatar.tsx`) — círculo com olhos retangulares, implementação **paralela**. Usado no Modo Consulta.
- `DexMascot` (`src/components/onboarding/dex-mascot.tsx`) — quadrado antigo. Usado só no `dex-guide` (desligado na spec #1/A2).
- Além disso, o **widget do DEX usa o ícone genérico `Bot` do lucide** como rosto (`dex-widget.tsx:295,732`) — nem é o personagem.

Resultado: o "ajudante" muda de cara entre a consulta, o widget e o onboarding. O `DexMark` já foi feito pra ser o único (o próprio doc-comment diz "substitui DexFace e DexAvatar") — falta **propagar e deletar os rivais**.

**Confirmado (grep 12/07):** `dex-presence.tsx` e `dex-day-button.tsx` **não** renderizam rosto (indicador/stat), então ficam fora. `DexAvatar` só tem 2 usos (consulta); `DexMascot` só 1 (dex-guide).

---

## 2. D — Unificação (tudo vira DexMark)

### D1 — Modo Consulta
**Arquivo:** `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`.
- `:14` — remover `import { DexAvatar } from '@/components/ui/dex-avatar'`; importar `DexMark` de `@/components/dex/dex-mark`.
- `:542` `<DexAvatar size={32} />` → `<DexMark shape="circle" size={32} expression={isFormatando ? 'pensando' : 'neutro'} />` (E2 — ver §3).
- `:562` `<DexAvatar size={16} animated={isDetecting} />` → `<DexMark shape="circle" size={16} animated={isDetecting} expression={isDetecting ? 'pensando' : 'neutro'} />`.

### D2 — Widget do DEX
**Arquivo:** `src/components/layout/dex-widget.tsx`.
- `:295` (`<Bot className="w-5 h-5 text-white" />`, dentro do trigger/cabeçalho) → `<DexMark shape="circle" size={20} />`.
- `:732` (`<Bot className="w-4.5 h-4.5 text-white" />`) → `<DexMark shape="circle" size={18} />`.
- `:1008` (`<Bot className="w-3 h-3" />` — marcador minúsculo ao lado de uma mensagem): **opcional** — pode virar `<DexMark shape="circle" size={12} />` ou ficar como está (a 12px o rosto quase não lê). Decisão de execução; default = deixar, é decorativo.
- Remover o `Bot` do import do lucide **se** ficar órfão (confirmar no `tsc`).
- **Não** mexer na lógica do widget (1.103 linhas) — só o rosto. É swap visual, não refatoração.

### D3 — Deletar os rivais + manter compile
- `src/components/onboarding/dex-guide.tsx` (**desligado**, mas ainda compila): `:5` e `:35` usam `DexMascot`. Trocar o import e o uso por `DexMark` (`shape="squircle"`, tamanho equivalente ao mascote da cena) pra o build não quebrar ao deletar o mascote. Não reescrever o guide (é Fase 3) — só o swap do rosto.
- **Deletar** `src/components/ui/dex-avatar.tsx` (zero consumer após D1).
- **Deletar** `src/components/onboarding/dex-mascot.tsx` (zero consumer após D3).

### D4 — Gate visual
Mesma cara em toda superfície viva (consulta, widget, onboarding), dark/light, sem distorção de 12 a 96px. `design-review` confirma.

---

## 3. E — Motion (E1 + E2 apenas)

> **Regra 4 / frequency gate (DESIGN-KL):** uso diário = **sutil e rápido**, nunca bloqueia interação. Tudo aqui colapsa pra instantâneo com `prefers-reduced-motion` (o `DexMark` já respeita; o stagger precisa do mesmo guard). Consultar `design-motion-principles` antes de fechar.

### E2 — DexMark reage ao processamento (barato, alto valor)
As expressões já existem no componente — é só fiação de estado, feita junto do D1:
- Enquanto "Organizar com DEX" roda (`isFormatando` true) → rosto do cabeçalho (`:542`) em `pensando`.
- Detecção ao vivo de dentes (`isDetecting`) → rosto pequeno (`:562`) em `pensando`.
- Ao assentar a ficha estruturada (`evolucao` setado, `isFormatando` false) → beat de `feliz` por ~1–1.5s, depois `neutro`. (Estado local `justSettled` com `setTimeout`, ou derivar de `saved`/`evolucao`.)

### E1 — Moneyshot da estruturação (o "DEX encaixou cada peça")
**Onde:** o container dos cards de revisão em `consulta-client.tsx` — a seção "Confirmar evolução" que renderiza quando `evolucao` existe (blocos: queixa/anotações/procedimentos/conduta/alerta/retorno/dentes).
**O quê (DESIGN-KL §3a):** os blocos entram em **stagger** ~60–80ms cada, `opacity 0→1` + `translateY 8px→0`, easing `cubic-bezier(0.4,0,0.2,1)`, total < 500ms. Sensação de montagem peça-a-peça.
**Como (`motion-react`):** container `motion.div` com `variants` + `transition: { staggerChildren: 0.07 }`; cada bloco `motion.div` com variant `{ hidden: {opacity:0, y:8}, show: {opacity:1, y:0} }`. Guard `prefers-reduced-motion` → render direto sem variants.
**Só na consulta REAL e na demo** (é o aha, 1x/uso) — **não** replicar esse stagger em telas de uso repetido.

**Fora (E3 adiado):** micro-interações espalhadas (chips de status, modal de orçamento, hovers) — não nesta spec, pra não virar porta de AI-slop. Entram com brief próprio depois.

---

## 4. Invariantes
1. Existe **um** componente de rosto do DEX renderizado no app vivo: `DexMark`. `DexAvatar` e `DexMascot` deixam de existir.
2. Nenhuma lógica do widget/consulta muda — só o componente de rosto e a fiação de expressão.
3. `dex-guide` continua **desmontado** (spec #1/A2); só teve o import do rosto trocado pra compilar.
4. Todo motion respeita `prefers-reduced-motion`; nada bloqueia clique.
5. Stagger (E1) só em consulta/demo (1x), nunca em UI repetida.
6. `tsc` + `eslint` limpos; `design-review` aprova em dark e light.

---

## 5. Gates de aceite
- [ ] Consulta, widget e onboarding mostram o **mesmo** rosto (DexMark). O ícone `Bot` sumiu do widget.
- [ ] `grep -r "DexAvatar\|DexMascot\|dex-avatar\|dex-mascot" src` → zero (fora de git history).
- [ ] "Organizar com DEX": rosto vai a `pensando` e assenta em `feliz` quando a ficha aparece.
- [ ] Os blocos da ficha estruturada entram em stagger suave (< 500ms); com `prefers-reduced-motion` aparecem instantâneos.
- [ ] `design-review` sem apontamento de inconsistência de identidade; dark/light ok.

---

## 6. Ordem sugerida
D1 (consulta, já casa o E2) → D2 (widget) → D3 (swap dex-guide + deletar os 2 arquivos) → `tsc` verde → E1 (stagger) → `design-review` no renderizado (consulta + widget, dark/light) → ajustes.
