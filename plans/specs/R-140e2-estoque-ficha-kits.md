# R-140e2 — Consumo na ficha, kits e rastreabilidade

> **SPEC** · **R-140e2** · ⏳ fila · **Aberto:** 2026-09-11 · **Fase:** contrato proposto
> Passos 4–6 do [plano](R-140e-estoque-rastreavel.md); depende da base manual verificada.

## 1. Objetivo
Transformar o material efetivamente usado em movimento confiável sem perder o registro clínico.
Registro do uso, confirmação de etiqueta e baixa de estoque são fatos diferentes, com status visíveis.
Sem inferir consumo ao gerar orçamento, executar procedimento ou escolher kit.

## 2. Entrega por sublote
4: material selecionado/digitado manualmente na ficha, fila de pendências e baixa idempotente.
5: kits versionados sugerem composição; dentista confirma apenas o que usou.
6: R-140d entrega captura/extração revisada; vínculo ao item/lote/ativo é confirmado antes da baixa.
Lotes são independentes: não esperar OCR para registrar consumo manual de consumíveis.
Tipos especiais só ficam operacionais quando seu ciclo e gates completos estiverem implementados.

## 3. Autorização e autoria
- Registrar/corrigir declaração de uso na ficha: responsável clínico, `clinico.registrar` próprio,
  atendimento da clínica ativa e versão válida. Catálogo inacessível não pode ser pesquisado pela ficha.
- Baixar estoque após declaração: adicionalmente `estoque.ler` + `estoque.consumir` sobre cada item.
  `materiais.confirmar` valida etiqueta no escopo do atendimento; isoladamente não autoriza baixa.
- Sem permissão de estoque: declaração clínica salva; reconciliação pendente, nunca falso sucesso.
- Recepção com cadastrar/receber não confirma uso clínico nem altera evolução. Pode encaminhar pendência.
- Responsável autorizado regulariza uma declaração já confirmada pelo dentista: mapeia item/lote
  e aplica quantidade declarada; exige estoque.ler + estoque.consumir do titular. Se confirmar
  vínculo de etiqueta, exige também materiais.confirmar no atendimento permitido. O DTO mínimo
  limita a fila aos usos do estoque autorizado, sem conceder prontuário por regularização. Não muda descrição/quantidade clínica; divergência volta ao autor.
- Relatório de owner/secretária mostra material, quantidade, profissional e data permitidos, sem
  transcrição, anamnese, diagnóstico, nome do paciente ou link de prontuário por ter estoque.ler.
- Correção clínica nunca se disfarça de ajustar saldo; correção de inventário nunca reescreve ficha.

## 4. Persistência proposta
Reusar atendimentos_clinicos e odontograma_eventos, com FKs compostas por clínica. Conferir colunas
reais antes de DDL. R-140d continua dono de atendimento_rastreabilidade, capturas, itens e eventos.
Essas tabelas ainda são propostas: não alegar que já há captura/OCR entregue.

| Objeto novo/extensão | Contrato |
|---|---|
| estoque_usos | id, clinica_id, atendimento_id, linha_origem_id UUID, revisao, autor_usuario_id, snapshot_material, quantidade_declarada, unidade_declarada, item_id/lote_id/ativo_id nullable, estado_operacional, motivo_pendencia, kit_versao_id nullable, rastreabilidade_item_id nullable, substitui_id nullable, created_at. UNIQUE clínica+atendimento+linha+revisão. |
| estoque_kit_versoes | id, clinica_id, kit_id, versao, nome_snapshot, criado_por, created_at; UNIQUE kit+versão; publicada imutável. |
| estoque_kits | id, clinica_id, titular_tipo, titular_dentista_id nullable consistente, nome, ativo, versao_atual; escopo pela mesma titularidade do estoque. |
| estoque_kit_componentes | id, clinica_id, kit_versao_id, item_id, nome_snapshot, unidade_snapshot, quantidade_base positiva; FK composta e UNIQUE versão+item. Não fixa um lote futuro. |
| estoque_ativos | id, clinica_id, item_id, lote_id, identificador, numero_serie nullable, limite_usos nullable, estado, versao; identificação individual única no contexto apropriado. |
| estoque_ciclos | id, clinica_id, ativo_id, uso_id, iniciado_em, limpeza_em nullable, esterilizacao_referencia nullable, liberado_em nullable; eventos auditados e só um ciclo aberto por ativo. |

