'use server';

import { z } from 'zod';
import { requireClinicContext } from '@/server/auth/clinic';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import { inserirNotificacao } from '@/lib/notificacoes';
import { buscarGruposAbertos, type GrupoAberto } from '@/server/patients/get-grupos-abertos';
import type { OdontogramaEventoDraft } from '@/types/odontograma';
import { montarRowsEventos } from '@/lib/odontograma/montar-rows-eventos';
import { endoDetalheSchema } from '@/lib/especialidades/endo';
import { implanteDetalheSchema } from '@/lib/especialidades/implante';
import { criarDocumentoConclusaoAssinatura } from '@/server/legal/documentos-aceite';
import { hojeBRT } from '@/lib/hora-brt';

import { editarDetalhesEventoSchema, type EditarDetalhesEventoInput, type EditarDetalhesEventoResult } from '@/lib/odontograma/edicao-procedimento';

const excluirProcedimentoSchema = z.object({
  eventoId: z.string().uuid(),
});

/**
 * Salva o event-log do odontograma — retry do save inicial (fail-soft, ver
 * `salvarFicha` em `@/server/patients/salvar-ficha`) E caminho único de save da ficha
 * rápida (FichasTab).
 * Upsert por id (migration 107, R-01): registro que saiu do rascunho é apagado,
 * os demais são atualizados no lugar mantendo o id — nunca renumera.
 */
