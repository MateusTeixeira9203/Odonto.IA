import { hojeBRT } from '@/lib/hora-brt';
import { requireClinicContext } from '@/server/auth/clinic';
import { finalizarAtendimentoSeAplicavel } from '@/server/patients/finalizar-atendimento';
import { rotearVisitaMeuDia, type RotearVisitaInput } from '@/server/patients/rotear-visita';
import type { OdontogramaEventoDraft } from '@/types/odontograma';

export function papelPodeRegistrarClinico(role: string): boolean {
  return role === 'admin' || role === 'dentista';
}

export const MENSAGEM_VISITA_FINALIZADA =
  'Esta visita já foi finalizada e está salva na Ficha. Se você acrescentou algo depois, isso não foi gravado: use Novo atendimento na Ficha do paciente.';

export type RegistrarAtendimentoClinicoResult =
  | {
      ok: true;
      fichaId: string;
      atendimentoId: string;
      eventosFalharam?: boolean;
    }
  | { ok: false; error: string };

type AtendimentoRow = {
  id: string;
  paciente_id: string;
  dentista_id: string;
  agendamento_id: string | null;
  estado: 'preparando' | 'finalizado' | 'falhou';
};

type AtendimentoEventoRow = {
  atendimento_id: string;
  evento_id: string;
  papel: 'registrado' | 'realizado';
};

export interface RegistrarAtendimentoClinicoInput extends RotearVisitaInput {
  /** UUID criado no navegador uma vez por visita; é reutilizado no orçamento antecipado e no salvar final. */
  visitaKey: string;
  /**
   * Meu Dia tem agendamento; o Prontuário pode registrar uma consulta sem criar uma agenda
   * fictícia. A âncora continua idempotente nos dois casos.
   */
  origemAtendimento?: 'meu_dia' | 'ficha';
}

/**
 * R-140a — orquestra a âncora da visita sem reimplementar o roteamento de tratamentos.
 *
 * Não há transação entre as tabelas clínicas já existentes e o Atendimento. Por isso, qualquer
 * falha posterior à criação fica em `preparando`: repetir a mesma chave reconcilia a visita,
 * enquanto marcá-la como `falhou` poderia esconder uma ficha já gravada.
 */
