# R-182 — entrada de paciente e isolamento direto

STATUS: PARCIAL
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
CANONICAL_FOR: evidência dirigida de cadastro e leitura com contas sintéticas

## Ambiente e limite

Site publicado `https://odontoia.app`, deploy `ba5b531164c2983b991de27a96f94668fbb7ebda` (identificação do M0), projeto Supabase publicado `zenfemoxvwerplrjgfqz`. Apenas contas QA próprias; nunca a portaria real da Clindent. Todas as escritas deste recorte ficaram na clínica `QA Odonto Clínica B 2026-10-01` (`53eefdac-401b-484c-8ad4-a6cdd78b1a69`) e foram sintéticas. Nenhuma mensagem externa, pagamento, commit, push, deploy ou migration.

## Resultado

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| API/RLS entre clínicas | **PASSA no recorte de leitura** | Com JWTs próprios, dentista B2 leu uma linha de paciente QA B `823604f0-ca7f-48fe-bac1-c89e4ffa2baf` e orçamento QA B `bf5bc6c1-88f2-4eef-8a88-e9f975c6fc06`; titular da clínica QA A recebeu zero linhas para ambos. B2 recebeu zero para orçamento da QA A `72a8172b-b605-437d-82dc-6ecb331f52aa`. Sem erro nem escrita. Não cobre todos os endpoints nem as operações de escrita. |
| Papel protético | **PASSA no recorte negativo** | JWT do protético QA recebeu zero linhas na leitura direta de paciente QA B. Navegador publicado redirecionou `/dashboard/pacientes/<id>` a `/dashboard/protetico`; os endpoints `/api/pacientes/<id>/prontuario` e `/api/fichas/<id>/pdf` responderam 404 para os IDs sintéticos conhecidos. Nenhum corpo clínico foi exposto. Não cobre outros endpoints. |
| Validação inicial do cadastro | **PASSA no recorte** | No navegador publicado, secretária QA tentou nome vazio, CPF com comprimento inválido e telefone curto. Mensagens específicas apareceram, o nome digitado permaneceu e a contagem de pacientes da QA B ficou `2 → 2`. Não simula falha de rede ou refresh durante envio. |
| Cadastro válido e persistência | **PASSA no recorte** | Secretária QA cadastrou `QA R182 Entrada 779f3ae6`, ID `75ce0e71-4b06-43db-8f9b-cb4278592132`, sem CPF/telefone/email. Contagem QA B `2 → 3`; leitura posterior confirmou clínica e nome corretos, e a lista mostrou o paciente após recarga. Registro mantido como evidência QA. |
| Aviso de nome repetido | **NÃO TESTADO conclusivamente** | Duas tentativas de novo cadastro com o mesmo nome não abriram o diálogo esperado, mas tampouco criaram segunda linha; o estado/resultado da ação na UI não ficou observável com segurança. Consulta direta autenticada como secretária por `nome_busca = 'qa r182 entrada 779f3ae6'` retornou exatamente o paciente acima, `fichasCount=0`, sem erro. A consulta de detecção funciona neste recorte. Não repetir submissões às cegas; um teste com captura de resposta/estado da ação deve distinguir falha de UI, bloqueio nativo ou requisição não enviada. |

Este recorte fortalece AC-02 (isolamento de leitura) e AC-04 (validação/cadastro básico), sem fechar ambos. Também não muda o veredito geral do R-182: AC-05/08/10 e a publicação das correções continuam pendentes, e há S1 financeiros abertos fora da R-188.
