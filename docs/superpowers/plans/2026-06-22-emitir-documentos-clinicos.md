# Plano — Emitir Documentos Clínicos (receita / atestado / pedido de exame)

**Data:** 2026-06-22
**Autor:** sessão Claude + Mateus

---

## Goal

Permitir que o dentista **emita documentos clínicos** (receita, atestado, pedido de exame) em poucos cliques, com tudo pré-preenchido (paciente + dentista + CRO + clínica), gerando um **PDF** que é **salvo na aba Arquivos** do paciente e pode ser **impresso** ou **enviado por WhatsApp**.

Princípio de produto: `tipo → modelo → 2-3 campos → PDF`. Os "modelos" são **dados** (registry tipado), não telas — adicionar um tipo novo amanhã = adicionar uma entrada, não programar tela.

## Escopo da v1 (decidido)

- **Receita**: branca, com toggle **"2 vias"** (cobre antibiótico / RDC 20/2011). Sem controle especial, sem azul (Notificação B é formulário oficial numerado — fora).
- **Atestado**: comparecimento · afastamento (N dias).
- **Pedido de exame**: panorâmica · periapical · tomografia (cone beam) · documentação ortodôntica.
- **Casa do botão**: header do prontuário do paciente. No pós-consulta entra como **link secundário discreto** (não na cara).
- Documentos emitidos ficam em **Arquivos** (`categoria='Documentos'`, `origem='emitido'`).

## Architecture overview

```
[Modal EmitirDocumento]  (client)
   tipo → modelo → campos mínimos → "Gerar"
        │ server action
        ▼
[emitirDocumento]  (server)
   busca paciente/dentista/clinica
   → modelo.montarCorpo(valores, ctx)        (src/lib/documentos/modelos.ts)
   → gerarPDFDocumento(data) : Buffer        (src/lib/pdf/documento.ts, @react-pdf/renderer)
   → upload bucket 'fichas'
   → insert paciente_documentos (origem='emitido', tipo_documento)
   → signed URL
        ▼
[Modal: resultado]  →  Imprimir (abre signedUrl) | Enviar WhatsApp | Concluir
```

## Tech stack

- Next.js 16 App Router, TypeScript estrito, Server Actions.
- PDF: `@react-pdf/renderer` (`renderToBuffer`) — **mesmo padrão de [orcamento.ts](src/lib/pdf/orcamento.ts)**.
- Storage + DB: Supabase (bucket `fichas`, tabela `paciente_documentos`).
- WhatsApp: `sendFile` de [provider.ts](src/lib/whatsapp/provider.ts) (mesmo padrão de [send-pdf.ts](src/lib/whatsapp/send-pdf.ts)).

## Gate de verificação (não há runner de testes)

O projeto **não tem vitest/jest** (`package.json` só tem `lint` e `typecheck`). Então cada task fecha com:
- `npm run typecheck` → **0 erros nos arquivos tocados** (erros pré-existentes em `screenshots-sprint2-bloco2/` e `planos/page.tsx` são conhecidos e ignorados).
- `npm run lint` quando houver código novo.
- **Verificação manual** descrita na task para UI.
- Build final: `npm run build`.

> Commits: incluídos ao fim de cada task como sugestão. Seguir a cadência que o Mateus pedir — **só commitar/pushar quando ele autorizar**.

---

## File Structure Map

**Criados:**
- `supabase/migrations/20260622000001_078_paciente_documentos_tipo.sql`
- `src/lib/documentos/modelos.ts`
- `src/lib/pdf/documento.ts`
- `src/app/dashboard/pacientes/[id]/documentos-actions.ts`
- `src/components/pacientes/EmitirDocumentoModal.tsx`

**Modificados:**
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` (botão no header + render do modal)
- `src/components/pacientes/DocumentosTab.tsx` (filtro "Emitidos")
- `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` (link secundário no pós-consulta)

---

## Task 0: Migração `tipo_documento`

**Files:** `supabase/migrations/20260622000001_078_paciente_documentos_tipo.sql`

**Steps:**
1. Criar o arquivo:
   ```sql
   -- Migration: 078_paciente_documentos_tipo.sql
   -- Distingue documentos emitidos pelo sistema (receita/atestado/pedido) de uploads comuns.

   ALTER TABLE paciente_documentos
     ADD COLUMN IF NOT EXISTS tipo_documento text;

   COMMENT ON COLUMN paciente_documentos.tipo_documento IS
     'Tipo do documento emitido: receita | atestado | pedido_exame. NULL = upload comum.';
   ```
2. Aplicar no Supabase (projeto `zenfemoxvwerplrjgfqz`) via MCP `apply_migration` (ou painel).
3. **Recarregar o cache do PostgREST** (lição da migration 077): rodar `NOTIFY pgrst, 'reload schema';` via `execute_sql`.
4. Verificar: `execute_sql` →
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name='paciente_documentos' AND column_name='tipo_documento';
   ```
   Deve retornar 1 linha.
