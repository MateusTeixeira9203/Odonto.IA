# R-NN — Redesign: {Tela}

> **SPEC (redesign)** · **R-NN** · 🔵 ativo
> **Aberto:** YYYY-MM-DD · **Fechado:** — · **Fase:** debate | plano | contrato | aprovada

<!-- Variante de spec para mudança de APRESENTAÇÃO em tela existente.
     Feature nova usa templates/spec.md (types, API, schema).
     Campo vazio = o Claude preenche sozinho = o Claude inventa. Preencha. -->

## 0. Identificação

| | |
|---|---|
| **Tela / módulo** | |
| **Tipo** | redesign de tela existente · tela nova · ajuste pontual |
| **Rota** | `/…` |
| **Arquivos envolvidos** | `src/…` |

## 1. Estado atual

> Eu faço o inventário, **você confere**. Não altero nada nesta fase.

Inventário da tela — componentes de UI usados, cores/fontes/espaçamentos aplicados,
padrões repetidos vs. exceções, e onde a lógica está acoplada à apresentação.

**Resultado:**

**Sua conferência:**

## 2. O que NÃO pode mudar — trava de segurança

> A parte mais importante do documento. Marque tudo que é intocável.

- [ ] Nomes de campos e variáveis
- [ ] Funções e regras de negócio
- [ ] Chamadas de API / endpoints
- [ ] Estrutura do banco / modelo de dados
- [ ] Fluxo de navegação
- [ ] Outros:

> Nada marcado aqui é assumido como intocável por padrão: **apresentação muda, o resto não.**

## 3. O que eu quero

> **Escrito por VOCÊ, em português comum.** Esta seção eu não preencho — se eu escrever
> o que acho que você quer, o resto do documento vira ficção.

**Sensação pretendida:** *(ex: mais leve, mais profissional, menos poluído, mais denso)*

**Problemas concretos de hoje:**
1.
2.
3.

**Mudanças, item por item:**

| Elemento | Como está | Como quero |
|---|---|---|
| Cabeçalho | | |
| Blocos / seções | | |
| Tabelas | | |
| Formulários / campos | | |
| Botões e ações | | |
| Estados (vazio, erro, carregando) | | |

**Referências:** artefatos aprovados, telas que você gosta, prints — *descritos em texto*,
porque imagem não sobrevive à sessão.

## 4. Tokens — fonte única da verdade

> Se há artefato, extraia com a skill `artefato-visual` (JS no browser, não no olho).

| | |
|---|---|
| **Cores** | primária · secundária · sucesso · alerta · erro · neutros |
| **Tipografia** | família + escala (título, subtítulo, corpo, legenda) |
| **Espaçamento** | escala base (ex: 4 / 8 / 12 / 16 / 24 / 32) |
| **Raio de borda** | |
| **Sombras** | |
| **Tabelas** | altura de linha, zebrado, borda, cabeçalho fixo |
| **Arquivo onde vivem** | `src/app/globals.css` (ou onde for) |

## 5. Gates de aceite

- [ ] Nenhuma alteração fora do escopo do item 2
- [ ] Usa **exclusivamente** os tokens do item 4 — zero valor hard-coded
- [ ] Responsivo nas larguras que eu uso de verdade
- [ ] Estados de vazio / erro / carregando tratados
- [ ] Dark **e** light conferidos
- [ ] Diff revisado por mim, arquivo por arquivo

## 6. Fluxo de execução

```
Inventário → este briefing preenchido → protótipo em artefato → sua aprovação visual
   → código em UMA tela de referência → localhost → produção → replicar nas demais
```

**Uma tela primeiro, sempre.** Replicar antes de você aprovar a referência multiplica o erro.

## 7. Pós-entrega

- [ ] Diff revisado
- [ ] Testado em localhost
- [ ] Subido pra produção
- [ ] Tokens atualizados, se algum mudou
- [ ] Item fechado no `ROADMAP.md` e spec + artefato movidos pro `_arquivo/` *(ato atômico)*
