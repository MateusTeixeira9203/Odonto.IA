# R-197 — Editar preço e quantidade no orçamento vinculado à Ficha

STATUS: ACTIVE — gate do perfil no Preview PASSA; rota global e falha de transporte não testadas
OWNER: Implementar — código e teste; Coordenação — integração; Auditor — gate
LAST_REVIEWED: 2026-10-12
CANONICAL_FOR: correção da edição destrutiva de itens vinculados à Ficha

## Problema e decisão

No Preview `2c52879`, editar um orçamento ligado à Ficha chama `editarOrcamento`,
que apaga e recria todos os itens. `orcamento_eventos.item_id` referencia os IDs
antigos; o DELETE falha. O usuário precisa editar **preço e quantidade agora**.
Bloquear a edição não atende ao requisito.

O recorte é atualizar no lugar itens já existentes de orçamento ligado à Ficha,
sem mudar seus IDs nem os vínculos clínicos. Vale para orçamento ainda sem item
aprovado, aceite, cobrança, valor acordado, parcela ou pagamento. Orçamento com
histórico comercial/financeiro usa a revisão R-172 existente. Inclusão e retirada
de procedimentos continuam nos fluxos incrementais R-169b; esta operação não
altera descrição, composição, desconto ou responsabilidade.

## Contrato técnico

- Uma RPC transacional, com `SECURITY DEFINER`, `search_path` fixo, grant somente
  a `authenticated`, valida clínica ativa e dentista responsável no servidor.
- Entrada: orçamento, versão `updated_at` vista pela tela e lista completa de
  `{id, quantidade, preco_unitario}`. IDs devem ser únicos, existentes, ativos e
  corresponder exatamente aos itens atuais. Validar quantidade, preço, casas
  decimais e limites; rejeitar omissão, inclusão e item de outro orçamento.
- Travar orçamento e itens em ordem estável; conferir versão e elegibilidade
  dentro da transação. Atualizar `quantidade`, `preco_unitario`, `preco_total` e
  `orcamentos.total = max(0, subtotal - desconto atual)`. Preservar demais campos,
  em especial `orcamento_itens.id`, `orcamento_eventos.item_id`, aprovação e
  `procedimento_id`. Um log registra ator, IDs e valores anteriores/novos.
- Falha, conflito ou permissão negativa não deixam atualização nem log parcial.
  A Action mapeia erros seguros. As duas entradas de edição existentes (perfil
  do paciente e lista de orçamentos) devem enviar IDs e versão e atualizar a
  apresentação somente após resposta confirmada, seguida de recarga.
- Se a tela permitir mudar descrição, adicionar ou remover itens nesse modal,
  não os envie silenciosamente à RPC restrita. Mostre orientação para o fluxo
  incremental, mantendo o rascunho na tela. Não reescreva o editor inteiro.

## Aceite observável

| Estado inicial e ação | Resultado esperado | Efeito proibido | Verificação |
| --- | --- | --- | --- |
| Orçamento sintético ligado à Ficha, sem histórico financeiro; responsável altera preço e quantidade | Mesmo item e vínculo após recarga, valores e total corretos, um log | DELETE/reinsert, desvincular evento ou duplicar item | Preview + banco antes/depois + reload nas duas entradas |
| Payload omite/duplica ID, inclui ID alheio ou versão antiga | Conflito/erro acionável e estado intacto | Salvar metade do lote ou log parcial | RPC direta com conta QA |
| Segunda conta sem responsabilidade, secretária ou outra clínica tenta RPC | `sem_permissao` e efeito zero | Acesso por chamada direta apesar da UI | Duas contas QA autenticadas, com SELECT antes/depois |
| Orçamento aprovado/aceito/com cobrança/parcelas/pagamento | Encaminhado à R-172 ou rejeitado sem mutação | Alterar histórico financeiro silenciosamente | Caso sintético com histórico e recarga |

Preservar o orçamento sem Ficha, a revisão R-172, retirada/adição R-169b,
assinaturas, repasses e parcelas. Não aplicar migration, commit, push ou deploy
no despacho de implementação; integração decide após auditoria dirigida.

## Execução local — 2026-10-12

- Criada a migration forward-only `20261012150833_r197_editar_valores_orcamento_vinculado.sql`:
  RPC `editar_valores_orcamento_vinculado` transacional, com versão, trava do
  orçamento/itens ativos, autorização por clínica e dentista responsável,
  preservação de IDs/vínculos e log único com antes/depois.
