# Campanha dentista · ALFA Dev 2 · lotes 5–9

Playwright (`chromium`, canal Edge existente), sem instalação global, retries,
trace, vídeo, HAR ou storageState. Só contas Ana, Sara, Bruno, admin e protético
existentes no odonto-qa. Senhas e chaves são carregadas em memória pelo `contexto`.

## Ambiente e execução

Servidor congelado `Odonto.IA-dentistadev2`, porta **3013**, HEAD integral
`3d14edb231c318c4f005f57818a41233e8bab6ad`. Guard confere HEAD antes/depois e `src`
sem alterações. Não usa o3000. `exigirHostQa` e fetch guard só permitem o host
`uhuxteswtvgdnlixwrdu.supabase.co`; o navegador bloqueia outros hosts externos.
Nenhum script consulta produção. `page.request` acessa somente a base local fixa.

```powershell
npm.cmd run qa:snapshot-up -- --nome dentistadev2 --commit 3d14edb --porta 3013
$env:DENTISTA_D2_READY='3d14edb-odonto-qa'
node e2e/dentista-estresse/preparar.mjs
node e2e/dentista-estresse/05-apagar.mjs
node e2e/dentista-estresse/06-papeis.mjs
node e2e/dentista-estresse/07-isolamento.mjs
node e2e/dentista-estresse/08-agenda.mjs
node e2e/dentista-estresse/09-estresse.mjs
```

**Não repetir automaticamente esses comandos em banco com esta fixture existente.**
Cada lote recusa sobrescrever evidência. Uma repetição exige revisar a hipótese,
novo snapshot aprovado e nova faixa própria; nunca remover relatório para forçar
replay. `preparar.mjs revisado` é a segunda tentativa do seed inicial (primeira
transação revertida integralmente por status inválido); não é retry de produto.
`releituras.mjs` repete apenas leitura e documenta os dois defeitos de automação
da rodada inicial (shell antes de notFound e cópia responsiva oculta).

## Fixtures e limites

Faixa exclusiva **d025d200**, sem ES, Paciente Exclusao QA, e015e800 ou e015b300.
Seed via conexão PostgreSQL QA validada, INSERT parametrizado em transação, sem
DDL/migration e sem alterar usuários/papéis.4pacientes funcionais+36para busca,
7fichas,60procedimentos/35evoluções na ficha grande, orçamentos/financeiro próprios.
Cada ID está no `00-preparo-revisado.json`; os lotes registram IDs gerados pela
aplicação e paths sintéticos de assinatura para limpeza posterior por lista exata.
Sem cleanup automático, para conservar reprodução. Nunca limpar por faixa,
LIKE, nome, conta, clínica ou DELETE sem WHERE. Não apagar auditoria de terceiros.

| Lote | Caminhos exercitados |
|---|---|
|05|UI motivo/nome/Outro4/5/200/201; RPC negativas; apagar/recarregar; auditoria/cópia; Entendi; aceite/financeiro preservado; fallback RLS|
|06|PDF administrativo/completo/negado; cópia só admin; autoria; Sara/CRO; seleção mista; REC-4; entrega protética/repetição|
|07|7rotas,3PDFs,6tabelas RLS,3FK23503 e20ações autenticadas negativas; hashes antes/depois próprios|
|08|UI abrir/buscar/cancelar; Server Actions criar/editar/trocar/check-in/cancelar/encaixe/conflito; persistência e recarga por dentista|
|09|UI duplo clique,3requests mesma chave,2abas/conflito,2profissionais,60procedimentos/35evoluções,40pacientes/busca,offline/recuperação,rede lenta/recarga,back/forward e4combinações tamanho/tema|

Server Actions são chamadas com sessão real e IDs do manifest **do snapshot**.
Esses casos estão identificados e não equivalem a percorrer todos os formulários
por cliques. O teste da cópia protegida consulta RLS diretamente; não afirma UI
administrativa de consulta. Seletores e assertions preservam falhas como regressões.
Não há `skip` implícito para conta faltante, endpoint faltante ou erro.

## Evidência e ciclo de correção

Tabelas cenário × PASSOU/FALHOU × evidência, JSON seguro, PNG e DOM visível em:
`Projetos/Odonto-IA/log/dentista-dev2-3d14edb/`. Cada falha permanece no relatório;
releituras não apagam histórico. Capturas não serializam scripts ou credenciais.
IA real, carga em escala e contraste visual integral estão fora desta prova.

Achado novo → Orquestrador/Dev1 → regressão/portão verde → Revisor/commit local →
QA em **novo snapshot** → rodada final de todos os roteiros no commit final.
Banco/migração,6migrações C4,risco alto/produto ou antigos AGE-OBS/REC-4/MD-07
vão ao quadro do usuário. Este pacote não altera produto nem corrige permissões.
Não encerrar C4 com falha escondida ou só compilação/listagem como evidência.
