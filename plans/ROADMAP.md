# Roadmap — Odonto.IA

Atualizado em 18/10/2026. Não é histórico de entregas nem plano da próxima atualização.

| Frente | Situação atual |
| --- | --- |
| Produto em uso | Versão considerada estável pelo usuário; referência em [Estado](ESTADO.md). |
| Limpeza documental | Concluída localmente; commit e push serão feitos pelo usuário. |
| Auditoria da produção | Pacote dirigido salvo: código, banco e 113 prints públicos/internos QA. Cobertura por papel/mobile/integrações ainda parcial. [Evidências](../docs/auditoria-producao-2026-10-18/README.md). |
| Loop de acesso | Publicado; 13 testes locais aprovados, acesso QA e login com sessão/recarga verificados. Novo login por senha e estados comerciais reais pendentes. [Recorte](../docs/auditoria-producao-2026-10-18/CODIGO.md#correção-de-acesso-autorizada-após-a-auditoria). |
| Ajustes selecionados | Olhinho, acessibilidade das senhas, texto e status publicados e conferidos no navegador. [Pendências e limites](../docs/auditoria-producao-2026-10-18/PENDENCIAS.md). |
| Refino do produto | A definir com prints, tela a tela. Nenhuma implementação autorizada. |
| Plano da atualização | Será entregue externamente para download/OneDrive após o debate. |

## Pendências ainda relevantes

A exclusão de documentos não comprova resolução destes pontos:

- **Registro clínico:** relato de 15–16/10 de duas Fichas com evolução sem eventos,
  deixadas para complementação pela profissional. Situação posterior não verificada.
  Não recuperar dados nem lançar pagamento automaticamente.
- **Desempenho:** relato de lentidão na busca de pacientes, ainda sem medição atual.
- **Verificação:** sessão expirada/retomada, Ficha assinada com autenticação real,
  falha de transporte no editor e reabertura de tratamento têm cobertura pendente.
  São limites de teste, não uma lista de defeitos confirmados.
- **Recuperação:** restauração completa de banco, arquivos e autenticação não foi
  comprovada nesta fase. A identificação da aplicação não certifica o banco.

Trabalho local da fase encerrada não é backlog aprovado. O próximo plano partirá
do produto em uso e das decisões do usuário, sem reutilização automática de specs.
