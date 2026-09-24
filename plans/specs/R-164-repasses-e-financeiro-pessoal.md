# R-164 — Repasses e financeiro pessoal na clínica gerida

> **SPEC** · **R-164** · 🔵 ativo
> **Aberto:** 2026-09-23 · **Fechado:** — · **Fase:** aprovada
> Depende de R-163, já aplicado no banco principal. Artefato aprovado em 23/09/2026.

## 1. Problema

Na clínica gerida, o pagamento do paciente pertence ao caixa da clínica, mas cada dentista
precisa acompanhar o que produziu e o que tem a receber pelo seu acordo. Hoje a visão pessoal
filtra fatos pelo dentista e pode misturar um lançamento do caixa da clínica com a receita
pessoal de quem o registrou. Também não existe um acordo operacional por profissional nem
um histórico de repasses pagos.

## 2. Decisão e alternativas descartadas

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Acordo de repasse usa campos estruturados, com anotação opcional. | Ler percentual de PDF/contrato. | O sistema precisa de regra inequívoca e versionada; documento pode ser anexado depois apenas como referência. |
| Percentual incide sobre pagamento confirmado, nunca sobre orçamento aprovado. | Tratar aprovação como ganho. | Proposta aprovada é previsão; não é caixa recebido nem valor devido ao profissional. |
| Repasses são obrigações próprias e só viram despesa de caixa quando marcados como pagos. | Descontar repasse previsto do caixa imediatamente. | Não confundir obrigação com saída efetiva. |
| Diária é registrada por dia trabalhado; mensal fixo é gerado por competência. | Inferir dias pela agenda. | Agenda não prova presença, jornada ou acordo cumprido. |
| Em clínica gerida, Meu Financeiro mostra ganho profissional derivado de repasse. | Mostrar pagamentos da clínica como receita pessoal. | A titularidade do recebimento permanece da clínica. |

## 3. Objetivo e como funciona

**Objetivo:** proprietário/gestor configura o acordo de cada dentista e o sistema mostra,
sem misturar caixas, a produção, o repasse previsto e o que já foi pago a cada profissional.

Ao aceitar um convite, o dentista aparece em Minha equipe. Para clínica gerida, o proprietário
ou gestor cria um acordo com vigência: percentual sobre pagamentos confirmados, diária ou
mensal fixo. A troca de acordo só vale para fatos futuros; repasse já gerado conserva a regra
que o originou.

No Financeiro da clínica, o gestor vê repasses previstos e pagos. No Meu Financeiro, o
dentista vê sua produção clínica, os pagamentos vinculados aos seus orçamentos, seu repasse
previsto e o total pago. Na colaborativa, o financeiro pessoal existente continua sendo a
fonte de receita do profissional e esta funcionalidade não cria repasses.

## 4. Contrato técnico

### Dados aditivos

| Objeto | Campos e restrições |
|---|---|
| `acordos_repasse` | `id`, `clinica_id`, `dentista_id`, `modalidade` (`percentual_recebido`, `diaria`, `mensal_fixo`), `percentual` ou `valor_fixo`, `vigente_desde`, `vigente_ate` nullable, `ativo`, `observacao`, ator e timestamps. Um único acordo ativo por dentista e data; vigências não se sobrepõem. |
| `repasses` | `id`, clínica, dentista, acordo, modalidade e regra em snapshot, competência, valor, `status` (`previsto`, `pago`, `cancelado`), data de pagamento nullable, `despesa_id` nullable, ator e timestamps. Registro pago é imutável; correção cria ajuste ou cancelamento auditável. |
| `repasse_pagamentos` | `repasse_id`, `pagamento_id`, valor-base e percentual em snapshot. `pagamento_id` pertence a no máximo um repasse percentual ativo, impedindo duplicidade. |
| `repasse_diarias` | acordo, dentista, data trabalhada, valor em snapshot, estado. Um dia por dentista/acordo; é a origem de um repasse de diária. |

`repasses.despesa_id`, quando preenchido, referencia a despesa da clínica criada na confirmação.
Ela recebe `titular_financeiro = 'clinica'` pelo gatilho existente e descrição rastreável de
repasse. Nenhum pagamento do paciente é duplicado em `despesas` ou `receitas_manuais`.

### Leituras e regras de cálculo