5. Commit: `git add supabase/migrations && git commit -m "Task 0: coluna tipo_documento em paciente_documentos"`

---

## Task 1: Registry de modelos (`modelos.ts`)

**Files:** `src/lib/documentos/modelos.ts`

**Steps:**
1. Criar o arquivo completo:
   ```typescript
   // Registry tipado de modelos de documentos clínicos.
   // Adicionar um tipo/modelo novo = adicionar uma entrada aqui (sem tela nova).

   export type TipoDocumento = 'receita' | 'atestado' | 'pedido_exame';

   export interface CampoModelo {
     id: string;
     label: string;
     tipo: 'texto' | 'textarea' | 'numero';
     placeholder?: string;
     obrigatorio?: boolean;
     default?: string;
   }

   export interface DocumentoContexto {
     pacienteNome: string;
     hoje: string; // já formatado pt-BR
   }

   export interface ModeloDocumento {
     id: string;
     tipo: TipoDocumento;
     label: string;   // chip
     titulo: string;  // título no PDF
     campos: CampoModelo[];
     permiteDuasVias?: boolean;
     montarCorpo: (valores: Record<string, string>, ctx: DocumentoContexto) => string;
   }

   export const TIPO_LABEL: Record<TipoDocumento, string> = {
     receita:      'Receita',
     atestado:     'Atestado',
     pedido_exame: 'Pedido de exame',
   };

   export const MODELOS: ModeloDocumento[] = [
     // ── Receita ──────────────────────────────────────────────
     {
       id: 'simples',
       tipo: 'receita',
       label: 'Receita simples',
       titulo: 'Receituário',
       permiteDuasVias: true,
       campos: [
         {
           id: 'medicamentos',
           label: 'Medicamentos e posologia',
           tipo: 'textarea',
           obrigatorio: true,
           placeholder: 'Ex.: Amoxicilina 500mg — 21 cápsulas\nTomar 1 cápsula de 8/8h por 7 dias',
         },
       ],
       montarCorpo: (v) => (v.medicamentos ?? '').trim(),
     },
     // ── Atestado ─────────────────────────────────────────────
     {
       id: 'comparecimento',
       tipo: 'atestado',
       label: 'Comparecimento',
       titulo: 'Atestado de Comparecimento',
       campos: [
         { id: 'periodo', label: 'Período (opcional)', tipo: 'texto', placeholder: 'das 14h às 15h' },
       ],
       montarCorpo: (v, ctx) =>
         `Atesto para os devidos fins que ${ctx.pacienteNome} compareceu a esta clínica odontológica ` +
         `na data de ${ctx.hoje}${v.periodo?.trim() ? `, ${v.periodo.trim()}` : ''} para atendimento.`,
     },
     {
       id: 'afastamento',
       tipo: 'atestado',
       label: 'Afastamento',
       titulo: 'Atestado Médico-Odontológico',
       campos: [
         { id: 'dias', label: 'Dias de afastamento', tipo: 'numero', obrigatorio: true, default: '1' },
       ],
       montarCorpo: (v, ctx) => {
         const dias = parseInt(v.dias ?? '1', 10) || 1;
         return (
           `Atesto para os devidos fins que ${ctx.pacienteNome} necessita de afastamento de ` +
           `suas atividades pelo período de ${dias} dia(s), a partir de ${ctx.hoje}, ` +
           `por motivo odontológico.`
         );
       },
     },
     // ── Pedido de exame ──────────────────────────────────────
     ...([
       ['panoramica',          'Panorâmica',              'radiografia panorâmica'],
       ['periapical',          'Periapical',              'radiografia periapical'],
       ['tomografia',          'Tomografia (cone beam)',  'tomografia computadorizada de feixe cônico (cone beam)'],
       ['documentacao_orto',   'Documentação ortodôntica','documentação ortodôntica completa'],
     ] as const).map(([id, label, exame]): ModeloDocumento => ({
       id,
       tipo: 'pedido_exame',
       label,
       titulo: 'Solicitação de Exame',
       campos: [
         { id: 'justificativa', label: 'Justificativa clínica (opcional)', tipo: 'textarea',
           placeholder: 'Indicação clínica do exame' },
       ],
       montarCorpo: (v, ctx) =>
         `Solicito ${exame} para o(a) paciente ${ctx.pacienteNome}.` +
         (v.justificativa?.trim() ? `\n\nIndicação clínica: ${v.justificativa.trim()}` : ''),
     })),
   ];

   export function modelosPorTipo(tipo: TipoDocumento): ModeloDocumento[] {
     return MODELOS.filter((m) => m.tipo === tipo);
   }

   export function getModelo(tipo: TipoDocumento, id: string): ModeloDocumento | undefined {
     return MODELOS.find((m) => m.tipo === tipo && m.id === id);
   }
   ```
