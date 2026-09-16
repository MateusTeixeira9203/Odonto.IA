# R-169c — Exclusão explícita de ficha e orçamento

> **SPEC** · **R-169c** · 🔵 ativo
> **Aberto:** 2026-09-16 · **Fase:** contrato aprovado na conversa
> **Escopo:** Preview primeiro; produção somente após teste manual e autorização expressa.

## Problema

O comportamento atual depende da autoria da ficha ou do orçamento. Para o dentista isso parece
aleatório: ele vê o botão, mas algumas exclusões falham. Além disso, a exclusão de ficha está no
menu de três pontos, embora seja uma ação recorrente de correção.

## Decisão

- Exclusão é **física** e é responsabilidade do dentista que a confirma.
- Qualquer **dentista ativo da clínica** pode excluir ficha ou orçamento da mesma clínica,
  inclusive quando o registro pertence a outro dentista. Secretaria continua sem esse poder.
- Orçamento pode levar junto itens, cobranças, previsões, pagamentos recebidos, aceite e documento
  de aceite. Ficha pode levar seus procedimentos, evoluções, orçamento(s) e todos esses vínculos.
- Antes da mutação, a tela calcula e mostra as consequências. O botão só habilita após o checkbox
  `Estou ciente de que esta exclusão é permanente`.
- A action do servidor também exige `confirmada: true`; o checkbox não é apenas cosmético.
- Em Prontuário, `Excluir ficha` sai do menu de três pontos e vira uma ação visível no cabeçalho.

## Segurança e invariantes

1. Todo alvo é resolvido no servidor por `id + clinica_id`; cliente não envia paciente, clínica ou
   dentista para definir escopo.
2. A exclusão usa RPC `SECURITY DEFINER` exclusiva, que valida `get_my_clinica_id()` e
   `is_clinic_dentista()` antes de tocar em dependentes. Não abrir `DELETE` genérico para
   secretária nem para outra clínica.
3. A RPC apaga primeiro documentos de aceite e seus registros de arquivo, liberando as FKs
   RESTRICT; assinaturas, itens, cobranças, previsões e pagamentos seguem os cascades. A transação
   é atômica: falha não deixa ficha furada.
4. O bypass do trigger de evento assinado é local à transação e exclusivo da RPC de exclusão
   confirmada. Operações clínicas normais continuam imutáveis.
5. Não remover objetos do Storage nesta entrega: arquivos sem referência são inertes e a remoção de
   banco não pode gerar uma exclusão parcial por falha de rede. Limpeza de Storage é item próprio.

## Contrato técnico

```ts
type ResumoExclusao = {
  eventos: number;
  evolucoes: number;
  orcamentos: number;
  pagamentos: number;
  assinaturas: number;
  documentos: number;
};

prepararExclusaoFicha(fichaId) -> { ok: true; resumo: ResumoExclusao }
deletarFicha(fichaId, confirmada: true) -> { ok: true } | { ok: false; error }
excluirOrcamento(orcamentoId, pacienteId, confirmada: true) -> { error?: string }
```

Migration nova:

- `excluir_orcamento_permanentemente(uuid)` e `excluir_ficha_permanentemente(uuid)`;
- grants somente a `authenticated`; ambas validam dentista/clínica no corpo;
- policy de DELETE visível para dentista da clínica só se ainda houver uma chamada direta; as
  actions do app preferem as RPCs para manter a transação.

## Gates de aceite

1. Dentista A exclui ficha/orçamento próprio; tudo relacionado some de imediato.
2. Dentista B da mesma clínica exclui ficha/orçamento de A; funciona após checkbox.
3. Secretaria recebe negação server-side mesmo forjando a action.
4. Usuário de outra clínica recebe negação e não vê/afeta nenhuma linha.
5. Sem checkbox, botão e action recusam a exclusão.
6. Falha em uma dependência mantém ficha/orçamento e dependentes intactos.
