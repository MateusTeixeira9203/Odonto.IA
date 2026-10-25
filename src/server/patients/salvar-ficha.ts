'use server';

import { z } from 'zod';
import { mensagemErroExclusao, type ConfirmacaoExclusaoFicha } from '@/lib/prontuario/exclusao-ficha';
import { requireClinicContext } from '@/server/auth/clinic';
import { revalidatePath } from 'next/cache';
import { registrarLog } from '@/lib/activity-log';
// R-108b — as duas saíram DESTE arquivo pra módulos puros: `montarRowsEventos` porque o
// roteamento da visita precisa dela (3ª cópia era o bug silencioso da 137 esperando acontecer),
// e `finalizarAtendimentoSeAplicavel` porque fechar o atendimento deixou de depender de existir
// ficha nova (visita que só conclui pendência não cria nenhuma).
import { montarRowsEventos } from '@/lib/odontograma/montar-rows-eventos';
import { statusDoTratamento } from '@/lib/ficha/status-tratamento';
import { finalizarAtendimentoSeAplicavel } from '@/server/patients/finalizar-atendimento';
import { EVENTS, ENTITY_TYPES } from '@/lib/events';
import { DENTES_FDI } from '@/lib/odonto-dictionary';
import {
  ARCH_SUPERIOR, ARCH_INFERIOR, ARCH_COMPLETA,
  QUAD_SUP_DIREITO, QUAD_SUP_ESQUERDO, QUAD_INF_DIREITO, QUAD_INF_ESQUERDO,
} from '@/lib/arcadas';
import type { OdontogramaEventoDraft, OrtoManutencaoInfo } from '@/types/odontograma';

// R-30 Parte 1 — dentesAfetados aceita dente FDI real ou âncora de região (arcada/quadrante/
// boca toda). O schema antigo (min(11).max(85)) rejeitava os sentinelas 91-94 e 97-99, que a
// tela já produz há tempo (arch-chips.tsx) — 25 fichas em produção têm sentinela gravado e
// não abrem para editar.
const DENTES_E_ANCORAS_VALIDOS = new Set<number>([
  ...Object.keys(DENTES_FDI).map(Number),
  ARCH_SUPERIOR, ARCH_INFERIOR, ARCH_COMPLETA,
  QUAD_SUP_DIREITO, QUAD_SUP_ESQUERDO, QUAD_INF_DIREITO, QUAD_INF_ESQUERDO,
]);

/**
 * R-11 — contrato único de escrita da ficha (spec `plans/specs/R-11-unificar-gravacao-ficha.md`).
 * Substitui os 3 caminhos que hoje escrevem `fichas` direto (salvarFichaConsulta,
 * FichasTab.handleSave client-side, e o código morto já removido na Fase 0): mesma validação,
 * mesmo guard de imutabilidade, mesma derivação de `status`, nas duas origens (modo consulta e
 * ficha rápida). `odontograma_eventos` continua fora daqui — sempre via a RPC
 * `salvar_eventos_odontograma` (migration 107), reusada e não reescrita.
 *
 * Fora de escopo (Decisão #6): os 3 fluxos de assinatura (assinatura_url/assinado_em) — R-03b.
 */

// R-46c — 'importado' é histórico transcrito do Word, sem agendamento nem odontograma
// estruturado (D7: zero parsing). Fecha (status 'concluida', D6) na hora — nunca é
// "trabalho em aberto" como uma ficha 'manual' comum.
export type OrigemFicha = 'modo_consulta' | 'manual' | 'importado';

export interface SalvarFichaInput {
  fichaId?: string;
  pacienteId: string;
  origem: OrigemFicha;
  agendamentoId?: string;
  /** R-85 — default `true` (preserva o comportamento de sempre). `false` grava a ficha e os
   *  eventos SEM fechar o agendamento nem notificar a secretária — usado quando "Gerar
   *  orçamento" precisa de um `ficha_id` real no meio da consulta, antes do dentista ter
   *  terminado de verdade. Quem chama com `false` é responsável por chamar de novo depois
   *  (com `fichaId` desta resposta) e `finalizarAtendimento` omitido/`true` pra fechar. */
  finalizarAtendimento?: boolean;
  dataAtendimento: string;
  queixaPrincipal: string;
  anotacoes: string;
  dentesAfetados: number[];
  dentesObservacoes: Record<string, string>;
  procedimentos: string[];
  conduta: string;
  alertaNovo?: string | null;
  ortoManutencao?: OrtoManutencaoInfo | null;
  odontogramaEventos?: OdontogramaEventoDraft[];
}