export async function salvarEventosOdontograma(params: {
  fichaId:    string;
  pacienteId: string;
  eventos:    OdontogramaEventoDraft[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!dentistaPerfil) return { ok: false, error: 'Perfil de dentista não encontrado.' };

  // A ficha tem que existir, ser da clínica e ser DESTE dentista (mesma regra de autoria
  // do núcleo clínico 3.1 — clínica lê, autor escreve).
  const { data: ficha } = await supabase
    .from('fichas')
    .select('id')
    .eq('id', params.fichaId)
    .eq('clinica_id', clinicId)
    .eq('paciente_id', params.pacienteId)
    .eq('dentista_id', dentistaPerfil.id)
    .maybeSingle();

  if (!ficha) return { ok: false, error: 'Ficha não encontrada.' };
  if (params.eventos.length === 0) return { ok: true };

  const rows = montarRowsEventos(params.eventos, {
    clinicId,
    pacienteId: params.pacienteId,
    dentistaId: dentistaPerfil.id,
    fichaId:    params.fichaId,
  });

  // RPC atômica (migration 107): lock da ficha + upsert por id no mesmo
  // statement — serializa retries concorrentes (2 abas) e reforça no servidor
  // que ficha assinada é imutável (invariante #14), mesmo que a UI já esconda
  // o botão nesse caso.
  const { error } = await supabase.rpc('salvar_eventos_odontograma', {
    p_ficha_id:    params.fichaId,
    p_clinica_id:  clinicId,
    p_paciente_id: params.pacienteId,
    p_eventos:     rows,
  });

  if (error) {
    if (error.message.includes('ficha_assinada')) {
      return { ok: false, error: 'Esta ficha já foi assinada e não pode mais ser alterada.' };
    }
    console.error('[salvarEventosOdontograma]', error.message);
    return { ok: false, error: 'Não foi possível salvar o odontograma.' };
  }

  revalidatePath(`/dashboard/pacientes/${params.pacienteId}`);
  return { ok: true };
}

export async function salvarAssinaturaConsulta(
  fichaId: string,
  pacienteId: string,
  assinadoPor: string,
  assinaturaDataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, dentistaId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão' };

  const db = createServiceClient();

  // dono: só o dentista que criou a ficha pode assiná-la
  const { data: ficha } = await db
    .from('fichas')
    .select('id')
    .eq('id', fichaId)
    .eq('clinica_id', clinicId)
    .eq('paciente_id', pacienteId)
    .eq('dentista_id', dentistaId)
    .maybeSingle();

  if (!ficha) return { ok: false, error: 'Ficha não encontrada' };

  // R-03b: tenta o caminho granular primeiro (ficha com evento) — só cai pro legado
  // (abaixo, inalterado) se genuinamente não há nada realizado sem assinatura.
  const granular = await assinarTodosRealizadosDaFicha({ fichaId, pacienteId, assinadoPor, assinaturaDataUrl });
  if (granular.ok || granular.error !== 'Nada a assinar nesta ficha.') return granular;

  const base64 = assinaturaDataUrl.split(',')[1];
  if (!base64) return { ok: false, error: 'Assinatura inválida' };
  const buffer = Buffer.from(base64, 'base64');

  const storagePath = `${clinicId}/${pacienteId}/assinatura_${fichaId}.png`;

  const { error: storageErr } = await db.storage
    .from('fichas')
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

  if (storageErr) return { ok: false, error: storageErr.message };

  const { error: dbErr } = await db
    .from('fichas')
    .update({ assinatura_url: storagePath, assinado_em: new Date().toISOString() })
    .eq('id', fichaId)
    .eq('clinica_id', clinicId)
    .eq('dentista_id', dentistaId);

  if (dbErr) return { ok: false, error: dbErr.message };

  return { ok: true };
}

export async function iniciarAtendimentoConsulta(agendamentoId: string): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { error: 'Sem permissão.' };

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('status')
    .eq('id', agendamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle<{ status: string }>();

  if (!ag) return { error: 'Agendamento não encontrado.' };
  if (['completed', 'cancelled', 'no_show'].includes(ag.status)) return { error: 'Atendimento já encerrado.' };
  if (ag.status === 'in_progress') return {};

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', agendamentoId)
    .eq('clinica_id', clinicId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/agendamentos');
  return {};
}

// finalizarConsulta foi removida — fluxo de finalização usa `salvarFicha`
// (`@/server/patients/salvar-ficha`, R-11) diretamente.

/**
 * Alterna planejado ⇄ realizado de UM registro (grupo de eventos) na ficha salva.
 * Bug 21/07: a ficha salva não tinha caminho pra marcar o que foi feito — tudo
 * ficava "Planejado". Regras herdadas do núcleo clínico: só o AUTOR escreve, e
 * ficha assinada é imutável (invariante #14). `realizado_em` registra o dia em que
 * o dentista marcou o procedimento como realizado e volta a null ao reabrir o registro.
 */
export async function alternarStatusRegistro(params: {
  eventoIds: string[];
  novoStatus: 'indicado' | 'realizado';
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };
  if (params.eventoIds.length === 0) return { ok: true };

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!dentistaPerfil) return { ok: false, error: 'Perfil de dentista não encontrado.' };

  // A ficha dona precisa ser DESTE dentista e não estar assinada.
  const { data: eventos } = await supabase
    .from('odontograma_eventos')
    .select('id, ficha_id, origem')
    .in('id', params.eventoIds)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .eq('dentista_id', dentistaPerfil.id);

  if (!eventos || eventos.length !== params.eventoIds.length) {
    return { ok: false, error: 'Registro não encontrado ou de outro dentista.' };
  }

  const fichaIds = [...new Set(eventos.map((e) => e.ficha_id).filter((f): f is string => f != null))];
  const { data: fichas } = await supabase
    .from('fichas')
    .select('id, assinado_em')
    .in('id', fichaIds)
    .eq('clinica_id', clinicId);

  if (fichas?.some((f) => f.assinado_em != null)) {
    return { ok: false, error: 'Esta ficha já foi assinada e não pode mais ser alterada.' };
  }

  const realizado = params.novoStatus === 'realizado';
  const { error } = await supabase
    .from('odontograma_eventos')
    .update({
      status: params.novoStatus,
      // Pré-existente nunca ganha data; indicado nunca tem data. A data vem do servidor
      // para refletir o dia da confirmação, não o dia antigo em que a ficha foi criada.
      realizado_em: realizado
        ? (eventos[0].origem === 'clinica' ? hojeBRT() : null)
        : null,
      // R-101 — sem isso, marcar como realizado um evento em "próxima seção" violaria a
      // constraint odontograma_eventos_momento_coerente (momento só é != sessao_atual
      // quando status='indicado'). Voltar pra indicado não precisa resetar de volta —
      // a constraint já garante que só chega aqui com sessao_atual.
      ...(realizado ? { momento_planejado: 'sessao_atual' } : {}),
    })
    .in('id', params.eventoIds)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .eq('dentista_id', dentistaPerfil.id);

  if (error) {
    // R-03a: evento assinado individualmente é imutável mesmo com a ficha ainda aberta
    // (assinatura é por registro, não por ficha) — trg_odontograma_evento_imutavel barra.
    if (error.message.includes('evento_assinado_imutavel')) {
      return { ok: false, error: 'Este registro já foi assinado e não pode mais ser alterado.' };
    }
    console.error('[alternarStatusRegistro]', error.message);
    return { ok: false, error: 'Não foi possível atualizar o registro.' };
  }
  return { ok: true };
}

/**
 * R-101 — liga/desliga "próxima seção" de UM registro (grupo de eventos) na ficha salva.
 * Mesmo padrão de guarda que alternarStatusRegistro (autor, ficha não assinada). Só faz
 * sentido em status='indicado' — a constraint do banco recusa em realizado; o caller
 * (RegistroCard) já esconde o controle nesse caso, mas a action não confia só na UI.
 */
export async function alternarMomentoRegistro(params: {
  eventoIds: string[];
  novoMomento: 'sessao_atual' | 'proxima_sessao';
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };
  if (params.eventoIds.length === 0) return { ok: true };

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!dentistaPerfil) return { ok: false, error: 'Perfil de dentista não encontrado.' };

  const { data: eventos } = await supabase
    .from('odontograma_eventos')
    .select('id, ficha_id')
    .in('id', params.eventoIds)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .eq('dentista_id', dentistaPerfil.id);

  if (!eventos || eventos.length !== params.eventoIds.length) {
    return { ok: false, error: 'Registro não encontrado ou de outro dentista.' };
  }

  const fichaIds = [...new Set(eventos.map((e) => e.ficha_id).filter((f): f is string => f != null))];
  const { data: fichas } = await supabase
    .from('fichas')
    .select('id, assinado_em')
    .in('id', fichaIds)
    .eq('clinica_id', clinicId);

  if (fichas?.some((f) => f.assinado_em != null)) {
    return { ok: false, error: 'Esta ficha já foi assinada e não pode mais ser alterada.' };
  }

  const { error } = await supabase
    .from('odontograma_eventos')
    .update({ momento_planejado: params.novoMomento })
    .in('id', params.eventoIds)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .eq('dentista_id', dentistaPerfil.id);

  if (error) {
    if (error.message.includes('evento_assinado_imutavel')) {
      return { ok: false, error: 'Este registro já foi assinado e não pode mais ser alterado.' };
    }
    // odontograma_eventos_momento_coerente — tentativa em status='realizado' (não deveria
    // chegar aqui, o controle na UI já esconde; defesa em profundidade mesmo assim).
    if (error.message.includes('momento_coerente')) {
      return { ok: false, error: 'Só é possível marcar "próxima sessão" em registros ainda não realizados.' };
    }
    console.error('[alternarMomentoRegistro]', error.message);
    return { ok: false, error: 'Não foi possível atualizar o registro.' };
  }
  return { ok: true };
}

