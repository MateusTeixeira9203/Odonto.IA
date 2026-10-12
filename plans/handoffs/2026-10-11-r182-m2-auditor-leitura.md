# HANDOFF — R-182 M2/M4, auditoria de leitura

- Tarefa/área: núcleo clínico e usabilidade, somente leitura.
- Responsável anterior: Coordenação. Próximo: chat Auditor.
- Estado: PLANNED. Base: `codex/baseline-producao-v2` @ `ba5b531`; checkout compartilhado, sem commit.
- Data: 2026-10-11.

## Objetivo e fontes

Avançar o R-182 sem confundir inspeção com aceite. Contrato único:
`plans/specs/R-182-baseline-verificavel.md` (AC-03/04/06/07); cobertura já obtida:
`plans/auditorias/2026-10-11-auditoria-ampla-inicio.md`; protocolo `05_AUDITORIA_E_ESTRESSE.md`.

## Escopo e preservação

Usar **somente contas criadas para QA**, preferindo a clínica/conta QA B no site publicado.
Inspecionar em leitura as jornadas Pacientes → Agenda/Meu Dia → Ficha → Planejamento →
Orçamento, os controles alcançáveis por teclado, 390 px e temas claro/escuro nos estados
realmente acessíveis. Conferir versão/ambiente e distinguir fato, hipótese e impedimento.
Não usar a conta real da portaria da Clindent nem registros clínicos reais para ações.
R-188 RPC já passou no recorte A/B; não repetir fixture financeira nem chamar RPC de escrita.

## Critérios e verificação

- [ ] Matriz por rota/estado/papel testado, com PASSA/NÃO PASSA/NÃO TESTADO e evidência.
- [ ] Cada achado com reprodução, esperado/observado, severidade e limite da conclusão.
- [ ] Indicar o menor ensaio sintético necessário para fechar AC-03/04, sem executá-lo.
- [ ] Separar HID-01 já conhecido de novos achados; não duplicar bug.

## Responsabilidade e limites

Auditor pode criar apenas `plans/auditorias/2026-10-11-R-182-M2-leitura.md` e evidências
na pasta de auditoria com mesmo nome. Coordenação integra `plans/ESTADO.md`, relatório
amplo e panorama. Não editar código, spec, banco, dados, billing ou documentos centrais;
sem envio de mensagens, IA paga, commit, push ou deploy. Escrita de QA em produção **não**
foi autorizada por este despacho; parar antes de qualquer submissão. Não insistir após duas
tentativas sem nova evidência. Handoff de resultado no próprio relatório.

## Próxima ação exata

Ler matriz já existente, identificar lacunas prioritárias e iniciar navegação QA somente leitura.