- A Action `editarValoresOrcamentoVinculado` valida o payload e traduz erros da
  RPC para mensagens seguras. Os dois modais de edição passaram a enviar apenas
  ID, quantidade, preço e versão para orçamento de Ficha; após sucesso fecham e
  recarregam. Antes da recarga, aplicam somente total, versão e valores retornados
  pela RPC aos mesmos IDs locais, sem inventar item; em erro preservam o rascunho.
  Alterar descrição, adicionar ou remover linha mantém o rascunho e orienta usar
  o fluxo incremental da Ficha.
- O perfil encaminha qualquer aceite, aprovação, valor acordado, cobrança,
  parcela/pagamento ou plano para o fluxo R-172 já existente. A RPC também
  rejeita esses casos para proteger chamadas diretas.
- Itens retirados ou com composição de grupo permanecem no fluxo incremental
  R-169b; a RPC os rejeita antes de qualquer atualização.

| Critério | Estado | Evidência local | Limite pendente |
| --- | --- | --- | --- |
| Itens vinculados preservados e total/log corretos | PASSA | PGlite e PostgREST autenticado: preço/quantidade, total, IDs, dois vínculos e um log verificados; consumidores aplicam retorno confirmado | Recarga renderizada pelas duas entradas não testada |
| Payload inválido ou versão antiga sem efeito parcial | PASSA | PGlite e PostgREST autenticado: versão antiga, omissão, duplicação e ID estranho; valores, vínculos e log intactos | Concorrência simultânea não testada |
| Dentista não responsável, secretária e outra clínica sem efeito | PASSA | PGlite cobre três identidades; PostgREST confirma secretária e participação suspensa com duas contas QA autenticadas, `sem_permissao` e efeito zero | Outra clínica não foi repetida no ambiente publicado |
| Histórico comercial/financeiro preservado | PASSA | PGlite: aprovação, valor acordado, assinatura, cobrança e pagamento rejeitados sem log | Execução visual do R-172 e dados reais não testados |
| Retirada, grupo e payload SQL nulo | PASSA | PGlite: dois bloqueios R-169b e `p_itens = NULL` sem log | Não repetido no ambiente publicado |

Validação adicional: `pnpm typecheck` passou; ESLint focal concluiu sem erros e
com 31 avisos preexistentes nos dois clientes. A migration foi aplicada depois
do gate local por decisão de integração; esta auditoria não fez migration,
commit, push, deploy ou escrita em dados reais.

## Gate pós-aplicação — 2026-10-12

Ambiente: projeto Supabase `zenfemoxvwerplrjgfqz`, clínica QA B, somente contas e registros
sintéticos novos. Marcador da execução válida: `QA R197 POSTGREST b2c5f03c`.

| Critério | Estado | Evidência | Limite |
| --- | --- | --- | --- |
| Catálogo e ACL efetiva | **PASSA** | Função com assinatura esperada, `SECURITY DEFINER`, `search_path=public`; execução para `postgres`, `authenticated` e `service_role`, sem `PUBLIC`/`anon` | Catálogo prova o objeto vivo, não a UI |
| Responsável autenticado atualiza no lugar | **PASSA** | PostgREST HTTP 200; mesmos dois IDs e mesmos dois vínculos; total 225 → 306 com desconto 25; um log antes/depois | UI e reload não exercitados |
| Secretária e participação suspensa | **PASSA** | Duas identidades QA; secretária e dentista suspenso receberam `sem_permissao`, com snapshot idêntico | Perfil inativo ficou coberto pelo PGlite, não repetido aqui |
| Lista exata e item alheio | **PASSA** | Omissão, duplicação e item de outro orçamento recusados sem efeito | — |
| Retry da versão consumida | **PASSA** | Retornou `conflito`; nenhum valor ou vínculo mudou e nenhum segundo log foi criado | Chamadas concorrentes simultâneas não exercitadas |
| Limpeza QA | **PASSA** | Zero resíduo pelo prefixo/marcador em autenticação, perfis e entidades clínicas criadas | A primeira rotina de limpeza precisou incluir `clinica_acessos`; todos os resíduos sintéticos foram removidos antes da repetição válida |
| Duas entradas e recarga | **NÃO TESTADO** | Nenhum navegador foi usado; as duas contas QA descartáveis foram removidas no cleanup e não deixaram sessão ou credencial reutilizável | Provisionar novas identidades sintéticas autorizadas e validar perfil do paciente e lista de orçamentos no Preview |
| Histórico comercial/financeiro | **NÃO TESTADO no projeto publicado** | Nenhuma fixture financeira foi criada | Preservação continua sustentada pelo gate PGlite e deve ser verificada via jornada R-172 quando exigida |