/**
 * Autor encaminha (ou remove o encaminhamento de) um registro planejado seu a outro
 * dentista da clínica (R-04). Nunca transfere autoria — `dentista_id` continua o autor;
 * só `encaminhado_para` muda. RLS de escrita (migration 101) já cobre esta coluna pro
 * dono; nenhuma policy nova.
 */
export type EncaminharResult =
  | { ok: true; encaminhados: string[]; ignorados: string[] }
  | { ok: false; error: string };

export async function encaminharProcedimento(params: {
  eventoIds: string[];
  /** null = remove o encaminhamento existente. */
  dentistaDestinoId: string | null;
}): Promise<EncaminharResult> {
  const { supabase, user, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };
  if (params.eventoIds.length === 0) return { ok: true, encaminhados: [], ignorados: [] };

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!dentistaPerfil) return { ok: false, error: 'Perfil de dentista não encontrado.' };

  // R-52 (MAPA-MEU-DIA.md §4, R-51-53 spec) — sucesso PARCIAL, não tudo-ou-nada: um lote
  // selecionado no Meu dia pode ter 1 id que mudou de estado entre a seleção e o confirmar
  // (outra aba, outra pessoa da clínica assinou a ficha nesse meio-tempo). Abortar o lote
  // inteiro por causa de 1 id é pior do que encaminhar os N-1 válidos e avisar do resto.
  // A query já filtra por autor (`dentista_id = eu`) — o que não voltar aqui já é "ignorado".
  const { data: eventos } = await supabase
    .from('odontograma_eventos')
    .select('id, ficha_id, status, paciente_id')
    .in('id', params.eventoIds)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .eq('dentista_id', dentistaPerfil.id);

  const idsIndicados = new Set(
    (eventos ?? []).filter((e) => e.status === 'indicado').map((e) => e.id),
  );

  const fichaIdsCandidatos = [
    ...new Set((eventos ?? []).map((e) => e.ficha_id).filter((f): f is string => f != null)),
  ];
  const { data: fichas } = await supabase
    .from('fichas')
    .select('id, assinado_em')
    .in('id', fichaIdsCandidatos)
    .eq('clinica_id', clinicId);
  const fichasAssinadas = new Set(
    (fichas ?? []).filter((f) => f.assinado_em != null).map((f) => f.id),
  );

  const eventosElegiveis = (eventos ?? []).filter(
    (e) => idsIndicados.has(e.id) && (e.ficha_id == null || !fichasAssinadas.has(e.ficha_id)),
  );
  const idsElegiveis = eventosElegiveis.map((e) => e.id);
  const ignorados = params.eventoIds.filter((id) => !idsElegiveis.includes(id));

  if (idsElegiveis.length === 0) {
    return {
      ok: false,
      error: 'Só é possível encaminhar procedimento indicado, não assinado e registrado por você.',
    };
  }

  let destino: { id: string; nome: string } | null = null;
  if (params.dentistaDestinoId != null) {
    // Destino elegível: mesma clínica, ativo, nunca secretária, nunca o próprio autor —
    // validado no servidor, não só escondido na UI (a RLS não filtra isso sozinha).
    const { data: destinoData } = await supabase
      .from('dentistas')
      .select('id, nome')
      .eq('id', params.dentistaDestinoId)
      .eq('clinica_id', clinicId)
      // R-94 — .neq('role','secretaria') sozinho deixaria 'protetico' virar destino
      // de encaminhamento clínico; ele não atende paciente.
      .in('role', ['admin', 'dentista'])
      .eq('ativo', true)
      .neq('id', dentistaPerfil.id)
      .maybeSingle();

    if (!destinoData) return { ok: false, error: 'Destino inválido.' };
    destino = destinoData;
  }

  // R-140c: alteração e trilha de auditoria precisam ser uma operação só. A RPC
  // reafirma autor, clínica, status, ficha não assinada e destino antes de gravar
  // o evento e o `activity_logs`; se o log falhar, nada é encaminhado.
  const { error } = await supabase.rpc('encaminhar_eventos_odontograma', {
    p_evento_ids: idsElegiveis,
    p_destino_id: params.dentistaDestinoId,
  });

  if (error) {
    if (error.code === 'PGRST202' || error.message.includes('Could not find the function')) {
      return { ok: false, error: 'O encaminhamento está indisponível porque a configuração clínica ainda não foi publicada.' };
    }
    console.error('[encaminharProcedimento]', error.message);
    return { ok: false, error: 'Não foi possível encaminhar o registro.' };
  }

  if (destino) {
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('nome')
      .eq('id', eventosElegiveis[0].paciente_id)
      .maybeSingle<{ nome: string }>();

    await inserirNotificacao(supabase, {
      clinicaId:     clinicId,
      paraRole:      'dentista',
      paraDentistaId: destino.id,
      deDentistaId:  dentistaPerfil.id,
      tipo:          'procedimento_encaminhado',
      titulo:        `Procedimento encaminhado — ${paciente?.nome ?? 'Paciente'}`,
      mensagem:      'Um procedimento planejado foi encaminhado pra você.',
      href:          `/dashboard/pacientes/${eventosElegiveis[0].paciente_id}`,
    });
  }

  revalidatePath(`/dashboard/pacientes/${eventosElegiveis[0].paciente_id}`);
  return { ok: true, encaminhados: idsElegiveis, ignorados };
}

