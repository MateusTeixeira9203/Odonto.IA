# R-159c — Entrada de gestão e consulta da equipe

> **SPEC** · R-159 · 🔵 ativo · **Aberto:** 2026-09-11 · **Fase:** contrato
> Execução no ambiente separado autorizada nesta conversa; produção não autorizada.
> Revisão posterior: gestor delegado fora da próxima entrega; Financeiro pessoal integral conforme R-161.
> Recorte do [R-159](R-159-acessos-clinica.md), após a persistência R-159b.
> Base de consulta implementada/verificada no Free; entrada/UI em implementação autorizada.
> Evidências e ressalvas: [gate do recorte](../auditorias/2026-09-11-r159c-equipe-isolada.md).

## 1. Problema e decisão

O proprietário não dentista não consegue entrar no dashboard sem um perfil em `dentistas`.
Dar-lhe `admin` seria incorreto: o legado associa esse cargo a acesso clínico.
A primeira entrega de Equipe consulta membros por autorização explícita, fora do layout clínico.
Editar concessões, convidar e remover exigem os próximos contratos de delegação/transação;
não reaproveitar actions legadas privilegiadas só porque seus botões já existem.

## 2. Nomenclatura definida pelo usuário

| Modelo da clínica | Pessoa responsável | Atendimento |
|---|---|---|
| Colaborativa | Sem proprietário promovido automaticamente | Dentistas compartilham a unidade |
| Com proprietário dentista | Proprietário | Também tem perfil clínico real |
| Com proprietário não dentista | Proprietário | Atua somente na gestão |

Gestor é função delegada, não um quarto modelo nem sinônimo de proprietário.
Proprietário que atende reúne a atuação de dentista e a gestão completa da unidade.
Não exige outra pessoa como gestor. Delegação é opcional; atuação clínica é independente.
Matriz de páginas e personas confirmada pelo usuário: [R-161 §2–3](R-161-meu-consultorio.md).
Uma unidade por vez. Pagador, valor de assinatura, franquias e novo cadastro externo não entram.

## 3. Recorte executável

- Vínculo interno `gestor` para o membro não clínico, sem criar linha artificial em `dentistas`.
- Isolamento desse vínculo dos recursos legados; autorização nova não depende do helper legado.
- Consulta paginada da equipe pela unidade ativa, sem prontuário, pacientes ou valores financeiros.
- Protótipo de Equipe e permissões seguindo o brief R-158, para revisão visual do usuário.
- Entrada funcional de consulta só pode ser conectada depois dos gates de isolamento.
- Colaborativa existente permanece no fluxo atual; não inferir modelo pela ausência de governança.

## 4. Contrato técnico

Catálogo efetivo do Free conferido em 11/09: 111 policies e 64 funções public/private.
`users` tem id/email/active_clinica_id, sem nome nem role; `clinica_usuarios` tem role/status.
Novo valor é aditivo em `clinica_usuarios_role_check`; não ampliar `ClinicRole` clínico.
`getMemberContext` aceita `gestor` e retorna `perfilClinico: null` sem buscar perfil profissional.

`get_my_clinica_id()` preserva o ramo legado e retorna NULL para vínculo gestor da unidade ativa.
O bloqueio permanece após suspensão/remoção; vínculo clínico ativo legítimo de outra unidade
continua utilizável quando a unidade ativa muda. Policies por join em dentistas e RPCs definer
também entram na verificação; negar somente na interface não é aceite.

RPC proposta `public.listar_equipe_gestao(p_clinica_id uuid, p_apos uuid DEFAULT NULL)`:
wrapper invoker, implementação privada definer com search_path fixo e grants mínimos.
Somente leitura, autenticação pelo `auth.uid()`, unidade atual por `users.active_clinica_id`.
Exige vínculo ativo e governança em preparação; responsável explícito ativo OU concessão
`equipe.ler` com escopo `clinica` na configuração atual do próprio membro.
Cargo admin/dentista/gestor isoladamente nunca autoriza essa RPC.
Autorizar antes de consultar dados dos demais membros; nenhuma service key na aplicação.

```ts
type TeamMember = {
  membroId: string; nome: string; email: string;
  papel: 'admin' | 'dentista' | 'secretaria' | 'protetico' | 'gestor';
  status: 'ativo' | 'pendente' | 'suspenso' | 'removido';
  proprietario: boolean; atuaClinicamente: boolean;
};
type TeamPage = {
  clinicaId: string; clinicaNome: string;
  membros: TeamMember[]; proximo: string | null;
};
type TeamResult = { ok: true; data: TeamPage } | {
  ok: false; codigo: 'INVALIDO' | 'SEM_ACESSO' | 'CONTEXTO_ALTERADO' | 'INDISPONIVEL';
  mensagem: string;
};
```

