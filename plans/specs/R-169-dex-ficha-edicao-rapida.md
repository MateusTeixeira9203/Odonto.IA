# R-169 — Dex fiel ao relato e edição rápida na ficha

> **SPEC** · **R-169** · 🔵 implementação integrada
> **Aberto:** 2026-09-14 · **Fechado:** — · **Fase:** todos os lotes autorizados; validação manual no preview
> **Revisão:** 2 — fluxos integrados e destaque exclusivo do orçamento dentro da ficha.
> Lote 1 Dex aceito em 14/09; usuário autorizou concluir todos os lotes e testar ao retornar.
> Destino: produto principal `odontoia.app`, Supabase `zenfemoxvwerplrjgfqz` (Odonto.ia).

## 1. Problema

O dentista precisa acrescentar procedimentos à ficha existente, mas “Complementar consulta”
abre a bancada de novo atendimento. A edição contextual permite observação/detalhes, sem nome.
O Dex aceita intervenções fora dos tipos visuais, mas o nome pode ficar apenas na observação,
enquanto a ficha exibe “Outro procedimento”. Texto, regiões, etapas e status precisam sobreviver
à extração, revisão e persistência, independentemente de cadastro no catálogo.

Exemplo fornecido em 14/09, sem identificação do paciente:
“Realizada osteotomia da maxila e da mandíbula. Instalados implantes nas regiões dos dentes
14, 24, 34, 32, 44 e 42. Confeccionadas próteses totais superior e inferior, e prótese protocolo
inferior provisória e definitiva.” Nos prints, prótese total e protocolo definitivo aparecem
sob “Outro procedimento”, e todos os itens visíveis estão em “A fazer”. Os seis implantes são
visíveis nos dois recortes; os recortes não provam ausência das demais intervenções.

O usuário também pediu retirar a prévia “Identificando”, levar a tela aos procedimentos após
Organizar e permitir vários relatos sucessivos, inclusive um procedimento por vez.

## 2. Decisão e limites

- Adicionar um botão **Adicionar procedimentos** no cabeçalho de Procedimentos, ao lado de
  **Coletar assinatura**. Abre um painel Dex compacto dentro da ficha, sem trocar a superfície.
- Texto ou voz → Organizar com Dex → revisão dos novos itens → Adicionar à ficha.
- Editar nome e observação no editor contextual existente; manter os detalhes técnicos disponíveis.
- A ficha conserva sua identidade. Adição não cria ficha, atendimento, agendamento ou evolução
  narrativa nova; registra autoria/data da alteração na auditoria. A data original não muda.
- A bancada completa permanece para **Novo atendimento**. “Complementar consulta” deixa de ser
  a entrada para adicionar procedimentos; preservar eventual edição de evolução em ação própria.
- Catálogo é vínculo opcional de cadastro/preço. Nome clínico é texto livre e não exige cadastro.
- Fidelidade primeiro: não reduzir campos nem descartar intervenções para ganhar velocidade.
  Primeiro corrigir contrato/parser/apresentação; troca de modelo só se o eval demonstrar necessidade.
- **Oferecer as diferenças da ficha ao orçamento pertence a [R169b](R-169b-ficha-orcamento-ajustes.md),
  parte obrigatória desta entrega.** Aviso explícito de faltantes, inclusão só dos selecionados e
  retirada revisada, inclusive em orçamento com pagamentos. Não é reforma da edição financeira geral.
- Botão âmbar/contador sinaliza **somente procedimentos novos para incluir no orçamento da ficha
  aberta**. Sem destaque no prontuário geral, Meu Dia, histórico de consultas ou aba geral de orçamentos.
  Renomear, remover, alterar status ou valores não acende esse indicador. Comportamento em R169b.
- Esta decisão substitui, neste recorte, “nome apenas em observação” de R133 e a prioridade
  exclusiva de latência de R151. Os demais contratos/gates dessas frentes não são reativados em lote.

## 3. Objetivo e sequência de execução

**Objetivo:** registrar e corrigir procedimentos específicos na própria ficha, sem refazer uma
consulta, e receber do Dex uma revisão completa e legível.