/**
 * Destino conclui (ou reabre) um registro que foi encaminhado a ele (R-04, Fases 1-4).
 * Escrita estreita via RPC (migration 109): só status + realizado_em, nunca tipo/âncora/
 * detalhe/autoria — quem trata de fato o `detalhe` de endo/implante ainda é o autor
 * (R-04b, item futuro). A RPC valida sozinha (encaminhado_para = caller, ficha não
 * assinada); esta action só decide o "de quem" da notificação de volta.
 */
export async function atualizarStatusEncaminhado(params: {
  eventoIds: string[];
  novoStatus: 'indicado' | 'realizado';
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };
  if (params.eventoIds.length === 0) return { ok: true };

  const { error } = await supabase.rpc('concluir_evento_encaminhado', {
    p_evento_ids:   params.eventoIds,
    p_novo_status:  params.novoStatus,
    // A data clínica desta confirmação é do servidor: o cliente não pode forjar nem
    // reaproveitar a data de uma ficha antiga ao concluir um encaminhamento.
    p_realizado_em: params.novoStatus === 'realizado' ? hojeBRT() : null,
  });

  if (error) {
    if (error.message.includes('sem_permissao')) {
      return { ok: false, error: 'Este registro não foi encaminhado a você, ou a ficha já foi assinada.' };
    }
    console.error('[atualizarStatusEncaminhado]', error.message);
    return { ok: false, error: 'Não foi possível atualizar o registro.' };
  }

  // Notifica o autor original só ao concluir (Decisão #4) — cortesia, best-effort.
  // O núcleo clínico já é compartilhado (migration 099): o autor vê a mudança de status
  // sozinho na próxima vez que abrir o paciente, mesmo se a notificação falhar.
  if (params.novoStatus === 'realizado') {
    const { data: destinoPerfil } = await supabase
      .from('dentistas')
      .select('id')
      .eq('user_id', user.id)
      .eq('clinica_id', clinicId)
      .maybeSingle();

    const { data: evento } = await supabase
      .from('odontograma_eventos')
      .select('dentista_id, paciente_id')
      .eq('clinica_id', clinicId)
    .is('retirado_em', null)
      .in('id', params.eventoIds)
      .limit(1)
      .maybeSingle<{ dentista_id: string; paciente_id: string }>();

    if (evento && destinoPerfil) {
      const { data: paciente } = await supabase
        .from('pacientes')
        .select('nome')
        .eq('id', evento.paciente_id)
        .maybeSingle<{ nome: string }>();

      await inserirNotificacao(supabase, {
        clinicaId:     clinicId,
        paraRole:      'dentista',
        paraDentistaId: evento.dentista_id,
        deDentistaId:  destinoPerfil.id,
        tipo:          'encaminhamento_concluido',
        titulo:        `Procedimento encaminhado concluído — ${paciente?.nome ?? 'Paciente'}`,
        mensagem:      'O dentista que você encaminhou concluiu o procedimento.',
        href:          `/dashboard/pacientes/${evento.paciente_id}`,
      });

      revalidatePath(`/dashboard/pacientes/${evento.paciente_id}`);
    }
  }

  revalidatePath('/dashboard');
  return { ok: true };
}

