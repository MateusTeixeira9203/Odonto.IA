# Odonto.IA — produto atual

STATUS: ACTIVE
LAST_REVIEWED: 2026-10-18
CANONICAL_FOR: descrição do produto atual, público e separação entre atual e desejado

## O que é hoje

Sistema odontológico em uso que conecta **agenda → atendimento → Ficha →
planejamento → orçamento → acompanhamento financeiro**. A IA auxilia a captura
e a estruturação do registro; o profissional revisa. A Ficha é a unidade de
tratamento dentro do prontuário do paciente; um atendimento representa uma visita.

O usuário considera a versão de produção estável e útil, precisando de refino.
O mapa abaixo foi conciliado com código da aplicação `a1722c4`, catálogo e interface QA. Não é uma nova homologação de todas as telas, integrações ou permissões.
Versão e limites estão no [Estado](../plans/ESTADO.md).

A [auditoria dirigida de 18/10](auditoria-producao-2026-10-18/README.md) confirmou
o deployment, examinou o catálogo vivo e reuniu 113 capturas públicas e internas
com a conta QA isenta. Cadastro sintético, procedimento manual com recarga, orçamento,
encaixe, apresentação e receita manual tiveram verificação dirigida. A isenção
permitiu a coleta; a correção do ciclo foi publicada seletivamente em 18/10. Login com sessão e acesso QA
foram verificados; novo login por senha e estados comerciais reais ainda não. Ver CODIGO.md
no pacote da auditoria para a identidade da versão e limites.
Há estruturas de gestão, estoque e repasses no banco que não comprovam entrega
dessas capacidades na interface desta versão. Os relatórios separam esses níveis.

## Capacidades da versão identificada

| Capacidade | Responsabilidade atual / limite |
| --- | --- |
| Entrada e conta | Landing, cadastro/login, recuperação, onboarding, convites e gates comerciais. A landing ainda enfatiza documentação clínica por IA. |
| Início | Painel do dentista com métricas, próximo atendimento e pendências; composição própria para recepção. Ainda existe na versão publicada. |
| Agenda | Organizar atendimentos, encaixes, retornos e compromissos; origem do contexto de paciente/visita. |
| Meu Dia | Fila e registro da consulta, Campo Mágico, revisão estruturada, odontograma, detalhes de especialidade e continuidade para Ficha/orçamento. |
| Pacientes / prontuário | Cadastro, acompanhamento longitudinal, Fichas, procedimentos, autoria, status, encaminhamentos e documentos conforme autorização. |
| Perfil do paciente | Áreas de Prontuário, Orçamentos, Arquivos e Agenda; acesso à apresentação ao paciente. Visibilidade varia por papel. |
| Orçamento | Proposta vinculada ao contexto clínico, aprovação, descontos, etapas, previsões, recebimentos e estornos pelos fluxos existentes. A operação está no perfil do paciente; `/dashboard/orcamentos` redireciona para Pacientes. |
| Financeiro | Recebimentos de orçamento, receitas manuais, despesas, pendências, séries e estimativa de hora clínica. Acesso condicionado por papel/plano. Não equivale a saldo bancário conciliado nem a DRE completa. |
| Equipe e configuração | Clínica, profissionais, convites, catálogo, horários e controles comerciais existentes. Não confundir com a nova Gestão de clínicas geridas. |
| Protético e comunicação | Rotas/fluxos próprios de protético e integrações de comunicação no código. Cobertura operacional e configuração de integrações não foram revalidadas nesta curadoria. |
| Acesso | Web responsiva/PWA, temas claro/escuro. Aplicativo nativo não é produto entregue nesta baseline. |

## Interface atual observada

A navegação principal tem Início, Meu Dia, Pacientes, Agenda, Financeiro e Config,
com DEX, tema e menu pessoal. Meu Dia combina fila, captura e painel clínico; a Ficha
permite odontograma, procedimentos por dente, status, detalhes e continuidade.
O perfil reúne Prontuário, Orçamentos, Arquivos e Agenda; Apresentar abre editor e
slides. Configurações reúne Meu Perfil, Consultório, Horários, Procedimentos e Plano.

A captura distinguiu criação da proposta, aceite de itens e status global do orçamento;
esses estados não devem ser tratados como equivalentes. Receita manual aparece no
resumo/extrato, mas não na série mensal no cenário QA observado (COD-01).
Recepção, protético e WhatsApp não foram homologados pela conta de dentista SOLO.
[Índice visual](auditoria-producao-2026-10-18/PRINTS.md) e
[cobertura/limites](auditoria-producao-2026-10-18/INTERFACE.md).

## Papéis e propriedade dos dados

O código atual trabalha com `admin`, `dentista`, `secretaria` e `protetico` e resolve
usuário, clínica ativa, vínculo e perfil. Os rótulos não concedem por si só todas
as capacidades. Autorização efetiva precisa ser verificada no servidor e banco.

Paciente/Ficha são contexto clínico; autoria, responsável pelo procedimento,
responsável pelo orçamento e destinatário de repasse são conceitos distintos.
Não consolidar orçamentos, ampliar acesso ou transferir autoria por reorganização visual.
Clindent colaborativa e Dra. Léia na configuração solo existente permanecem preservadas.

## Direção de produto já decidida, sem confundir com entrega

O foco comercial desejado é **gestão para clínicas com proprietário, com atendimento
clínico integrado e IA operacional**. O proprietário pode ou não atender; proprietário
não clínico não recebe atuação clínica por ser dono. Uma clínica de um dentista
continua contemplada pela direção. Transição comercial e de permissões exige contrato.

Gestão ampliada, cadastro de proprietário não clínico, estoque e repasses não são
capacidades publicadas comprovadas nesta baseline. Não apresentar ideias ou trabalho
local anterior como parte do produto entregue. A próxima atualização será definida
com o usuário a partir do sistema atual.

## Comportamentos que precisam sobreviver ao refino

- Identidade de paciente, Ficha e visita; texto e dados clínicos sem perda silenciosa.
- Autoria, assinatura, encaminhamento, permissões e isolamento por clínica.
- Valores e estados consistentes entre orçamento, pagamento e Financeiro; repetição
  de uma operação não pode duplicar efeitos. Saldo simplificado não é lucro.
- Fluxos das clínicas existentes; apresentações visuais não alteram regras de negócio.
- Revisão humana da IA: não inventar diagnóstico, execução clínica ou medições ausentes.

## Design e próximo planejamento

O design do sistema atual é a base escolhida pelo usuário; Figma saiu do processo.
O refino será debatido tela por tela a partir dos prints que o usuário apresentar.
O plano futuro será externo (download/OneDrive), sem duplicação neste repositório.
Este documento descreve o produto; não lista as mudanças da próxima atualização.

Fontes de código para consulta dirigida: `src/components/layout/floating-dock.tsx`,
`src/app/dashboard/page.tsx`, `src/app/dashboard/meu-dia/_components/meu-dia-client.tsx`,
`src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`,
`src/app/dashboard/financeiro/page.tsx`, `src/server/auth/clinic.ts`.
