# Odonto.IA — visão de produto

> Este arquivo carrega a **direção** do produto. Regras de código, stack e design system
> moram no `CLAUDE.md`. Leia este quando a conversa for de produto, posicionamento ou rumo.
> Movido do CLAUDE.md em 2026-07-21 (era 88% dele e afundava as regras de código).

## O que estamos construindo

Um **sistema operacional inteligente para consultas odontológicas** — não mais um ERP
odontológico. O diferencial não é "ter IA"; é reduzir atrito no atendimento: acelerar
documentação clínica, organizar consultas automaticamente, estruturar fichas, gerar
planejamento consistente.

**O principal ativo é a ficha clínica estruturada automaticamente.**

### O que o produto nunca deve parecer
ERP antigo · software burocrático · dashboard genérico · CRUD corporativo · sistema pesado ·
chatbot aleatório com IA.

### O que deve transmitir
Modernidade, fluidez, velocidade, inteligência operacional, experiência premium, produto vivo
em evolução contínua.

## Modo consulta — núcleo do produto

A principal experiência do sistema. Objetivo: atendimento rápido, organizado e fluido.

```
Consulta → captura livre → estruturação IA → ficha clínica
        → planejamento → apresentação visual → orçamento
```

O pipeline conceitual da IA: transcrição → correção odontológica → estruturação JSON →
ficha → planejamento → texto técnico → apresentação visual.
(Implementação real e regras duras: `CLAUDE.md` §IA e `src/lib/ai/provider.ts`.)

## Dex — a identidade inteligente do sistema

O Dex **não é** chatbot genérico nem assistente aberto. É a identidade da inteligência do
sistema, presente em: loaders, processamento IA, feedback visual, modo consulta, geração de
planejamento, estados inteligentes, análises clínicas.

**Tom:** clareza, inteligência, velocidade, confiança, modernidade.
**Evitar:** personalidade infantil, excesso de humor, exagero futurista.

## Planejamento — ferramenta de conversão

O planejamento não é só documento técnico. É a **ferramenta visual de conversão para o
paciente**: facilita entendimento, parece premium, melhora fechamento, transmite
profissionalismo.

## WhatsApp — extensão natural da clínica

Nunca parecer bot genérico ou automação robótica. Prioridades de uso: confirmação, lembrete,
follow-up, recuperação, envio de orçamento.
(Já implementado em `src/lib/whatsapp/` — Meta API.)

## Direção visual

Inspiração em **princípios** (nunca cópia de layout) de: Linear, Notion, Attio, Vercel
Dashboard, Stripe Dashboard.

- **Hierarquia forte** — o usuário identifica instantaneamente o que importa, o que é
  secundário e qual ação tomar. Nenhuma tela compete visualmente consigo mesma.
- **Espaçamento generoso** — respiro, agrupamento lógico, separação clara de contexto.
- **Baixa carga cognitiva** — toda tela responde rápido: onde estou? o que estou vendo?
  o que posso fazer agora?
- **Consistência** — componentes equivalentes com mesma linguagem, hierarquia, espaçamento
  e estados. O sistema inteiro parece construído pela mesma equipe.
- **Premium = refinamento** — clareza, elegância, simplicidade. Evitar excesso de elementos,
  cores, bordas e informação simultânea.

A régua prática (Dashboard e Tratamento como referência oficial, tokens, dark/light) está
no `CLAUDE.md` §Design — é regra de código, não visão.

## Retenção e evolução

Retenção vem de: experiência excelente, velocidade operacional, IA útil, evolução contínua,
sensação de produto vivo. Sustentar com: changelog, feedback interno, melhorias constantes,
comunicação próxima das clínicas — construção junto com clínicas reais.

**Comunicação:** modernidade, evolução, fluidez, inteligência operacional, proximidade.

## Mobile — direção futura

App híbrido (React Native + Expo) em algum momento. O que isso exige do código de hoje já
está no `CLAUDE.md`: lógica separada da UI, auth centralizada, APIs reutilizáveis, não
depender excessivamente de SSR.

## Filosofia

Antes de implementar qualquer funcionalidade:

> **Isso reduz atrito operacional do dentista?**

Se não, reavaliar. Objetivo final: o sistema odontológico mais moderno, fluido e inteligente
para consultas clínicas.
