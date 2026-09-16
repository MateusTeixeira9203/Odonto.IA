# DESIGN.md — R-140e2 Materiais na ficha

> Gerado em 2026-09-15 · status: brief para aprovação visual
> Superfícies: seção Materiais da ficha e criação de kits no Estoque

## Direção

Extensão de produto do [brief R-140](R-140-prontuario-atendimento-DESIGN.md): SaaS B2B clínico,
modo claro/escuro e uso frequente pelo dentista. Não cria uma identidade de estoque dentro da ficha.
O percurso é único: escolher kit ou material → revisar linhas → confirmar a baixa.

## Hierarquia e comportamento visual

| Área | Conteúdo | Ação dominante |
|---|---|---|
| Ficha | resumo compacto de usos e pendências | `Revisar materiais` |
| Revisão | linhas com material, lote, quantidade e estado textual | `Confirmar baixa` |
| Estoque | lista de kits e composição versionada | `Novo kit` |

Aplicar um kit adiciona linhas revisáveis; nunca simula reserva ou saldo confirmado. Uma divergência
mostra texto, saldo e o aceite da própria linha. Correção abre revisão da linha, não altera história.

## Tokens e geometria

Usar somente `bg-surface`, `bg-surface-alt`, `border-border`, `text-text-primary`,
`text-text-secondary`, `text-teal-ink` e o verde existente para conclusão. Sem nova cor para estoque,
sem gradientes e sem cards de métrica. Lote e quantidade usam `font-mono`.

- Card de seção: `rounded-2xl border border-border bg-surface p-4`, como a lateral do Prontuário.
- Linha: mínimo 44 px, divisor interno; estado sempre texto e ícone, não apenas cor.
- Espaços: 4 / 8 / 12 / 16 px; no mobile as linhas ficam em coluna e o CTA fica acima do teclado.
- Sheet de revisão: 420–520 px no desktop e largura útil no mobile; restaura foco e scroll ao fechar.

## Estados e aprovação necessária

Vazio, carregando, sem acesso, pendente de baixa, confirmado, divergente, conflito e falha posterior
precisam de copy própria. O atendimento salvo permanece visível quando a baixa falhar.

Este brief está pronto para um artefato/protótipo de referência. Nenhuma tela nova é aprovada ainda.
