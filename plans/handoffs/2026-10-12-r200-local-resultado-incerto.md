# HANDOFF

## 1. Identificação
- Tarefa: R-182 / R-200, testes integrados locais seguros.
- Responsável: Auditor na execução; Coordenação na integração.
- Estado: recorte técnico concluído; fase encerrada operacionalmente pelo usuário
  com verificações residuais adiadas.
- Base: `codex/baseline-producao-v2@a1722c47c346a4a80c84ad6cd5efd0ee42afbf08`.
- Data: 12/10/2026.

## 2. Objetivo
Provar resultado incerto financeiro, retry, bloqueio, vencimento futuro e estorno
sem induzir falhas em produção ou usar dados reais.

## 3. Contexto mínimo
Usuário autorizou seguir as pendências testáveis com segurança. O laboratório
local agora executa Auth, PostgREST, Next e PG17 reais; não depende de Docker.
Código da aplicação copiado por `git archive`, sem mudanças.

## 4. Fonte de verdade utilizada
`AGENTS.md`, `00_FONTE_DA_VERDADE.md`, specs R-182/R-200 e auditoria dirigida
§12.20. Evidências em `plans/auditorias/evidencias-2026-10-12-r200-local/`.
Sem artefato visual aplicável. Skill `qa-web` aplicada ao ensaio.

## 5. Decisões tomadas
Proxy de falha restrito a loopback: após RPC 200, falhar uma releitura de pagamentos.
Permissões extras do bootstrap nativo foram removidas no laboratório conforme
manifesto de origem. Recomparação: 2.271 entradas da aplicação, zero divergência.
Retestes posteriores à conciliação passaram. Nenhuma correção de produto.

## 6. Fora de escopo
Escritas remotas, produção, dados reais, gastos, commit, push, deploy,
gateway, cópia de usuários/Storage ou restauração física da plataforma.

## 7. Arquivos alterados
Estado, atualização de R-182/R-200, adendo da auditoria, evidências sintéticas e este
handoff. Alterações documentais de rodadas anteriores preservadas.
Scripts/config/credenciais do laboratório ficam fora do Git.

## 8. Banco / schemas / APIs afetados
Somente laboratório `~/.local/share/odontoia-qa/r200-browser-lab/`.
Stack `03d1cc09747b60226ddc79b097f2b591ecaf3908b10ae89e70fe8b6b82729f15`;
Next 3140, proxy 3141, API 30983, banco 30807, todos locais.
Auth sintético A/B em clínicas distintas; schema público/privado exportado.
Serviços encerrados ao final, dados/evidências preservados para retomada.

## 9. Critérios de aceite
- [x] Resultado incerto e retry geral: um pagamento/log por intenção.
- [x] Etapa bloqueada ao fechar/reabrir, reconciliada após reload.
- [x] Auth A/B, negativas cruzadas e ausência de efeito indevido.
- [x] Data futura nativa, parcelas, Financeiro e recarga.
- [x] Estorno por etapa, trilha e recomposição sem perda do recebimento anterior.
- [x] Usuário decidiu encerrar operacionalmente a fase com testes residuais adiados.
- [ ] Testes residuais — não foram convertidos em PASSA.

## 10. Testes executados
- [x] Integração Auth/PostgREST/PG e UI/Server Actions no navegador.
- [x] Falha controlada, retry, recarga, teclado nativo e SQL antes/depois.
- [x] Comparação de catálogo e evidências com hashes.
- [ ] Nova auditoria geral, lint/build — código não alterado.
Resultado: PASSA no recorte. Ver §12.20 para números e limites por critério.

## 11. Problemas conhecidos
Confirmados nesta rodada: nenhum novo defeito de aplicação.
Verificação pendente: sessão expirada/retomada, lote de Ficha assinada com Auth
real, exceção de transporte do editor R-197. Não confundir isso com bug confirmado.
R-195 reabertura/negativa tem evidência anterior; feedback imediato desse retorno
não foi repetido no candidato atual. Atalho R-194 está inacessível pela rota atual.

## 12. Riscos de regressão
Nenhum código novo. Teste local usa runtime nativo e não reproduz toda a plataforma
Supabase hospedada. A falha foi na releitura pós-commit, não na infraestrutura real.

## 13. Próxima ação exata
Quando o usuário retomar os testes, usar §12.20–12.21 para executar somente o
cenário focal escolhido e registrar PASSA/NÃO PASSA/NÃO TESTADO. Sua revisão
manual dos fluxos clínico, financeiro e laboratório ocorrerá com mais tempo.
O fechamento operacional libera planejar a fase seguinte; R-198 ainda exige
despacho próprio para implementação. Não reabrir gates já passados sem evidência nova.

## 14. Não fazer
Não reaplicar schema exportado em produção; não restaurar dados reais; não usar
conta da portaria; não introduzir outra implementação para validar o código atual;
não publicar por causa deste handoff nem declarar cobertura 100%.

## 15. Estado da documentação
- [x] Estado, contratos e auditoria atualizados no recorte.
- [x] Resultados históricos mantidos e substituição explícita pelo adendo.
- [x] Handoff salvo; sem arquivamento de trabalhos alheios nesta rodada.