export async function registrarAtendimentoClinico(
  input: RegistrarAtendimentoClinicoInput,
): Promise<RegistrarAtendimentoClinicoResult> {
  const { supabase, clinicId, dentistaId, role, user } = await requireClinicContext();
  if (!papelPodeRegistrarClinico(role)) return { ok: false, error: 'Sem permissão.' };

  const origemAtendimento = input.origemAtendimento ?? 'meu_dia';
  if (origemAtendimento === 'meu_dia' && !input.agendamentoId) {
    return { ok: false, error: 'Registro nao encontrado.' };
  }

  // As FKs por id não garantem que as referências pertençam à clínica da nova visita.
  // Validar antes de buscar/reutilizar a âncora também protege o caminho do Prontuário.
  const [paciente, agendamento] = await Promise.all([
    supabase.from('pacientes').select('id')
      .eq('id', input.pacienteId)
      .eq('clinica_id', clinicId)
      .maybeSingle<{ id: string }>(),
    input.agendamentoId
      ? supabase.from('agendamentos').select('id')
        .eq('id', input.agendamentoId)
        .eq('clinica_id', clinicId)
        .eq('paciente_id', input.pacienteId)
        .eq('dentista_id', dentistaId)
        .maybeSingle<{ id: string }>()
      : Promise.resolve(null),
  ]);
  if (paciente.error || !paciente.data
    || (input.agendamentoId && (agendamento?.error || !agendamento?.data))) {
    return { ok: false, error: 'Registro nao encontrado.' };
  }

  const atendimento = await obterOuCriarAtendimento({
    supabase,
    clinicId,
    dentistaId,
    usuarioId: user.id,
    visitaKey: input.visitaKey,
    pacienteId: input.pacienteId,
    agendamentoId: input.agendamentoId,
    origem: origemAtendimento,
  });

  if (!atendimento.ok) return atendimento;

  if (atendimento.row.estado === 'finalizado') {
    return { ok: false, error: MENSAGEM_VISITA_FINALIZADA };
  }

  const resultado = await rotearVisitaMeuDia({
    ...input,
    atendimentoId: atendimento.row.id,
    origemFicha: origemAtendimento === 'ficha' ? 'manual' : 'modo_consulta',
    // O fechamento de agenda é feito apenas depois que as relações da visita estiverem íntegras.
    finalizarAtendimento: false,
  });
  if (!resultado.ok) return resultado;
  if (resultado.eventosFalharam) {
    return { ...resultado, atendimentoId: atendimento.row.id };
  }

  const eventos = await vincularEventosAoAtendimento({
    supabase,
    clinicId,
    atendimentoId: atendimento.row.id,
    eventos: input.eventosDraft,
  });
  if (!eventos.ok) return eventos;

  // O orçamento pode salvar uma ficha antes de a consulta acabar. Nesse estágio a âncora e os
  // vínculos já existem, mas ela continua recuperável até o clique final em "Salvar".
  if (input.finalizarAtendimento === false) {
    return { ...resultado, atendimentoId: atendimento.row.id };
  }

  const { data: finalizado, error: erroFinalizar } = await supabase
    .from('atendimentos_clinicos')
    .update({ estado: 'finalizado', finalizado_em: new Date().toISOString() })
    .eq('id', atendimento.row.id)
    .eq('clinica_id', clinicId)
    .eq('dentista_id', dentistaId)
    .select('id');

  if (erroFinalizar || !finalizado || finalizado.length === 0) {
    console.error('[registrarAtendimentoClinico:finalizar]', erroFinalizar?.message);
    return { ok: false, error: 'A visita foi gravada, mas não pôde ser finalizada. Tente salvar novamente.' };
  }

  if (origemAtendimento === 'meu_dia') {
    await finalizarAtendimentoSeAplicavel(supabase, {
      clinicId,
      dentistaId,
      pacienteId: input.pacienteId,
      origem: 'modo_consulta',
      agendamentoId: input.agendamentoId,
      finalizarAtendimento: input.finalizarAtendimento,
    });
  }

  return { ...resultado, atendimentoId: atendimento.row.id };
}

async function obterOuCriarAtendimento(ctx: {
  supabase: Awaited<ReturnType<typeof requireClinicContext>>['supabase'];
  clinicId: string;
  dentistaId: string;
  usuarioId: string;
  visitaKey: string;
  pacienteId: string;
  agendamentoId?: string;
  origem: 'meu_dia' | 'ficha';
}): Promise<{ ok: true; row: AtendimentoRow } | { ok: false; error: string }> {
  const porChave = await buscarAtendimento(ctx.supabase, ctx.clinicId, 'chave_idempotencia', ctx.visitaKey);
  if (porChave) return validarContextoAtendimento(porChave, ctx);

  // A constraint por agendamento também protege um refresh que gere uma chave nova. Reusar a
  // mesma visita é mais seguro do que falhar depois de uma ficha já ter sido criada.
  if (ctx.agendamentoId) {
    const porAgendamento = await buscarAtendimento(ctx.supabase, ctx.clinicId, 'agendamento_id', ctx.agendamentoId);
    if (porAgendamento) return validarContextoAtendimento(porAgendamento, ctx);
  }

  const { data: criado, error } = await ctx.supabase
    .from('atendimentos_clinicos')
    .insert({
      clinica_id: ctx.clinicId,
      paciente_id: ctx.pacienteId,
      dentista_id: ctx.dentistaId,
      agendamento_id: ctx.agendamentoId,
      chave_idempotencia: ctx.visitaKey,
      data_atendimento: hojeBRT(),
      origem: ctx.origem,
      estado: 'preparando',
      criado_por: ctx.usuarioId,
    })
    .select('id, paciente_id, dentista_id, agendamento_id, estado')
    .maybeSingle<AtendimentoRow>();

  if (criado) return { ok: true, row: criado };
  if (error?.code !== '23505') {
    console.error('[registrarAtendimentoClinico:criar]', error?.message);
    return { ok: false, error: 'Não foi possível iniciar esta visita. Tente novamente.' };
  }

  const concorrente =
    await buscarAtendimento(ctx.supabase, ctx.clinicId, 'chave_idempotencia', ctx.visitaKey)
    ?? (ctx.agendamentoId
      ? await buscarAtendimento(ctx.supabase, ctx.clinicId, 'agendamento_id', ctx.agendamentoId)
      : null);
  if (!concorrente) return { ok: false, error: 'Esta visita está sendo salva. Tente novamente em instantes.' };
  return validarContextoAtendimento(concorrente, ctx);
}

