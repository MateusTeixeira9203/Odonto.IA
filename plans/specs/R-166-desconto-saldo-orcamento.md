# R-166 — Desconto no saldo do orçamento

> SPEC · R-166 · ⏳ correção · Aberto: 2026-09-11 · Fase: contrato
> Usuário autorizou resolver, commitar e fazer push em 11/09. Recorte isolado da main.

## Problema e decisão

Relato: desconto concedido, pagamento recebido, desconto continua como saldo pendente.
Exemplo ilustrativo: R$400, desconto R$40, recebido R$360. Cálculo local reproduz
“Aceito — falta R$40”. Fórmula da view e RPCs foi conferida no catálogo da produção.
Não houve identificação nem alteração do orçamento real relatado.

## Contrato

- `valor_acordado` explícito vence: já é o valor final negociado; não descontar duas vezes.
- Sem acordo e sem cobranças abertas: devido = max(0, aprovado − desconto global).
- Com cobranças abertas: devido = max(0, aprovado − descontos das cobranças abertas).
  As obrigações registradas prevalecem sobre o desconto global da proposta; não acumulá-los
  nem ratear um desconto global entre etapas. Isso também vale para etapa parcial.
  Cancelar a última etapa aberta volta ao cálculo global. Itens não aprovados não somam.
- Novos orçamentos com desconto global ou acordo explícito usam o fluxo global existente;
  UI e RPC impedem criar etapa nessa modalidade. Não reescrever cobranças mistas históricas.
  Casos históricos com acordo explícito e etapas conservam a precedência anterior e exigem
  identificação do orçamento para eventual reconciliação, fora deste patch.
- Cobrança cancelada não concede desconto. Pagamento pendente/cancelado não é recebido.
- Comparações de dinheiro em centavos; orçamento sem valor aprovado continua Proposto.
- `deriveEstadoOrcamento` recebe `desconto: number | null` e
  `cobrancas: { desconto: number; situacao: string }[]` junto dos fatos existentes.
- View `orcamentos_com_estado`, validações de recebimento e novos aceites seguem a regra.
- Consumidores existentes recebem desconto/cobranças; nenhum layout ou fluxo novo.
- Sem reescrever pagamentos, preços dos itens, acordos ou aceites já assinados.
- Policies, grants e checagens de autorização preservados. Consultas por clínica ativa.

## Gates

1. R$400 − R$40, recebido R$360: quitado e saldo zero (desconto global e por etapa).
2. Sem desconto, recebido R$360: pendente R$40; recebido R$300 com desconto R$40: R$60.
3. Acordo R$360 junto de desconto R$40: devido R$360, nunca R$320.
4. Múltiplas etapas somam descontos abertos; cancelar etapa devolve seu desconto ao saldo.
5. Itens não aprovados, centavos e pagamentos cancelados não produzem quitação falsa.
6. SQL e TypeScript concordam; novos fluxos cobertos rejeitam recebimento acima do devido.
   Acordos globais misturados com etapas em dados históricos mantêm o limite descrito acima.
7. Dados sintéticos no Free, A/B autenticados: isolamento preservado. UI mostra Quitado
   após reabrir; PDF/prontuário e financeiro usam o mesmo devido.
8. Global40 + etapa0 preexistente: devido400; global40 + etapa40: devido360, nunca320.
   Cancelar última etapa restaura desconto global. Criar etapa em orçamento global é negado.
9. Typecheck/lint dirigidos e revisão antes do commit. Migration e aplicação em commits
   separados; somente a correção sobe, sem frentes não verificadas do checkout original.

## Entrega e reversão

Migration altera cálculo, não dados. Aplicar e verificar no Free antes da produção.
Guardar definições anteriores do catálogo para reversão; reverter aplicação por commit.
Este gate não promove o item a ✅ (auditoria completa é independente).

## Evidência — 11/09

- Migration aplicada exclusivamente no Free; objetos anteriores guardados para reversão
  em `/home/mtx/.local/share/odontoia-testes/r166-rollback.sql`.
- 13 testes locais passaram (estado, etapa e documento). Typecheck completo passou;
  lint dos arquivos alterados sem erros, com avisos preexistentes.
- `scripts/tests/r166-desconto-qa.mjs`: 12 estados SQL conferidos com A/B autenticados,
  recebimento/correção/confirmação, excesso bloqueado, cancelamento, acordo, novo aceite,
  embed e isolamento. Consulta usada pelo Financeiro também validada via REST.
- Browser: componente real em harness, carregado com snapshots reais sintéticos do Free.
  Etapa: Quitado, Paga, recebido 360, saldo 0. Global: Quitado, devido 360, saldo 0.
  Sem desconto: Aceito, falta 40. Fechar/reabrir e recarregar mantêm o resultado.
  Documento real: subtotal 400, desconto 40, total 360, 100% recebido;
  previsão cancelada não aparece como pendência. Console sem erros/warnings.
- Limite: harness comprova renderização, não integração completa do Next no preview.
  Escritas foram verificadas separadamente nas RPCs reais; nenhum envio WhatsApp executado.
- Revisões independentes TypeScript e UX realizadas; corrigida a mistura de descontos e
  o retorno ao fluxo global após cancelar última etapa. Novos históricos mistos não são criados.
- QA adicional do componente: global sem pagamento e com etapa cancelada mostram o
  recebimento global; Usar saldo preenche 360 e habilita Registrar recebimento.
- Publicação desta rodada limitada à branch da correção. Produção não recebeu migration
  nem promoção da aplicação; exige rollout conjunto para SQL e UI concordarem.

## Commits da entrega

- `e020559`: migration do cálculo e guarda de modalidade global.
- `df58fb8`: consumidores, roteamento financeiro e testes.
- Branch `codex/fix-desconto-orcamento`, isolada de outras frentes locais.
- Gates TypeScript e UX aprovados após as correções; typecheck completo e lint do modal
  novamente aprovados. Nenhuma alteração de dados reais ou de policies.