| Etapa | Trabalho | Evidência necessária para seguir |
|---|---|---|
| 0 — ambiente | Worktree da versão produtiva, preview Vercel ligado ao principal, clínica de teste existente | SHA/host conferidos; localhost encerrado a pedido; identificar clínica/paciente antes de QA com escrita |
| 1 — Dex | Golden/baseline → nome tipado, regiões/etapas/status, revisão, retirar prévia e scroll | Sem migration; eval antes/depois, erro recuperável e QA no Meu Dia |
| 2 — editar nome | Editor contextual + RPC compatível de detalhes, auditoria e rederivação | SQL clínico de edição isolado; duas contas, assinatura, reload e orçamento preservado |
| 3 — adicionar na ficha | RPC aditiva + painel compacto, lotes/recuperação e projeção da ficha inteira | SQL aditivo isolado; painel conforme brief, retry sem duplicação, reload/assinatura sem consulta fictícia |
| 4 — incluir no orçamento | R169b: resumo/âmbar, faltantes, seleção e inclusão incremental | SQL de vínculo/concorrência isolado; 0/1/vários orçamentos e pagamentos anteriores preservados |
| 5 — retirar/revisar | R169b: item↔evento, retirada histórica, pendências e revisão de cobrança | Schema/RLS/RPC próprios; duas contas, grupos/legado e pagamento parcial de teste |
| 6 — liberação | QA integrado e revisão técnica/UX de cada lote antes da publicação | Revisão técnica antes do preview; usuário faz QA integrado ao retornar; aceite exige §8 e R169b |

Subagentes Terra/high investigaram Dex, ficha e orçamento nesta sessão. Execução é integrada pela
thread principal; reviewers verificam o recorte antes de commit/merge, QA valida ao fim.

### Mapa dos fluxos clínicos e pontos de integração

Cada linha é uma jornada de teste ponta a ponta, complementar aos estados da §5. Persistência
e fórmulas permanecem nas respectivas seções de contrato; este mapa identifica quem participa.

| ID | Entrada → caminho real/proposto → saída | Prova de integração |
|---|---|---|
| C01 | Pacientes → `paciente-detail-client` → `ProntuarioTab` → abrir uma ficha | ID/paciente/autor corretos; nenhum destaque no prontuário geral |
| C02 | Cabeçalho Procedimentos → painel Dex compacto proposto | Campo na ficha, ao lado da ação de assinatura; nenhuma bancada/consulta nova |
| C03 | Texto → `CapturaLivreCard` → `formatar-evolucao` → parser/reconciliação → rascunho | Nome/região/evidência completos, inclusive `outro`, sem persistência automática |
| C04 | Microfone → `useCapturaLivre` → `/api/transcrever` → texto → C03 | Permissão negada, áudio interrompido, transcrição falha e retry preservam captura; texto continua disponível |
| C05 | Organizar → consumidor da resposta → IDs novos → cards → scroll | Primeiro item do lote visível antes de salvar; zero request da prévia parcial |
| C06 | Adicionar mais → outro lote → revisar/editar/remover rascunhos → confirmar | Lotes e edições anteriores preservados; texto antigo não reenviado |
| C07 | Adicionar à ficha → action/RPC aditiva → rederivação/auditoria → leitura atualizada | Mesma ficha e zero novo atendimento/evolução; retry não duplica |
| C08 | Reload → `get-prontuario-longitudinal` → `projetarFichasProntuario` → ficha inteira | Adições sem atendimento próprio continuam visíveis e contadas, inclusive ficha sem visita associada |
| C09 | Editar item → `ProcedimentoDetalheFicha` → `editarDetalhesEvento` → reload | Nome/observação/detalhe persistem sem mudar catálogo/status/preço; grupo não perde integrantes |
| C10 | Meu Dia → `CampoMagicoMeuDia` → mesma extração → revisão/scroll → save vigente | Contrato clínico comum, mas gravação de consulta/agenda segue fluxo atual; sem CTA âmbar novo aqui |
| C11 | Ficha alterada → invalidar resumo de orçamento → entrada exclusiva da ficha | Encadeia fluxos O01–O14 de R169b; só adições elegíveis sinalizam âmbar |
| C12 | Remover/renomear persistido → action clínica → orçamento relacionado | Diferença pendente durável conforme R169b; não chama exclusão integral da ficha |
| C13 | Trocar ficha/paciente/rota durante captura ou request → cancelar/ignorar resposta obsoleta | Rascunho não migra de paciente; recuperar captura compacta por chave própria |
| C14 | Assinar/encaminhar/gerar documento depois da edição | Autoria, limites de assinatura, nomes novos e histórico preservados; nada muda sem gesto próprio |

