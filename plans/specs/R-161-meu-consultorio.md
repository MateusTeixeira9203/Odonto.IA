# R-161 — Meu Consultório, hub de gestão

> **SPEC** · **R-161** · 🔵 em implementação
> **Atualizado:** 2026-09-23 · **Artefato V2 aprovado.**

## Objetivo

Concentrar a gestão de uma clínica em um único contexto navegável. Para proprietário que
atende, reúne a leitura pessoal e a da unidade; para proprietário não clínico, oculta a aba
pessoal e preserva Visão geral, Financeiro da clínica, Minha equipe e Estoque.

A tela precisa dar muitos dados sem apresentá-los como uma parede de cards. A hierarquia é:
primeiro decisão, depois resultado, por fim aprofundamento por área.

## Contrato de navegação

- `Meu Consultório` é um shell persistente nas rotas de Visão geral, Meu financeiro,
  Financeiro da clínica, Minha equipe e Estoque. A barra interna permanece visível em todas.
- A Visão geral não repete atalhos grandes para essas áreas. As abas são a navegação; o
  conteúdo central prioriza pendências, resultado mensal, jornada do paciente e resumo da
  equipe. O gráfico de fluxo de caixa existe somente no Financeiro da clínica.
- `Meu financeiro` permanece pessoal e só aparece para quem atende. Caixa da clínica nunca é
  apresentado como dinheiro pessoal. O custo por hora clínica recebe destaque e as ações são
  rotuladas como entrada pessoal e saída pessoal.
- `Financeiro da clínica` aprofunda em ordem: caixa confirmado → previsão → fluxo → autoria por
  profissional → custos recorrentes. Previsão não entra no caixa; saldo não é lucro contábil.
  Proprietário, gestor ou secretária com permissão financeira registra entradas e saídas da
  clínica nesta área; secretária nunca lança uma movimentação no financeiro pessoal do dentista.
- `Minha equipe` concentra pessoas, papéis, acessos e convites. `Estoque` fica dentro do mesmo
  shell e mantém seus fluxos de materiais e kits.
- Ações de reativação/remarcação levam a `Pacientes → Pendências`; o hub só mostra o contexto.
- O seletor de tema permanece somente na navegação global. Em telas estreitas, as seções do hub
  formam uma faixa horizontal com rolagem por toque; não viram uma grade de duas colunas que
  empurra o conteúdo para baixo. As rotas exibem skeleton no conteúdo enquanto o layout e a
  faixa de seções permanecem interativos.

## Referência visual

- **Artefato:** [R-161-meu-consultorio-v2.html](../artefatos/R-161-meu-consultorio-v2.html)
- **Rotas alvo:** `/dashboard/meu-consultorio/*` e `/consultorio/*`
- **Componente alvo:** `MeuConsultorioShell`

| Token | Valor |
|---|---|
| Fundo | `#0d0d0e` |
| Fundo claro | `#f5f4f1` |
| Superfície | `#111112` |
| Superfície clara | `#ffffff` |
| Superfície alternativa | `#1c1c1e` |
| Borda | `#27272a` |
| Texto | `#fafafa` |
| Texto secundário | `#a1a1aa` |
| Teal | `#2f9c85` |
| Teal claro | `#5dbeb0` |
| Âmbar | `#d6a84b` |
| Título | `DM Serif Display, Georgia, serif` |
| Corpo | `Outfit, system-ui, sans-serif` |
| Valores | `DM Mono, monospace` |

A página não usa fundo quadriculado. A barra de seções ocupa toda a largura, apresenta cinco
áreas separadas com ícones e mantém a área ativa evidente. Os cards usam raios entre 13px e
18px. O artefato é interativo: cada aba troca somente o conteúdo central, sem perder cabeçalho,
período, barra interna ou dock global; o botão de tema demonstra os modos escuro e claro.

Gráficos financeiros precisam mostrar os valores sem depender da interpretação de linhas sem
escala. A Visão geral usa um funil explícito paciente → orçamento → aprovação → retorno. O
Financeiro da clínica usa comparação mensal recebidos × despesas com valores legíveis.

## Invariantes

- Dados e ações continuam com `clinica_id` ativo e autorização por papel/permissão.
- Não duplicar números entre Visão geral e Financeiro para preencher espaço.
- Zero somente após leitura bem-sucedida sem fatos; falha e carregamento têm estados próprios.
- Estoque, financeiro pessoal, configuração de equipe e pendências preservam seus fluxos atuais
  quando forem portados para dentro do shell.
- Movimentação financeira sempre informa o escopo: pessoal ou clínica. Permissão de registrar
  saída da clínica não concede acesso ao financeiro pessoal de qualquer dentista.

## Gates visuais antes de implementar

- [x] Usuário aprova este artefato V2 como contrato visual único.
- [x] Todas as cinco abas funcionam com a mesma barra interna no artefato.
- [ ] Desktop e mobile preservam a hierarquia; tabelas grandes rolam horizontalmente.
- [ ] Proprietário não clínico não vê Meu financeiro e não perde as demais áreas.
- [ ] Financeiro deixa explícita a diferença entre recebido, previsão, despesa e resultado estimado.
