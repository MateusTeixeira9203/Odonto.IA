# DentAI

# CLAUDE.md — CONTEXTO MESTRE ATUALIZADO — ODONTO.IA

# ODONTO.IA

Odonto.IA é um SaaS odontológico moderno focado em:

* velocidade operacional
* experiência premium
* organização inteligente do atendimento
* redução de atrito clínico
* IA útil e contextual

O objetivo NÃO é construir apenas mais um ERP odontológico.

O objetivo é construir:

# um sistema operacional inteligente para consultas odontológicas.

---

# VISÃO DO PRODUTO

O Odonto.IA NÃO deve parecer:

* ERP antigo
* software burocrático
* dashboard genérico
* sistema pesado
* chatbot aleatório com IA

O sistema deve transmitir:

* modernidade
* fluidez
* velocidade
* inteligência operacional
* experiência premium
* evolução contínua

---

# DIFERENCIAL PRINCIPAL

O diferencial NÃO é:

# “ter IA”.

O diferencial é:

* reduzir atrito no atendimento
* acelerar documentação clínica
* organizar consultas automaticamente
* estruturar fichas clínicas
* gerar planejamento consistente
* transformar atendimento em fluxo fluido

---

# PRINCÍPIO CENTRAL DO PRODUTO

O principal ativo do Odonto.IA NÃO é:

* chatbot
* automação isolada
* texto gerado aleatoriamente

O principal ativo é:

# a ficha clínica estruturada automaticamente.

---

# MODO CONSULTA — NÚCLEO DO PRODUTO

O modo consulta é a principal experiência do sistema.

Objetivo:

# permitir atendimento rápido, organizado e fluido.

Fluxo:

Consulta
↓
captura livre
↓
estruturação IA
↓
ficha clínica
↓
planejamento
↓
apresentação visual
↓
orçamento

---

# COMO A IA DEVE FUNCIONAR

A IA NÃO deve:

* inventar diagnósticos
* agir como dentista
* responder excessivamente criativa
* depender de texto livre sem estrutura

A IA deve:

* organizar
* estruturar
* resumir
* acelerar documentação
* melhorar produtividade
* gerar respostas previsíveis

---

# PRINCÍPIO DA IA

# IA operacional > IA conversacional

Priorizar:

* previsibilidade
* velocidade
* estruturação
* contexto clínico
* utilidade real

---

# PIPELINE DE IA

Sempre estruturar:

Whisper/Gemini
↓
correção odontológica
↓
estruturação JSON
↓
ficha clínica
↓
planejamento
↓
texto técnico
↓
apresentação visual

---

# RESPOSTAS DE IA — REGRA OBRIGATÓRIA

NUNCA depender apenas de texto livre.

Sempre preferir estruturas JSON tipadas.

Exemplo:

```json
{
  "queixa_principal": "",
  "dentes": [],
  "procedimentos": [],
  "observacoes": "",
  "prioridade": ""
}
```

---

# DEX — NOVA DIREÇÃO

O Dex NÃO é mais:

* chatbot genérico
* assistente aberto
* “IA conversacional”

O Dex agora é:

# a identidade inteligente do sistema.

---

# O DEX DEVE SER USADO EM

* loaders
* processamento IA
* feedback visual
* modo consulta
* geração de planejamento
* estados inteligentes
* análises clínicas

---

# TOM DO DEX

Transmitir:

* clareza
* inteligência
* velocidade
* confiança
* modernidade

Evitar:

* personalidade infantil
* excesso de humor
* exagero futurista

---

# VISÃO DO PLANEJAMENTO

O planejamento NÃO é apenas documento técnico.

Ele deve funcionar como:

# ferramenta visual de conversão para o paciente.

Objetivos:

* facilitar entendimento
* parecer premium
* melhorar fechamento
* transmitir profissionalismo

---

# STACK PRINCIPAL

| Camada        | Tecnologia                  |
| ------------- | --------------------------- |
| Framework     | Next.js App Router          |
| Linguagem     | TypeScript estrito          |
| Banco         | Supabase Postgres + RLS     |
| Auth          | Supabase Auth               |
| Storage       | Supabase Storage            |
| UI            | Tailwind CSS v4 + shadcn/ui |
| Animações     | Framer Motion               |
| Mobile futuro | React Native + Expo         |