Dependências transversais: `get-patient-workspace-data`/`get-prontuario-longitudinal` leem a base;
`projetarFichasProntuario` não pode depender só dos eventos de visitas para compor a ficha inteira;
`get-meu-dia` lê os mesmos nomes/pendências; `derivarV2DosEventos` alimenta campos legados/documentos.
Após mutação, invalidar leitura da ficha, resumo de orçamento e projeções do paciente sem limpar
rascunhos não salvos. Testar retorno pelo histórico e abertura direta da ficha, não só o caminho novo.

## 4. Contrato técnico

### 4.1 Fatos conferidos e superfícies

- `src/app/api/dex/formatar-evolucao/route.ts`: schema, prompt e `parseEventos`; já aceita `outro`.
- `src/lib/dex/reconciliar-procedimentos.ts`: fallback de texto sem evento gera indicado revisável.
- `src/types/odontograma.ts`: `OdontogramaEventoInput`/`Draft` já têm `procedimentoNome` e `procedimentoId`.
- `src/lib/odontograma/montar-rows-eventos.ts`: serializa `procedimento_nome`/`procedimento_id`.
- `src/components/pacientes/ProntuarioTab.tsx`: cabeçalho, seleção da ficha e rótulo do procedimento.
- `src/components/pacientes/procedimento-detalhe-ficha.tsx` e
  `src/server/patients/registro-actions.ts::editarDetalhesEvento`: editor e action a ampliar.
- `src/components/fichas/captura-livre-card.tsx`, `src/hooks/useCapturaLivre.ts`,
  `src/app/dashboard/meu-dia/_components/campo-magico-meu-dia.tsx`: reusar captura/organização.
- Produção consultada **somente por metadados** em 14/09: colunas de nome/vínculo/assinatura existem;
  `salvar_eventos_odontograma(uuid,uuid,uuid,jsonb,boolean)` existe com sincronização padrão ativa;
  `editar_detalhes_evento_odontograma(uuid,jsonb,boolean,text,boolean)` não recebe nome.
- `acrescentarEventosNaFicha` em `rotear-visita.ts` usa `p_sincronizar:false`, mas grava evolução.
  Reusar sua serialização/rederivação, não chamar esse fluxo completo na entrada compacta.

### 4.2 Extração e nome

- Manter `POST /api/dex/formatar-evolucao` e os campos existentes de `EvolucaoFormatada`.
  Uma chamada estruturada via `generateStructuredGemini`, com `responseSchema` e `feature`;
  avaliar `thinkingBudget: 1024` só nesta rota para fidelidade, preservando modelo e timeout de 30s.
- Acrescentar `procedimento_nome: string | null` ao evento **wire** e converter para
  `procedimentoNome` no domínio. Nome identifica a intervenção; `observacao` guarda os detalhes.
  O schema exige a chave; o parser tolera respostas antigas sem ela, para compatibilidade.
- Nome: trim, 1–500 caracteres quando preenchido; `outro` precisa de nome clínico não vazio.
  Para resposta legada `outro` sem nome, preservar `observacao` como nome de exibição, sem apagá-la.
  Não truncar silenciosamente; conteúdo excedente fica visível para revisão.
- Nome clínico específico ganha do rótulo visual em ficha, revisão, Meu Dia e novos documentos.
  Leitura legada usa `procedimentoNome || (tipo === 'outro' ? observacao : null) || TIPO_LABEL[tipo]`.
  Não reescrever eventos históricos em massa nem PDFs/documentos já assinados.
- Não escolher procedimento/preço parecido por fuzzy. Preservar o nome narrado; catálogo ausente
  deixa vínculo/preço sem definição. Nome livre não impede organizar nem salvar a ficha.
- Extração preserva intervenção, localização explícita e qualificadores (superior/inferior,
  provisória/definitiva, remoção/instalação). Tipos visuais não equivalem à identidade clínica.
- Negação isolada fica nas anotações, sem criar item a fazer; indicação adicional explícita pode criar o item.
  Curativo executado tem nome próprio e tipo outro. Histórico não vira execução de hoje; fallback é revisável.
- Decisão explícita do dentista sobre o lançamento prevalece. Sem override, usar evidência por item;
  eventual conflito entre o modo escolhido e o relato fica visível na revisão, nunca silencioso.
- Reconciliação e merge não podem colapsar duas intervenções só por terem mesmo tipo e região.
  Divergência sem cobertura aparece para revisão, sem inventar localização/status/preço.

### 4.3 Adição na mesma ficha

Contrato proposto para nova action em `src/server/patients/registro-actions.ts`:

