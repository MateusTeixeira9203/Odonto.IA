# Estado — Odonto.IA

Atualizado em 24/09/2026.

🔵 **R-174 — Cálculos financeiros confiáveis.**

O artefato V5 e a estrutura visual do R-164 seguem aprovados. A migration
`20260924023000_r164_painel_operacional_financeiro.sql` foi aplicada no banco principal e
os seus objetos foram conferidos no SQL Editor. A base local foi integrada com `origin/main`;
310 testes passaram depois da integração.

**Estado técnico agora**

- A branch do Meu Consultório estava 35 commits atrás de `origin/main`. O merge local trouxe
  R-172 e R-173, inclusive a correção do gatilho financeiro de orçamento, e foi concluído no
  commit `022d42d`. Ainda não foi reenviado.
- A auditoria de cálculo encontrou uma lacuna real: o novo Meu Financeiro aceita saída pessoal
  apenas como variável, enquanto a hora clínica soma custos fixos do mês. Logo, o custo/h pode
  permanecer zero mesmo com custo lançado.
- `despesas_recorrentes` hoje é só da clínica e projeta o mês; não cria competência, não permite
  marcar o pagamento e não alimenta custo fixo pessoal. É preciso completar esse ciclo antes de
  afirmar que o financeiro opera sozinho mês a mês.
- O painel da clínica separa corretamente pagamento confirmado, previsão e repasse, mas fôlego,
  saldo bancário e ponto de equilíbrio permanecem indisponíveis sem saldo conciliado e modelo de
  competência. Não haverá número inventado para preencher esses cards.
- A leitura ao vivo adicional do banco foi interrompida por aprovação automática expirada no
  dashboard do Supabase. Não houve tentativa de contorno; falta retomar a consulta de integridade
  e conferir no banco os objetos R-173 e os agregados financeiros.

**Próximo passo concreto**

Obter aprovação do contrato R-174 e então implementar: recorrência por competência, custo/h
pessoal e da clínica com base explícita, projeção de caixa, desempenho por profissional e testes
de duas contas. Não aplicar nova migration nem subir preview antes da verificação do banco e dos
gates desse contrato.
