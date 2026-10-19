# Segurança — pontos de entrada e limites

STATUS: ACTIVE
LAST_REVIEWED: 2026-10-18
CANONICAL_FOR: orientação de verificação de segurança; não inventário certificado de policies

Este documento orienta a verificação. Não declara que todas as tabelas, RPCs ou
regras de Storage passaram auditoria.

## Código consultado na baseline

`src/server/auth/clinic.ts` resolve Supabase Auth → `users.active_clinica_id` →
vínculo em `clinica_usuarios` + perfil em `dentistas`, exigindo vínculo ativo.
`src/server/authorization/` e consumidores conferem capacidades adicionais.
Esse fluxo não substitui checks nas RPCs, políticas RLS ou regras de Storage.

## Regras para qualquer alteração autorizada

- Clínica ativa e identidade vêm da sessão/servidor; não confiar em IDs/roles do cliente.
- Consultas de domínio têm escopo de clínica; tabelas multi-tenant exigem RLS.
- `SECURITY DEFINER` exige autorização interna, escopo, grants e `search_path` seguros.
- Testar permissão diretamente no servidor com duas identidades autenticadas,
  negativas entre clínicas/papéis e ausência de efeitos indevidos. Ocultar botão não basta.
- Conferir objetos do catálogo real; ledger de migrations ou SQL no Git não prova instalação.
- Credenciais de serviço ficam no servidor. Não copiar `.env`, tokens, payloads clínicos
  ou extratos para documentação, logs compartilhados ou pacotes de contexto.
- Em produção, auditoria é somente leitura. Escrita de QA exige autorização, dados
  sintéticos identificados e efeitos delimitados. Não induzir falha/carga em dados reais.
- Publicação e reversão precisam de escopo e autorização; reversão não restaura vulnerabilidade.

## Limites atuais

A limpeza documental não incluiu auditoria do banco ou testes autenticados.
Consulte [Estado](../plans/ESTADO.md) para a referência de aplicação e
[Roadmap](../plans/ROADMAP.md) para pendências relevantes. Não atribuir à produção
um achado de outro ambiente sem verificação no recorte autorizado.
