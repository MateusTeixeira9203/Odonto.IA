'use server';

import { z } from 'zod';
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
  orcamentos: number;
  pagamentos: number;
  assinaturas: number;
  documentos: number;
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

  const isUpdate = data.fichaId != null;

  if (isUpdate) {
    const { data: fichaAtual } = await supabase
      .from('fichas')
      .select('id, dentista_id, assinado_em, dentes_afetados, procedimentos')
      .eq('id', data.fichaId as string)
      .eq('clinica_id', clinicId)
      .maybeSingle();

    if (!fichaAtual) return { ok: false, error: 'Ficha não encontrada.' };
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

/** Prévia simples usada pela tela legada antes da exclusão física confirmada. */
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
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão para apagar fichas clínicas.' };

  const { data: ficha } = await supabase
    .from('fichas')
    .select('id, paciente_id, dentista_id, assinado_em, dentes_afetados, procedimentos')
    .eq('id', fichaId)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!ficha) return { ok: false, error: 'Ficha não encontrada.' };
  const { count: eventos, error: eventosError } = await supabase
    .from('odontograma_eventos')
    .select('id', { count: 'exact', head: true })
    .eq('ficha_id', fichaId)
    .eq('clinica_id', clinicId);
  const { count: eventosAssinados, error: eventosAssinadosError } = await supabase
    .from('odontograma_eventos')
    .select('id', { count: 'exact', head: true })
    .eq('ficha_id', fichaId)
    .eq('clinica_id', clinicId)
    .not('assinatura_id', 'is', null);
  const { count: evolucoes, error: evolucoesError } = await supabase
    .from('ficha_evolucoes')
    .select('id', { count: 'exact', head: true })
    .eq('ficha_id', fichaId)
    .eq('clinica_id', clinicId);
  const { count: documentos, error: documentosError } = await supabase
    .from('documentos_aceite')
    .select('id', { count: 'exact', head: true })
    .eq('ficha_id', fichaId)
    .eq('clinica_id', clinicId);
  const { data: orcamentos, error: orcamentosError } = await supabase
    .from('orcamentos')
    .select('id, status')
    .eq('ficha_id', fichaId)
    .eq('clinica_id', clinicId);

  if (eventosError || eventosAssinadosError || evolucoesError || documentosError || orcamentosError) {
    console.error('[avaliarExclusaoFicha] falha ao validar vínculos', {
      eventos: eventosError?.message,
      eventosAssinados: eventosAssinadosError?.message,
      evolucoes: evolucoesError?.message,
      documentos: documentosError?.message,
      orcamentos: orcamentosError?.message,
    });
    return { ok: false, error: 'Não foi possível verificar se esta ficha pode ser apagada.' };
  }

  const orcamentoIds = (orcamentos ?? []).map((orcamento) => orcamento.id);
  let pagamentos = 0;
  let assinaturasDeOrcamento = 0;
  let documentosDeOrcamento = 0;
  if (orcamentoIds.length > 0) {
    const [pagamentosResult, assinaturasResult, documentosResult] = await Promise.all([
      supabase
        .from('pagamentos')
        .select('id', { count: 'exact', head: true })
        .in('orcamento_id', orcamentoIds)
        .eq('clinica_id', clinicId),
      supabase
        .from('assinaturas')
        .select('id', { count: 'exact', head: true })
        .in('orcamento_id', orcamentoIds)
        .eq('clinica_id', clinicId)
        .eq('tipo', 'orcamento'),
      supabase
        .from('documentos_aceite')
        .select('id', { count: 'exact', head: true })
        .in('orcamento_id', orcamentoIds)
        .eq('clinica_id', clinicId),
    ]);
    if (pagamentosResult.error || assinaturasResult.error || documentosResult.error) {
      console.error('[avaliarExclusaoFicha] falha ao calcular impacto financeiro', {
        pagamentos: pagamentosResult.error?.message,
        assinaturas: assinaturasResult.error?.message,
        documentos: documentosResult.error?.message,
      });
      return { ok: false, error: 'Não foi possível verificar os vínculos financeiros desta ficha.' };
    }
    pagamentos = pagamentosResult.count ?? 0;
    assinaturasDeOrcamento = assinaturasResult.count ?? 0;
    documentosDeOrcamento = documentosResult.count ?? 0;
  }

  return {
    ok: true,
    contexto: {
      supabase,
      clinicId,
      dentistaId,
      ficha: {
        id: ficha.id,
        paciente_id: ficha.paciente_id,
        dentes_afetados: ficha.dentes_afetados,
        procedimentos: ficha.procedimentos,
      },
      resumo: {
        eventos: eventos ?? 0,
        evolucoes: evolucoes ?? 0,
        orcamentos: orcamentoIds.length,
        pagamentos,
        assinaturas: (eventosAssinados ?? 0) + assinaturasDeOrcamento,
        documentos: (documentos ?? 0) + documentosDeOrcamento,
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

/**
 * Exclusão física confirmada. A RPC mantém a transação íntegra quando há orçamento, pagamento,
 * assinatura ou documento relacionado; o cliente nunca escolhe clínica, paciente ou autor.
 */
export async function deletarFicha(fichaId: string, confirmada: boolean): Promise<DeletarFichaResult> {
  if (!confirmada || !z.string().uuid().safeParse(fichaId).success) {
    return { ok: false, error: 'Confirme que está ciente da exclusão permanente.' };
  }
  const avaliacao = await avaliarExclusaoFicha(fichaId);
  if (!avaliacao.ok) return avaliacao;
  const { supabase, clinicId, dentistaId, ficha, resumo } = avaliacao.contexto;

  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  const { error } = await rpc('excluir_ficha_permanentemente', { p_ficha_id: fichaId });

  if (error) {
    console.error('[deletarFicha]', error.message);
    return { ok: false, error: 'Erro ao apagar ficha.' };
  }

  registrarLog(supabase, {
    clinicaId:  clinicId,
    actorId:    dentistaId,
    pacienteId: ficha.paciente_id,
    entityType: ENTITY_TYPES.FICHA,
    entityId:   fichaId,
    action:     EVENTS.FICHA_EXCLUIDA,
    metadata: {
      dentes_adicionados: [],
      dentes_removidos:   ficha.dentes_afetados ?? [],
      eventos_antes:      resumo.eventos,
      eventos_depois:     0,
      procedimentos_antes:  ficha.procedimentos ?? [],
      procedimentos_depois: [],
    },
  });

  revalidatePath(`/dashboard/pacientes/${ficha.paciente_id}`);
  return { ok: true };
}
