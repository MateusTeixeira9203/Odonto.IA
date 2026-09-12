# R-168 — Retorno confiável e Ficha sem mapa geral

> **SPEC** · **R-168** · 🟡 em produção, não verificado
> **Aberto:** 2026-09-12 · **Fechado:** — · **Fase:** publicada; aguarda auditoria completa

## 1. Problema

Três correções do fluxo de retorno ficaram fora da linha publicada: a busca da semana exibida,
a leitura dos horários ocupados no celular e a restrição do retorno ao responsável pela visita.
No resumo do prontuário, o mapa geral da boca ocupa a maior parte da tela e repete uma leitura
que já existe dentro de cada Ficha.

## 2. Decisão

| Decisão | Motivo |
|---|---|
| Restaurar as três correções sobre a `main` de produção | O código já existia e ficou fora da linha promovida |
| Remover o mapa geral `Boca` do resumo | A Ficha e seu progresso são a unidade clínica de leitura |
| Mostrar `%` e `realizados de total` | O percentual facilita a leitura sem esconder a contagem real |
| Preservar o odontograma do atendimento e sua expansão | Mantém a leitura clínica e a apresentação ao paciente no contexto correto |

## 3. O que o usuário quer

> “Remover esse mapa geral e deixar ele só expansível dentro da ficha. Botar a barra de progresso
> da ficha por porcentagem, manter o 3 de 5 procedimentos e, ao abrir, manter o odontograma daquele
> atendimento com a opção de expandir para mostrar para o paciente.”

## 4. Contrato técnico

- `janelaDaSemanaDisponibilidade` converte o domingo inicial da grade na segunda-feira da semana
  operacional antes de consultar `janelaDaVisao`.
- O mobile lista `ocupados` do dia selecionado sem permitir selecioná-los.
- O botão de retorno de uma visita só aparece quando há `atendimentoId` e o profissional da visita
  é o dentista autenticado.
- O resumo remove somente a apresentação e o estado do odontograma geral.
- O cabeçalho da Ficha e cada Ficha em curso mostram percentual e contagem de procedimentos.
- Nenhum schema, RLS, endpoint, ação de servidor ou regra clínica muda neste item.

## 5. Referência visual

- **Rota:** `/dashboard/pacientes/[id]` · aba Prontuário.
- **Componente:** `src/components/pacientes/ProntuarioTab.tsx`.
- **Artefato:** —; simplificação aprovada diretamente pelo usuário sobre a tela existente.
- **Tokens:** `bg-surface`, `bg-surface-alt`, `text-text-primary`, `text-text-secondary`,
  `border-border`, `bg-teal` e `text-teal-ink`.

## 6. Invariantes

- [x] Agenda, permissões, autoria, procedimentos, status e navegação permanecem iguais.
- [x] Horário ocupado continua indisponível; a lista mobile é somente informativa.
- [x] O odontograma aberto usa apenas os eventos do atendimento em exibição.
- [x] A expansão continua em modo de apresentação e não cria procedimento ao tocar em dente vazio.

## 7. Gates de aceite

- [x] O teste da semana exibida falha sem a correção e passa com ela.
- [x] O mobile mostra horários ocupados e mantém livres selecionáveis.
- [x] Visita de outro responsável não oferece `Marcar retorno`; visita própria oferece.
- [x] O resumo não renderiza o bloco `Boca` nem seu modal geral.
- [x] Cada Ficha em curso mostra, por exemplo, `60% · 3 de 5 procedimentos`.
- [x] A Ficha aberta mostra o mesmo percentual e contagem.
- [x] O odontograma do atendimento e `Ver odontograma completo` permanecem funcionais.
- [ ] Light, dark, 375 px e desktop conferidos no aplicativo rodando.
- [x] Teste focado, typecheck e revisão técnica/UX aprovados antes da publicação.

## 8. Fora de escopo

- Mudar cálculo de progresso, dados do odontograma, schema, RLS ou comportamento da Agenda.
- Redesenhar a Ficha, a timeline clínica ou o modal de apresentação.

## 9. Evidência de publicação

- O schema principal já contém `agendamentos.atendimento_origem_id`, sua FK e o índice único;
  nenhuma migration foi necessária.
- Typecheck, lint focado, testes de Agenda, build Next.js e revisões técnica/UX passaram.
- Preview Vercel `dpl_FkEV2JytEkCo7kdCRmBx3YpprSGq` ficou `READY` sobre o SHA auditado.
- A validação renderizada completa permanece como gate da auditoria completa; o navegador local
  do agente foi bloqueado para URLs locais durante esta execução.
