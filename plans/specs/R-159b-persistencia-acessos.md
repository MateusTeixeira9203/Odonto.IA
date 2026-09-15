# R-159b — Persistência protegida de acessos

> **SPEC** · R-159 · 🔵 ativo · Aberto: 2026-09-11 · Fase: contrato
> Execução isolada autorizada pelo usuário: “pode seguir pro próximo lote”.
> Recorte incremental de R-159; aprovação de UI e liberação externa continuam separadas.

## 1. Problema

R-159a representa identidade e catálogo, mas não armazena configurações nem histórico.
Precisamos validar a transação de edição antes de trocar as regras usadas pelas rotas atuais.

## 2. Decisão

Criar armazenamento aditivo, leitura autenticada e edição exclusiva pelo responsável explícito.
Toda governança deste lote tem estado fixo `preparacao`: não governa recursos do aplicativo.
Não adicionar modelo_gestao em clinicas nem reinterpretar admin legado como proprietário.
Nenhuma policy, guard, dado clínico, assinatura ou tela atual será alterado.
Configuração inicial será somente fixture no banco de teste; não existe bootstrap público.
Delegação, alteração de teto, convites, conversão, ativação e retirada de membro são lotes seguintes.
O teto fica persistido como [] e não concede delegação nesta etapa.

## 3. Objetivo

Salvar configurações válidas com versão, motivo e auditoria atômica; negar acessos externos,
escrita direta, replay divergente e edição por cargo legado ou pessoa removida.

## 4. Contrato técnico

Tabelas novas: clinica_governanca, clinica_acessos, clinica_acessos_auditoria (campos R-159).
Governança: estado CHECK somente preparacao; responsável explícito, versão positiva.
Vínculo membro+clínica consistente por FK composta, sem mover/reescrever membros antigos.
Concessões: catálogo R-159a, versão inicial 1, arrays JSONB estritos, teto default [] e
CHECK vazio até existir o contrato de delegação. Perfil personalizado; atuação clínica
derivada de vínculo/profissional legítimo, nunca inferida de uma linha de secretária.
Auditoria append-only: antes/depois, motivo 1–500, ator auth.uid(), chave UUID,
hash SHA-256 do payload canônico e resultado; UNIQUE clínica+ator+chave.
Nenhuma escrita direta para anon/authenticated; SELECT com RLS por clínica ativa e membro ativo.
Membro lê apenas sua configuração; responsável ativo lê configurações/auditoria da unidade.
Governança não é pública nem criação/transferência disponível via RPC.

RPC `preparar_acessos_membro(p_clinica_id uuid, p_membro_id uuid,
p_versao_esperada integer, p_acessos jsonb, p_motivo text, p_chave_idempotencia uuid)`.
Retorno `{ok:true,data:{versao:number}}` ou `{ok:false,codigo,mensagem}`;
códigos INVALIDO, SEM_ACESSO, NAO_ENCONTRADO, CONFLITO, CONTEXTO_ALTERADO, INDISPONIVEL.
Versão esperada positiva; configuração existente obrigatória neste lote.
Ator autenticado com clínica ativa esperada, vínculo ativo e responsável explícito.
Não editar o próprio responsável neste recorte, nem elevar por `permissoes.gerir` legado.
Lock governança → membros em ordem de UUID → users FOR SHARE → configuração; serializar operações na unidade.
Revalidar ator/alvo no banco, mesmo com JWT antigo. UUIDs/alvos normalizados; ordenação
de permissões/alvos não muda hash. Payload inclui clínica, alvo, versão, acessos e motivo.
Replay igual retorna resultado já salvo; divergente conflito. Validar autorização atual antes
do replay. Versão alterada gera conflito; incremento + auditoria + resultado na mesma transação.
JSON validado também no banco: chaves/escopos fechados, sem duplicados, máx.42 permissões,
selecionados 1–200 UUIDs distintos de dentistas ativos admin/dentista da mesma clínica.
Próprio clínico/profissional requer perfil legítimo; próprio de acompanhamento usa usuário.
Concessão clínica exige perfil clínico legítimo. Dependências de autorização dos recursos
serão exigidas na ativação; aqui salva-se configuração em preparação, sem conceder uso.
Auxiliares privilegiados em schema privado, search_path fixo e grants mínimos;
wrapper público invoker para RPC, sem aceitar identidade/teto do formulário.

