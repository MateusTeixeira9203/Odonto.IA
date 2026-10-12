# HANDOFF — R-129a HID-01, correção local

- Tarefa/área: hidratação de datas e horários em Pacientes e Agenda.
- Responsável anterior: Coordenação. Próximo: chat Implementar.
- Estado: PLANNED. Base: `codex/baseline-producao-v2` @ `ba5b531`; checkout compartilhado, sem commit.
- Data: 2026-10-11.

## Objetivo e fontes

Contrato: `plans/specs/R-129a-performance-hidratacao.md`, somente o achado HID-01;
reprodução em `plans/auditorias/2026-10-11-auditoria-ampla-inicio.md` e
`plans/auditorias/evidencias-2026-10-11-auditoria-ampla/hidratacao-fusos-qa.json`.
Servidor UTC renderiza data/hora diferente do navegador BRT: PacientesTable `04/10`
versus `03/10`; WeekView `15:30` versus `12:30`. Corrigir o primeiro render mantendo
data e hora clínica pretendidas, sem alterar valores persistidos ou regras de agenda.

## Critérios e verificação

- [ ] Markup inicial de servidor/cliente coincide em UTC e America/Sao_Paulo.
- [ ] Data de cadastro e horário de agendamento preservam semântica correta após hidratar.
- [ ] Agenda e Pacientes sem `React #418` nos dois fusos; demais rotas afetadas por helper
      compartilhado conferidas.
- [ ] Testes focais, TypeScript e lint dos arquivos tocados; registrar o que não foi E2E.

## Responsabilidade e limites

Executor é dono apenas de `src/components/pacientes/pacientes-table.tsx`,
`src/app/dashboard/agendamentos/_components/week-view.tsx`, helper estritamente necessário
em `src/lib/` e teste focal se justificar. Atualizar evidência no próprio R-129a sem
reescrever o escopo amplo. Avisar Coordenação antes de tocar arquivo fora desse conjunto.
Coordenação mantém `plans/ESTADO.md` e auditoria ampla; Auditor não edita código.
Não tocar `src/app/dashboard/orcamentos/actions.ts`, migrations, auth, dados ou billing.
Sem banco de produção, commit, push ou deploy. Após duas hipóteses falhas, parar e relatar
reprodução/bloqueio, sem remendos.

## Próxima ação exata

Ler a spec e a documentação Next instalada, reproduzir ambos os mismatches e aplicar a
menor correção local verificável.