2. `npm run typecheck` → sem erros novos.
3. Commit: `git commit -am "Task 1: registry de modelos de documentos"`

---

## Task 2: Gerador de PDF (`documento.ts`)

**Files:** `src/lib/pdf/documento.ts`

**Steps:**
1. Criar o arquivo (mesmo estilo `createElement` de [orcamento.ts](src/lib/pdf/orcamento.ts)):
   ```typescript
   import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
   import { createElement } from "react";

   export interface DocumentoPDFData {
     titulo: string;
     corpo: string;
     duasVias: boolean;
     paciente: { nome: string; cpf?: string };
     clinica: { nome: string; endereco?: string; telefone?: string; cnpj?: string };
     dentista: { nome: string; cro: string };
     data: string; // ISO
   }

   const styles = StyleSheet.create({
     page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", backgroundColor: "#ffffff", color: "#222222" },
     via: { flexGrow: 1 },
     viaLabel: { fontSize: 8, color: "#999999", marginBottom: 8, textAlign: "right" },
     divider: { borderTopWidth: 1, borderTopColor: "#cccccc", borderStyle: "dashed", marginVertical: 18 },
     header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: "#2f9c85" },
     clinicaNome: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#2f9c85" },
     clinicaDetalhe: { fontSize: 8, color: "#666666", marginTop: 2 },
     titulo: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginVertical: 14, textTransform: "uppercase", letterSpacing: 1 },
     pacienteLinha: { fontSize: 10, marginBottom: 12 },
     corpo: { fontSize: 11, lineHeight: 1.6, marginBottom: 24 },
     dataLinha: { fontSize: 10, marginTop: 8, marginBottom: 36 },
     assinatura: { alignItems: "center", marginTop: 10 },
     assinaturaLinha: { width: 230, borderBottomWidth: 1, borderBottomColor: "#333333", marginBottom: 4 },
     assinaturaTexto: { fontSize: 9, color: "#444444" },
   });

   function formatDate(iso: string): string {
     return new Date(iso).toLocaleDateString("pt-BR");
   }

   function Via({ data, label }: { data: DocumentoPDFData; label?: string }) {
     return createElement(
       View, { style: styles.via },
       label ? createElement(Text, { style: styles.viaLabel }, label) : null,
       createElement(
         View, { style: styles.header },
         createElement(
           View, null,
           createElement(Text, { style: styles.clinicaNome }, data.clinica.nome),
           data.clinica.endereco ? createElement(Text, { style: styles.clinicaDetalhe }, data.clinica.endereco) : null,
           data.clinica.telefone ? createElement(Text, { style: styles.clinicaDetalhe }, `Tel: ${data.clinica.telefone}`) : null,
           data.clinica.cnpj ? createElement(Text, { style: styles.clinicaDetalhe }, `CNPJ: ${data.clinica.cnpj}`) : null,
         ),
       ),
       createElement(Text, { style: styles.titulo }, data.titulo),
       createElement(Text, { style: styles.pacienteLinha },
         `Paciente: ${data.paciente.nome}${data.paciente.cpf ? `  •  CPF: ${data.paciente.cpf}` : ""}`),
       createElement(Text, { style: styles.corpo }, data.corpo),
       createElement(Text, { style: styles.dataLinha }, `Data: ${formatDate(data.data)}`),
       createElement(
         View, { style: styles.assinatura },
         createElement(View, { style: styles.assinaturaLinha }),
         createElement(Text, { style: styles.assinaturaTexto },
           `${data.dentista.nome} — CRO: ${data.dentista.cro || "—"}`),
       ),
     );
   }

   function DocumentoPDF({ data }: { data: DocumentoPDFData }) {
     return createElement(
       Document, null,
       createElement(
         Page, { size: "A4", style: styles.page },
         data.duasVias
           ? createElement(
               View, { style: { flexDirection: "column", flexGrow: 1 } },
               createElement(Via, { data, label: "1ª via — Farmácia" }),
               createElement(View, { style: styles.divider }),
               createElement(Via, { data, label: "2ª via — Paciente" }),
             )
           : createElement(Via, { data }),
       ),
     );
   }

   export async function gerarPDFDocumento(data: DocumentoPDFData): Promise<Buffer> {
     return renderToBuffer(DocumentoPDF({ data }));
   }
   ```