```ts
type AdicionarProcedimentosFichaInput = {
  fichaId: string;
  pacienteId: string;
  capturaId: string; // UUID desta entrada; reutilizado em retry
  eventos: OdontogramaEventoDraft[]; // apenas novos, com IDs estáveis
};
type MutacaoFichaResult =
  | { ok: true; fichaId: string; eventoIds: string[] }
  | { ok: false; error: string;
      code: 'INVALIDO' | 'SEM_PERMISSAO' | 'ASSINADO' | 'CONFLITO' | 'INDISPONIVEL' };
```

- Zod valida UUIDs, lote não vazio e campos clínicos existentes. Clínica/ator vêm da sessão.
- Nova RPC aditiva recebe a ficha, paciente e lote; lock da ficha, validação de todos os itens,
  inclusão e rederivação dos campos legados/status da ficha com auditoria **na mesma transação**.
  Usar semântica `p_sincronizar:false`; nunca chamar a RPC de substituição com parâmetro omitido.
- Validar ficha/paciente/clínica, autoria e `assinado_em`. Evento assinado permanece imutável;
  uma ficha não assinada pode receber eventos novos mesmo contendo eventos antigos assinados.
- ID já existente com mesmo payload e destino é retry sem duplicação; com destino/payload
  diferente é conflito, nunca update implícito de um procedimento existente.
- `capturaId` e IDs dos eventos sobrevivem a erro/perda de resposta; nova entrada intencional recebe
  novos IDs. Repetir o texto em outra entrada não autoriza apagar ou fundir itens por nome.
- **Adicionar mais** após organizar guarda o lote em revisão e abre entrada limpa com outro
  `capturaId`; não reenvia o relato anterior. Após persistir, limpar somente texto/revisão dos
  lotes confirmados e manter o painel aberto. Uma entrada nova ainda não salva nunca é apagada
  pelo sucesso de um lote anterior. Erro não limpa texto, resultado nem identidade do lote.
- Não passar pelo criador de atendimento nem pelo salvamento integral da ficha. Não mudar
  texto clínico anterior, data original, alerta ou dados ortodônticos por payload parcial.
- Ao atualizar a consulta de leitura, os novos eventos devem aparecer na **ficha inteira**, mesmo
  sem pertencer ao atendimento antigo. Não criar atendimento fictício para fazê-los aparecer.
- Ampliar `ProntuarioFicha` com `eventos: ProntuarioEvento[]`, alimentado por todos os eventos
  da ficha autorizada em `get-prontuario-longitudinal`, antes de separá-los por atendimento.
  Lista, contadores, odontograma contextual e seleção para assinatura usam essa coleção;
  `atendimentos[].eventos` conserva o histórico de cada visita, sem anexar novidades à visita antiga.
- Recuperação compacta usa chave clínica/ator/paciente/ficha e guarda texto, lotes e IDs estáveis.
  Reusar mecanismos de `clinical-draft`, sem reutilizar o estado integral de `useRegistrarPainel`
  com evolução/destino de consulta. Troca de conta nunca restaura o rascunho de outro ator.

### 4.4 Editar nome e detalhes

- Ampliar `editarDetalhesEvento` com `procedimentoNome?: string` e `alterarNome?: boolean`.
  Omissão mantém o comportamento antigo. Nome vazio é validação; não vira rótulo genérico.
- Acrescentar ao fim da RPC parâmetros opcionais `p_procedimento_nome text DEFAULT NULL` e
  `p_alterar_nome boolean DEFAULT false` e `p_original jsonb DEFAULT NULL`, sem overload ambíguo.
  Preservar chamadas com cinco argumentos, grants e validações anteriores.
- Nome + observação + detalhe alterados no mesmo gesto gravam juntos, com rederivação da ficha
  textual e auditoria. `original` contém nome/observação/detalhe; comparar só campos editados no lock;
  conflito retorna `atual` e mantém o rascunho; revisar versão atual antes de reaplicar explicitamente.
- Só o autor autorizado pode renomear. Permissão recebida para detalhe técnico de encaminhamento
  não concede automaticamente poder de renomear o procedimento do colega.
- Nome edita apenas `odontograma_eventos.procedimento_nome`; preserva `procedimento_id`, tipo,
  região, status e catálogo. Trocar identidade clínica/cadastro exige ação própria, fora do rename.
- Orçamento persistido não recebe renomeação/preço automático. Oferecimento explícito é R169b.

### 4.5 Prévia e navegação após organizar