/**
 * R-04b — o DESTINO de um encaminhamento preenche a TABELA clínica (detalhe) do que recebeu.
 * Só `detalhe`, nunca a observação do autor (Decisão 4). Valida contra o Zod do plugin certo
 * ANTES da RPC (a RPC não sabe de Zod — sem isso, um detalhe corrompido só apareceria "sem tabela"
 * na leitura seguinte, em silêncio). A escrita passa pela RPC preencher_detalhe_encaminhado
 * (migration 110), que barra quem não é o destino, ficha assinada, ou tipo fora de endo/implante.
 */
export async function preencherDetalheEncaminhado(params: {
  eventoId: string;
  detalhe: unknown;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };

  // Descobre o tipo pra escolher o schema certo. Leitura é aberta à clínica (núcleo
  // compartilhado, migration 099); a autorização de ESCRITA é toda da RPC.
  const { data: evento } = await supabase
    .from('odontograma_eventos')
    .select('tipo, paciente_id')
    .eq('id', params.eventoId)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .maybeSingle<{ tipo: string; paciente_id: string }>();

  if (!evento) return { ok: false, error: 'Registro não encontrado.' };

  const schema =
    evento.tipo === 'endodontia' ? endoDetalheSchema
    : evento.tipo === 'implante' ? implanteDetalheSchema
    : null;
  if (!schema) return { ok: false, error: 'Esse tipo de registro não tem tabela editável.' };

  const parsed = schema.safeParse(params.detalhe);
  if (!parsed.success) return { ok: false, error: 'Alguns campos da tabela estão inválidos.' };

  const { error } = await supabase.rpc('preencher_detalhe_encaminhado', {
    p_evento_id: params.eventoId,
    p_detalhe:   parsed.data,
  });

  if (error) {
    if (error.message.includes('sem_permissao')) {
      return { ok: false, error: 'Este registro não foi encaminhado a você, ou a ficha já foi assinada.' };
    }
    if (error.message.includes('tipo_nao_suportado')) {
      return { ok: false, error: 'Esse tipo de registro não tem tabela editável.' };
    }
    console.error('[preencherDetalheEncaminhado]', error.message);
    return { ok: false, error: 'Não foi possível salvar a tabela.' };
  }

  revalidatePath(`/dashboard/pacientes/${evento.paciente_id}`);
  return { ok: true };
}