export type SalvarFichaResult =
  | { ok: true; fichaId: string; eventosFalharam?: boolean }
  | { ok: false; error: string };

export interface DeletarFichaResult {
  ok: boolean;
  error?: string;
}

export interface ResumoExclusaoFicha {
  eventos: number;
  evolucoes: number;
  orcamentosEditaveis: number;
  orcamentosMantidos: number;
  orcamentosApagados: number;
  nomePaciente: string;
  arquivos: number;
  dataAtendimento: string;
}

export type PrepararExclusaoFichaResult =
  | { ok: true; resumo: ResumoExclusaoFicha }
  | { ok: false; error: string };

const salvarFichaSchema = z.object({
  fichaId:            z.string().uuid().optional(),
  pacienteId:         z.string().uuid(),
  origem:             z.enum(['modo_consulta', 'manual', 'importado']),
  agendamentoId:      z.string().uuid().optional(),
  finalizarAtendimento: z.boolean().optional(),
  dataAtendimento:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  queixaPrincipal:    z.string().trim().max(500),
  anotacoes:          z.string().trim().max(5000),
  dentesAfetados:     z.array(
    z.number().int().refine((n) => DENTES_E_ANCORAS_VALIDOS.has(n), {
      message: 'Dente FDI ou âncora de região inválida',
    }),
  ),
  dentesObservacoes:  z.record(z.string(), z.string()),
  procedimentos:      z.array(z.string()),
  conduta:            z.string().trim().max(2000),
  alertaNovo:         z.string().trim().nullable().optional(),
  ortoManutencao:     z.unknown().nullable().optional(),
  odontogramaEventos: z.array(z.unknown()).optional(),
});

/**
 * R-108b — `fichas.status` é o estado do TRATAMENTO (R-108 §2), então sai do CONTEÚDO e não da
 * origem: sobrou procedimento `indicado`, o tratamento está aberto; saiu tudo `realizado`, ele
 * fechou. Antes vinha de `origem`, e era por isso que **71 de 71** fichas do Meu dia nasciam
 * `concluida` (conferido em produção 13/08) — nenhum tratamento jamais abria pela entrada
 * principal do produto, e o seletor "o novo vai para" nunca teria o que oferecer.
 *
 * Ficha sem evento nenhum não tem o que derivar e mantém a regra antiga — é a ficha só-texto
 * da ficha rápida, que nunca foi um tratamento.
 */
function statusDoConteudo(
  origem: OrigemFicha,
  eventos: OdontogramaEventoDraft[] | undefined,
): 'aberta' | 'concluida' {
  // R-46c (D6) — importada é registro histórico transcrito, nunca trabalho em aberto.
  if (origem === 'importado') return 'concluida';
  if (!eventos || eventos.length === 0) return origem === 'modo_consulta' ? 'concluida' : 'aberta';
  return statusDoTratamento(eventos);
}

/**
 * salvarFicha — cria (sem fichaId) ou edita (com fichaId) o documento-ficha. `status` e
 * `origem` nunca vêm do input: `status` é derivado do conteúdo no servidor
 * (`statusDoConteudo`) e `origem` não muda depois de criada (update não a aceita).
 * Update de ficha assinada é rejeitado (`ficha_assinada`) — mesma classe de proteção que a
 * RPC 107 já dá a `odontograma_eventos`.
 */
