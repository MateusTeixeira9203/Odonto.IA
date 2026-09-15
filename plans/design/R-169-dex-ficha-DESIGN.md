# DESIGN.md — R169 Dex dentro da ficha

> 14/09/2026 · brief para implementação; artefato visual ainda não produzido/aprovado.
> Contrato funcional: [R169](../specs/R-169-dex-ficha-edicao-rapida.md).

## Direção e origem

SaaS odontológico, dentista atendendo; densidade compacta, leitura clara, ações no contexto.
Manter a identidade existente da Ficha/Dashboard/Meu Dia. Não reabrir paleta, fontes ou shell:
o usuário decidiu simplificar a interface atual e localizou o botão no cabeçalho de Procedimentos.
Estilo: interface de produto existente, sem ornamentação adicional.

## Composição definida

Desktop: título **Procedimentos** à esquerda; **Adicionar procedimentos** e **Coletar assinatura**
à direita, nessa ordem. Adicionar é a ação principal da seção; assinatura permanece secundária.
Não mover os procedimentos para outra aba nem exigir abrir Meu Dia.

Clique expande o painel imediatamente abaixo desse cabeçalho, antes da lista. Uma coluna:
campo de texto/voz → Organizar com Dex → revisão dos itens novos → Adicionar mais/Descartar → Adicionar à ficha.
O campo continua disponível para a próxima entrada; rascunhos anteriores permanecem visíveis.
O painel não traz odontograma, seletor de consulta, dados cadastrais ou resumo financeiro completo.
Metadados de situação/região aparecem na revisão; não adicionar um formulário manual paralelo.

Editor de item: campo **Nome do procedimento** primeiro, **Observação** depois; detalhes técnicos
existentes a seguir. Salvar/Cancelar pertencem ao item. Não abrir página ou modal de consulta.

Mobile: título em linha própria; Adicionar e Assinatura quebram para a próxima linha conforme
espaço, sem esconder o primeiro em menu. Painel/lista com largura disponível; ações na ordem do
conteúdo e fora da cobertura da barra inferior/teclado.

## Tokens canônicos

Valores lidos em `src/app/globals.css` em 14/09; classes usam tokens, nunca literais no componente.
As áreas ao redor não mudam nesta entrega. Tokens semânticos do Button existente são reutilizados.

| Classe/token | Light | Dark |
|---|---|---|
| `bg-background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `bg-card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| `text-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `text-muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` |
| `border-border` | `#e2e2e5` | `#27272a` |
| `bg-primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `text-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `bg-warning-pale` | `#fef3c7` | `#451a03` |
| `text-warning-ink` | `#92400e` | `var(--color-warning)` → `#fbbf24` |
| `border-warning` | `#f59e0b` | `#fbbf24` |

- Interface: Outfit (`--font-sans`); manter DM Serif Display em títulos editoriais existentes,
  sem introduzi-la no input. Datas/dentes: DM Mono (`--font-mono`) quando já usado.
- Texto do campo: 16 px; corpo/controles: 14 px; metadados: 12 px.
- Espaçamento: 8 px entre ações, 12 px entre campos, 16 px painel desktop/mobile.
- Controles: `rounded-lg` (10 px no tema atual); painel `rounded-xl` (14 px); borda de 1 px.
- Alvos interativos: mínimo 44 px de altura; ícone Plus 16 px com texto visível.
- Campo inicial: mínimo 96 px, crescimento vertical; sem largura/altura rígida que corte texto.
- Uma borda no painel; sem empilhar cards decorativos nem criar outra paleta de status.

## Movimento, foco e feedback

- DexLoader durante IA. Sem “Identificando”, chips preliminares ou texto de progresso inventado.
- Expansão/realce sutil até 180 ms; reduced-motion remove animação/scroll suave.
- Ao Organizar, rolar apenas ao primeiro card novo, com margem para cabeçalho/barra fixa.
  Marcar o lote com mensagem curta e `aria-live`; não roubar foco durante digitação/gravação.
- Depois de salvar, mostrar os novos itens na ficha e deixar **Adicionar mais** junto do resultado
  quando o campo tiver saído da viewport. Essa ação volta ao mesmo campo, não cria outro painel.
- Nome/região/situação nunca dependem só de cor; erro junto ao campo preserva o conteúdo.

## Orçamento dentro da ficha

Aplicar somente à ação de orçamento da ficha aberta. A visão geral do prontuário, o histórico,
Meu Dia e a aba geral de orçamentos conservam sua apresentação. Estados/contagem/elegibilidade
são definidos em [R169b](../specs/R-169b-ficha-orcamento-ajustes.md); não duplicar essa lógica na UI.
Manter a ação visível mesmo com zero ou uma consulta histórica, sem depender da expansão do histórico.

- Pendência de inclusão: **Atualizar orçamento · N**, fundo `bg-warning-pale`, texto
  `text-warning-ink`, borda `border-warning`. Texto/contador explicam a ação sem depender da cor.
  Nome acessível esclarece: “N procedimentos da ficha disponíveis para adicionar ao orçamento”.
- Um pulso suave de 600 ms na camada de realce, sem reduzir legibilidade do texto nem mover layout.
  Ocorre uma vez ao detectar IDs elegíveis novos na sessão; guardar IDs já sinalizados por ficha.
  Renders, abertura/fechamento e foco da aba não repetem o pulso. Sem loop ou respiração permanente.
  `prefers-reduced-motion: reduce` mantém somente o destaque estático. Cor permanece enquanto pendente.
- No orçamento aberto, aviso acima dos itens com nome/região/data e ação de revisão; retirada ou
  renomeação usa aviso próprio, sem disparar o pulso de inclusão. Reusar espaçamento e tipografia do modal.

## Conferência e defaults

Posição do botão, painel na própria ficha e entrada por Dex: decisões do usuário.
Espaçamento, medidas, ordem secundária das ações e duração: propostas locais herdadas da interface;
validar em artefato antes do componente. Não há aprovação visual presumida pelos prints atuais.
Artefato inclui painel/editor, CTA âmbar e aviso do orçamento nos dois temas e em mobile/desktop; sem exploração de quatro
direções porque a direção existente e a localização já foram escolhidas.
Critério: parece parte da ficha atual e permite adicionar/editar sem mudança de contexto.

## Evolução clínica — ajuste do teste manual

O bloco conserva posição, cartão e tipografia. Editar evolução clínica substitui Complementar
evolução; editor inline com textarea, label e Salvar/Cancelar. Sem bancada, captura Dex ou
procedimentos nesse caminho. Contrato e exceções em R-169c-editar-evolucao.md.