/**
 * R-140c — edição contextual do card no Prontuário unificado. A RPC mantém a
 * autorização estreita e grava o log na mesma transação: autor pode atualizar
 * observação e detalhe; destinatário encaminhado só atualiza detalhe técnico.
 */
export async function editarDetalhesEvento(params: EditarDetalhesEventoInput): Promise<EditarDetalhesEventoResult> {
  const parsedParams = editarDetalhesEventoSchema.safeParse(params);
  if (!parsedParams.success) return { ok: false, error: parsedParams.error.issues[0]?.message ?? 'Revise os dados antes de salvar.' };

  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };

  const { data: evento } = await supabase
    .from('odontograma_eventos')
    .select('tipo, paciente_id')
    .eq('id', parsedParams.data.eventoId)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .maybeSingle<{ tipo: string; paciente_id: string }>();

  if (!evento) return { ok: false, error: 'Registro não encontrado.' };

  let detalheValidado: unknown | null = null;
  if (parsedParams.data.alterarDetalhe) {
    const schema = evento.tipo === 'endodontia'
      ? endoDetalheSchema
      : evento.tipo === 'implante'
        ? implanteDetalheSchema
        : null;
    if (!schema) return { ok: false, error: 'Esse procedimento não possui detalhes técnicos editáveis.' };
    const parsedDetalhe = schema.safeParse(parsedParams.data.detalhe);
    if (!parsedDetalhe.success) return { ok: false, error: 'Alguns campos dos detalhes técnicos estão inválidos.' };
    detalheValidado = parsedDetalhe.data;
  }

  const { error } = await supabase.rpc('editar_detalhes_evento_odontograma', {
    p_evento_id: parsedParams.data.eventoId,
    p_detalhe: detalheValidado,
    p_alterar_detalhe: parsedParams.data.alterarDetalhe,
    p_observacao: parsedParams.data.observacao,
    p_alterar_observacao: parsedParams.data.alterarObservacao,
    ...(parsedParams.data.alterarNome !== undefined ? {
      p_procedimento_nome: parsedParams.data.procedimentoNome ?? null,
      p_alterar_nome: parsedParams.data.alterarNome,
    } : {}),
    ...(parsedParams.data.original ? { p_original: parsedParams.data.original } : {}),
  });

  if (error) {
    if (error.message.includes('conflito_edicao')) {
      const { data: atual } = await supabase.from('odontograma_eventos')
        .select('procedimento_nome, observacao, detalhe')
        .eq('id', parsedParams.data.eventoId).eq('clinica_id', clinicId)
    .is('retirado_em', null)
        .maybeSingle<{ procedimento_nome: string | null; observacao: string | null; detalhe: unknown }>();
      return {
        ok: false,
        error: 'Este procedimento foi alterado enquanto você editava. Sua edição foi mantida; confira os dados atuais antes de salvar novamente.',
        ...(atual ? { atual: { procedimentoNome: atual.procedimento_nome, observacao: atual.observacao, detalhe: atual.detalhe } } : {}),
      };
    }
    if (error.message.includes('nome_invalido')) {
      return { ok: false, error: 'Informe um nome com até 500 caracteres.' };
    }
    if (error.message.includes('registro_bloqueado') || error.message.includes('evento_assinado_imutavel')) {
      return { ok: false, error: 'Este registro já foi assinado e não pode mais ser alterado.' };
    }
    if (error.message.includes('tipo_nao_suportado')) {
      return { ok: false, error: 'Esse procedimento não possui detalhes técnicos editáveis.' };
    }
    if (error.message.includes('sem_permissao')) {
      return { ok: false, error: 'Você só pode editar seus registros ou o detalhe técnico de um procedimento encaminhado.' };
    }
    console.error('[editarDetalhesEvento]', error.message);
    return { ok: false, error: 'Não foi possível salvar os detalhes do procedimento.' };
  }

  revalidatePath(`/dashboard/pacientes/${evento.paciente_id}`);
  revalidatePath('/dashboard/meu-dia');
  return { ok: true };
}

