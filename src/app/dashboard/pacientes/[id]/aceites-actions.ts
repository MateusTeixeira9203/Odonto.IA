'use server';

import { z } from 'zod';
import { TIPO_LABEL } from '@/types/odontograma';
import { requireClinicContext } from '@/server/auth/clinic';
import { criarDocumentoAceiteClinico } from '@/server/legal/documentos-aceite';

const assinaturaSchema = z.string().startsWith('data:image/png;base64,').max(2_000_000);
const textoObrigatorio = z.string().trim().min(3).max(8_000);

const emitirAceiteSchema = z.object({
  tipo: z.literal('tcle'),
  pacienteId: z.string().uuid(),
  fichaId: z.string().uuid(),
  eventoIds: z.array(z.string().uuid()).min(1).max(20),
  assinadoPor: z.string().trim().min(2).max(120),
  assinaturaDataUrl: assinaturaSchema,
  representante: z.object({
    nome: z.string().trim().min(2).max(120),
    cpf: z.string().trim().min(5).max(24).optional(),
  }).nullable().optional(),
  campos: z.object({
    justificativa: z.string().trim().max(8_000).optional(),
    explicacao: z.string().trim().max(8_000).optional(),
    alternativas: z.string().trim().max(8_000).optional(),
    riscos: z.string().trim().max(8_000).optional(),
    consequencias: z.string().trim().max(8_000).optional(),
    orientacoes: textoObrigatorio,
    intercorrencia: z.string().trim().max(8_000).optional(),
    retorno: z.string().trim().max(8_000).optional(),
  }),
}).superRefine((value, ctx) => {
  (['justificativa', 'explicacao', 'alternativas', 'riscos', 'consequencias'] as const).forEach((campo) => {
    if (!value.campos[campo] || value.campos[campo]!.trim().length < 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['campos', campo], message: 'Preencha este campo.' });
    }
  });
  if (value.eventoIds.length !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['eventoIds'], message: 'Selecione um procedimento para o TCLE.' });
  }
});

export type ContextoAceite = {
  fichas: Array<{
    id: string;
    dataAtendimento: string;
    eventos: Array<{ id: string; tipo: string; status: string; dente: number | null; observacao: string | null }>;
  }>;
};

type FichaContextoRaw = { id: string; data_atendimento: string };
type EventoContextoRaw = { id: string; ficha_id: string; tipo: string; procedimento_nome: string | null; status: string; dente: number | null; observacao: string | null };

export async function listarContextoAceite(pacienteId: string): Promise<ContextoAceite | { error: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  if (role === 'secretaria' || role === 'protetico') return { error: 'Sem permissão para emitir aceites.' };

  const { data: fichasRaw, error: fichasError } = await supabase
    .from('fichas')
    .select('id, data_atendimento')
    .eq('paciente_id', pacienteId)
    .eq('clinica_id', clinicId)
    .eq('dentista_id', dentistaId)
    .order('data_atendimento', { ascending: false })
    .limit(20);
  if (fichasError) return { error: 'Não foi possível carregar as fichas.' };
  const fichas = (fichasRaw as unknown as FichaContextoRaw[] | null) ?? [];
  if (fichas.length === 0) return { fichas: [] };

  const { data: eventosRaw, error: eventosError } = await supabase
    .from('odontograma_eventos')
    .select('id, ficha_id, tipo, procedimento_nome, status, dente, observacao')
    .eq('paciente_id', pacienteId)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .in('ficha_id', fichas.map((ficha) => ficha.id));
  if (eventosError) return { error: 'Não foi possível carregar os procedimentos.' };
  const eventos = (eventosRaw as unknown as EventoContextoRaw[] | null) ?? [];

  return {
    fichas: fichas.map((ficha) => ({
      id: ficha.id,
      dataAtendimento: ficha.data_atendimento,
      eventos: eventos
        .filter((evento) => evento.ficha_id === ficha.id)
        .map((evento) => ({
          id: evento.id,
          tipo: evento.procedimento_nome?.trim()
            || (evento.tipo === 'outro' ? evento.observacao?.trim() : null)
            || Object.entries(TIPO_LABEL).find(([tipo]) => tipo === evento.tipo)?.[1]
            || evento.tipo,
          status: evento.status,
          dente: evento.dente,
          observacao: evento.observacao,
        })),
    })),
  };
}

export async function emitirAceiteClinico(params: unknown): Promise<{ signedUrl?: string; error?: string }> {
  const parsed = emitirAceiteSchema.safeParse(params);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Preencha os dados obrigatórios.' };

  const { campos, ...dados } = parsed.data;
  const context = await requireClinicContext();
  try {
    const result = await criarDocumentoAceiteClinico({
      context,
      ...dados,
      campos: dados.tipo === 'tcle'
        ? {
            justificativa: campos.justificativa ?? '',
            explicacao: campos.explicacao ?? '',
            alternativas: campos.alternativas ?? '',
            riscos: campos.riscos ?? '',
            consequencias: campos.consequencias ?? '',
            orientacoes: campos.orientacoes,
          }
        : {
            orientacoes: campos.orientacoes,
            intercorrencia: campos.intercorrencia,
            retorno: campos.retorno,
          },
    });
    return result.ok ? { signedUrl: result.signedUrl } : { error: result.error };
  } catch (error) {
    console.error('[R-120] emitir aceite clínico:', error);
    return { error: 'Não foi possível finalizar o documento. Tente novamente.' };
  }
}
