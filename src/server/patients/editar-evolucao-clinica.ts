'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireClinicContext } from '@/server/auth/clinic';

const schema = z.object({
  pacienteId: z.string().uuid(), fichaId: z.string().uuid(),
  atendimentoId: z.string().uuid().nullable(), evolucaoId: z.string().uuid().nullable(),
  textoOriginal: z.string().nullable(), texto: z.string().max(20000),
});
type Input = z.infer<typeof schema>;
type Resultado = { ok: true; texto: string | null } | { ok: false; error: string };

export async function editarEvolucaoClinica(input: Input): Promise<Resultado> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Revise o texto da evolução (máximo de 20.000 caracteres).' };
  const { supabase, role } = await requireClinicContext();
  if (role !== 'dentista' && role !== 'admin') return { ok: false, error: 'Sem permissão para editar esta evolução.' };
  const { data, error } = await supabase.rpc('editar_evolucao_clinica', {
    p_paciente_id: parsed.data.pacienteId, p_ficha_id: parsed.data.fichaId,
    p_atendimento_id: parsed.data.atendimentoId, p_evolucao_id: parsed.data.evolucaoId,
    p_texto_original: parsed.data.textoOriginal, p_texto: parsed.data.texto,
  });
  if (error) {
    if (error.message.includes('evolucao_assinada')) return { ok: false, error: 'Esta ficha já foi assinada e não pode ser editada.' };
    if (error.message.includes('evolucao_conflito')) return { ok: false, error: 'A evolução mudou em outra edição. Copie seu texto e reabra a ficha antes de tentar novamente.' };
    if (error.message.includes('evolucao_sem_permissao')) return { ok: false, error: 'Esta evolução não está disponível para edição pelo seu perfil.' };
    console.error('[editarEvolucaoClinica]', error.message);
    return { ok: false, error: 'Não foi possível salvar a evolução. Tente novamente.' };
  }
  if (data !== null && typeof data !== 'string') return { ok: false, error: 'Não foi possível confirmar a gravação. Reabra a ficha para conferir.' };
  revalidatePath(`/dashboard/pacientes/${parsed.data.pacienteId}`);
  revalidatePath('/dashboard/meu-dia');
  return { ok: true, texto: data };
}