/** Remove um único procedimento ainda editável, com guarda e auditoria na mesma RPC. */
export async function excluirProcedimento(params: {
  eventoId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const parsedParams = excluirProcedimentoSchema.safeParse(params);
  if (!parsedParams.success) return { ok: false, error: 'Registro inválido.' };

  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };

  const { data: evento } = await supabase
    .from('odontograma_eventos')
    .select('paciente_id')
    .eq('id', parsedParams.data.eventoId)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .maybeSingle<{ paciente_id: string }>();

  if (!evento) return { ok: false, error: 'Registro não encontrado.' };

  const { error } = await supabase.rpc('excluir_evento_odontograma', {
    p_evento_id: parsedParams.data.eventoId,
  });

  if (error) {
    if (error.message.includes('registro_bloqueado') || error.message.includes('evento_assinado_imutavel')) {
      return { ok: false, error: 'Este procedimento já foi assinado e não pode ser apagado.' };
    }
    if (error.message.includes('registro_orcado')) {
      return { ok: false, error: 'Este procedimento está vinculado a um orçamento e não pode ser apagado.' };
    }
    if (error.message.includes('sem_permissao')) {
      return { ok: false, error: 'Você só pode apagar procedimentos registrados por você.' };
    }
    if (error.message.includes('registro_nao_encontrado')) {
      return { ok: false, error: 'Registro não encontrado.' };
    }
    console.error('[excluirProcedimento]', error.message);
    return { ok: false, error: 'Não foi possível apagar o procedimento.' };
  }

  revalidatePath(`/dashboard/pacientes/${evento.paciente_id}`);
  return { ok: true };
}

/**
 * R-02 Fase 3 — trabalhos ainda abertos do paciente, pro modo consulta (alimenta a confirmação
 * de amarração do ToothDetailPanel). A clínica vem do contexto de auth (nunca confia no client);
 * a leitura em si é a função pura já testada. Read-only, sem efeito colateral.
 */
export async function getGruposAbertos(patientId: string): Promise<GrupoAberto[]> {
  const { clinicId } = await requireClinicContext();
  return buscarGruposAbertos({ patientId, clinicId });
}

const conclusaoAssinadaSchema = z.object({
  orientacoes: z.string().trim().min(3).max(8_000),
  intercorrencia: z.string().trim().max(8_000).optional(),
  retorno: z.string().trim().max(8_000).optional(),
});

const assinarProcedimentosSchema = z.object({
  eventoIds: z.array(z.string().uuid()).min(1),
  assinadoPor: z.string().trim().min(2).max(120),
  assinaturaDataUrl: z.string().startsWith('data:image/png;base64,'),
  conclusao: conclusaoAssinadaSchema.optional(),
});
export type AssinarProcedimentosInput = z.infer<typeof assinarProcedimentosSchema>;
export type AssinarProcedimentosResult =
  | { ok: true; signedUrl?: string; documentWarning?: string }
  | { ok: false; error: string };

/**
 * R-03a — assinatura por procedimento (lote). Wrapper fino da RPC assinar_procedimentos
 * (migration 111, SECURITY DEFINER): quem pode assinar é decisão #5, validada NO BANCO —
 * autor da ficha ou secretária da mesma clínica, nunca via bypass de service role (diferente
 * dos 3 fluxos legados de assinatura de FICHA, que ficam fora deste item — R-03b reconcilia).
 * Cliente normal (RLS ligada), não service role: o bucket `fichas` já é silo por clínica.
 */