Adapter server-side tipado: entrada Zod estrita reutiliza catálogo; chama RPC autenticada,
sem service-role, sem cache de autorização e sem expor erros internos. Resposta remota validada.
Nenhum consumidor de produto ainda. Biblioteca pura + adapter testados com dependência estreita.

## 5. Comportamento

Responsável → validação → locks/revalidação → replay/versão → gravação + auditoria → versão.
Vazio: acesso [] válido; não cria registro por engano. Configuração inexistente: não encontrado.
Erro de dados: inválido, sem alteração parcial. Falha de banco: indisponível, sem detalhe interno.
Pessoa de outra clínica ou sem responsabilidade: nega mesmo alterando IDs ou chamando REST.
Duas edições simultâneas na mesma versão: uma vence, outra conflito; nenhum histórico perdido.
Repetição de mesma chave não duplica histórico. Auditoria não pode ser editada/apagada pelo cliente.

## 6. Referência visual

Sem UI de produto neste lote. Harness privado leve serve apenas aos testes de duas contas
autenticadas no navegador, usando Supabase Free; não substitui QA de futuras telas do app.
Usuário reforçou em 11/09 a exigência de alinhamento com Dashboard, Meu Dia e Ficha,
qualidade visual e animações discretas. Aplicar os artefatos aprovados nas futuras telas,
com verificação em claro/escuro e celular; o harness não é referência visual do produto.

## 7. Invariantes e recuperação

Somente etlqznuoxiilvxzygpat pode receber DDL/fixtures. Produção permanece intocada.
DDL e fixture separadas. Capturar contagens/hashes de fatos existentes antes/depois da DDL.
Lock timeout curto e statement timeout; sem DROP, reset, exclusão de fatos ou backfill de clientes.
Exceção de teste: adicionar/remover somente uma constraint temporária na tabela nova de auditoria,
rejeitando um motivo QA reservado para forçar falha e verificar rollback da edição. Não apaga dados;
a constraint deve ser removida ao terminar, mesmo se a verificação falhar.
Rollback operacional: descontinuar chamadas ao adapter/RPC, preservar novas tabelas/histórico;
remoção de grants da RPC em migration futura, sem retornar governança ativa ao legado.
Não aplicar em produção neste lote. Referência CLI local pode apontar à produção: não usar db push.

## 8. Gates

- Tipos, lint e testes de contrato: payload adulterado, erro técnico, retorno inesperado.
- Revisão SQL de grants/RLS, search_path, locks, validação de alvos, idempotência e transação.
- Duas contas autenticadas reais no navegador de QA: leituras próprias, negação cross-clínica,
  negação de escrita direta/edição sem responsabilidade, edição autorizada e replay.
- API QA adicional: versão concorrente, chave divergente, alvo/escopo inválido, vazio,
  vínculo removido com mesmo JWT, escrita/auditoria indivisíveis, acesso anônimo negado.
- Catálogo SQL/TS compatível; fatos financeiros/clínicos legados inalterados pela migration.
- Sem consumidores novos nas rotas, sem promoção de R-159 completo ou produção.

## 9. Próximos lotes

Delegação limitada e dependências; enforcement por módulo com policies legadas revisadas;
cadastro/convite com condição comercial R-165; editor e painéis aprovados; ativação gradual.

## Evidência do lote — 11/09/2026

Persistência aplicada e testada somente no Free. Migration `a229706` e adapter `9bb12ac`
na branch `codex/testes-integrados`. Revisão técnica passou; 20 testes de código,
37 verificações API e 179 casos de paridade do catálogo passaram. Navegador com sessões
autenticadas verificou responsável não clínico, membro comum, outra clínica e revogação
sem renovar sessão. Falha forçada de auditoria reverteu a configuração inteira.
54 tabelas antigas, 58 funções e 108 policies permaneceram iguais após DDL.
Detalhes e limites no [relatório](../auditorias/2026-09-11-r159b-persistencia-isolada.md).
