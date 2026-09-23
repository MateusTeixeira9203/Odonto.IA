# R-172 — Estoque manual e kits no banco principal

> **SPEC** · **R-172** · 🔵 em execução
> **Base visual:** artefatos aprovados R-140e1 / R-140e2 · **Data:** 2026-09-23

## Escopo

Disponibilizar estoque manual para teste nas clínicas de teste do banco principal, sem migrar ou
alterar materiais de clínicas reais. O módulo fica dentro de **Meu Consultório** para dentistas e
de **Minha Clínica** para proprietário ou gestor não clínico.

## Fluxo

1. Pessoa autorizada cadastra material consumível da clínica ou do próprio dentista.
2. Recebimento cria ou usa lote; saldo é derivado dos movimentos, nunca salvo em coluna mutável.
3. Consumo, descarte, contagem e correção mantêm fatos imutáveis e auditoria.
4. Um kit versionado reúne materiais; a ficha declara o que foi usado e confirma a baixa depois
   de o atendimento existir. A confirmação registra dentista, paciente, data, lote e kit.
5. A ficha salva continua possível sem material. Falta de saldo é uma divergência explícita, sem
   apagar o dado clínico.

## Permissões

| Clínica | Quem administra material compartilhado |
|---|---|
| Colaborativa | Cada dentista ativo da clínica |
| Gerida | Proprietário responsável; membros recebem ações explícitas |

O dentista sempre trabalha no seu estoque pessoal. Proprietário tem visão e operação do estoque
compartilhado. Consultas e mutações passam exclusivamente por RPC autenticada; tabelas não têm
acesso direto para `authenticated`.

## Banco e rollout

- Migrations novas, aditivas e posteriores às R-159: `20260923120000` a `20260923120800`.
- Não reaplicar a migration antiga de catálogo: o catálogo atual tem 48 permissões e a versão
  anterior o reduziria.
- `estoque_ativo` inicia `false`; somente as clínicas de teste selecionadas recebem ativação.
- Nenhum dado de clínica existente é copiado, convertido ou excluído.
- Aplicar primeiro a estrutura, depois ativar as duas clínicas de teste escolhidas, e testar duas
  contas com escopos diferentes antes de qualquer liberação para outras clínicas.

## Entradas clínicas

- **Ficha já salva:** bloco “Materiais e documentos” permite selecionar kit ou material, lote e
  quantidade; a baixa fica ligada ao atendimento.
- **Meu Dia e novo registro:** são as próximas entradas da mesma operação. A seleção precisa
  aguardar a criação idempotente do atendimento antes da baixa; nunca cria consumo para rascunho
  abandonado.

## Fora desta entrega

- Instrumental reutilizável e ciclos de lavagem/esterilização.
- Ativos com serial, limite de uso e implantáveis.
- OCR de etiqueta, marketplace, compras e previsão de consumo.

## Aceite

- [x] TypeScript e lint dos arquivos alterados passam.
- [x] 35 testes unitários de contratos, acesso, operações e kits passam.
- [x] Catálogo SQL atual mantém paridade com o catálogo da aplicação.
- [ ] Migrations aplicadas no banco principal.
- [ ] Duas contas testam isolamento e permissões no preview.
- [ ] Usuário valida cadastro, entrada, baixa, ajuste, kit e ficha.