```ts
type ModalidadeRepasse = 'percentual_recebido' | 'diaria' | 'mensal_fixo';
type StatusRepasse = 'previsto' | 'pago' | 'cancelado';

interface AcordoRepasseInput {
  clinicaIdEsperada: string;
  dentistaId: string;
  modalidade: ModalidadeRepasse;
  percentual?: number;
  valorFixo?: number;
  vigenteDesde: string;
  vigenteAte?: string | null;
  observacao?: string | null;
  versao?: number;
}

interface MeuFinanceiroGerido {
  producaoAprovada: number;
  pagamentosVinculados: number;
  repassePrevisto: number;
  repassePago: number;
  acordo: { modalidade: ModalidadeRepasse; vigenteDesde: string } | null;
}
```

- Percentual elegível: `pagamentos` com `titular_financeiro = 'clinica'`, `status = 'pago'`,
  `dentista_id` do acordo, data de pagamento dentro da vigência e sem vínculo anterior em
  `repasse_pagamentos`.
- O clique **Gerar repasse** cria um registro previsto com as linhas elegíveis e uma chave de
  idempotência. Uma nova parcela recebida depois disso fica elegível para o próximo repasse.
- Diária só nasce de registro explícito do gestor. Mensal fixo pode ter uma competência
  prevista por mês e acordo, sem duplicação; ambos só afetam o caixa ao marcar como pagos.
- Cancelar um repasse previsto libera suas origens. Um repasse pago não é editado em silêncio;
  ajuste ou estorno cria fato auditável.
- Meu Financeiro da clínica gerida não consulta `despesas`, `receitas_manuais` ou `pagamentos`
  titularizados pela clínica como receita pessoal. O financeiro colaborativo preserva os filtros
  atuais de titular dentista.

### Autorização

- Proprietário e quem possui `repasses.gerir` no escopo clínica criam acordos, registram
  diárias, geram, pagam ou cancelam repasses.
- Quem possui `repasses.ler` no escopo clínica lê a visão da equipe, sem editar.
- Dentista lê somente o próprio acordo e os próprios valores. Secretaria não lê acordo,
  repasse ou Meu Financeiro de dentista; pode registrar caixa da clínica apenas se já possuir
  a permissão financeira existente.
- Todas as RPCs validam clínica ativa, membro ativo, dentista pertencente à clínica e vigência
  antes de escrever. RLS bloqueia qualquer leitura cruzada.

## 5. Comportamento — o alvo funcional

| Estado | Quando acontece | O que a tela mostra | O que a função faz |
|---|---|---|---|
| Vazio | dentista sem acordo ou sem origem elegível | Acordo pendente ou nenhum repasse no período | Não cria valor fictício. |
| Carregando | salvar, gerar ou pagar | Botão bloqueado e feedback de processamento | Reutiliza a mesma chave de idempotência. |
| Sucesso | acordo ou repasse persistido | Valor e status atualizados nas duas visões | Revalida financeiro pessoal e da clínica. |
| Erro de validação | regra, data, valor ou vigência inválidos | Campo e mensagem específica | Não grava. |
| Sem permissão | dentista/secretaria tenta gerir ou ler outro profissional | Mensagem de acesso restrito | Não divulga valores. |
| Não encontrado/desatualizado | membro, acordo ou pagamento mudou | Solicita recarregar | Não calcula com versão antiga. |
| Conflito | duas pessoas geram/pagam o mesmo repasse | Explica que o estado mudou | Índices e transação impedem duplicidade. |

### Caminhos principais

```
Salvar acordo
  → proprietário/gestor preenche modalidade e vigência
  → Zod valida regra e intervalo
  → RPC confirma contexto, vínculo e ausência de sobreposição
  → acordo ativo fica visível em Minha equipe e Meu Financeiro

Gerar percentual
  → gestor escolhe dentista e período
  → RPC trava pagamentos elegíveis ainda não vinculados
  → cria repasse previsto e snapshots das linhas
  → clínica vê obrigação; dentista vê repasse previsto

Marcar como pago
  → gestor confirma data e valor do repasse previsto
  → RPC cria despesa da clínica vinculada e marca o repasse pago na mesma transação
  → caixa da clínica reduz uma vez; Meu Financeiro passa o valor para pago
```