Resultado: o gate pós-aplicação da RPC **PASSA** no recorte de API, autorização, atomicidade
observável, IDs/FK, total, log e retry. O item continua `ACTIVE` até a validação renderizada das duas
entradas e da recarga. Nenhum novo achado funcional foi confirmado.

## Correção local R197-UI — 2026-10-12

O achado confirmado `R197-UI-01` mostrou que o modal de edição exigia revisão somente para item
aprovado, pagamento recebido ou aceite, enquanto o salvamento já encaminhava também `status='aprovado'`,
valor acordado, plano, cobrança e qualquer pagamento ao R-172. A divergência escondia a confirmação
obrigatória e bloqueava o usuário nesses estados legados.

- `exigeRevisaoComercial` passou a ser a fonte única usada pelo perfil e pelo modal. Ela cobre item
  aprovado, status aprovado, valor acordado, plano, cobrança, pagamento e aceite; não altera o contrato
  R-172 nem a elegibilidade da RPC restrita.
- As duas entradas da edição restrita agora cercam a Server Action com `try/catch/finally`. Uma rejeição
  excepcional libera `saving`, mantém o rascunho e mostra orientação para recarregar antes de continuar.
- O estado de salvamento do perfil só é iniciado depois das validações locais, preservando a possibilidade
  de corrigir um erro de estrutura ou versão sem deixar o formulário bloqueado.

| Critério adicional | Estado | Evidência | Limite |
| --- | --- | --- | --- |
| Todos os sinais de histórico exibem revisão R-172 | **PASSA local** | 8 testes unitários: sem histórico e os sete sinais do predicado | Nenhum teste de componente/browser executado |
| Rejeição excepcional da Action libera o formulário | **PASSA estático** | `try/catch/finally` nas duas entradas; erro não limpa itens nem fecha o editor | Promise rejeitada não foi induzida em componente/browser |
| Tipos e estilo da correção | **PASSA** | `pnpm typecheck`; ESLint focal com 0 erros e 31 avisos preexistentes | — |

Esta correção não fez migration, escrita de QA, commit, push ou deploy. A validação renderizada e a
repetição do gate UI pelo Auditor continuam pendentes.

## Gate de browser no Preview — 2026-10-12

Preview Vercel `dpl_GD2g32dDQSUnySRm64oRfDckX9pf`, commit `5cbd956a4f8c6c136d62fa819c0be236a7661dcf`;
identidade e registros novos, sintéticos e removidos ao final na clínica QA B.

| Critério | Estado | Evidência | Limite |
| --- | --- | --- | --- |
| Perfil: preço, quantidade e resposta imediata | **PASSA** | `1 × 100` e `3 × 50` viraram `2 × 125,50` e `1 × 80`; modal e cartão passaram de R$ 225 para R$ 306 antes do reload | Somente a entrada real do perfil |
| Persistência, IDs/FK e log | **PASSA** | Reload preservou os valores; banco manteve dois IDs e dois vínculos e criou um único log antes/depois | Concorrência simultânea não repetida |
| Conflito de versão e rascunho | **PASSA** | Segunda aba com versão antiga recebeu mensagem acionável; rascunho `4 × 70` / `2 × 60` permaneceu e não criou segundo efeito | Queda de transporte não induzida |
| Entrada global | **NÃO TESTADO** | `/dashboard/orcamentos` redireciona para o perfil | Não contar como segunda montagem |
| Limpeza QA | **PASSA** | Contagens finais zero para entidades clínicas e identidade descartável | — |

Resultado: o fluxo R-197 pelo perfil **PASSA no Preview** com estado imediato, persistência, reload,
versionamento e preservação de vínculos. A rejeição excepcional de transporte e a rota global
redirecionada permanecem **NÃO TESTADAS**; nenhum novo achado foi confirmado.
