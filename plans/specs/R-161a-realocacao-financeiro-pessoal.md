# R-161a — Realocação do Financeiro pessoal

> Contrato do recorte autorizado pelo usuário em 11/09: aplicar e testar no ambiente separado.
> Integração pessoal do bloco R-159/R-161. Sem aprovação de redesign: usuário exige a tela atual inteira.

## Decisão

Dentista colaborativo ou agregado usa Meu Consultório pessoal. Retirar gestor delegado desta etapa.
Proprietário e gestão clínica seguem seus contratos; esta realocação não libera consolidados.
Nada de novo motor financeiro, gráficos, tabelas, formulários, fórmulas ou schema.
Fonte visual/funcional: página Financeiro do candidate `codex/testes-integrados` em `5ffbf24`.

## Rotas e reuso

Recorte pessoal usa `/dashboard/meu-consultorio/financeiro`, dentro do layout clínico EXISTENTE,
preservando sessão, guard de clínica, aceites, cobrança e barra inferior/header mobile.
A raiz `/dashboard/meu-consultorio` encaminha à seção Financeiro. A raiz neutra `/consultorio`
proposta em R-161 permanece futura para integrar gestão não clínica, sem duplicar este módulo.

Ativar apenas no Supabase Free `etlqznuoxiilvxzygpat` e billing desativado, reutilizando o gate
server do piloto. Fora dele: rota nova indisponível e menu atual preservado. Admin/dentista
com vínculo clínico legítimo podem abrir; recepção/protético não entram no consultório pessoal.

Extrair somente montagem atual da página para `FinanceiroContent`, reutilizando as mesmas
sete actions e `FinanceiroClient`. Prop `basePath?: '/dashboard/financeiro' |
'/dashboard/meu-consultorio/financeiro'`, default antigo. Mês/filtros usam essa prop; nenhum
parâmetro da URL decide usuário/clínica/autorização. Remount por clínica+dentista+mês+filtro.

Rota antiga continua para recepção e ambientes fora do piloto. No piloto, para admin/dentista,
encaminha uma vez ao novo destino preservando mês válido. Sem ciclos; bookmarks/notificações/
atalhos da ficha continuam utilizáveis. Não reescrever todos os links legados neste lote.

Menu desktop/mobile substitui Financeiro por Consultório (ícone Building2) apenas para
admin/dentista no piloto; mesmos componentes, posição e demais destinos. Prop explícita
`consultorioPessoalEnabled?: boolean`, fornecida no servidor e default false. Sem menu lateral
novo, placeholders de módulos futuros ou alteração da página financeira.

Após mutations financeiras, invalidar novo caminho além dos antigos. Sem mudar validação,
transação, resultado, regras de despesa/receita, cobrança/pagamento ou escopo individual.

## Invariantes

- Auth/clínica ativa vêm dos guards existentes; dentista não escolhe o dono dos números.
- Gráficos, saldos, listas, hora clínica e CSV continuam filtrados por clínica e dentista.
- A secretaria conserva seu fluxo financeiro legado; não ganha acesso ao consultório pessoal.
- Não apagar/resetar fixtures, migrar valores nem escrever na origem. Usuário criará duas clínicas
  adicionais; usar A/B/C/D fictícias existentes sem alterar as novas por inferência.
- Nenhuma alteração em webhooks, Stripe, cadastro de proprietários ou RLS neste recorte.

## Gates

- [ ] Mesma UI/componente, gráficos, filtros, privacidade, sheets e ações preservados.
- [ ] Menu desktop/mobile entra na nova rota; voltar/recarregar/trocar mês continuam nela.
- [ ] URL antiga encaminha sem ciclo, preserva mês válido; mês inválido usa regra atual.
- [ ] Duas contas fictícias: leitura própria, parâmetro de outro dentista ignorado/negado;
  recebimento/lançamento/CSV não trazem valores de outra conta/clínica.
- [ ] Criar entrada/saída fictícia e remover somente o registro criado nesta rodada;
  saldo/lista/gráfico atualizam e continuam corretos após reload/troca de mês.
- [ ] Fluxos de pagamentos existentes (pagos/pendentes e recebimento pela recepção) preservados;
  verificar fluxo real e relatório de regressão antes de dizer concluído.
- [ ] Sem permissão/sem sessão/billing/plano mantêm guards; clínica muda sem dados antigos.
- [ ] Typecheck/lint dirigidos, testes úteis de navegação e autorização; sem Next/build local.
- [ ] Revisão técnica e UX; publicação só preview; QA integrado é distinto de compilação.

## Retorno

Reverter commits de navegação/rota restaura o acesso antigo. Nenhum rollback de dados necessário.
Se navegador/rede bloquear QA, registrar o gate inconclusivo; não declarar 100% nem promover produção.

## Verificação em 11/09

Publicado somente no preview em `ff44e4e`; evidências e limites no
[gate R-161a](../auditorias/2026-09-11-r161a-financeiro-pessoal.md).
Fluxos centrais A/B/recepção, lançamentos e recebimento parcial passaram.
CSV e comparação por imagem inconclusivos; não declarar todos os gates aprovados.

Decisão de rótulo (11/09): usuário pediu **Consultório** no dock e drawer para ocupar menos espaço.
A seção e sua rota continuam as mesmas; ajuste local posterior ao preview `ff44e4e`.
