# Roteiro — visita à clínica piloto (odontograma multi-especialidade + perio)

> 2026-07-13. Cada bloco destrava uma decisão da spec do odontograma modular.
> ⭐ = crítica (sem ela a spec não fecha).
>
> **Regra de ouro da visita: peça pra VER, não pra opinar.** "Me mostra a última ficha
> que você preencheu" vale 10x mais que "o que você acha de X". Fotografa tudo que
> deixarem: ficha de papel, odontograma preenchido, periodontograma, tela do software
> atual. Observação > opinião.

## Bloco 1 — Periodontia ⭐ (decide se a spec perio é grade completa ou triagem)

1. ⭐ "Vocês fazem exame periodontal completo (sondagem de 6 pontos por dente) ou
   triagem por sextante (PSR)?" — se olharem confuso, é triagem ou nada.
2. ⭐ "Com que frequência? Todo paciente novo? Só quando suspeita?"
3. "Me mostra como registram hoje" — papel? planilha? software? **foto.**
4. Se fazem completo: "Quem anota enquanto você sonda — a auxiliar? Você fala os
   números em voz alta em que ordem?" (observar a sequência real: vestibular primeiro?
   arcada por arcada? mesial→distal?)
5. "Além da profundidade: marcam sangramento, mobilidade, furca, recessão? Todos ou
   só alguns?"

**O que decide:** grade 6-pontos com voz auto-avanço (feature grande) vs triagem por
sextante (6 números, cabe no pipeline atual) vs adiar perio por completo.

## Bloco 2 — Odontograma de hoje ⭐ (decide os símbolos da v1)

6. ⭐ "Me mostra o odontograma de um paciente real (papel ou sistema)" — **foto.**
   Anotar QUAIS símbolos aparecem de verdade: X de ausente? face pintada? linha de
   canal? parafuso de implante? setas?
7. ⭐ "Quando você anota uma cárie, você marca a FACE (oclusal, mesial...) ou só o
   dente?" — se só o dente, a granularidade por face é menos urgente do que pensamos.
8. "Vermelho = a fazer, azul = feito — vocês usam essa convenção? Alguma outra cor?"
9. "O que vocês anotam no odontograma que NÃO conseguem hoje no software?" (a dor real)

**O que decide:** quais overlays entram na fatia 1 e a convenção de cores.

## Bloco 3 — Especialidades da casa ⭐ (decide prioridade dos módulos)

10. ⭐ "Quais procedimentos rodam aqui numa semana típica? Quem faz o quê?"
    (clínico geral faz endo? tem periodontista? orto é da casa ou dentista externo
    que atende lá?)
11. "Odontopediatria: atendem criança? Usam odontograma decíduo separado?"
12. "HOF (botox/preenchimento): fazem? registram onde?"

**O que decide:** ordem dos módulos (a fila que propus: ausente+face → endo/implante →
orto → perio) e se HOF entra no dicionário/ficha.

## Bloco 4 — Fluxo da consulta real (decide UX do modo consulta + voz)

13. ⭐ "Durante o atendimento, quem registra? Você (de luva) ou a auxiliar? Na hora
    ou depois que o paciente sai?"
14. "Você falaria com o sistema em voz alta na frente do paciente? Algum constrangimento?"
    (testa a premissa do ditado por voz)
15. "Quanto tempo dura a consulta típica? E a documentação dela?"
    (valida a premissa das rajadas curtas)

## Bloco 5 — Ortodontia (só se a casa tiver)

16. "Numa manutenção mensal de aparelho, o que você registra? Me mostra uma."
    (hipótese: 1 linha — 'troquei fio, ativei'. Se for isso, orto-manutenção é trivial
    e o overlay relacional pode esperar)
17. "Classificação de Angle, apinhamento, giroversão — isso vai pra ficha de vocês
    ou fica só na documentação ortodôntica inicial?"

## Bloco 6 — Tolerância a erro e confirmação (calibra o 'não pode haver erro')

18. ⭐ "Se a IA montar a ficha e errar 1 dente em 20, mas te mostrar pra revisar antes
    de salvar — aceitável ou inaceitável?" (calibra: revisão obrigatória vs opcional)
19. "O que seria um erro IMPERDOÁVEL na ficha?" (ouvir: dente errado? procedimento
    errado? preço errado? assinatura?)
20. "Hoje, quem confere a ficha antes de fechar? Alguém confere?"

## Bloco 7 — Bônus se sobrar tempo (planejamento/orçamento)

21. "Como vocês apresentam o plano de tratamento pro paciente hoje? Me mostra."
    (alimenta a visão Fase 3 — apresentação visual de conversão)
22. "O paciente entende o odontograma quando vocês mostram? Ajuda a fechar orçamento?"

## Bloco 8 — Vocabulário de campo *(adicionado 16/07, pós-aprovação da spec)*

23. ⭐ **Anotar os termos EXATOS que eles falam em voz alta durante o atendimento** —
    materiais, elásticos ("corrente"? "intermaxilar"? outro nome?), técnicas, medidas.
    É o insumo direto do glossário do organizador (converte fala → chip/evento certo).
    Não perguntar — OBSERVAR e transcrever como falam.
24. "Que variável vocês anotariam SEMPRE se não custasse tempo?" (separa a variável
    que falta da variável que só parece faltar)

---

## Depois da visita
Trazer: fotos + respostas ⭐ no mínimo. Com isso a spec do odontograma fecha em
uma sessão: fatia 1 dimensionada pelo Bloco 2/3, perio decidida pelo Bloco 1,
UX de confirmação calibrada pelo Bloco 6.
