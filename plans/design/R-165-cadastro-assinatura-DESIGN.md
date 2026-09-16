# DESIGN — R-165 escolha comercial no cadastro

> **Status:** execução · **Data:** 2026-09-15

## Contexto e direção

Extensão do formulário de onboarding existente para um SaaS clínico B2B. Não cria uma tela nem
uma paleta nova: mantém o cartão centralizado, densidade balanceada e os controles de escolha já
usados no fluxo.

## Tokens e componentes

- Superfícies: `bg-surface`, `bg-surface-alt`, `border-border` e `text-text-primary` /
  `text-text-secondary`.
- Seleção: borda, anel e texto `teal`; erro textual `coral`, sem depender só de cor.
- Tipografia: `font-heading` no título; interface `font-sans`; preço em `font-mono`.
- Controles: opções em dois cartões com alvo mínimo de 44px, ordem igual à leitura e texto de
  consequência sob cada decisão.

## Conteúdo e comportamento

Na etapa existente, perguntar: atendimento próprio, modelo de gestão e pagador dos acessos.
Exibir R$200 por dentista, distinguir recepção incluída de cobertura clínica e esconder CRO/
especialidades quando não há atendimento. A confirmação só registra a escolha como pendente de
checkout; não sugere acesso ou cobrança confirmados.
