# Roadmap — Odonto.IA

> **ROADMAP** · atualizado em **03/09/2026** · mapa do produto atual.
> Histórico e specs fechadas vivem em [`_arquivo/`](./_arquivo/).

## Produto atual — fonte de decisão

- O núcleo é a documentação clínica rápida: **Agenda → Meu Dia → Prontuário → Orçamento**.
- **Prontuário** é a visão longitudinal; cada **Ficha** é um tratamento e cada **Atendimento** é
  uma visita. Não existe aba Tratamento.
- Pacientes e Fichas são compartilhados pela clínica conforme a permissão clínica. Agenda,
  orçamentos e financeiro permanecem no silo de cada dentista.
- Solo/Consultório e Clínica entregam o mesmo produto; a diferença é comercial. O domínio
  canônico é `odontoia.app`.

**Status:** ⏳ fila · 🔵 ativo · 🟡 no ar, ainda sem o gate indicado · ✅ no ar e verificado ·
🧊 congelado · ✂️ cortado. Código local não é publicação.

---

## Agora

| ID | Item | Estado |
|---|---|---|
| [**R-153**](specs/R-153-orcamento-ficha-fluxo-continuo.md) | **Orçamento da Ficha em fluxo contínuo** — uma Ficha por orçamento, catálogo confiável e continuidade no perfil do paciente | 🔵 integrada em `main`; aguarda confirmação do deploy e validação dirigida. |

## Publicado, aguardando validação dirigida

| ID | Item | Estado |
|---|---|---|
| **R-145** | **Orçamento financeiro flexível** — recebimento livre, previsão de cobrança reorganizável, à vista como conta a receber e orçamento estritamente por responsável | ✅ em produção e verificado pelo usuário em 03/09; spec e artefato arquivados. |
| [**R-152**](specs/R-152-paridade-ficha-unificada.md) + [**R-152a**](specs/R-152a-cabecalho-ficha-redesign.md) | **Ficha unificada e cabeçalho** — ações clínicas na superfície nova, legado somente leitura e cabeçalho organizado | 🟡 publicado; falta gate consolidado de paridade antes de remover código legado. |
| [**R-149**](specs/R-149-revisao-meu-dia-legivel.md) | **Revisão legível no Meu Dia** — cartões clínicos priorizam procedimento e status, sem esconder nenhuma ação | 🟡 publicada; aguarda conferência visual completa. |
| **R-138** | **Agenda com calendário mobile** | 🟡 enviada; falta validação manual em Android/iPhone e desktop. |
| **R-137** | **Retorno com protético e agenda mobile** | 🟡 publicada; restam os relatos mobile de protético/retorno. |
| **R-136** | **Financeiro do orçamento claro** | 🟡 publicada; falta validação manual completa. |
| [**R-139a**](specs/R-139a-remover-procedimento-catalogo.md), [**R-139b**](specs/R-139b-face-incisal-i.md), [**R-139d**](specs/R-139d-visualizador-clinico-arquivos.md) e [**R-139e**](specs/R-139e-visualizador-apresentacao-anotacoes.md) | Catálogo, face incisal e visualizador clínico | 🟡 no ar; aguardam auditoria completa. |
| **R-92 / R-105** | Cobrança Stripe e onboarding do primeiro valor | 🟡 fluxo no ar; faltam ciclos reais controlados. |

## Correção de desconto

| ID | Item | Estado |
|---|---|---|
| [R-166](specs/R-166-desconto-saldo-orcamento.md) | Desconto no saldo do orçamento | ⏳ correção revisada e validada no Free; entrega na branch R-166, produção pendente. |
| [R-167](specs/R-167-editar-etapa-orcamento.md) | Editar procedimentos e valor final da etapa; excluir orçamento com recebimento | 🟡 migration aplicada em produção; interface na branch R-167 aguarda deploy e teste real. |

## Correções críticas antes de nova escrita clínica

| ID | Item | Estado |
|---|---|---|
| **R-146** | **Contexto seguro da consulta** — `?ag=` resolve o agendamento futuro correto, sem fallback para outro paciente; retorno da Ficha usa o vínculo da Agenda | ⏳ P0/P1 da auditoria de 02/09; bloqueia novo teste de escrita nesse caminho. |
| **R-147** | **DEX: transcrição autenticada e resiliente** — corrigir vínculo `user_id`/clínica ativa, expor erros acionáveis, alinhar MIME e provar Whisper no Preview | ⏳ P0 da auditoria `2026-09-02-dex-completo.md`; aguarda prova no Preview. |