Payload clínico de estoque_usos é imutável após confirmação; correções criam revisão/substituição.
Estado operacional muda somente por RPC autorizada, com auditoria. Snapshot não depende de nome atual.
Estado: pendente_vinculo / pendente_autorizacao / pendente_saldo / pendente_sincronizacao /
confirmado / confirmado_divergente / substituido / cancelado; motivo específico, sem confundir
cancelamento administrativo com material clinicamente não utilizado.
Saldo insuficiente de consumível confirmado pode resultar confirmado_divergente (§6), não sucesso comum.
Movimentos usam origem_tipo=uso_atendimento, origem_id=uso.id, UNIQUE parcial por uso+tipo de fato.
Linha_origem identifica a intenção; dois consumos legítimos do mesmo material usam linhas distintas.
Rastreabilidade_item_id tem vínculo explícito; reanexar a mesma etiqueta não confirma uso novamente.
Não duplicar texto clínico em log de estoque acessível ao proprietário.
FKs de usos para atendimento, eventos e fatos usam ON DELETE RESTRICT, inclusive usos pendentes.
O legado exclui paciente fisicamente e atendimentos usam cascade: adicionar guard no fluxo de
exclusão e resposta tratada se houver material registrado. Informar que o histórico impede excluir;
DB RESTRICT é a garantia final mesmo em corrida. Não excluir usos para permitir o hard delete.
Não criar política nova de retenção/anonimização neste módulo; nenhum paciente será apagado na QA.
Revisões de uma linha são serializadas; somente uma revisão corrente e uma compensação por fato.
Novo pedido de correção usa a versão corrente, sem duas correções concorrentes da mesma origem.

## 5. APIs e fronteira de persistência

```ts
interface DeclaracaoUso {
  linhaOrigemId: string; descricao: string; quantidade: string; unidade: string;
  itemId: string | null; loteId: string | null; ativoId: string | null;
  kitVersaoId: string | null; rastreabilidadeItemId: string | null;
}
interface ConfirmacaoUso {
  clinicaIdEsperada: string; atendimentoId: string; usoIds: string[];
  versaoAtendimentoEsperada: number; chaveIdempotencia: string;
  divergenciasAceitas: { usoId: string; versaoItemEsperada: number }[];
}
```
Versão do atendimento deve usar revisão canônica existente; se não houver, definir versão aditiva
antes de codar o adapter, sem usar horário do cliente como mecanismo de concorrência.
- registrarMateriaisNaFicha({clinicaIdEsperada,atendimentoId,versaoEsperada,linhas,chave}) → usos/estado.
  Salva declaração clínica e pendência de estoque na mesma transação clínica; não grava estoque ali.
- confirmarUsos(ConfirmacaoUso) → resultados por uso, movimentos e pendências. Máx.50 linhas.
  Tudo solicitado confirmado atomicamente ou nada baixado; falha mostra linha/motivo, permite novo
  lote de confirmação explicitamente selecionado, com nova chave. Não falhar depois de baixar metade.
- regularizarUso({clinicaIdEsperada,usoId,versaoEsperada,itemId,loteId,ativoId,chave}) → resultado;
  não aceita quantidade/descrição novas e não eleva permissões. Contrato clínico original preservado.
- corrigirUso({clinicaIdEsperada,usoId,versaoEsperada,motivo,substituicao,chave}) → revisão clínica
  + pendência; compensação do estoque transacional ao confirmar. Enquanto pendente, saldo mantém
  último fato confirmado e interface sinaliza correção a aplicar, sem duas baixas ativas para mesma revisão.
- listarPendenciasEstoque({clinicaIdEsperada,titular,cursor}) → até50 pendências administrativas mínimas;
  negativa não revela material pessoal/paciente. Dentista vê pendências de suas declarações permitidas.
- criarKit/editarKit({contexto,titular,nome,componentes,versaoEsperada}) → nova versão;
  aplicarKit({clinicaIdEsperada,atendimentoId,kitVersaoId}) → somente sugestão revisável, sem reserva.

Zod: UUIDs e decimais canônicos R-140e1; descricao1–200, motivo1–500, max50 linhas por confirmação,
sem IDs de pacientes/atores escolhidos pelo payload. Duplicata de linha é inválida.
Ficha salva antes da chamada de estoque; resultado incerto fica pendente_sincronizacao.
Retry usa chave original e reconcilia resposta persistida. Se sessão encerra, próxima abertura
reconcilia usos pendentes, sem reaplicar movimentação que já foi concluída.
Travar item/lote/ativo e uso em ordem estável; reaplicar mesma linha/revisão com nova chave retorna
fato existente, não segundo consumo. Hash diferente para mesma chave retorna conflito.
Auditoria, inverso/substituto, estado de uso e resultado idempotente são atômicos no estoque.
Não exigir que a ficha espere rede/OCR/disponibilidade do catálogo para salvar seu conteúdo clínico.

## 6. Regras por comportamento

| Material | Ao usar | Saldo e recuperação |
|---|---|---|
| Consumível | Consome quantidade real do lote escolhido | Falta gera aviso; dentista confirma consumo real divergente, saldo pode ficar negativo e exige contagem posterior |
| Uso limitado | Marca uso de um ativo individual | Contador por usos confirmados; no limite sai de disponível; ultrapassar limite fica pendente/divergente, não disponibiliza o ativo |
| Reutilizável | Abre ciclo do ativo | Não reduz quantidade como descartável; indisponível até registrar limpeza, referência de esterilização e liberação responsável |
| Implantável | Liga unidade/lote/serial ao uso autorizado | Exclusividade transacional: não confirmar o mesmo ativo para duas pessoas/atendimentos |

