# R-175 — Operação da secretária

**Fase:** execução.  
**Base visual:** Visão geral aprovada do R-164; não cria dashboard paralelo.

## Objetivo

Dar à secretária as filas operacionais da clínica e um atalho que prepara, mas
nunca envia sozinho, uma mensagem de WhatsApp.

## Escopo

- Mesma Visão geral do Meu Consultório, restrita a três filas: reativação,
  pagamentos vencidos e orçamentos pendentes.
- Orçamentos pendentes contém listas independentes de: atendimento concluído
  sem orçamento, orçamento enviado sem decisão e orçamento aprovado sem
  cobrança. Itens podem aparecer em somente uma lista por causa raiz.
- Modelos por clínica: `reativacao`, `cobranca` e `orcamento`; proprietário ou
  gestor pode editar texto com `{{nome_paciente}}` e `{{nome_clinica}}`.
- O botão abre `wa.me` com mensagem interpolada; a pessoa ainda confirma o
  envio no WhatsApp.
- Secretária não lê indicadores, repasses, saldo informado ou configuração de
  custos. Ela pode abrir o Financeiro da Clínica apenas para lançar entradas e
  saídas já previstas no R-174.

## Contrato de dados e segurança

`whatsapp_modelos_operacionais` possui `clinica_id`, tipo único, corpo,
autor e atualização. RLS fica habilitado e sem grants diretos; RPCs fazem
leitura e escrita após conferir clínica ativa e papel.

As listas usam sempre `clinica_id` da clínica ativa. Atendimento concluído usa
`agendamentos.status = 'completed'`; orçamento aprovado sem cobrança consulta
a ausência de `orcamento_cobrancas`; orçamento enviado sem decisão usa
`status = 'enviado'` e sete dias desde `enviado_em`.

## Aceite

1. Secretária de uma clínica vê as filas e lança caixa, mas não vê números de
   gestão nem dados de outra clínica.
2. Os três modelos são editáveis por gestão e substituem apenas os placeholders
   permitidos.
3. Um atendimento concluído sem orçamento, um orçamento enviado e um aprovado
   sem cobrança entram nas listas corretas.
4. WhatsApp recebe texto pronto e não há envio automático.
