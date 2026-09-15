# R169c — Editar somente a evolução da consulta

> Contrato aprovado pelo pedido de 14/09/2026; correção do fluxo R169 em preview.

## Observação e resultado

No preview 25f6fd1, o botão Complementar evolução do bloco Evolução clínica ainda abre a
bancada completa. O usuário determinou que sirva apenas para editar o registro textual da
consulta em exibição. O botão passa a Editar evolução clínica e abre edição dentro do bloco.
Procedimentos, orçamento, odontograma, data, autor e identidade da consulta não mudam.

## Contrato

`editarEvolucaoClinica({ pacienteId, fichaId, atendimentoId: string | null,
evolucaoId: string | null, textoOriginal: string | null, texto: string })`
retorna `{ ok: true, texto: string | null } | { ok: false, error: string }`.
Texto limitado a 20.000 caracteres; vazio normaliza para null.

- Evolução existente: atualizar exclusivamente texto/updated_at pelo ID e contexto exatos.
- Legado sem evolução: editar anotacoes da mesma ficha; nunca procurar pela data de hoje.
- Consulta moderna sem linha, já vinculada à ficha por eventos: criar só a evolução textual
  vinculada à consulta existente,
  com data/autoria da consulta; nunca criar ficha/atendimento/procedimento.
- Autor clínico autenticado e clínica ativa; colega, secretária e protético não editam.
- Ficha assinada bloqueia edição. Lock da ficha serializa assinatura com escrita textual.
- Snapshot do texto impede sobrescrita concorrente; erro preserva rascunho.
- Linhas automáticas continuam identificadas como automáticas e não são editáveis neste fluxo.
- Persistência via RPC restrita, sem tabelas/colunas/policies novas. RLS permanece ativa.

## Apresentação

Reusar cartão, fontes e espaçamento atuais da ficha e tokens do editor R169. Não redesenhar.
Um registro: botão no cabeçalho, textarea com label Evolução clínica, Salvar e Cancelar abaixo.
Vários registros: cada texto elegível tem seu próprio botão/edição; não concatenar visitas.
Texto vazio abre textarea vazio. Foco ao abrir; IDs acessíveis únicos; erro junto do campo;
loading bloqueia duplo envio. Cancelar não grava. Sucesso mostra texto confirmado no mesmo bloco.

## Aceite

1. Abrir ação não abre Meu Dia nem bancada/Dex/orçamento.
2. Editar e reabrir mantém texto somente na consulta escolhida; procedimentos idênticos.
3. Cancelar preserva texto original; erro conserva rascunho.
4. Outra autoria, ficha assinada e contexto de clínica incorreto recusados no servidor.
5. Dois editores do mesmo texto: segundo recebe conflito.
6. Build/checagens técnicas; teste manual pelo usuário na clínica de teste em preview.

Limite preexistente: as policies atuais permitem ao autor PATCH direto em ficha_evolucoes.
A RPC protege o caminho da aplicação contra assinatura/concorrência; esta entrega não muda
a Data API/RLS nem pretende fechar esse acesso direto preexistente.
