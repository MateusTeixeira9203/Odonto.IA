# R-140e1b — Operações manuais do estoque

12/09/2026 · Execução autorizada no Free pelo usuário; sem novos commits/push até sua conferência.
Complementa os contratos [R-140e1](R-140e1-estoque-base-manual.md) e usa R-140e1a.

## Contrato de transporte
RPCs autenticadas invoker, implementações privadas e tabelas sem acesso direto.
- `operar_estoque(p_acao text,p_entrada jsonb)` recebe os inputs camelCase dos schemas
  CadastrarItem/EditarItem/ReceberMaterial/ConsumirMaterial/DescartarMaterial/AjustarContagem.
  Ações: cadastrar, editar, receber, consumir, descartar, ajustar, corrigir.
- `consultar_estoque(p_acao text,p_entrada jsonb)` recebe listar ou detalhar.
  Listar: clinicaIdEsperada,titular,busca(default vazio),filtro(default todos),
  cursor nullable `{nome,id}`,limite(default25,até50).
  Filtros: todos,baixo,validade,divergente,arquivados. Todos inclui somente ativos;
  validade significa lote com saldo positivo vencido ou vencendo nos próximos30 dias.
  Divergente significa qualquer lote com saldo negativo; operações manuais impedem criar esse
  estado. O filtro pode legitimamente retornar zero até o consumo clínico R140e2.
  Detalhar: clinicaIdEsperada,itemId,cursor nullable `{ocorridoEm,id}`,limite(default25,até50).
  Cursor de movimento ordena ocorrido_em DESC,id DESC; item ordena nome ASC,id ASC.
- Inputs e outputs estritos, decimais string; ator e escopo vêm do contexto autenticado.

## Respostas
Todas usam EstoqueResult, falhas já definidas no contracts.ts. Saldo retornado é saldo do item.
- cadastrar/editar: `{itemId,versao}`.
- receber/consumir/descartar/ajustar: `{itemId,loteId,movimentoId:null|uuid,saldo:string,versao}`.
- corrigir: mesmo acima, `movimentoId` é substituto e `reversaoId:uuid` adicional.
- listar: `{itens:ItemResumo[],proximoCursor:null|{nome,id},total:number}`.
  ItemResumo: id,nome,unidadeBase,titular,controlaLote,minimo,saldo,ativo,versao,
  validadeProxima:null|ISOdate. Total do filtro, sempre limitado ao titular autorizado.
- detalhar: `{item:ItemResumo,lotes:LoteResumo[],movimentos:MovimentoResumo[],
  proximoCursor:null|{ocorridoEm,id}}`.
  LoteResumo: id,codigoFabricante:null|string,validadeISO:null|string,semIdentificacao:boolean,saldo:string.
  MovimentoResumo: id,loteId,tipo,quantidade:string,motivo,ocorridoEm:ISOdatetime,
  atorUsuarioId:uuid,atorNome:string,reversaoDe:null|uuid,corrigido:boolean.
  Não incluir paciente, origemId clínica, nota de ficha ou email do ator.

## Complementos da entrada
Recebimento vencido exige `aceitarVencido:true,motivoVencido:string` (1–500); sem isso nega.
Data de vencimento no passado conforme data civil America/Sao_Paulo; hoje permanece consumível.
Quando controle_lote=true, novo lote exige código fabricante; validade pode ser desconhecida.
Sem controle, desconhecido permanece explícito, sem inventar código/validade.
`corrigir` recebe clinicaIdEsperada,chaveIdempotencia,itemId,movimentoId,versaoEsperada,motivo,
substituicao `{tipo:entrada|consumo|descarte,quantidade:decimal positivo}` no mesmo item/lote.
Quando substituto for entrada em lote vencido, aceitarVencido/motivoVencido no input da
correção são obrigatórios, como no recebimento. Consumo vencido nega com INVALIDO; descarte permite.
INDISPONIVEL é reservado a indisponibilidade/resposta incerta, não à restrição conhecida de validade.
Exige ajustar e ação específica do substituto; somente fatos manuais originais, sem encadear
reversão/ajuste/consumo clínico. Corrigir um substituto posterior é permitido como novo original.
Valida saldo final e vencimento do substituto; mantém original, inverso exato e substituto atômicos.
Custo financeiro e conversão de unidade automática continuam fora deste lote.