export async function assinarProcedimentos(
  params: AssinarProcedimentosInput,
): Promise<AssinarProcedimentosResult> {
  const parsed = assinarProcedimentosSchema.safeParse(params);
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' };
  const { eventoIds, assinadoPor, assinaturaDataUrl, conclusao } = parsed.data;

  const context = await requireClinicContext();
  const { supabase, clinicId } = context;

  // Resolve paciente_id/ficha_id só pro path do storage — a RPC valida tudo de novo por
  // dentro (este read não é a autorização, é só pra montar o nome do arquivo).
  const { data: eventoRef } = await supabase
    .from('odontograma_eventos')
    .select('paciente_id, ficha_id')
    .eq('id', eventoIds[0])
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .maybeSingle();

  if (!eventoRef?.ficha_id) return { ok: false, error: 'Registro não encontrado.' };

  const base64 = assinaturaDataUrl.split(',')[1];
  if (!base64) return { ok: false, error: 'Assinatura inválida.' };
  const buffer = Buffer.from(base64, 'base64');
  const storagePath = `${clinicId}/${eventoRef.paciente_id}/assinatura_${eventoRef.ficha_id}_${Date.now()}.png`;

  const { error: storageErr } = await supabase.storage
    .from('fichas')
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

  if (storageErr) {
    console.error('[assinarProcedimentos] storage:', storageErr.message);
    return { ok: false, error: 'Erro ao salvar a assinatura.' };
  }

  const { data: assinaturaId, error } = await supabase.rpc('assinar_procedimentos', {
    p_evento_ids: eventoIds,
    p_assinado_por: assinadoPor,
    p_assinatura_ref: storagePath,
  });

  if (error) {
    // PNG já subiu mas a RPC rejeitou — remove o órfão antes de devolver o erro (mesmo
    // cuidado que salvarAssinaturaConsulta/FichasTab.handleSaveSignature já tomam).
    await supabase.storage.from('fichas').remove([storagePath]);
    if (error.message.includes('sem_permissao')) {
      return { ok: false, error: 'Você não tem permissão para assinar estes registros.' };
    }
    // A RPC funde "status diferente de realizado", "já assinado" e "mistura de fichas"
    // num único raise (status_invalido) — não há como o wrapper distinguir os 3 casos.
    if (error.message.includes('status_invalido')) {
      return { ok: false, error: 'Só é possível assinar procedimentos já realizados e ainda não assinados, todos da mesma ficha.' };
    }
    console.error('[assinarProcedimentos]', error.message);
    return { ok: false, error: 'Não foi possível registrar a assinatura.' };
  }

  revalidatePath(`/dashboard/pacientes/${eventoRef.paciente_id}`);
  if (!conclusao) return { ok: true };
  if (typeof assinaturaId !== 'string') {
    return { ok: true, documentWarning: 'A assinatura foi salva, mas o identificador do documento não foi retornado.' };
  }

  const documento = await criarDocumentoConclusaoAssinatura({ context, assinaturaId, campos: conclusao });
  return documento.ok
    ? { ok: true, signedUrl: documento.signedUrl }
    : { ok: true, documentWarning: documento.error };
}

/**
 * R-03b — gesto padrão dos 3 fluxos de captura: assina TODOS os realizados ainda não
 * assinados desta ficha, preservando o "1 clique assina tudo" de hoje. Ficha sem evento
 * (caminho legado, fichas.assinado_em) nunca chega aqui — cada chamador branchueia antes
 * (spec R-03b, Decisão #B3).
 */
export async function assinarTodosRealizadosDaFicha(params: {
  fichaId: string;
  pacienteId: string;
  assinadoPor: string;
  assinaturaDataUrl: string;
  conclusao?: z.infer<typeof conclusaoAssinadaSchema>;
}): Promise<AssinarProcedimentosResult> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data: eventos } = await supabase
    .from('odontograma_eventos')
    .select('id')
    .eq('ficha_id', params.fichaId)
    .eq('paciente_id', params.pacienteId)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null)
    .eq('status', 'realizado')
    .is('assinatura_id', null);

  const eventoIds = (eventos ?? []).map((e) => e.id as string);
  if (eventoIds.length === 0) {
    return { ok: false, error: 'Nada a assinar nesta ficha.' };
  }

  return assinarProcedimentos({
    eventoIds,
    assinadoPor: params.assinadoPor,
    assinaturaDataUrl: params.assinaturaDataUrl,
    conclusao: params.conclusao,
  });
}