- Remover a **prévia IA de relato parcial** chamada pelo usuário de “Identificando”, incluindo
  disparos automáticos do cliente para `/api/dex/detectar-consulta`. Manter revisão final do Dex.
- Neste checkout a rota existe, mas não há call-site ativo localizado. Conferir bundle/Network da
  versão produtiva antes da remoção; não apagar outra área para simular atendimento ao pedido.
  “Identificado nesta consulta” do histórico salvo não é a prévia e fica preservado.
- Sugestão local de catálogo não é a prévia IA. Não remover funcionalidades distintas por rótulo.
- `CapturaLivreCard.onOrganizado` continua entregando resposta estruturada + relato. O dono do
  rascunho cria/mescla os eventos e obtém `eventoIdsNovos`, associados à ficha/captura atual;
  não acrescentar IDs persistentes ao contrato HTTP de extração para viabilizar o scroll.
  Após montar os cards, rolar uma única vez ao primeiro resultado desse lote, **antes de salvar**.
  No Meu Dia, abrir a seção de procedimentos se necessário;
  no painel compacto, mostrar os novos rascunhos, ainda não persistidos, para revisão.
- Respeitar container real, barra fixa, teclado mobile e reduced-motion. Não rolar em erro,
  resultado vazio, refresh ou alteração de status. Foco não fica escondido nem reabre o teclado.

## 5. Comportamento — o alvo funcional

| Estado/gatilho | Resultado observável |
|---|---|
| Ficha sem itens | CTA visível; painel vazio com digitação/voz e Organizar |
| Adicionar procedimentos | Painel abre abaixo do cabeçalho, sem rota/modal/bancada nova |
| Organizando | DexLoader; impedir segundo envio do mesmo lote, preservar texto e rascunhos anteriores |
| Organização concluída | Revisão com nome, região, situação e detalhes; scroll aos novos itens |
| Mais uma entrada | Campo reutilizável; segundo lote soma ao primeiro e conserva edições feitas |
| Adicionar à ficha | Salvar lote confirmado; só remover rascunhos confirmados após sucesso; mostrar na lista |
| Cancelar revisão | Descartar só lote não salvo mediante decisão do dentista; ficha existente não muda |
| Texto sem intervenção | Aviso claro, sem procedimento inventado; manter texto editável, sem scroll |
| Erro de validação/rede/IA | Mensagem junto da ação; texto/IDs/rascunho preservados para correção/retry |
| Sem permissão ou assinado | Motivo claro; servidor recusa toda escrita; não oferecer editor inoperante |
| Ficha removida/desatualizada | Conservar rascunho, informar e permitir recarregar; não migrar para ficha nova |
| Resposta de paciente anterior | Ignorar por chave ficha/paciente/captura; nunca anexar ao próximo paciente |
| Conflito de edição/retry | Sem sobrescrita/duplicação; recarregar estado atual e manter edição para reaplicar |
| Salvar nome | Título atualizado após reabrir, detalhes preservados, catálogo e orçamento inalterados |

## 6. Referência visual

Brief e tokens: [R169 DESIGN](../design/R-169-dex-ficha-DESIGN.md), fonte única de geometria.
Referência oficial: ficha mostrada pelo usuário, Dashboard e Meu Dia. Não redesenhar essas telas.
Antes de componente novo: artefato curto `plans/artefatos/R-169-dex-ficha-edicao-rapida.html`
(a produzir, sem aprovação presumida), com painel/revisão/edição, CTA/aviso de orçamento e mobile/light/dark.
Artefato aprovado é contrato visual; extrair medidas com `artefato-visual`, sem leitura do HTML.

## 7. Invariantes

1. Mesmo `ficha_id`; registros existentes e documentos assinados preservados.
2. Nome livre não altera preço, catálogo, autoria, tipo, região ou status implicitamente.
3. Nenhuma intervenção desaparece por enum/catálogo/merge; ambiguidade exige revisão visível.
4. Permissões por clínica e autor continuam no servidor/RPC; nenhum acesso baseado só na UI.
5. Organizar não persiste nem recebe pagamento. Adicionar persiste apenas o lote confirmado.
6. Erro/retry/troca de paciente não perde texto nem duplica/transfere procedimentos.
7. Prompt clínico só muda depois de baseline e só é promovido com eval posterior aprovado.

## 8. Gates de aceite e liberação