async function buscarAtendimento(
  supabase: Awaited<ReturnType<typeof requireClinicContext>>['supabase'],
  clinicId: string,
  campo: 'chave_idempotencia' | 'agendamento_id',
  valor: string,
): Promise<AtendimentoRow | null> {
  const { data, error } = await supabase
    .from('atendimentos_clinicos')
    .select('id, paciente_id, dentista_id, agendamento_id, estado')
    .eq('clinica_id', clinicId)
    .eq(campo, valor)
    .maybeSingle<AtendimentoRow>();

  if (error) console.error('[registrarAtendimentoClinico:buscar]', error.message);
  return data ?? null;
}

function validarContextoAtendimento(
  row: AtendimentoRow,
  ctx: { pacienteId: string; dentistaId: string; agendamentoId?: string },
): { ok: true; row: AtendimentoRow } | { ok: false; error: string } {
  if (
    row.paciente_id !== ctx.pacienteId
    || row.dentista_id !== ctx.dentistaId
    || row.agendamento_id !== (ctx.agendamentoId ?? null)
  ) {
    return { ok: false, error: 'Esta visita já pertence a outro contexto. Atualize a página antes de salvar.' };
  }
  return { ok: true, row };
}

async function vincularEventosAoAtendimento(ctx: {
  supabase: Awaited<ReturnType<typeof requireClinicContext>>['supabase'];
  clinicId: string;
  atendimentoId: string;
  eventos: OdontogramaEventoDraft[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const desejados = [...new Map(
    ctx.eventos.map((evento) => [
      `${evento.id}:${evento.status === 'realizado' ? 'realizado' : 'registrado'}`,
      {
        evento_id: evento.id,
        papel: evento.status === 'realizado' ? 'realizado' as const : 'registrado' as const,
      },
    ]),
  ).values()];
  if (desejados.length === 0) return { ok: true };

  const { data: existentes, error: erroLeitura } = await ctx.supabase
    .from('atendimento_eventos')
    .select('atendimento_id, evento_id, papel')
    .eq('clinica_id', ctx.clinicId)
    .in('evento_id', [...new Set(desejados.map((evento) => evento.evento_id))]);
  if (erroLeitura) {
    console.error('[registrarAtendimentoClinico:eventos:leitura]', erroLeitura.message);
    return { ok: false, error: 'Não foi possível vincular os procedimentos à visita. Tente novamente.' };
  }

  const porEventoEPapel = new Map(
    ((existentes ?? []) as AtendimentoEventoRow[]).map((evento) => [`${evento.evento_id}:${evento.papel}`, evento]),
  );
  const novos = [] as Array<{ clinica_id: string; atendimento_id: string; evento_id: string; papel: 'registrado' | 'realizado' }>;
  for (const evento of desejados) {
    const existente = porEventoEPapel.get(`${evento.evento_id}:${evento.papel}`);
    if (existente?.atendimento_id === ctx.atendimentoId) continue;
    if (existente) {
      return { ok: false, error: 'Um procedimento já está ligado a outra visita. Atualize a página antes de salvar.' };
    }
    novos.push({
      clinica_id: ctx.clinicId,
      atendimento_id: ctx.atendimentoId,
      evento_id: evento.evento_id,
      papel: evento.papel,
    });
  }

  if (novos.length === 0) return { ok: true };
  const { error: erroInserir } = await ctx.supabase.from('atendimento_eventos').insert(novos);
  if (erroInserir) {
    console.error('[registrarAtendimentoClinico:eventos:inserir]', erroInserir.message);
    return { ok: false, error: 'Não foi possível vincular os procedimentos à visita. Tente novamente.' };
  }
  return { ok: true };
}