2. `npm run typecheck` → sem erros novos.
3. Commit: `git commit -am "Task 2: gerador de PDF de documentos clínicos"`

---

## Task 3: Server action `emitirDocumento`

**Files:** `src/app/dashboard/pacientes/[id]/documentos-actions.ts`

> Nota de schema: **não** selecionar `clinicas.cnpj` (coluna não confirmada — [send-pdf.ts](src/lib/whatsapp/send-pdf.ts) também não a usa). Passar `cnpj: undefined`. `dentistas.cro` é confirmado (usado em orçamento).

**Steps:**
1. Criar o arquivo:
   ```typescript
   'use server';

   import { requireClinicContext } from '@/server/auth/clinic';
   import { gerarPDFDocumento } from '@/lib/pdf/documento';
   import { getModelo, type TipoDocumento } from '@/lib/documentos/modelos';

   export async function emitirDocumento(params: {
     pacienteId: string;
     tipo: TipoDocumento;
     modeloId: string;
     valores: Record<string, string>;
     duasVias: boolean;
   }): Promise<{ docId?: string; signedUrl?: string; nome?: string; error?: string }> {
     const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
     if (role === 'secretaria') return { error: 'Sem permissão para emitir documentos.' };

     const modelo = getModelo(params.tipo, params.modeloId);
     if (!modelo) return { error: 'Modelo de documento inválido.' };

     const [{ data: paciente }, { data: dentista }, { data: clinica }] = await Promise.all([
       supabase.from('pacientes').select('nome, cpf').eq('id', params.pacienteId).eq('clinica_id', clinicId).maybeSingle(),
       supabase.from('dentistas').select('nome, cro').eq('id', dentistaId).maybeSingle(),
       supabase.from('clinicas').select('nome, endereco, telefone').eq('id', clinicId).maybeSingle(),
     ]);

     if (!paciente) return { error: 'Paciente não encontrado.' };

     const hoje = new Date();
     const corpo = modelo.montarCorpo(params.valores, {
       pacienteNome: paciente.nome as string,
       hoje: hoje.toLocaleDateString('pt-BR'),
     });

     let pdfBuffer: Buffer;
     try {
       pdfBuffer = await gerarPDFDocumento({
         titulo: modelo.titulo,
         corpo,
         duasVias: params.duasVias && !!modelo.permiteDuasVias,
         paciente: { nome: paciente.nome as string, cpf: (paciente.cpf as string | null) ?? undefined },
         clinica: {
           nome: (clinica?.nome as string) ?? 'Clínica',
           endereco: (clinica?.endereco as string | null) ?? undefined,
           telefone: (clinica?.telefone as string | null) ?? undefined,
           cnpj: undefined,
         },
         dentista: { nome: (dentista?.nome as string) ?? 'Dentista', cro: (dentista?.cro as string | null) ?? '' },
         data: hoje.toISOString(),
       });
     } catch (err) {
       console.error('[emitirDocumento] PDF:', err);
       return { error: 'Erro ao gerar o PDF. Tente novamente.' };
     }

     const dataBR = hoje.toLocaleDateString('pt-BR').replace(/\//g, '-');
     const nome = `${modelo.titulo} - ${dataBR}.pdf`;
     const safeNome = nome.replace(/[^\w.\- ]/g, '_');
     const storagePath = `${clinicId}/${params.pacienteId}/docs/${Date.now()}_${safeNome}`;

     const { error: upErr } = await supabase.storage.from('fichas').upload(storagePath, pdfBuffer, {
       contentType: 'application/pdf', upsert: false,
     });
     if (upErr) { console.error('[emitirDocumento] upload:', upErr.message); return { error: 'Erro ao salvar o arquivo.' }; }

     const { data: docRow, error: dbErr } = await supabase.from('paciente_documentos').insert({
       clinica_id: clinicId,
       paciente_id: params.pacienteId,
       nome,
       url: storagePath,
       categoria: 'Documentos',
       origem: 'emitido',
       tipo_documento: params.tipo,
     }).select('id').single();
     if (dbErr) { console.error('[emitirDocumento] insert:', dbErr.message); return { error: 'Erro ao registrar o documento.' }; }

     const { data: signed } = await supabase.storage.from('fichas').createSignedUrl(storagePath, 3600);

     return { docId: (docRow as { id: string }).id, signedUrl: signed?.signedUrl, nome };
   }
   ```
2. `npm run typecheck` → sem erros novos.
3. Commit: `git commit -am "Task 3: action emitirDocumento (gera PDF, salva em Arquivos)"`

