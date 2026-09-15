# R-165 — Cadastro e responsável pelo pagamento da assinatura

> **SPEC** · **R-165** · ⏳ fila
> **Aberto:** 2026-09-10 · **Fase:** plano · Proposta, não decisão comercial aprovada.
> Integra R-158/R-159; retomada de cobrança deve respeitar R-155 e dados existentes.

## 1. Problema

O cadastro dos novos modelos precisa explicar se cada dentista contrata a própria assinatura
ou se a clínica paga os acessos. Quem paga a assinatura do software não é necessariamente
quem atende, quem administra os dados ou quem recebe o pagamento do paciente.

## 2. Proposta e alternativas

- Oferecer duas modalidades: **Cada dentista paga seu acesso** e **A clínica paga os acessos**.
- Escolha de cobrança independente de governança/permissões. Modelo colaborativo sugere
  individual; clínica gerida sugere centralizado. Confirmar a escolha explicitamente no cadastro.
- Uma modalidade por unidade na primeira versão; combinar pagadores dentro da mesma unidade
  fica para recorte posterior, reduzindo ambiguidade de bloqueio, troca e cobrança duplicada.
- Cada profissional sempre usa conta própria, mesmo quando o proprietário paga por todos.
- Não escolher preços, limites, descontos comerciais ou gratuidade de gestores/recepção nesta spec.

## 3. Cadastro, convites e ciclo de vida

### Sequência de cadastro proposta

Como a clínica funciona → você também atende? (inferido da opção, revisável) →
quem paga os acessos? → resumo de cobertura/custo confirmado → dados e convites → ativação.
Dados profissionais só para quem atende. Escolha comercial não cria privilégios de gestão.

| Modalidade | Quem contrata | Convite de novo dentista | Liberação |
|---|---|---|---|
| Individual | Cada dentista | Informa que o profissional contratará o próprio acesso e mostra condições antes do aceite | Depois da elegibilidade comercial desse vínculo ser confirmada |
| Centralizada | Clínica, por responsável financeiro autorizado | Informa que o acesso é custeado pela clínica; não pede cartão do convidado | Depois de validar cobertura/vaga e vínculo ativo |

Na centralizada, proposta é assinatura da unidade com quantidade de acessos clínicos cobertos.
Gestor vê utilizados/disponíveis; novo convite reserva vaga com prazo definido no contrato
técnico futuro. Se precisa ampliar cobertura, mostrar impacto e pedir confirmação ao pagador
antes de qualquer cobrança adicional. Convite repetido não consome duas vagas.
Prazo de reserva, periodicidade, prorrata e contabilização do proprietário que atende ainda
precisam ser definidos; não podem ficar implícitos na implementação.

Gestor não dentista precisa ter cobertura administrativa explícita da unidade. Na modalidade
individual, definir se existe plano administrativo da clínica ou cobertura incluída e em quais
condições. Não criar assinatura de dentista fictícia nem presumir gestor gratuito para sempre.
Recepção/protético: declarar inclusão ou preço separado antes da venda; nada foi decidido ainda.

### Proteções do ciclo de vida

- Individual: falha confirmada na assinatura de A não suspende B que está regular. Aplicar
  consequências somente aos vínculos cobertos pela assinatura, preservando histórico.
- Centralizada: inadimplência pode afetar os acessos cobertos da unidade; explicitar essa
  consequência ao contratante. Falha técnica de webhook não equivale a falta de pagamento.
- Ambos: reusar reconciliação e acesso recuperável R-155; pagamento válido é reconhecido,
  erro de comunicação não gera loop ou suspensão automática tratada como inadimplência.
- Saída de dentista desativa vínculo e conserva autoria/prontuário/pagamentos. Na centralizada,
  vaga fica disponível conforme política contratada; não cancela toda a assinatura da clínica.
- Sair de clínica ou remover acesso não significa cancelar contrato individual automaticamente;
  mostrar separadamente consequências comerciais e de vínculo.
- Troca de modalidade exige transição explícita: verificar cobertura nova antes de encerrar
  antiga, tratar créditos/prorrata conforme política aprovada e evitar cobrança sobreposta.
- Clínicas atuais continuam no modelo vigente. Nada é migrado/cancelado silenciosamente.
- Uma pessoa em várias unidades: mapear quais vínculos a assinatura cobre antes de calcular
  preço ou suspender acesso. Não cobrar novamente nem prometer cobertura global por suposição.

### Decisões para fechar o contrato técnico

1. Aprovar duas modalidades e regra de uma modalidade por unidade na primeira entrega.
2. Definir preço/base/acessos e cobertura de gestor, recepção e proprietário que atende.
3. Definir vaga reservada, ampliação/redução, prorrata, vencimento e recuperação de atraso.
4. Definir cobertura multiunidade e transição dos clientes que desejarem mudar de modalidade.

## 4. Contrato técnico

Pendente das decisões comerciais. Inventariar onboarding, convites, assinaturas individuais,
checkout, reconciliação, webhooks e cron antes de propor schema/RPCs. Plano não autoriza
reaproveitar `admin` como pagador nem substituir contratos atuais. Novos objetos serão aditivos.

## 5. Comportamento esperado

Sem cobertura: explicar responsável pela regularização; sem loop nem criação de conta repetida.
Pagamento em confirmação: estado recuperável; não declarar inadimplência sem evidência.
Convite sem vaga: aguarda ampliação autorizada; não cobra automaticamente nem ativa sem cobertura.
Conflito de convite/checkout: operação idempotente com responsável e unidade conferidos.

## 6. Referência visual

Etapa “Quem paga os acessos?” no cadastro e resumo no convite. Tela de assinatura fica
separada do financeiro dos pacientes. Ações financeiras só para responsável autorizado.

## 7. Invariantes

Identidade individual, autoria preservada, pagador não concede acesso clínico, sem duplicidade
de cobrança, sem bloqueio de colegas por dívida individual, sem migração automática de contratos.

## 8. Gates a detalhar no contrato

- [ ] Usuário já vinculado recebe conflito compreensível, sem HTTP500 genérico. Achado no
  [gate R-159c](../auditorias/2026-09-11-r159c-equipe-isolada.md): ALREADY_ONBOARDED/P0409 nega sem mutar.
- [ ] Dentista convidado na centralizada entra sem contratar assinatura duplicada.
- [ ] Individual regular continua ativo quando outro membro fica inadimplente.
- [ ] Convites concorrentes respeitam cobertura; retry não duplica vaga/cobrança.
- [ ] Webhook repetido/atrasado/fora de ordem converge; falha técnica não se torna dívida.
- [ ] Remover vínculo preserva dados e informa consequências comerciais separadamente.
- [ ] Troca de modalidade não deixa período descoberto nem duas cobranças indevidas.

## 9. Fora de escopo

Preço final, condições de venda aprovadas, mudança na Stripe/banco agora, cobrança ou convite
real, migração de contratos atuais, assinatura consolidada de franquias e modalidades mistas.