Página de 50 vínculos, ordem determinística por id, cursor exclusivo; não excluir histórico.
Nome de exibição vem de dentista/secretária da mesma unidade ou metadado de nome do próprio
usuário, com fallback para email; nome nunca participa da autorização. Projeção escapada pela UI.
Perfil clínico exige vínculo e profissional ativos com role admin/dentista na mesma unidade.
Owner explícito é governança; `admin` legado aparece como Administrador legado, não proprietário.
Adapter valida entrada/saída com Zod estrito; erro de rede não vira lista vazia.

## 5. Estados e exemplos

Carregando com skeleton; resultado com unidade visível; vazio confirmado; erro com tentar
novamente; sem acesso sem dados do alvo; contexto alterado pede recarregar, sem seguir em outra clínica.
Owner não clínico vê nomes/funções na RPC e não vê fichas nem caixa via REST.
Gestor delegado com leitura vê equipe; retirar `equipe.ler` bloqueia a próxima chamada com JWT antigo.
Membro da B não consulta A, mesmo conhecendo IDs/cursor. Paginação repete autorização inteira.
Nenhuma consulta habilita escrita, convite, remoção ou concessão implicitamente.

## 6. Visual

[Brief R-158](../design/R-158-modelos-clinica-gestao-DESIGN.md); artefato rascunho
`plans/artefatos/R-159c-equipe-gestao.html`. É exemplo de organização, NÃO aprovação visual.
Correção expressa do usuário em 11/09: a barra inferior global permanece. A página inteira
Meu Consultório/Minha Clínica é um de seus destinos; pode ter menu lateral INTERNO.
Equipe pertence à gestão em Minha Clínica, não ao consultório pessoal do colaborativo.
O shell global lateral do preview é transitório; o menu interno não substitui a navegação global.
Proprietário sem atuação clínica usa o mesmo padrão, sem exigir um perfil dentista.
Nova proposta: `plans/artefatos/R-159c-equipe-gestao-v2.html`, ainda rascunho para revisão.
Preservar Outfit, DM Serif Display, DM Mono; tokens do produto; espaçamentos 8/12/16/24.
Lista → pessoa → função/atuação → permissões agrupadas → resumo/motivo.
O protótipo distingue simulação de salvamento de ação real; não promete 42 acessos já ativos.
Claro/escuro, 320/390px, teclado, foco e movimento reduzido. Sem redesenhar dashboard.

Medidas do rascunho inspecionadas no DOM: título desktop 42px/DM Serif Display; corpo Outfit.
Página #0d0d0d dark/#f4f4f6 light; superfície #111112/#ffffff; borda #27272a/#c2c2c6;
texto teal #5dbeb0 dark/#1e7060 light. São valores dos tokens existentes, não novas cores.
320px light e 390px sem overflow; modelo continua visível com quebra de linha.

## 7. Gates

- [x] Migration aditiva Free, sem alterar registros existentes nem produção.
- [x] Perfil gestor sem dentistas; próprio contexto continua acessível, legado clínico negado.
- [x] Catálogo efetivo revisado: policies/RPCs/Storage sem bypass novo identificado para o vínculo.
- [x] Duas sessões reais: owner/gestor C e pessoa B; campos/cursor adulterados negados.
- [x] Revogar leitura e suspender vínculo com aba aberta bloqueia a próxima operação.
- [x] Legado A/B preservado; usuário clínico em outra unidade continua com acesso legítimo.
- [x] Contrato de saída mínimo, páginas sem duplicação, falha técnica distinta de vazio.
- [x] Typecheck/lint focados, revisão técnica; sem Next/build completo neste computador.
- [x] Protótipo inspecionado nos dois temas e celular; aprovação visual ainda do usuário.

## 8. Limites explícitos

Este recorte não ativa todos os módulos nem transforma preparação em enforcement geral.
Delegação de escrita, teto, convites, remoção, novo onboarding/login gerencial definitivo e
integração ampla Meu Consultório seguem depois da base de leitura verificada.
Nenhuma promessa de estabilidade total ou liberação externa decorre deste lote.

## 9. Integração de consulta autorizada — 11/09

Rota `/equipe`, fora do layout que exige dentista. Ativada somente no projeto Free
`etlqznuoxiilvxzygpat`, com cobrança Stripe desativada; gate no servidor, sem parâmetro
de URL/cookie capaz de ativá-la. Origem oficial continua desativada até contrato comercial.
Isso é um piloto com contas fictícias, não uma nova regra de gratuidade para proprietários.