---

# REGRAS DE CÓDIGO

* TypeScript estrito
* NUNCA usar `any`
* funções sempre tipadas
* tratar erros explicitamente
* componentes desacoplados
* lógica isolada em services/hooks
* evitar duplicação
* evitar overengineering
* evitar abstrações excessivas

---

# ESTRUTURA RECOMENDADA

```text
src/
  app/
  components/
  hooks/
  services/
  lib/
  types/
```

---

# ARQUITETURA

Priorizar:

* separação de responsabilidades
* services reutilizáveis
* hooks reutilizáveis
* APIs organizadas
* componentes pequenos
* previsibilidade

Evitar:

* lógica pesada dentro de componentes
* middleware excessivamente complexo
* fetch espalhado
* acoplamento forte

---

# MULTI-CLÍNICA

O sistema deve suportar:

* múltiplas clínicas
* troca de clínica
* roles por clínica
* dentistas em mais de uma clínica

Toda tabela multi-tenant deve:

* possuir `clinica_id`
* possuir RLS
* garantir isolamento seguro

NUNCA fazer query sem:

```sql
WHERE clinica_id = active_clinica_id
```

---

# UX — DIREÇÃO PRINCIPAL

O sistema deve parecer:

* rápido
* fluido
* moderno
* limpo
* elegante

Priorizar:

* poucos cliques
* baixa fricção
* clareza visual
* velocidade operacional

---

# DESIGN SYSTEM — REGRAS OBRIGATÓRIAS

SEMPRE usar:

* tokens do design system
* variáveis CSS
* componentes padronizados

NUNCA:

* usar cores hardcoded
* criar componentes inconsistentes
* quebrar dark mode

---

# PADRÃO VISUAL

O sistema deve transmitir:

# software premium moderno.

Evitar:

* poluição visual
* dashboards exagerados
* excesso de cards
* excesso de informações simultâneas

---

# MICROINTERAÇÕES

Sempre priorizar:

* animações suaves
* hover states leves
* feedback visual claro
* loaders elegantes
* skeletons consistentes

Animações devem:

# ser sentidas, não percebidas.

---

# DEX LOADER

Criar e reutilizar:

# DexLoader

Com:

* animação suave
* identidade premium
* suporte dark/light mode
* visual consistente

---

# DARK MODE

Obrigatório funcionar perfeitamente.

NUNCA usar:

* cores hardcoded
* bg-white
* text-black
* gray hardcoded

Sempre usar:

* bg-background
* bg-card
* text-foreground
* text-muted-foreground
* border-border

---

# MOBILE FUTURO

O sistema deve ser preparado para:

# app híbrido futuramente.

Então:

* separar lógica da UI
* evitar dependência excessiva de SSR
* centralizar autenticação
* criar APIs reutilizáveis

---

# PERFORMANCE

Priorizar:

* Promise.all
* loading states
* Suspense
* skeletons
* evitar re-render desnecessário

---

# WHATSAPP

O WhatsApp NÃO deve parecer:

* bot genérico
* automação robótica

Deve parecer:

# extensão natural da clínica.

Prioridades:

* confirmação
* lembrete
* follow-up
* recuperação
* envio de orçamento

---

# RETENÇÃO

Retenção deve vir de:

* experiência excelente
* velocidade operacional
* IA útil
* evolução contínua
* sensação de produto vivo

---

# EVOLUÇÃO CONTÍNUA

O Odonto.IA deve transmitir:

* produto vivo
* melhoria constante
* construção junto com clínicas reais

Implementar:

* changelog
* feedback interno
* melhorias contínuas
* comunicação próxima dos usuários

---

# DIREÇÃO DE COMUNICAÇÃO

Focar em:

* modernidade
* evolução
* fluidez
* inteligência operacional
* proximidade

---

# O QUE EVITAR

NÃO transformar o sistema em:

* ERP enterprise complexo
* dashboard genérico
* chatbot de IA aleatório
* sistema burocrático

---

# FILOSOFIA PRINCIPAL

Antes de implementar qualquer funcionalidade, perguntar:

# isso reduz atrito operacional do dentista?

Se NÃO:
reavaliar a feature.

---

# OBJETIVO FINAL

Construir:

# o sistema odontológico mais moderno, fluido e inteligente para consultas clínicas.