## Invariantes de execução
Reusar contexto R140e1a. Pessoal exige titularDentistaId da sessão; comum exige ação concedida.
Locks de governança/membership/users/perfil/configuração precedem lock item/lote; revalidar
permissões antes de escrever. Grants/revogações devem serializar com operações.
Idempotência clínica+ator+chave: hash canônico inclui ação/input; mesmo payload retorna resultado
prévio após revalidar autorização. Diferente conflita; lock de chave cobre cadastro concorrente.
CAS no item, soma NUMERIC por lote e item, nada em float. Audit/fatos/versão/resultados atômicos.
Arquivar só com saldo zero em todos os lotes; fatos não apagados. Metadados de titular/unidade imutáveis.
Listagem/detalhe nunca revelam item de titular externo. Clínica trocada ou vínculo revogado nega.

## Execução e aceite
1. Migration e testes transacionais do catálogo/movimentos; revisão antes de aplicar no Free.
2. Adapters tipados e server actions, sem service key, testes focados.
3. Artefato de lista/detalhe/formulários com tokens do produto; UI em candidato para conferência.
4. QA com A/B, recepção e os dois proprietários fictícios já existentes; não duplicar clínicas.
5. Fluxo zero→entrada100→consumo2→98; ajuste igual sem movimentozero; descarte; correção;
   duplicação/replay; corrida duas saídas6 sobre10; auditoria falha não deixa escrita parcial.
6. UI claro/escuro, desktop/celular/teclado, conflito preserva rascunho e timeout repete mesma chave.
7. Registrar limites. Ficha/kits continuam R140e2; nunca fingir fluxo ainda não implementado.

## Rotas no piloto
Dentista: `/dashboard/meu-consultorio/estoque`, dentro do shell atual. Proprietário sem perfil
clínico e recepção: `/estoque`, reaproveitando o mesmo componente, guarda por vínculo e contexto
de estoque (não requireClinicContext que exige dentista). Link de retorno à equipe/dashboard.
Manter guards de Financeiro/Procedimentos intactos. Não liberar dashboard clínico ao proprietário
não dentista. Artefato/UI desta rodada ficam para conferência do usuário antes de commit/push.

## Referência visual medida
Artefato rascunho `plans/artefatos/R-140e1b-estoque-manual.html`, aberto por HTTP e medido via DOM.
Outfit corpo; DM Serif Display h1 36px (30px celular); h2 24px; DM Mono quantidades.
Lista radius16px, linha padding20px desktop/16px celular; colunas 1fr/120px/170px/24px.
Tokens herdados: background/card oklch(1 0 0), foreground oklch(.145 0 0), border #e2e2e5;
escuro background oklch(.145 0 0), card oklch(.205 0 0), foreground oklch(.985 0 0), border #27272a.
Implementar com tokens semânticos existentes, sem hex em componentes. Main max1536px,
padding32px desktop/16px celular, controles mínimos44px, grupos separados por24px.
Ordem: contexto → busca/filtro → lista → detalhe/lotes/histórico; cadastro/entrada em modal.
Artefato é proposta para conferência, não aprovação visual presumida; shell global existente preservado.

## Situação da execução
Operações e UI no candidato, migrations somente no Free. Evidências e limites no
[gate de 12/09](../auditorias/2026-09-12-r140e1b-estoque-manual.md).
Sem novos commits/push. Gate de falha de auditoria e Next integrado permanece aberto;
conferência do usuário antes de publicar. Não iniciar R140e2 como se este gate estivesse fechado.