export async function salvarFicha(input: SalvarFichaInput): Promise<SalvarFichaResult> {
  const parsed = salvarFichaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' };
  const data = parsed.data;

  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão.' };

  // Esta action também é chamada diretamente pela Ficha rápida e pela importação do Word.
  const [paciente, agendamento] = await Promise.all([
    supabase.from('pacientes').select('id')
      .eq('id', data.pacienteId)
      .eq('clinica_id', clinicId)
      .maybeSingle<{ id: string }>(),
    data.agendamentoId
      ? supabase.from('agendamentos').select('id')
        .eq('id', data.agendamentoId)
        .eq('clinica_id', clinicId)
        .eq('paciente_id', data.pacienteId)
        .eq('dentista_id', dentistaId)
        .maybeSingle<{ id: string }>()
      : Promise.resolve(null),
  ]);
  if (paciente.error || !paciente.data
    || (data.agendamentoId && (agendamento?.error || !agendamento?.data))) {
    return { ok: false, error: 'Registro nao encontrado.' };
  }

  const isUpdate = data.fichaId != null;

  if (isUpdate) {
    const { data: fichaAtual } = await supabase
      .from('fichas')
      .select('id, dentista_id, assinado_em, dentes_afetados, procedimentos')
      .eq('id', data.fichaId as string)
      .eq('clinica_id', clinicId)
      .eq('paciente_id', data.pacienteId)
      .maybeSingle();

    if (!fichaAtual) return { ok: false, error: 'Registro nao encontrado.' };
    if (fichaAtual.assinado_em != null) {
      return { ok: false, error: 'Esta ficha já foi assinada e não pode mais ser alterada.' };
    }

    // R-30 Parte 6 — "antes" do delta que vai pro log, capturado antes do UPDATE mudar tudo.
    const { count: eventosAntes } = await supabase
      .from('odontograma_eventos')
      .select('id', { count: 'exact', head: true })
      .eq('ficha_id', data.fichaId as string)
      .eq('clinica_id', clinicId)
      .is('retirado_em', null);

    const { data: atualizada, error } = await supabase
      .from('fichas')
      .update({
        data_atendimento:    data.dataAtendimento,
        // D1 (achado no MAPA-MEU-DIA.md §4) — mesmo padrão de `conduta` abaixo: string vazia
        // vira null, não fica presa vazia. `?? 'Evolução'` nos 4 consumidores (PDF, timeline,
        // perfil, modal de orçamento) só pega null — string vazia passava reto e a ficha ia
        // pro CRO sem título.
        queixa_principal:    data.queixaPrincipal || null,
        anotacoes:           data.anotacoes,
        dentes_afetados:     data.dentesAfetados,
        dentes_observacoes:  data.dentesObservacoes,
        procedimentos:       data.procedimentos,
        conduta:             data.conduta || null,
        // R-47 (achado 6, 31/07) — `alertaNovo` é opcional no schema; omitido (undefined)
        // preserva o valor já salvo, só `null`/string explícitos mudam. Antes gravava
        // `?? null` sempre — a ficha rápida nunca mandava a chave, então reeditar por ela
        // uma ficha que tinha alerta real (ex.: vindo do modo consulta) apagava o alerta.
        ...(data.alertaNovo !== undefined && { alerta_novo: data.alertaNovo }),
        // R-108b — o estado do tratamento acompanha o conteúdo também na edição: sem isto, a
        // ficha nascida com uma indicação continuaria `aberta` para sempre depois que o
        // dentista marcasse tudo como feito. Só quando o payload traz os eventos — chamador
        // que não manda `odontogramaEventos` não está dizendo nada sobre o plano, e o status
        // fica como está.
        ...(data.odontogramaEventos !== undefined && {
          status: statusDoConteudo(data.origem, data.odontogramaEventos as OdontogramaEventoDraft[]),
        }),
        orto_manutencao:     data.ortoManutencao ?? null,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', data.fichaId as string)
      .eq('clinica_id', clinicId)
      .select('id');

    if (error) {
      console.error('[salvarFicha:update]', error.message);
      return { ok: false, error: 'Erro ao salvar a ficha. Tente novamente.' };
    }

    // R-59 Parte 3 — mesmo padrão de `deletarFicha` (achado de 28/07): a RLS pode barrar o
    // UPDATE sem devolver erro (0 linhas afetadas) e isso virava um `ok: true` com a ficha
    // intacta no banco — a edição "salvava" e sumia. O `fichaAtual` lido acima NÃO protege:
    // desde a migration 099 a leitura de ficha é compartilhada na clínica, mas a escrita
    // continua siloada por dentista. Ficha de colega é achada, lida, e o UPDATE não pega.
    if (!atualizada || atualizada.length === 0) {
      console.error('[salvarFicha:update] UPDATE bloqueado silenciosamente (RLS?) — 0 linhas para', data.fichaId);
      return { ok: false, error: 'Não foi possível salvar: esta ficha é de outro dentista.' };
    }

    const resultado = await finalizarEventos(supabase, {
      fichaId: data.fichaId as string,
      clinicId,
      pacienteId: data.pacienteId,
      dentistaId,
      eventos: data.odontogramaEventos as OdontogramaEventoDraft[] | undefined,
    });

    if (resultado.ok) {
      const { count: eventosDepois } = await supabase
        .from('odontograma_eventos')
        .select('id', { count: 'exact', head: true })
        .eq('ficha_id', data.fichaId as string)
      .eq('clinica_id', clinicId)
      .is('retirado_em', null);

      const dentesAntes = new Set((fichaAtual.dentes_afetados ?? []) as number[]);
      const dentesDepois = new Set(data.dentesAfetados);
      registrarLog(supabase, {
        clinicaId:  clinicId,
        actorId:    dentistaId,
        pacienteId: data.pacienteId,
        entityType: ENTITY_TYPES.FICHA,
        entityId:   data.fichaId as string,
        action:     EVENTS.FICHA_EDITADA,
        metadata: {
          dentes_adicionados: [...dentesDepois].filter((d) => !dentesAntes.has(d)),
          dentes_removidos:   [...dentesAntes].filter((d) => !dentesDepois.has(d)),
          eventos_antes:      eventosAntes ?? 0,
          eventos_depois:     eventosDepois ?? 0,
          procedimentos_antes:  fichaAtual.procedimentos ?? [],
          procedimentos_depois: data.procedimentos,
        },
      });
    }

    // R-85 — antes, uma edição nunca fechava o agendamento (só o ramo de criação alcançava
    // isto). Agora alcança: é o que permite "Gerar orçamento" criar a ficha cedo (finalizarAtendimento:
    // false) e o Salvar de verdade, depois, EDITAR essa mesma ficha e só então fechar/avisar.
    if (resultado.ok) {
      await finalizarAtendimentoSeAplicavel(supabase, {
        clinicId, dentistaId, pacienteId: data.pacienteId,
        origem: data.origem, agendamentoId: data.agendamentoId, finalizarAtendimento: data.finalizarAtendimento,
      });
    }

    return resultado;
  }

  // Create — status derivado do CONTEÚDO (R-108b), nunca do input.
  const status = statusDoConteudo(data.origem, data.odontogramaEventos as OdontogramaEventoDraft[] | undefined);

  const { data: nova, error } = await supabase
    .from('fichas')
    .insert({
      clinica_id:          clinicId,
      paciente_id:         data.pacienteId,
      dentista_id:         dentistaId,
      data_atendimento:    data.dataAtendimento,
      queixa_principal:    data.queixaPrincipal || null, // D1 — ver comentário no ramo update
      anotacoes:           data.anotacoes,
      dentes_afetados:     data.dentesAfetados,
      dentes_observacoes:  data.dentesObservacoes,
      procedimentos:       data.procedimentos,
      conduta:             data.conduta || null,
      alerta_novo:         data.alertaNovo ?? null,
      orto_manutencao:     data.ortoManutencao ?? null,
      status,
      origem:              data.origem,
    })
    .select('id')
    .single();

  if (error || !nova) {
    console.error('[salvarFicha:create]', error?.message);
    return { ok: false, error: 'Erro ao salvar a ficha. Tente novamente.' };
  }

  const fichaId = (nova as { id: string }).id;

  const resultado = await finalizarEventos(supabase, {
    fichaId,
    clinicId,
    pacienteId: data.pacienteId,
    dentistaId,
    eventos: data.odontogramaEventos as OdontogramaEventoDraft[] | undefined,
  });

  if (resultado.ok) {
    const { count: eventosDepois } = await supabase
      .from('odontograma_eventos')
      .select('id', { count: 'exact', head: true })
      .eq('ficha_id', fichaId)
      .eq('clinica_id', clinicId)
      .is('retirado_em', null);

    registrarLog(supabase, {
      clinicaId:  clinicId,
      actorId:    dentistaId,
      pacienteId: data.pacienteId,
      entityType: ENTITY_TYPES.FICHA,
      entityId:   fichaId,
      action:     EVENTS.FICHA_CRIADA,
      metadata: {
        dentes_adicionados: data.dentesAfetados,
        dentes_removidos:   [],
        eventos_antes:      0,
        eventos_depois:     eventosDepois ?? 0,
        procedimentos_antes:  [],
        procedimentos_depois: data.procedimentos,
      },
    });
  }

  // R-85 — side-effects de fim de consulta, agora condicionados a `finalizarAtendimento`
  // (default true). `abrirPickerFichasAbertas` passa `false` pra criar a ficha sem fechar o
  // agendamento nem avisar a secretária no meio da consulta.
  if (resultado.ok) {
    await finalizarAtendimentoSeAplicavel(supabase, {
      clinicId, dentistaId, pacienteId: data.pacienteId,
      origem: data.origem, agendamentoId: data.agendamentoId, finalizarAtendimento: data.finalizarAtendimento,
    });
  }

  return resultado.ok ? { ok: true, fichaId, eventosFalharam: resultado.eventosFalharam } : resultado;
}

/**
 * Persiste `odontogramaEventos` via a RPC atômica (migration 107) — nunca insert direto.
 * Fail-soft deliberado: a ficha JÁ está salva quando isto roda; se a RPC falhar, o chamador
 * recebe `eventosFalharam: true` e oferece retry (mesmo padrão que `salvarEventosOdontograma`
 * já usava) em vez de desfazer o save do conteúdo clínico.
 */
async function finalizarEventos(
  supabase: Awaited<ReturnType<typeof requireClinicContext>>['supabase'],
  ctx: {
    fichaId: string;
    clinicId: string;
    pacienteId: string;
    dentistaId: string;
    eventos: OdontogramaEventoDraft[] | undefined;
  },
): Promise<SalvarFichaResult> {
  const eventos = ctx.eventos ?? [];
  if (eventos.length === 0) return { ok: true, fichaId: ctx.fichaId };

  const rows = montarRowsEventos(eventos, {
    clinicId:   ctx.clinicId,
    pacienteId: ctx.pacienteId,
    dentistaId: ctx.dentistaId,
    fichaId:    ctx.fichaId,
  });

  const { error } = await supabase.rpc('salvar_eventos_odontograma', {
    p_ficha_id:    ctx.fichaId,
    p_clinica_id:  ctx.clinicId,
    p_paciente_id: ctx.pacienteId,
    p_eventos:     rows,
    // R-108b (migration 142) — explícito, não pelo default: aqui quem chama é dono do conteúdo
    // INTEIRO da ficha (é a ficha da sessão), então card removido da tela continua removendo o
    // evento. O roteamento de pendência, que grava subconjunto em ficha alheia, passa `false`.
    p_sincronizar: true,
  });

  if (error) {
    console.error('[salvarFicha:eventos]', error.message);
    return { ok: true, fichaId: ctx.fichaId, eventosFalharam: true };
  }

  return { ok: true, fichaId: ctx.fichaId };
}

export interface VinculosFicha {
  orcamentos: number;
  pagamentos: number;
}

/**
 * R-35 item 2 — orcamentos.ficha_id e pagamentos.orcamento_id são ON DELETE CASCADE.
 * O componente legado ainda usa este resumo visual. A decisão de apagar é revalidada em
 * `avaliarExclusaoFicha`, que bloqueia qualquer prova clínica ou financeira.
 */
export async function contarVinculosFicha(fichaId: string): Promise<VinculosFicha> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data: orcamentos } = await supabase
    .from('orcamentos')
    .select('id')
    .eq('ficha_id', fichaId)
    .eq('clinica_id', clinicId);

  const orcamentoIds = (orcamentos ?? []).map((o) => o.id as string);
  if (orcamentoIds.length === 0) return { orcamentos: 0, pagamentos: 0 };

  const { count } = await supabase
    .from('pagamentos')
    .select('id', { count: 'exact', head: true })
    .in('orcamento_id', orcamentoIds)
    .eq('clinica_id', clinicId);

  return { orcamentos: orcamentoIds.length, pagamentos: count ?? 0 };
}

