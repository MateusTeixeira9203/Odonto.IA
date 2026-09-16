# R-161f — Orçamento em PDF pelo WhatsApp

16/09/2026 · execução autorizada; formato confirmado por Mateus.

## Escopo e contrato

Reusar o botão existente e o gerador `@react-pdf/renderer`. Preservar a visualização
HTML de impressão em `/api/orcamentos/[id]/pdf`; `?download=1` entrega arquivo PDF real.
Não publicar links com dados de pacientes. Não usar API WhatsApp nem enviar em testes.

- Próprio dentista ativo e proprietário explícito gerido têm acesso; recepção exige
  `orcamentos.ler` e `contatos.whatsapp` no profissional responsável. Protético negado.
- Leitor RPC autenticado retorna só projeção do documento, paciente/número, clínica e
  dentista exibíveis. Clínica ativa, vínculo e grants revalidados no servidor, sem service role.
- Mesmo recorte de itens aprovados/não retirados do documento vigente; preservar grupos,
  valor fechado, visibilidade de preços, desconto, condições e pagamentos ativos.
  Totais derivados pela função canônica `deriveEstadoOrcamento`, sem novo cálculo de saldo.
- Download `application/pdf`, nome por ID, `Cache-Control: private, no-store`, sem PII no log.
- Compartilhar prepara o arquivo antes do clique nativo (`canShare`/`share` exige gesto).
  Celular compatível: arquivo + mensagem, usuário escolhe WhatsApp e destinatário.
  Desktop/fallback: baixa o arquivo e abre contato com mensagem, usuário anexa e envia.
- Mensagem inicial “Olá, {paciente}! Aqui está seu orçamento.”, editável antes de abrir.
  Não alterar preços nem aceite pela mensagem; não gravar modelo global implicitamente.
- Abertura/compartilhamento/cancelamento nunca marca enviado. Após tentativa, botões
  **Enviei** e **Não enviei**; Enviei registra fato manual com autor autenticado.
- Snapshot SHA256 do documento acompanha o preparo; registro exige mesmo snapshot e
  clínica esperada, nega contexto/permissão alterados e revisão posterior do documento.
  Retry idêntico não duplica auditoria. `enviado_em` é primeiro envio; histórico carrega snapshot.

## Brief de design — adaptação do componente existente

Manter botão icon/full no mesmo lugar. Abrir Dialog já usado em orçamento, sem nova página.
Ordem: título Enviar orçamento → paciente e telefone → mensagem editável → estado do PDF →
ação compartilhar/baixar → confirmação manual. Tokens sem paleta nova: bg-card/background,
text-foreground/muted-foreground, border-border, Button/Dialog/Textarea existentes.
Largura e scroll responsivo do Dialog canônico, foco/escape/teclado preservados. Feedback de
preparo/erro e botões desabilitados durante ações; nenhum loader de IA para download comum.
Sem artefato aprovado específico a substituir; conferir dark/light e mobile no Preview.

## Gates

PDF começa `%PDF`, grupos/preço fechado não se multiplicam, preço oculto respeitado,
pagamento cancelado não aumenta pago/pendente; comparação com HTML vigente.
Telefone inválido/sem acesso não abre; cancelamento não registra; Enviei é explícito.
Documento revisado/sessão revogada/outra clínica negados. Erro ao gerar arquivo recuperável.
Teste manual do compartilhamento nativo e anexo desktop é de Mateus; testes não enviam.

Configuração persistente de modelo orçamento fica em sublote próprio de mensagens,
sem forçar o enum confirmação/reativação a assumir semântica de orçamento.