| Dado / situação | O sistema faz | Resultado esperado |
|---|---|---|
| Dentista com 40%, pagamento confirmado de R$ 1.000 | Gera uma linha percentual de R$ 400 | Clínica mantém R$ 1.000 de receita; R$ 400 é obrigação, não saída até pagamento. |
| Mesmo pagamento em nova tentativa | Reencontra a linha já vinculada | Não gera R$ 800 de repasse. |
| Diária de R$ 500 em 02/10 | Gestor registra o dia e gera o repasse | Valor previsto de R$ 500, sem inferir agenda. |
| Mensal de R$ 3.000 em outubro | Gera uma competência única | Um repasse previsto; a confirmação cria uma única despesa. |
| Secretária abre Meu Financeiro de dentista | Nega leitura | Nenhum valor pessoal é exposto. |

## 6. Referência visual

- **Artefato aprovado:** `plans/artefatos/R-164-repasses-e-financeiro-pessoal-v1.html`.
- **Rotas alvo:** `/dashboard/meu-consultorio/meu-financeiro`,
  `/dashboard/meu-consultorio/financeiro-clinica` e `/dashboard/meu-consultorio/equipe`.
- **Componentes alvo:** painel financeiro pessoal, painel financeiro da clínica e painel de
  equipe existentes; não criar nova área de navegação.
- **Direção:** preservar a hierarquia aprovada de R-161 V2 e R-163 V2. Repasses entram como
  seção financeira legível, com estados previstos e pagos distintos; o acordo fica no contexto
  da pessoa na equipe.
- **Zonas:** Meu Financeiro mostra quatro métricas → acordo vigente → próximo repasse →
  histórico. Financeiro da Clínica mostra caixa → quatro métricas → repasses a resolver →
  leitura do gestor → produção e repasses por profissional. Minha Equipe mostra pessoas à
  esquerda e acordo/estado pendente no detalhe à direita.
- **Estados visuais:** acordo ativo com regra e vigência; acordo pendente sem valores;
  repasse previsto e pago são rótulos diferentes. Modal de acordo apresenta percentual,
  diária e mensal fixo sem abrir uma nova rota.
- **Tokens extraídos do artefato:** fundo `#111112`, superfície `#1c1c1e`, borda `#303034`,
  texto `#fafafa`, texto secundário `#a1a1aa`, teal `#2f9c85`, teal claro `#5dbeb0`, raio de
  card `16px`; títulos `DM Serif Display, Georgia, serif`, corpo Outfit e valores DM Mono.
  A implementação usa os tokens semânticos equivalentes (`bg-background`, `bg-card`,
  `text-foreground`, `text-muted-foreground`, `border-border`, `text-teal`, `bg-teal-pale`)
  nos dois temas, sem hardcode.

## 7. Invariantes

- [ ] Recebimento do paciente titularizado pela clínica nunca é receita pessoal do dentista.
- [ ] Repasse previsto não reduz saldo de caixa; só repasse pago cria despesa.
- [ ] Nenhum pagamento confirmado compõe dois repasses percentuais ativos.
- [ ] Alterar ou encerrar acordo não reescreve repasse já gerado ou pago.
- [ ] Dados de clínica, profissional e acordo sempre compartilham o mesmo `clinica_id`.
- [ ] Secretaria não ganha acesso a valores pessoais por conseguir registrar o caixa.
- [ ] Legado e clínica colaborativa não recebem reatribuição ou cálculo automático novo.

## 8. Gates de aceite

- [ ] Percentual de R$ 1.000 a 40% gera R$ 400 previsto e, depois de pago, uma única despesa
  de R$ 400 no caixa da clínica.
- [ ] Repetir geração, abrir em duas abas ou repetir a ação após timeout não duplica o repasse.
- [ ] Pagamento futuro ou cancelado não entra no repasse percentual.
- [ ] Diária exige data explícita; mensal fixo não duplica na mesma competência.
- [ ] Proprietário e dentista veem os mesmos valores próprios pelos seus papéis; dentista não vê
  dados de outro profissional e secretaria não vê nenhum repasse.
- [ ] Lançamento manual do caixa da clínica deixa de aparecer em Meu Financeiro do proprietário
  que atende.
- [ ] Teste manual com duas contas na clínica de teste valida convites, orçamento, recebimento,
  geração e pagamento de repasse.
- [ ] `pnpm test`, typecheck, lint e build passam; migration é aplicada isoladamente e o schema
  é conferido no banco antes do preview.

## 9. Fora de escopo

Folha trabalhista, impostos, contabilidade fiscal, remessa bancária, conciliação Open Finance,
extração de dados de PDF, rateio de material por atendimento, custo de cadeira e assinatura de
contrato jurídico dentro do produto.