Página autentica, resolve contexto e chama a RPC de consulta; paginação por Server Action
revalida o mesmo contexto e a RPC. Falha apaga dados exibidos quando perde acesso/contexto;
não reapresentar equipe da unidade anterior nem tratar erro como lista vazia.
Quem tem perfil clínico real pode voltar ao Atendimento; membro gestor não recebe esse link.
Gestor encaminhado pelo login para dashboard/onboarding deve chegar à Gestão sem ciclo;
gestor suspenso/removido recebe acesso indisponível, sem formulário para criar dentista.
Ausência de governança não é evidência para rotular clínica como colaborativa.

Usar o artefato como exemplo de organização; a decisão de navegação da §6 prevalece.
Consulta → selecionar pessoa → função,
status e atuação. Busca identificada como filtro dos membros carregados, paginação explícita.
Editor, salvar, convite e desativação não simulam sucesso: continuam indisponíveis até
contratos transacionais próprios. Não reutilizar actions legadas de escrita por cargo.

Aceite adicional: login de gestor sem dentista chega à equipe; login clínico continua no
dashboard; URL clínica de gestor não entra em loop; sem concessão não expõe nomes; sair
funciona; paginação e erro/contexto alterado; celular 320px, claro/escuro e teclado.

Ajustes de volume/responsividade na integração: lista com rolagem até 440px mobile/560px
desktop; seleção mobile leva foco ao detalhe; nomes completos no detalhe. Contagem refere-se
às pessoas carregadas. Referência apresentou overflow em 1024px; breakpoint da grade foi
corrigido no artefato antes do código para empilhar até 1279px, preservando as duas colunas em 1280px.

QA no preview encontrou skeleton preso no caminho login → onboarding → equipe, enquanto
acesso direto funcionou. Correção de navegação do piloto: middleware de sessão lê unidade/vínculo
próprio e proxy encaminha gestor a `/equipe` ANTES de renderizar dashboard/onboarding, inclusive
suspenso (negação na página). Isso também cobre favoritos antigos, sem depender do formulário.
Convite/redefinição de senha preservam seus destinos. Cookies renovados seguem no redirect;
os guards de servidor/RPC permanecem obrigatórios. OAuth ainda requer gate integrado próprio.

## 10. Achados para o próximo contrato — 11/09

Inventário somente leitura no candidate; nenhum novo módulo liberado por esta revisão.
`getMemberContext` resolve vínculo/atuação, mas não nome da unidade, proprietário nem concessões.
Gestor não pode reaproveitar queries clínicas: o helper legado retorna NULL de propósito.
Próximo recorte precisa de contexto mínimo derivado do JWT/unidade ativa, sem service key;
proprietário vem de governança explícita, nunca de admin, nome de perfil ou ausência de registro.
Sem governança configurada: manter acesso clínico legítimo e informar gestão não configurada;
não classificar automaticamente a unidade como colaborativa nem criar responsável.

A única leitura nova efetiva é `equipe.ler`; os demais grants continuam preparação.
Não devolver o catálogo bruto ao menu como se autorizasse módulos. Provisionamento de
modelos/governança e escrita delegada ainda exigem contratos transacionais próprios.
Lacuna: o backend atual aceita `equipe.ler` para protético, se concedida. O modelo confirmado
restringe protético à agenda/confirmação; corrigir no autorizador/RPC e testar com duas contas,
não apenas esconder Equipe. Nenhuma concessão foi criada nesta investigação.

### Revisão visual v2 — histórico, superado na simplificação posterior

V2 não é contrato visual aprovado; o Financeiro ilustrativo não atende ao reuso integral solicitado. Desktop segue proporções
medidas do Dashboard: margem 32px, título 36px/DM Serif Display, seção 24px; cards com
padding 20px e raio 18px, números Outfit em negrito. Mobile usa título 32px, menu interno
select e cabeçalho global; dock desktop com SVGs outline e nomes de destino do produto.
Controles externos alternam seis personas, tema e conteúdo fictício. Proprietário dentista
começa administrando sozinho; delegado opcional. Colaborativo não tem Equipe/Recepção.
No root, troca para proprietário não dentista removeu detalhes clínicos da agenda e tema
escuro funcionou sem overflow na largura efetiva de 734px. Menu global mobile é representação
com feedback de demonstração, não drawer de navegação do app conectado.
A validação anterior de 320/390/1280 precisa ser repetida após o último ajuste de navegação;
não presumir que a rodada anterior cobre automaticamente o HTML final.