- [ ] **Extração:** ampliar `evals/extracao-clinica/golden.json` e `run.cjs` antes da mudança.
  Avaliar nome/região/evidência e qualificadores, não apenas presença de `tipo`.
  Caso de 14/09 conserva 12 unidades de informação: 2 osteotomias, 6 implantes, 2 totais,
  2 protocolos. Agrupamento visual é permitido sem perder distinções. Executar 3 vezes antes/depois;
  candidato passa 3/3, sem extras nem perdas; conjunto existente não regride.
- [ ] **Variações:** remoção de implantes preexistentes 46/47; extração 22; implante/pilar/coroa
  sem localização inventada; negação, histórico, procedimento desconhecido, mesma região com
  intervenções distintas. Status com override explícito e sem override testados separadamente.
- [ ] **Ponta a ponta:** snapshot do nome/região/status persiste e reaparece após reload na ficha,
  Meu Dia, preparação de orçamento e documento novo; documento assinado anterior não muda.
- [ ] **UI:** todos os estados da §5 exercitados; dois lotes sucessivos preservam itens e edições;
  editar nome/observação funciona sem abrir bancada; prévia parcial não aparece nem gera request.
- [ ] **Integração clínica:** C01–C14, incluindo reload de adição sem atendimento, assinatura da
  ficha inteira e recuperação compacta; histórico de visitas conserva seus vínculos anteriores.
- [ ] **Scroll:** sucesso no Meu Dia e painel compacto mostra lote novo; erro/vazio não move;
  desktop/mobile/teclado/barra fixa/reduced-motion e foco acessível conferidos.
- [ ] **Persistência:** adicionar aumenta apenas eventos/auditoria, sem nova ficha/atendimento/evolução;
  falha forçada reverte toda a transação; retry idêntico não duplica; lote inválido não salva parcialmente.
- [ ] **Autorização:** duas contas logadas, outra clínica, colega, encaminhamento e assinatura total/parcial;
  testar cliente antigo contra RPC atualizada. Grants/RLS não ampliados por conveniência.
- [ ] **Qualidade/tempo:** baseline aquecido de pelo menos 20 casos; medir p50/p95 total/IA e custo
  com `feature`, sem relato nos logs. Não impor meta antiga de velocidade sacrificando fidelidade.
  Proposta operacional: p95 ≤15 s; se exceder, trazer medição para decisão antes de liberar.
  Manter timeout/erro recuperável; nenhum timeout pode virar “sucesso” parcial.
- [ ] **Checks:** testes focados, typecheck/lint do recorte e build/QA integrado em ambiente capaz.
  Usuário substituiu localhost por preview Vercel em 14/09; não rodar Next/build pesado local.
- [ ] **Produção:** confirmar SHA e schema de destino de novo; migration compatível e isolada somente
  se necessária (RPCs aqui exigem atualização; coluna de nome já existe). Inspecionar objetos, não
  confiar em `schema_migrations`. Não aplicar lote de migrations pendentes do checkout.
- [ ] **Entrega:** commit por unidade reversível (docs/SQL/Dex/UI separados); diff sem R157/R163/estoque
  não relacionados. Push/deploy seguem aprovação do lote verificado, não o mero pedido desta spec.
- [ ] **Rollback:** reverter app mantém nomes/lotes salvos; RPC nova é aditiva/compatível; não apagar
  procedimentos para voltar versão. Guardar DDL anterior das funções alteradas e testar cliente antigo.

Validação autorizada em 14/09: **preview Vercel → banco principal → clínica de teste existente**.
Gravações de teste são reais nesse banco; identificar clínica/paciente, sem usar pacientes reais como fixtures.
SQL altera também o site produtivo: revisar compatibilidade/rollback de cada migration antes de aplicar.
Base conferida na Vercel: `14fde60a215286b37e5cd8dd2c65aac92fce05d5`; branch `codex/r169-dex-ficha`.
Worktree: `/home/mtx/.local/share/odontoia-testes/r169-dex-ficha`; localhost encerrado.
Preview na branch própria, sem promover domínio principal; usuário testa o roteiro e dá aval por lote.

## 9. Fora de escopo

Redesign geral da ficha/Meu Dia; abrir plano automaticamente; novos modelos de clínica/estoque;
cadastro automático do catálogo; troca de fornecedor/modelo sem eval; diagnóstico ou conduta
inventada; reextração em massa de fichas antigas; edição de documentos assinados; reforma do chat Dex.
Recebimentos e ajustes de orçamento não serão improvisados dentro deste recorte: seguem R169b.