---

## Task 4: Modal `EmitirDocumentoModal`

**Files:** `src/components/pacientes/EmitirDocumentoModal.tsx`

Modal autossuficiente (overlay fixo com tokens do design system). Precisa apenas de `patientId` + `patientName` (a action resolve clínica/dentista do contexto).

**Steps:**
1. Criar o componente:
   ```tsx
   'use client';

   import { useState } from 'react';
   import { motion, AnimatePresence } from 'motion/react';
   import { X, FileText, Loader2, Check, Printer } from 'lucide-react';
   import { toast } from 'sonner';
   import {
     TIPO_LABEL, modelosPorTipo, getModelo,
     type TipoDocumento, type ModeloDocumento,
   } from '@/lib/documentos/modelos';
   import { emitirDocumento } from '@/app/dashboard/pacientes/[id]/documentos-actions';

   interface Props {
     open: boolean;
     onClose: () => void;
     patientId: string;
     patientName: string;
     onEmitted?: () => void; // ex.: refazer fetch da aba Arquivos
   }

   const TIPOS: TipoDocumento[] = ['receita', 'atestado', 'pedido_exame'];

   export function EmitirDocumentoModal({ open, onClose, patientId, patientName, onEmitted }: Props) {
     const [tipo, setTipo] = useState<TipoDocumento>('receita');
     const [modeloId, setModeloId] = useState<string>('');
     const [valores, setValores] = useState<Record<string, string>>({});
     const [duasVias, setDuasVias] = useState(false);
     const [isSaving, setIsSaving] = useState(false);
     const [result, setResult] = useState<{ signedUrl?: string; nome?: string; docId?: string } | null>(null);

     const modelos = modelosPorTipo(tipo);
     const modelo: ModeloDocumento | undefined = modeloId ? getModelo(tipo, modeloId) : undefined;

     const reset = () => {
       setTipo('receita'); setModeloId(''); setValores({}); setDuasVias(false);
       setIsSaving(false); setResult(null);
     };
     const fechar = () => { reset(); onClose(); };

     const selecionarTipo = (t: TipoDocumento) => { setTipo(t); setModeloId(''); setValores({}); setDuasVias(false); };

     const selecionarModelo = (m: ModeloDocumento) => {
       setModeloId(m.id);
       const init: Record<string, string> = {};
       m.campos.forEach((c) => { if (c.default) init[c.id] = c.default; });
       setValores(init);
       setDuasVias(false);
     };

     const podeGerar = !!modelo && modelo.campos.every((c) => !c.obrigatorio || (valores[c.id]?.trim()));

     const gerar = async () => {
       if (!modelo) return;
       setIsSaving(true);
       const r = await emitirDocumento({ pacienteId: patientId, tipo, modeloId: modelo.id, valores, duasVias });
       setIsSaving(false);
       if (r.error) { toast.error(r.error); return; }
       setResult({ signedUrl: r.signedUrl, nome: r.nome, docId: r.docId });
       onEmitted?.();
     };

     if (!open) return null;

     return (
       <AnimatePresence>
         <motion.div
           className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
           initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
           onClick={fechar}
         >
           <motion.div
             className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden"
             initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
             onClick={(e) => e.stopPropagation()}
           >
             {/* Header */}
             <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
               <div className="flex items-center gap-2.5">
                 <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center">
                   <FileText className="w-4 h-4 text-teal" />
                 </div>
                 <div>
                   <p className="text-sm font-bold text-text-primary leading-none">Emitir documento</p>
                   <p className="text-xs text-text-secondary mt-0.5">{patientName}</p>
                 </div>
               </div>
               <button onClick={fechar} className="text-text-secondary hover:text-text-primary transition-colors">
                 <X className="w-5 h-5" />
               </button>
             </div>

             <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
               {result ? (
                 /* ── Resultado ── */
                 <div className="flex flex-col items-center text-center gap-4 py-4">
                   <div className="w-14 h-14 rounded-full bg-teal flex items-center justify-center">
                     <Check className="w-7 h-7 text-white" />
                   </div>
                   <div>
                     <p className="font-bold text-text-primary">Documento gerado!</p>
                     <p className="text-xs text-text-secondary mt-1">Salvo em Arquivos do paciente.</p>
                   </div>
                   <div className="flex flex-col gap-2 w-full">
                     {result.signedUrl && (
                       <a
                         href={result.signedUrl} target="_blank" rel="noopener noreferrer"
                         className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal-lt transition-colors"
                       >
                         <Printer className="w-4 h-4" /> Abrir / Imprimir
                       </a>
                     )}
                     {/* Botão "Enviar WhatsApp" entra na Task 6 */}
                     <button
                       onClick={fechar}
                       className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
                     >
                       Concluir
                     </button>
                   </div>
                 </div>
               ) : (
                 <>
                   {/* Tipo */}
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Tipo</label>
                     <div className="flex flex-wrap gap-2">
                       {TIPOS.map((t) => (
                         <button
                           key={t} onClick={() => selecionarTipo(t)}
                           className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                             tipo === t ? 'bg-teal text-white border-teal' : 'bg-surface-alt text-text-secondary border-border hover:border-teal/40'
                           }`}
                         >
                           {TIPO_LABEL[t]}
                         </button>
                       ))}
                     </div>
                   </div>

                   {/* Modelo */}
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Modelo</label>
                     <div className="flex flex-wrap gap-2">
                       {modelos.map((m) => (
                         <button
                           key={m.id} onClick={() => selecionarModelo(m)}
                           className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                             modeloId === m.id ? 'bg-teal/10 text-teal border-teal/40' : 'bg-surface-alt text-text-secondary border-border hover:border-teal/40'
                           }`}
                         >
                           {m.label}
                         </button>
                       ))}
                     </div>
                   </div>

                   {/* Campos do modelo */}
                   {modelo && (
                     <div className="space-y-3">
                       {modelo.campos.map((c) => (
                         <div key={c.id} className="space-y-1.5">
                           <label className="text-xs font-semibold text-text-primary">
                             {c.label}{c.obrigatorio && <span className="text-red-500"> *</span>}
                           </label>
                           {c.tipo === 'textarea' ? (
                             <textarea
                               value={valores[c.id] ?? ''} placeholder={c.placeholder} rows={4}
                               onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                               className="w-full text-sm text-text-primary bg-surface-alt rounded-lg px-3 py-2 outline-none border border-transparent focus:border-teal transition-colors resize-none placeholder:text-text-secondary/50"
                             />
                           ) : (
                             <input
                               type={c.tipo === 'numero' ? 'number' : 'text'} min={c.tipo === 'numero' ? 1 : undefined}
                               value={valores[c.id] ?? ''} placeholder={c.placeholder}
                               onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                               className="w-full text-sm text-text-primary bg-surface-alt rounded-lg px-3 py-2 outline-none border border-transparent focus:border-teal transition-colors placeholder:text-text-secondary/50"
                             />
                           )}
                         </div>
                       ))}

                       {modelo.permiteDuasVias && (
                         <label className="flex items-center gap-2 cursor-pointer select-none">
                           <input type="checkbox" checked={duasVias} onChange={(e) => setDuasVias(e.target.checked)} className="accent-teal" />
                           <span className="text-xs text-text-secondary">Imprimir em 2 vias (ex.: antibiótico)</span>
                         </label>
                       )}
                     </div>
                   )}

                   <button
                     onClick={() => void gerar()} disabled={!podeGerar || isSaving}
                     className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                     style={{ background: '#2f9c85' }}
                   >
                     {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : <><FileText className="w-4 h-4" /> Gerar documento</>}
                   </button>
                 </>
               )}
             </div>
           </motion.div>
         </motion.div>
       </AnimatePresence>
     );
   }
   ```
2. `npm run typecheck` && `npm run lint` → sem erros novos.
3. Commit: `git commit -am "Task 4: EmitirDocumentoModal (composer + resultado)"`

---

## Task 5: Botão no header do prontuário

**Files:** `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`

**Steps:**
1. No bloco de imports de ícones `lucide-react`, adicionar `FilePlus`. No topo de imports de componentes, adicionar:
   ```tsx
   import { EmitirDocumentoModal } from '@/components/pacientes/EmitirDocumentoModal';
   ```
2. Junto aos outros `useState` do componente (perto de `isNovaConsultaOpen`), adicionar:
   ```tsx
   const [isEmitirOpen, setIsEmitirOpen] = useState(false);
   ```
3. Na barra de ações (entre o botão "Exportar prontuário" e "Nova Consulta", ~linha 871), inserir — **só para quem escreve clínica**:
   ```tsx
   {canWriteClinical && (
     <button
       onClick={() => setIsEmitirOpen(true)}
       className="p-2 rounded-xl border border-border/60 text-text-secondary hover:text-teal hover:border-teal/40 bg-surface transition-colors"
       title="Emitir documento (receita, atestado, pedido de exame)"
     >
       <FilePlus className="w-4 h-4" />
     </button>
   )}
   ```
4. Antes do fechamento do componente (junto aos outros modais renderizados), adicionar:
   ```tsx
   <EmitirDocumentoModal
     open={isEmitirOpen}
     onClose={() => setIsEmitirOpen(false)}
     patientId={paciente.id}
     patientName={displayNome}
   />
   ```
5. `npm run typecheck` → sem erros novos.
6. **Verificação manual:** `npm run dev` → abrir um paciente → clicar no ícone FilePlus → gerar uma "Receita simples" com 2 vias → confirmar PDF (2 vias) → abrir aba **Arquivos** → o PDF aparece em "Documentos".
7. Commit: `git commit -am "Task 5: botão Emitir documento no header do prontuário"`

---

## Task 6: Envio por WhatsApp

**Files:** `src/app/dashboard/pacientes/[id]/documentos-actions.ts`, `src/components/pacientes/EmitirDocumentoModal.tsx`

**Steps:**
1. Em `documentos-actions.ts`, adicionar o import e a action:
   ```typescript
   import { sendFile } from '@/lib/whatsapp/provider';

   export async function enviarDocumentoWhatsApp(
     docId: string, pacienteId: string,
   ): Promise<{ ok: boolean; error?: string }> {
     const { supabase, clinicId, role } = await requireClinicContext();
     if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };

     const [{ data: doc }, { data: paciente }, { data: clinica }] = await Promise.all([
       supabase.from('paciente_documentos').select('nome, url').eq('id', docId).eq('clinica_id', clinicId).maybeSingle(),
       supabase.from('pacientes').select('whatsapp, telefone').eq('id', pacienteId).eq('clinica_id', clinicId).maybeSingle(),
       supabase.from('clinicas').select('whatsapp_phone_number_id').eq('id', clinicId).maybeSingle(),
     ]);
     if (!doc) return { ok: false, error: 'Documento não encontrado.' };

     const numero = (paciente?.whatsapp as string | null) ?? (paciente?.telefone as string | null);
     if (!numero) return { ok: false, error: 'Paciente sem número de WhatsApp cadastrado.' };

     const phoneNumberId = (clinica?.whatsapp_phone_number_id as string | null) ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
     if (!phoneNumberId) return { ok: false, error: 'WhatsApp não configurado nesta clínica.' };

     const { data: file, error: dlErr } = await supabase.storage.from('fichas').download(doc.url as string);
     if (dlErr || !file) return { ok: false, error: 'Erro ao baixar o arquivo.' };

     const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
     try {
       await sendFile(phoneNumberId, numero, base64, doc.nome as string, `Documento: ${doc.nome}`, 'application/pdf');
       return { ok: true };
     } catch (err) {
       console.error('[enviarDocumentoWhatsApp]', err);
       return { ok: false, error: 'Erro ao enviar pelo WhatsApp.' };
     }
   }
   ```
   > Confirmar a assinatura de `sendFile` em [provider.ts](src/lib/whatsapp/provider.ts) — esperado `sendFile(phoneNumberId, to, base64, filename, caption, mime)` (igual ao uso em [send-pdf.ts:174](src/lib/whatsapp/send-pdf.ts)). Ajustar a ordem dos args se divergir.
2. No `EmitirDocumentoModal.tsx`:
   - Importar a action e `MessageCircle` de lucide: `import { emitirDocumento, enviarDocumentoWhatsApp } from '@/app/dashboard/pacientes/[id]/documentos-actions';`
   - Adicionar estado `const [enviando, setEnviando] = useState(false);`
   - No bloco de resultado, **antes** do botão "Concluir", inserir:
     ```tsx
     {result.docId && (
       <button
         onClick={async () => {
           setEnviando(true);
           const r = await enviarDocumentoWhatsApp(result.docId!, patientId);
           setEnviando(false);
           if (r.ok) toast.success('Enviado pelo WhatsApp!');
           else toast.error(r.error ?? 'Falha ao enviar.');
         }}
         disabled={enviando}
         className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-teal/40 text-teal text-sm font-bold hover:bg-teal/5 transition-colors disabled:opacity-50"
       >
         {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />} Enviar por WhatsApp
       </button>
     )}
     ```
   - Incluir `MessageCircle` no import de lucide e resetar `enviando` no `reset()`.
3. `npm run typecheck` && `npm run lint` → sem erros novos.
4. **Verificação manual:** gerar um documento → "Enviar por WhatsApp" (em clínica com WhatsApp Meta configurado) → confirmar recebimento. Sem número → toast de erro claro.
5. Commit: `git commit -am "Task 6: envio de documento por WhatsApp"`

---

## Task 7: Filtro "Emitidos" na aba Arquivos (opcional)

**Files:** `src/components/pacientes/DocumentosTab.tsx`

> `Document.source` já recebe `origem` (`'emitido'` para documentos gerados). Filtro contido, sem tocar `GaleriaImagens`.

**Steps:**
1. Adicionar estado: `const [soEmitidos, setSoEmitidos] = useState(false);`
2. Em `filteredDocs`, adicionar a condição: `if (soEmitidos && doc.source !== 'emitido') return false;`
3. Na barra de filtros, ao lado do botão "Selecionar", adicionar um toggle:
   ```tsx
   <button
     onClick={() => setSoEmitidos((s) => !s)}
     className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
       soEmitidos ? 'bg-teal text-white' : 'bg-surface-alt text-text-secondary hover:bg-border'
     }`}
   >
     Emitidos
   </button>
   ```
4. `npm run typecheck` → sem erros novos.
5. **Verificação manual:** com ≥1 documento emitido e ≥1 upload, alternar "Emitidos" e conferir o filtro.
6. Commit: `git commit -am "Task 7: filtro Emitidos na aba Arquivos"`

---

## Task 8: Link secundário discreto no pós-consulta (opcional)

**Files:** `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`

> Decisão do Mateus: pedir exame/emitir documento é opcional → **não na cara**. Link de texto discreto, abaixo do botão de assinatura, na tela "Ficha salva!".

**Steps:**
1. Importar o modal: `import { EmitirDocumentoModal } from '@/components/pacientes/EmitirDocumentoModal';`
2. Adicionar estado: `const [showEmitir, setShowEmitir] = useState(false);`
3. Na tela `saved && !isDemo` (após o botão "Solicitar assinatura do paciente", ~linha 695), adicionar um link discreto:
   ```tsx
   {!showSignature && (
     <button
       onClick={() => {
         if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
         setShowEmitir(true);
       }}
       className="text-xs text-text-secondary underline underline-offset-2 hover:text-text-primary transition-colors"
     >
       Emitir documento (receita, atestado, pedido)
     </button>
   )}
   ```
4. Junto ao `ConsultaAssinaturaModal` no fim do componente, renderizar:
   ```tsx
   <EmitirDocumentoModal
     open={showEmitir}
     onClose={() => setShowEmitir(false)}
     patientId={paciente.id}
     patientName={paciente.nome}
   />
   ```
5. `npm run typecheck` → sem erros novos.
6. **Verificação manual:** fazer uma consulta real → salvar ficha → clicar no link discreto → gerar receita → confirmar que o countdown pausou e o PDF foi salvo.
7. Commit: `git commit -am "Task 8: link discreto Emitir documento no pós-consulta"`

---

## Verificação final

1. `npm run typecheck` → 0 erros (fora os pré-existentes conhecidos).
2. `npm run lint` → limpo.
3. `npm run build` → sucesso.
4. **Smoke manual completo:**
   - Receita simples + 2 vias → PDF com 1ª/2ª via, salvo em Arquivos.
   - Atestado de afastamento (3 dias) → texto correto com nome do paciente e data.
   - Pedido de panorâmica → texto correto.
   - Envio WhatsApp (clínica configurada).
   - Filtro "Emitidos" em Arquivos.
   - Link discreto no pós-consulta.

---

## Self-review checklist

- [x] **Spec coverage:** receita (2 vias) ✓, atestado (comparecimento/afastamento) ✓, pedido de exame (4 modelos) ✓, salva em Arquivos ✓, header ✓, pós-consulta discreto ✓, WhatsApp ✓.
- [x] **Sem placeholders:** código completo em todas as tasks.
- [x] **Consistência de tipos:** `TipoDocumento`, `ModeloDocumento`, `DocumentoPDFData`, `emitirDocumento`/`enviarDocumentoWhatsApp` batem entre tasks.
- [x] **Sem forward references:** modelos (T1) → PDF (T2) → action (T3) → modal (T4) → header (T5) → WhatsApp (T6) → filtro (T7) → pós-consulta (T8).

## Pontos a confirmar na execução

1. Assinatura exata de `sendFile` em `provider.ts` (ordem dos args).
2. `clinicas.cnpj` — se existir, dá pra incluir no cabeçalho do PDF (hoje passamos `undefined`).
3. Coluna de telefone do paciente: usamos `whatsapp` com fallback `telefone` — confirmar nomes reais.

## Evoluções futuras (fora da v1)

- Modelos próprios da clínica (CRUD) — ex.: receita pós-extração favorita.
- Receita de Controle Especial (branca, 2 vias, campos comprador/fornecedor).
- Catálogo de medicamentos com posologia pré-pronta.
- Badge visual "Emitido" nos cards (exige mexer em `GaleriaImagens`).
