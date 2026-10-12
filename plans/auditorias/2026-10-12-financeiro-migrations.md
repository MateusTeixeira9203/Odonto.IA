# Gate financeiro dirigido — R-184, R-189 e R-194

STATUS: READY_FOR_REVIEW
OWNER: Coordenação / Auditoria
LAST_REVIEWED: 2026-10-12
AMBIENTES: Supabase produção `zenfemoxvwerplrjgfqz`; localhost:3000; Vercel produção em `ba5b531`

O usuário autorizou aplicar as migrations aprovadas em 12/10. A execução usou apenas
orçamentos e contas sintéticos da clínica **QA Odonto Clínica B 2026-10-01**;
nenhum registro real foi usado como alvo de escrita. Não houve commit, push ou deploy.

## Migrações e integridade

| Item | Versão aplicada | Resultado |
|---|---|---|
| R-184 | `20261012034818` | PASSA: função atualizada preservando a guarda R-188; cálculo usa devido canônico. |
| R-189 | `20261012034837` | PASSA: `operacao_id` anulável, índice único parcial válido, RPC nova apenas para `authenticated`. |
| R-194 | `20261012034858` | PASSA: RPC única `SECURITY DEFINER`, `search_path` vazio, apenas `authenticated`. |

O catálogo e o ledger foram conferidos após cada aplicação. A função R-184 tinha
fingerprint prévio `b05d239c7cb52339e6fa7e3de33e22e8` (R-188 ativo) e passou a
`b2241bc8c9241d77831aa13e1efd0c01`. As migrations não alteraram os 591
pagamentos preexistentes: 124 cancelados, 274 pagos, 193 pendentes. Os testes QA
criaram oito pagamentos sintéticos, o formulário local criou um recebimento, e a
confirmação explícita mudou um dos pendentes para pago. Conferência final: 600
pagamentos, sendo 124 cancelados, 281 pagos, 195 pendentes. Os arquivos locais foram
renomeados para as versões registradas pelo Supabase para evitar reaplicação futura.

## Critérios exercidos

| Critério | Resultado | Evidência |
|---|---|---|
| R-184, aprovação parcial/desconto/pago anterior | **PASSA**, direto na RPC | Orçamento QA `f42e89aa-8359-4823-82c2-3f52cd05a39e`: devido R$ 70; duas previsões de R$ 25. Protetico negado sem pagamento extra. |
| R-189, replay e conflitos | **PASSA**, direto na RPC | Orçamento QA `bf56ad52-c5a9-4e67-a740-d84aa662b845`: replay retornou mesmo ID; ator/payload conflitantes foram negados; duas intenções iguais distintas geraram duas linhas e dois logs. |
| R-189, formulário local e recarga | **PASSA**, localhost contra dados QA | Um recebimento adicional de R$ 50 persistiu; após recarga, recebido R$ 250 de R$ 300 e saldo R$ 50. [Captura](evidencias-2026-10-12-financeiro/r189-ui-recebimento.png). |
| R-194, previsão e replay | **PASSA**, direto na RPC | Orçamento QA `9cdee14c-57f3-45d1-9406-665728e82ef8`: primeira parcela confirmada, segunda ainda pendente, um log; replay sem novo efeito. |
| R-194, saldo pela secretária | **PASSA**, direto na RPC | Orçamento QA `0e393564-40fd-46ca-af56-2ff46a907a31`: um pagamento, um log, uma notificação ao dentista; replay sem duplicação. |
| Confirmação explícita existente | **PASSA**, localhost contra dados QA | Segunda parcela do orçamento QA de previsão marcada paga na UI; recarga mostrou quitado, R$ 200 recebidos e saldo zero. [Captura](evidencias-2026-10-12-financeiro/r194-regressao-confirmacao-explicita.png). |
| Atalho de pagamento rápido na UI | **NÃO TESTADO** | `/dashboard/orcamentos` redireciona para `/dashboard/pacientes`; o componente do atalho não fica acessível pela navegação atual. |
| Versão publicada, corrida real, perda de resposta e restore | **NÃO TESTADO** | Vercel ainda serve `ba5b531`; o schema completo não foi restaurado em branch isolada. Não executar carga/falha no banco real. |

Os 14 testes de banco com PGlite descartável e os cinco testes de contrato da
Action/RPC passaram após alinhar os nomes dos arquivos. O roteiro reproduzível de QA
direta está em `scripts/qa-r184-r189-r194-live.mjs` e exige opt-in explícito.
A senha de um **dentista sintético de QA** foi rotacionada imediatamente após um
envio nativo de formulário local antes da hidratação React ter exposto essa senha
na URL do servidor de desenvolvimento. Nenhuma credencial real foi usada.

## Limite para a publicação

O código publicado ainda chama `registrar_recebimento_orcamento` sem chave de
idempotência. A RPC antiga permanece habilitada para compatibilidade; portanto,
**R-189 ainda não protege retries no site publicado**. Publicar o consumidor novo
requer gate de release específico e, depois de confirmar que não há consumidor da
RPC antiga, uma decisão separada sobre revogá-la. A aplicação das migrations não
fecha R-182 nem comprova estabilidade de todas as jornadas clínicas.