/**
 * deletarFicha — role dentista só apaga ficha própria; role admin apaga qualquer uma da
 * clínica. Fecha o gap do código morto removido na Fase 0 (client apagava sem checar autoria,
 * só a RLS segurava).
 */
type ContextoExclusaoFicha = {
  supabase: Awaited<ReturnType<typeof requireClinicContext>>['supabase'];
  clinicId: string;
  dentistaId: string;
  ficha: {
    id: string;
    paciente_id: string;
    dentes_afetados: number[] | null;
    procedimentos: string[] | null;
  };
  resumo: ResumoExclusaoFicha;
};

type AvaliacaoExclusaoFicha =
  | { ok: true; contexto: ContextoExclusaoFicha }
  | { ok: false; error: string };

async function avaliarExclusaoFicha(fichaId: string): Promise<AvaliacaoExclusaoFicha> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  if (role !== 'admin' && role !== 'dentista') {
    return { ok: false, error: mensagemErroExclusao('sem_permissao') };
  }
  const { data: ficha, error: fichaError } = await supabase.from('fichas')
    .select('id, paciente_id, dentista_id, assinado_em, assinatura_url, dentes_afetados, procedimentos, data_atendimento')
    .eq('id', fichaId).eq('clinica_id', clinicId).maybeSingle();
  if (fichaError) {
    console.error('[avaliarExclusaoFicha:ficha]', fichaError.message);
    return { ok: false, error: mensagemErroExclusao('erro') };
  }
  if (!ficha) return { ok: false, error: mensagemErroExclusao('ficha_nao_encontrada') };
  if (ficha.dentista_id !== dentistaId) return { ok: false, error: mensagemErroExclusao('sem_permissao') };

  const [eventos, evolucoes, documentos, assinaturas, arquivos, paciente, orcamentosDiretos] = await Promise.all([
    supabase.from('odontograma_eventos').select('id, assinatura_id, retirado_em, encaminhado_para')
      .eq('ficha_id', fichaId).eq('clinica_id', clinicId),
    supabase.from('ficha_evolucoes').select('id', { count: 'exact', head: true })
      .eq('ficha_id', fichaId).eq('clinica_id', clinicId),
    supabase.from('documentos_aceite').select('id', { count: 'exact', head: true })
      .eq('ficha_id', fichaId).eq('clinica_id', clinicId).neq('tipo', 'orcamento'),
    supabase.from('assinaturas').select('id', { count: 'exact', head: true })
      .eq('ficha_id', fichaId).eq('clinica_id', clinicId).neq('tipo', 'orcamento'),
    supabase.from('ficha_arquivos').select('id', { count: 'exact', head: true })
      .eq('ficha_id', fichaId).eq('clinica_id', clinicId),
    supabase.from('pacientes').select('nome').eq('id', ficha.paciente_id).eq('clinica_id', clinicId).maybeSingle(),
    supabase.from('orcamentos').select('id, ficha_id, paciente_id, status, aprovado_em')
      .eq('ficha_id', fichaId).eq('clinica_id', clinicId),
  ]);
  const falhas = [eventos, evolucoes, documentos, assinaturas, arquivos, paciente, orcamentosDiretos]
    .flatMap((resultado) => resultado.error ? [resultado.error.message] : []);
  if (falhas.length > 0 || !paciente.data) {
    console.error('[avaliarExclusaoFicha:vinculos]', falhas);
    return { ok: false, error: mensagemErroExclusao('erro') };
  }
  const procedimentos = eventos.data ?? [];
  if (ficha.assinado_em != null || ficha.assinatura_url != null
    || procedimentos.some((evento) => evento.assinatura_id != null)
    || (documentos.count ?? 0) > 0 || (assinaturas.count ?? 0) > 0) {
    return { ok: false, error: mensagemErroExclusao('ficha_assinada') };
  }
  if (procedimentos.some((evento) => evento.retirado_em != null)) {
    return { ok: false, error: mensagemErroExclusao('ficha_com_retirado') };
  }
  if (procedimentos.some((evento) => evento.encaminhado_para != null && evento.encaminhado_para !== dentistaId)) {
    return { ok: false, error: mensagemErroExclusao('ficha_com_encaminhamento') };
  }

  const orcamentos = new Map((orcamentosDiretos.data ?? []).map((orcamento) => [orcamento.id, orcamento]));
  if (procedimentos.length > 0) {
    const pontes = await supabase.from('orcamento_eventos').select('orcamento_id')
      .in('evento_id', procedimentos.map((evento) => evento.id)).eq('clinica_id', clinicId);
    if (pontes.error) {
      console.error('[avaliarExclusaoFicha:pontes]', pontes.error.message);
      return { ok: false, error: mensagemErroExclusao('erro') };
    }
    const ids = [...new Set((pontes.data ?? []).map((ponte) => ponte.orcamento_id))];
    if (ids.length > 0) {
      const ligados = await supabase.from('orcamentos').select('id, ficha_id, paciente_id, status, aprovado_em')
        .in('id', ids).eq('clinica_id', clinicId);
      if (ligados.error) {
        console.error('[avaliarExclusaoFicha:orcamentos]', ligados.error.message);
        return { ok: false, error: mensagemErroExclusao('erro') };
      }
      for (const orcamento of ligados.data ?? []) orcamentos.set(orcamento.id, orcamento);
    }
  }
  if ([...orcamentos.values()].some((orcamento) => orcamento.paciente_id !== ficha.paciente_id)) {
    console.error('[avaliarExclusaoFicha] ficha_contexto_invalido');
    return { ok: false, error: mensagemErroExclusao('ficha_contexto_invalido') };
  }
  const mantidos = new Set<string>();
  const ids = [...orcamentos.keys()];
  if (ids.length > 0) {
    const provas = await Promise.all([
      supabase.from('orcamento_itens').select('orcamento_id').in('orcamento_id', ids).eq('clinica_id', clinicId).eq('aprovado', true),
      supabase.from('assinaturas').select('orcamento_id').in('orcamento_id', ids).eq('clinica_id', clinicId),
      supabase.from('documentos_aceite').select('orcamento_id').in('orcamento_id', ids).eq('clinica_id', clinicId),
      supabase.from('pagamentos').select('orcamento_id').in('orcamento_id', ids).eq('clinica_id', clinicId),
      supabase.from('orcamento_cobrancas').select('orcamento_id').in('orcamento_id', ids).eq('clinica_id', clinicId),
    ]);
    if (provas.some((prova) => prova.error)) {
      console.error('[avaliarExclusaoFicha:financeiro]', provas.flatMap((prova) => prova.error ? [prova.error.message] : []));
      return { ok: false, error: mensagemErroExclusao('erro') };
    }
    for (const prova of provas) {
      for (const linha of prova.data ?? []) if (linha.orcamento_id) mantidos.add(linha.orcamento_id);
    }
    for (const orcamento of orcamentos.values()) {
      if (orcamento.status === 'aprovado' || orcamento.aprovado_em != null) mantidos.add(orcamento.id);
    }
  }
  const apagados = [...orcamentos.values()].filter((orcamento) => orcamento.ficha_id === fichaId && !mantidos.has(orcamento.id)).length;
  return {
    ok: true,
    contexto: {
      supabase, clinicId, dentistaId, ficha,
      resumo: {
        eventos: procedimentos.length,
        evolucoes: evolucoes.count ?? 0,
        arquivos: arquivos.count ?? 0,
        dataAtendimento: ficha.data_atendimento,
        nomePaciente: paciente.data.nome,
        orcamentosEditaveis: apagados,
        orcamentosApagados: apagados,
        orcamentosMantidos: mantidos.size,
      },
    },
  };
}