Saída administrativa insuficiente continua bloqueada; exceção de saldo negativo só para declaração
clínica real confirmada nos usos listados em divergenciasAceitas. Lista vazia não aceita nenhuma.
Servidor primeiro retorna usos insuficientes e versões; somente esses IDs podem ser aceitos,
individualmente. Nova insuficiência ou versão alterada exige nova conferência, sem aceite global. Sem permissão não se aplica exceção por ser dentista.
Uso de ativo individual exige quantidade=1; consumo fracionário vale somente para consumíveis
em unidade-base cadastrada. Quantidade desconhecida não vira zero ou valor inferido: pendente até revisão do autor.
Lote/ativo vencido ou não identificado não recebe autorização automática de uso; o sistema registra
um fato clínico passado/divergência, não recomenda conduta nem diz que o material é seguro.
Usar item reutilizável não comprova esterilização; etiqueta identifica pacote/ativo, não consumível.
Correção de implantável/ativo não o devolve automaticamente a disponível: quarentena/revisão explícita,
com histórico de vínculo preservado. Nunca liberar segundo uso por simples estorno financeiro ou clínico.

## 7. Kits e privacidade
Kit é receita de sugestão, não protocolo clínico ou quantidade obrigatória. Sem material presumido.
Versão publicada imutável; kit usado mantém essa versão mesmo que catálogo mude amanhã.
Compartilhado só referencia itens compartilhados; kit pessoal pode combinar seus itens com comuns
que pode ler. Referenciar pessoal de outro profissional fica fora da primeira entrega de kits.
Visualizar/aplicar exige ler cada componente; confirmar exige consumir cada um. Acesso revogado
bloqueia componente sem expor seu nome/saldo. Compartilhar kit não compartilha estoque.
Duas unidades de um componente no kit podem virar uma, zero ou outra quantidade no uso real.
Remover componente da sugestão não gera descarte e não apaga uso que já foi confirmado.

## 8. Etiquetas/OCR
Fotografar/digitar → extrair R-140d → revisar → confirmar etiqueta → sugerir item/lote/ativo →
confirmar vínculo e quantidade utilizada → confirmar uso no estoque.
Código/GTIN+fabricante+lote/serial ajudam match; só descrição nunca autoriza baixa silenciosa.
Match único previamente confirmado pode vir selecionado, sempre revisável antes de consumir.
Imagem repetida é deduplicada na captura; consumo usa identidade da linha clínica, não hash da imagem.
Validar etiquetas reais de >=2 clínicas: legibilidade, campos recorrentes, associação correta,
correções necessárias e atrito da revisão. Campos ausentes permanecem ausentes; jamais inventar lote,
validade ou fabricante. Medir antes/depois de mexer em extração; erro crítico não passa silencioso.

## 9. Estados, visual e gates
Ficha: bloco Materiais com linhas compactas, origem pessoal/comum, lote, quantidade, estado e ação.
Histórico já assinado não é formulário livre. Gestor recebe fila administrativa em Estoque.
[Brief](../design/R-140e-estoque-DESIGN.md); proposta visual e artefato antes de implementar integração.

- [ ] Declarar uso sem rede/permissão/saldo conserva ficha; estado pendente é recuperável.
- [ ] Confirmar duas vezes mesma linha, inclusive chave nova, deixa uma baixa; duas linhas legítimas somam.
- [ ] Duas confirmações concorrentes de mesmo implantável não vinculam dois atendimentos.
- [ ] Paciente/item/lote/ativo de outra clínica e usuário com acesso revogado falham também por RPC.
- [ ] Kit3 materiais usado2 gera duas baixas; versão nova não muda o uso anterior.
- [ ] Correção gera revisão clínica e compensação rastreável; saldo anterior fica explícito até regularizar.
- [ ] Reutilizável usado não volta a disponível sem ciclo; limitado no limite não recebe uso normal.
- [ ] Falta de saldo permite consumo clínico divergente confirmado; nunca bloqueia salvamento da ficha.
- [ ] Secretária com cadastro não confirma uso; owner não clínico não acessa evolução pela fila/relatório.
- [ ] OCR errado/ausente/repetido preserva revisão humana e nunca cria baixa ou identificação inventada.
- [ ] Vazio, pending, confirmação, erro, conflito e recuperação em 390px/desktop/claro/escuro/teclado.
- [ ] Falha de auditoria reverte estoque inteiro; ficha previamente salva permanece intacta.
- [ ] Exclusão de paciente/atendimento com uso é bloqueada por guard e FK sem apagar histórico.
- [ ] Aceitar divergência em A não autoriza falta em B; kit antigo conserva nomes/unidades snapshot.

Fora: dedução automática por procedimento, orientação clínica gerada, câmbio de titular,
compra/finanças automáticas, rastreamento fictício de instrumental sem identificação.
