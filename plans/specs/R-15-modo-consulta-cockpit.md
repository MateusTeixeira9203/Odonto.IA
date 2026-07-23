# R-15 — Modo consulta: o cockpit do atendimento

> **SPEC** · **R-15** · ⏳ fila · **Fase:** debate (visão) · **Modelo:** Opus (visão transversal, ambígua)
> **Aberto:** 2026-07-22 · **Depende de:** R-01 · R-02 · plugins (R-05…R-09)

> Esta spec está em **fase debate**: é a visão registrada da sessão de 22/07, **não** o contrato
> de implementação. Vira plano/contrato quando as fundações (R-01, R-02) estiverem no ar e o
> cockpit for o item ativo. Ela existe pra que o que a gente construiu não morra na sessão —
> não pra ser codada agora.

## 1. O norte

Hoje o modo consulta é, na prática, uma **tela de transcrição**. Passa a ser o **cockpit** do
atendimento: o ambiente de onde o dentista pilota a consulta com **o paciente na cadeira**, com o
estado clínico vivo à mão. A ficha nasce como **consequência**, não como o foco da tela.

Filtro do item: *quanto mais alimentado o perfil do paciente, mais o cockpit entrega.* O valor
cresce com o histórico — e isso tem uma sombra a resolver (ver §4, cold start).

## 2. Arquitetura — um motor, duas superfícies

O que separa esta reformulação de um "frankenstein": a superfície muda inteira, o **motor** que
grava a ficha clínica (o principal ativo) permanece. Reinventar a UX não é reinventar o que persiste.

- **Motor compartilhado** — transcrição + extração + **gravação da ficha**. Um caminho só grava,
  os dois lados chamam ele. É o que o **R-11** unifica (`status`, server action vs. browser).
- **Modo consulta (cockpit)** — estado clínico vivo: procedimentos **ativos** em destaque
  (= grupos abertos, §3), odontograma do que está mexendo, tabelas de especialidade, implante,
  **raio-x por dente + panorâmico**. A gravação é um **canto pequeno**, não o palco — inversão
  figura/fundo: o centro é o paciente, a voz é instrumento.
- **Ficha rápida** — a mesma máquina, superfície leve: gravar **+ subir um arquivo e extrair dele**;
  pra adição pontual fora da consulta completa ("fechei a última ficha, vou adicionar isto aqui").

As duas **não fundem** — dividem o motor.

## 3. Conceitos que sustentam (vêm das fundações — aqui só se referenciam)

- **Registro = unidade viva** com id estável → **R-01**. Sem isso o grupo se desfaz a cada save.
- **Trabalho = grupo de eventos datados**; etapa atual **derivada** (preparo→cimentado), nunca
  máquina de estados; congela por assinatura (R-03). **"Procedimento ativo" = grupo aberto**
  (etapa atual < última da lista). → **R-02**.
- **`grupo_id` com dupla função**: multi-dente **e** multi-consulta = "este trabalho" (uma ponte
  é os dois ao mesmo tempo). → **R-02**.
- **Amarração ao grupo**: a inferência **estrutural** (existe grupo aberto no dente+tipo?) é o
  **piso** e funciona até digitado, sem voz. A **voz reforça** (dente = âncora forte; "continuar"
  = intenção). A **tela confirma** o que vai amarrar antes de gravar — nunca em silêncio (número
  é onde a transcrição mais erra). → **R-09**.

## 4. Decisões desta sessão (2026-07-22)

- **Raio-x**: exibir e puxar fácil (por dente + panorâmico sempre à mão). A **IA não lê** a imagem
  — é o dentista que vê. Escopo: armazenar e exibir no contexto, não interpretar.
- **Cold start (paciente zerado)**: aceito por ora — no vazio o cockpit é basicamente o microfone
  e cresce com o uso. **Rever depois** (candidato: piso de utilidade = anamnese + queixa).
- **Anamnese**: hoje é **texto livre nas observações** do paciente. Estruturar em *flags de conduta*
  (alergia, anticoagulante, diabetes, cardiopatia/profilaxia, gestante, bifosfonato) + alertas no
  cockpit fica **adiado**. Se for feito: o alerta de segurança sai de **flag determinística**,
  **nunca** de IA lendo texto livre ao vivo (errar uma negação de alergia fere o paciente).
- **Orçamento**: preço **por trabalho** (o grupo), não por sessão — os eventos por baixo não
  aparecem no que o paciente vê. Reformulação de orçamento/financeiro **adiada** (arrasta o
  financeiro junto).

## 5. Fora de escopo

Reformulação de orçamento/financeiro · anamnese estruturada · IA sobre imagem (raio-x/foto).

## 6. Dependências e ordem

Cadeia de execução confirmada na sessão:

```
R-01 (id estável) → R-02 (odontograma · grupo · card) → plugins (R-05…R-09) → R-15 (cockpit)
```

O cockpit **não se especifica** antes das fundações existirem no chão — especificar em cima de
fundação ausente é o documento que envelhece antes de ser usado. O **artefato de design** de cada
tela vem na implementação daquela tela (`design-brief` / `design-shotgun`), não aqui.