## Próximos, por impacto no dentista

| ID | Item | Estado |
|---|---|---|
| [**R-154**](specs/R-154-plano-tratamento-fluido.md) | **Plano de tratamento fluido no Meu Dia** — fila clínica completa, responsabilidade explícita e transição de status sem recarregar | ⏳ debate; não altera autoria clínica sem decisão explícita. |
| [**R-151**](specs/R-151-dex-organizar-baixa-latencia.md) | **Dex organiza a ficha com baixa latência** — otimiza autenticação, esperas e infraestrutura mantendo a inteligência atual | 🟡 integrada com a baseline; aguarda validação dirigida própria. |
| [**R-150**](specs/R-150-agenda-util-retorno-rapido.md) | **Agenda útil e retorno rápido** — atalhos de 7/15 dias, ponte fixa, expediente comprovado e Agenda de segunda a sábado | ⏳ fila; não concorre com as correções P0. |
| [**R-139c**](specs/R-139c-status-dex-preservado.md) | **Status clínico confiável na saída do Dex** | ⏳ revisão 2 em contrato; classificação exige eval antes/depois. |
| [**R-133**](specs/R-133-dex-clinico-sem-perda.md) | **Dex clínico sem perda** | ⏳ executa depois de R-139c e antes do gate R-143. |
| [**R-141**](specs/R-141-captura-dex-sem-perda.md), [**R-142**](specs/R-142-contratos-hardening-dex.md) e [**R-143**](specs/R-143-revisao-clinica-segura-acessivel.md) | Captura, contratos e revisão clínica do Dex | ⏳ contratos aprovados; aguardam a ordem clínica acima. |
| **R-131 / R-132** | Patches de segurança e gate automatizado | ⏳ manutenção pré-lançamento; não misturar com o fluxo clínico. |
| **R-117 / R-116 / R-120 / R-119** | Fotos mobile, PWA, documentos e assinatura manuscrita | 🟡 no ar; validações de dispositivo, jurídica ou de uso real permanecem pendentes. |
| **R-95 / R-25 / R-37 / R-43-R-44** | Limpeza, hidratação, integridade de dentista e auditoria RLS | ⏳ manutenção preventiva em recortes próprios. |

## Produto clínico e operacional — verificado em produção

| Entregas | Estado |
|---|---|
| **R-49** — voz e campos de endodontia | ✅ |
| **R-60, R-122, R-123, R-125a** — ficha e Meu Dia: bancada de consulta, MultiDent, Campo Mágico, ortodontia livre e revisão organizada | ✅ |
| **R-110, R-111, R-118, R-126a** — agenda, retorno da secretária e comportamento mobile operacional | ✅ |
| **R-127 + R-128** — evento estrutural mais recente e escopos Boca toda/Arcada | ✅ |
| **R-130** — compromisso pessoal, orçamento de todos os procedimentos clínicos e ponte fixa | ✅ |
| **R-112, R-113, R-114, R-125b** — orçamento por responsável/fonte, aprovação parcial, parcelas e recebimentos | ✅ |
| **R-97 + R-103** — gestão da clínica, equipe, convites e painel Dex | ✅ |
| **R-121 + R-124** — porta de entrada, landing, login/convite e fundo arquitetônico | ✅ |

## Congelado ou posterior

| ID | Item | Condição de retorno |
|---|---|---|
| **R-140** | Prontuário/Atendimento remanescente | 🧊 retomada somente com build, prova transacional e RLS; materiais/etiquetas no R-140d. |
| **R-134** | Apresentação comercial | 🧊 volta com escopo comercial explícito. |
| **R-115** | Refino anatômico dos símbolos do odontograma | 🧊 referência clínica e artefato específico. |
| **R-49b** | Registro ao vivo no odontograma enquanto dita | 🧊 medir benefício sem distração. |
| **R-08** | Periodontia completa | ⏳ depois do lançamento e estabilização operacional. |
| **R-45 / R-88b** | Recall automático / importação de pacientes | ⏳ dependem de WhatsApp ou de clínicas pagantes. |

## Cortado ou absorvido

- **Aba Tratamento e modelos centrados nela:** ✂️ a Ficha é a base clínica.
- **R-33:** ✂️ orçamento é operado no perfil do paciente; a tela dedicada atende somente a
  operação necessária da secretária.
- **R-36:** ✂️ substituído pela gestão colaborativa e cobrança individual.
- **R-09:** ✂️ absorvido por R-49.