/** Prévia sem mutação usada pelo aviso explícito antes da exclusão. */
export async function prepararExclusaoFicha(fichaId: string): Promise<PrepararExclusaoFichaResult> {
  const avaliacao = await avaliarExclusaoFicha(fichaId);
  if (!avaliacao.ok) return avaliacao;
  return { ok: true, resumo: avaliacao.contexto.resumo };
}

/** A RPC revalida autoria, prova clínica, confirmação e preservação financeira atomicamente. */
export async function deletarFicha(
  fichaId: string,
  confirmacao?: ConfirmacaoExclusaoFicha,
): Promise<DeletarFichaResult> {
  if (!confirmacao) return { ok: false, error: 'Confirme a exclusão.' };
  const { supabase, clinicId } = await requireClinicContext();
  const { data: ficha, error: fichaError } = await supabase.from('fichas').select('paciente_id')
    .eq('id', fichaId).eq('clinica_id', clinicId).maybeSingle();
  if (fichaError) {
    console.error('[deletarFicha:contexto]', fichaError.message);
    return { ok: false, error: mensagemErroExclusao('erro') };
  }
  if (!ficha) return { ok: false, error: mensagemErroExclusao('ficha_nao_encontrada') };
  const { error } = await supabase.rpc('excluir_ficha_clinica', {
    p_ficha_id: fichaId,
    p_motivo: confirmacao.motivo,
    p_motivo_detalhe: confirmacao.detalhe ?? null,
    p_nome_paciente: confirmacao.nomePaciente,
    p_confirma_orcamento_aceito: confirmacao.confirmaOrcamentoAceito === true,
  });
  if (error) {
    console.error('[deletarFicha]', error.message);
    return { ok: false, error: mensagemErroExclusao(error.message) };
  }
  revalidatePath(`/dashboard/pacientes/${ficha.paciente_id}`);
  return { ok: true };
}
