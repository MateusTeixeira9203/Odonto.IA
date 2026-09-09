import { descricaoComComposicao, type ComponenteGrupoOrcamento } from '@/lib/orcamentos/grupos';
import { Buffer } from 'buffer';
import { gerarPDFDocumento } from '@/lib/pdf/documento';
import { createServiceClient } from '@/lib/supabase/service';
import {
  hashConteudo,
  renderAceiteOrcamento,
  renderConclusao,
  renderTCLE,
  TEMPLATE_ACEITE_VERSAO,
} from '@/lib/legal/templates';
import type { ClinicContext } from '@/server/auth/clinic';

type EventoClinico = {
  id: string;
  tipo: string;
  status: string;
  dente: number | null;
  observacao: string | null;
  realizado_em: string | null;
};

type CamposTCLE = {
  justificativa: string;
  explicacao: string;
  alternativas: string;
  riscos: string;
  consequencias: string;
  orientacoes: string;
};

type CamposConclusao = {
  orientacoes: string;
  intercorrencia?: string;
  retorno?: string;
};

type AssinaturaOrcamento = {
  id: string;
  assinatura_ref: string;
  assinado_por: string;
  assinado_em: string;
  termos_snapshot: unknown;
};

type AssinaturaProcedimentos = {
  id: string;
  paciente_id: string;
  dentista_id: string;
  ficha_id: string | null;
  assinatura_ref: string;
  assinado_por: string;
  assinado_em: string;
};

type SnapshotOrcamento = {
  itens?: Array<{ composicao?: ComponenteGrupoOrcamento[] | null; descricao?: string | null; quantidade?: number | null; precoTotal?: number | null }>;
  total?: number | null;
  condicoesPagamento?: string | null;
};

function isSnapshotOrcamento(value: unknown): value is SnapshotOrcamento {
  return typeof value === 'object' && value !== null;
}

function descricaoEvento(evento: EventoClinico): string {
  const dente = evento.dente ? ` — dente ${evento.dente}` : '';
  const observacao = evento.observacao?.trim() ? ` (${evento.observacao.trim()})` : '';
  return `${evento.tipo}${dente}${observacao}`;
}

function dataUrlParaBuffer(dataUrl: string): Buffer | null {
  const base64 = dataUrl.split(',')[1];
  return base64 ? Buffer.from(base64, 'base64') : null;
}

function nomeSeguro(nome: string): string {
  return nome.replace(/[^\w.-]+/g, '_').slice(0, 90);
}

async function salvarDocumentoAssinado(input: {
  context: ClinicContext;
  pacienteId: string;
  fichaId?: string;
  orcamentoId?: string;
  assinaturaId?: string;
  tipo: 'orcamento' | 'tcle' | 'conclusao_procedimento';
  titulo: string;
  corpo: string;
  snapshot: Record<string, unknown>;
  assinaturaPacienteDataUrl?: string;
  assinaturaPacienteRef?: string;
  assinadoPor: string;
  dentistaId?: string;
  dentistaNome: string;
  dentistaCro: string | null;
  pacienteNome: string;
  pacienteCpf: string | null;
  clinicaNome: string;
}): Promise<{ ok: true; signedUrl: string } | { ok: false; error: string }> {
  const service = createServiceClient();
  const hash = hashConteudo(input.corpo);
  const stamp = Date.now();
  const basePath = `${input.context.clinicId}/${input.pacienteId}/aceites/${stamp}_${input.tipo}`;
  let assinaturaRef = input.assinaturaPacienteRef ?? '';
  let pdfPath = '';
  let pacienteDocumentoId: string | null = null;

  try {
    if (input.assinaturaPacienteDataUrl) {
      const buffer = dataUrlParaBuffer(input.assinaturaPacienteDataUrl);
      if (!buffer) return { ok: false, error: 'Assinatura do paciente inválida.' };
      assinaturaRef = `${basePath}_assinatura.png`;
      const { error } = await service.storage.from('fichas').upload(assinaturaRef, buffer, {
        contentType: 'image/png', upsert: false,
      });
      if (error) return { ok: false, error: 'Não foi possível salvar a assinatura do paciente.' };
    }

    if (!assinaturaRef) return { ok: false, error: 'Assinatura do paciente não encontrada.' };

    let assinaturaPublica = input.assinaturaPacienteDataUrl;
    if (!assinaturaPublica) {
      const { data: arquivoAssinatura, error: assinaturaDownloadError } = await service.storage
        .from('fichas')
        .download(assinaturaRef);
      if (assinaturaDownloadError || !arquivoAssinatura) {
        throw new Error('Não foi possível ler a assinatura do paciente.');
      }
      const assinaturaBuffer = Buffer.from(await arquivoAssinatura.arrayBuffer());
      assinaturaPublica = `data:image/png;base64,${assinaturaBuffer.toString('base64')}`;
    }
    const pdf = await gerarPDFDocumento({
      titulo: input.titulo,
      corpo: input.corpo,
      duasVias: false,
      paciente: { nome: input.pacienteNome, cpf: input.pacienteCpf ?? undefined },
      clinica: { nome: input.clinicaNome },
      dentista: { nome: input.dentistaNome, cro: input.dentistaCro ?? '' },
      assinaturaPacienteDataUrl: assinaturaPublica,
      assinaturaPacienteNome: input.assinadoPor,
      data: new Date().toISOString(),
    });

    pdfPath = `${basePath}_${nomeSeguro(input.titulo)}.pdf`;
    const { error: pdfError } = await service.storage.from('fichas').upload(pdfPath, pdf, {
      contentType: 'application/pdf', upsert: false,
    });
    if (pdfError) throw new Error('Não foi possível salvar o PDF final.');

    const { data: pacienteDocumento, error: pacienteDocumentoError } = await service
      .from('paciente_documentos')
      .insert({
        clinica_id: input.context.clinicId,
        paciente_id: input.pacienteId,
        dentista_id: input.dentistaId ?? input.context.dentistaId,
        nome: `${input.titulo} — ${new Date().toLocaleDateString('pt-BR')}.pdf`,
        url: pdfPath,
        categoria: 'Documentos',
        origem: 'aceite_assinado',
        tipo_documento: input.tipo,
      })
      .select('id')
      .single();
    if (pacienteDocumentoError || !pacienteDocumento) throw new Error('Não foi possível registrar o PDF do paciente.');

    pacienteDocumentoId = pacienteDocumento.id;

    const { error: aceiteError } = await service
      .from('documentos_aceite')
      .insert({
        clinica_id: input.context.clinicId,
        paciente_id: input.pacienteId,
        dentista_id: input.dentistaId ?? input.context.dentistaId,
        ficha_id: input.fichaId ?? null,
        orcamento_id: input.orcamentoId ?? null,
        assinatura_id: input.assinaturaId ?? null,
        tipo: input.tipo,
        template_versao: TEMPLATE_ACEITE_VERSAO,
        template_hash: hash,
        conteudo_snapshot: { ...input.snapshot, corpo: input.corpo, hash },
        assinatura_paciente_ref: assinaturaRef,
        assinado_por: input.assinadoPor,
        pdf_path: pdfPath,
        paciente_documento_id: pacienteDocumento.id,
      });
    if (aceiteError) throw new Error('Não foi possível congelar o aceite.');

    const { data: signed } = await service.storage.from('fichas').createSignedUrl(pdfPath, 3600);
    return { ok: true, signedUrl: signed?.signedUrl ?? '' };
  } catch (error) {
    if (pacienteDocumentoId) await service.from('paciente_documentos').delete().eq('id', pacienteDocumentoId);
    if (pdfPath) await service.storage.from('fichas').remove([pdfPath]);
    if (input.assinaturaPacienteDataUrl && assinaturaRef) await service.storage.from('fichas').remove([assinaturaRef]);
    console.error('[R-120] salvar documento assinado:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível finalizar o documento.' };
  }
}

export async function criarDocumentoAceiteOrcamento(input: {
  context: ClinicContext;
  orcamentoId: string;
}): Promise<{ ok: true; signedUrl: string } | { ok: false; error: string }> {
  const { context, orcamentoId } = input;
  const service = createServiceClient();

  const { data: assinaturaExistente } = await service
    .from('documentos_aceite')
    .select('pdf_path')
    .eq('orcamento_id', orcamentoId)
    .maybeSingle();
  if (assinaturaExistente) {
    const { data: signed } = await service.storage.from('fichas').createSignedUrl(assinaturaExistente.pdf_path, 3600);
    return { ok: true, signedUrl: signed?.signedUrl ?? '' };
  }

  const [{ data: orcamento }, { data: clinica }] = await Promise.all([
    context.supabase
      .from('orcamentos')
      .select('paciente_id, dentista_id, condicoes_pagamento, aceite:assinaturas!assinaturas_orcamento_id_fkey(id, assinatura_ref, assinado_por, assinado_em, termos_snapshot)')
      .eq('id', orcamentoId)
      .eq('clinica_id', context.clinicId)
      .maybeSingle(),
    context.supabase.from('clinicas').select('nome').eq('id', context.clinicId).maybeSingle(),
  ]);

  if (!orcamento) return { ok: false, error: 'Orçamento não encontrado.' };
  const { data: dentista } = await context.supabase
    .from('dentistas')
    .select('id, nome, cro')
    .eq('id', orcamento.dentista_id)
    .eq('clinica_id', context.clinicId)
    .maybeSingle();
  if (!dentista) return { ok: false, error: 'Dentista responsável não encontrado.' };
  const aceiteRaw = (orcamento.aceite as unknown as AssinaturaOrcamento[] | null)?.[0] ?? null;
  if (!aceiteRaw || !isSnapshotOrcamento(aceiteRaw.termos_snapshot)) {
    return { ok: false, error: 'Aceite do orçamento não encontrado.' };
  }

  const { data: paciente } = await context.supabase
    .from('pacientes')
    .select('nome, cpf')
    .eq('id', orcamento.paciente_id)
    .eq('clinica_id', context.clinicId)
    .maybeSingle();
  if (!paciente) return { ok: false, error: 'Paciente não encontrado.' };

  const snapshot = aceiteRaw.termos_snapshot;
  const itens = (snapshot.itens ?? []).map((item) => ({
    descricao: descricaoComComposicao(item.descricao ?? 'Procedimento', item.composicao),
    quantidade: item.quantidade ?? 1,
    precoTotal: item.precoTotal ?? 0,
  }));
  const corpo = renderAceiteOrcamento({
    clinicaNome: clinica?.nome ?? 'Clínica',
    paciente: { nome: paciente.nome, cpf: paciente.cpf },
    dentistaNome: dentista?.nome ?? 'Dentista',
    cro: dentista?.cro ?? null,
    itens,
    total: snapshot.total ?? 0,
    condicoesPagamento: snapshot.condicoesPagamento ?? null,
  });

  const salvo = await salvarDocumentoAssinado({
    context,
    pacienteId: orcamento.paciente_id,
    orcamentoId,
    assinaturaId: aceiteRaw.id,
    tipo: 'orcamento',
    titulo: 'Aceite de orçamento',
    corpo,
    snapshot: { orcamentoId, assinaturaId: aceiteRaw.id, termos: snapshot },
    assinaturaPacienteRef: aceiteRaw.assinatura_ref,
    assinadoPor: aceiteRaw.assinado_por,
    dentistaId: dentista.id,
    dentistaNome: dentista.nome,
    dentistaCro: dentista.cro ?? null,
    pacienteNome: paciente.nome,
    pacienteCpf: paciente.cpf,
    clinicaNome: clinica?.nome ?? 'Clínica',
  });
  return salvo.ok ? { ok: true, signedUrl: salvo.signedUrl } : salvo;
}

export async function criarDocumentoConclusaoAssinatura(input: {
  context: ClinicContext;
  assinaturaId: string;
  campos: CamposConclusao;
}): Promise<{ ok: true; signedUrl: string } | { ok: false; error: string }> {
  const { context, assinaturaId, campos } = input;
  if (context.role === 'secretaria' || context.role === 'protetico') {
    return { ok: false, error: 'Somente o dentista responsável pode emitir esta conclusão.' };
  }

  const service = createServiceClient();
  const { data: existente } = await service
    .from('documentos_aceite')
    .select('pdf_path')
    .eq('assinatura_id', assinaturaId)
    .maybeSingle();
  if (existente) {
    const { data: signed } = await service.storage.from('fichas').createSignedUrl(existente.pdf_path, 3600);
    return { ok: true, signedUrl: signed?.signedUrl ?? '' };
  }

  const { data: assinaturaRaw } = await service
    .from('assinaturas')
    .select('id, paciente_id, dentista_id, ficha_id, assinatura_ref, assinado_por, assinado_em')
    .eq('id', assinaturaId)
    .eq('clinica_id', context.clinicId)
    .eq('tipo', 'procedimentos')
    .maybeSingle();
  const assinatura = assinaturaRaw as AssinaturaProcedimentos | null;
  if (!assinatura?.ficha_id || assinatura.dentista_id !== context.dentistaId) {
    return { ok: false, error: 'Assinatura clínica não encontrada ou sem permissão.' };
  }

  const [{ data: eventosRaw }, { data: paciente }, { data: dentista }, { data: clinica }] = await Promise.all([
    service
      .from('odontograma_eventos')
      .select('id, tipo, status, dente, observacao, realizado_em')
      .eq('assinatura_id', assinatura.id)
      .eq('ficha_id', assinatura.ficha_id)
      .eq('paciente_id', assinatura.paciente_id)
      .eq('clinica_id', context.clinicId),
    service.from('pacientes').select('nome, cpf').eq('id', assinatura.paciente_id).eq('clinica_id', context.clinicId).maybeSingle(),
    service.from('dentistas').select('nome, cro').eq('id', assinatura.dentista_id).eq('clinica_id', context.clinicId).maybeSingle(),
    service.from('clinicas').select('nome').eq('id', context.clinicId).maybeSingle(),
  ]);
  const eventos = (eventosRaw as unknown as EventoClinico[] | null) ?? [];
  if (!paciente || !dentista || eventos.length === 0 || eventos.some((evento) => evento.status !== 'realizado')) {
    return { ok: false, error: 'Não foi possível montar a conclusão dos procedimentos assinados.' };
  }

  const snapshot = {
    fichaId: assinatura.ficha_id,
    assinaturaId: assinatura.id,
    eventoIds: eventos.map((evento) => ({ id: evento.id, descricao: descricaoEvento(evento), status: evento.status })),
    campos,
  };
  const { error: snapshotError } = await service
    .from('assinaturas')
    .update({ termos_snapshot: snapshot })
    .eq('id', assinatura.id)
    .eq('clinica_id', context.clinicId);
  if (snapshotError) return { ok: false, error: 'A assinatura foi salva, mas não foi possível congelar as orientações.' };

  const corpo = renderConclusao({
    clinicaNome: clinica?.nome ?? 'Clínica',
    paciente: { nome: paciente.nome, cpf: paciente.cpf },
    dentistaNome: dentista.nome,
    cro: dentista.cro ?? null,
    procedimentos: eventos.map(descricaoEvento),
    ...campos,
  });

  return salvarDocumentoAssinado({
    context,
    pacienteId: assinatura.paciente_id,
    fichaId: assinatura.ficha_id,
    assinaturaId: assinatura.id,
    tipo: 'conclusao_procedimento',
    titulo: 'Conclusão de procedimento',
    corpo,
    snapshot,
    assinaturaPacienteRef: assinatura.assinatura_ref,
    assinadoPor: assinatura.assinado_por,
    dentistaId: assinatura.dentista_id,
    dentistaNome: dentista.nome,
    dentistaCro: dentista.cro ?? null,
    pacienteNome: paciente.nome,
    pacienteCpf: paciente.cpf,
    clinicaNome: clinica?.nome ?? 'Clínica',
  });
}

export async function criarDocumentoAceiteClinico(input: {
  context: ClinicContext;
  tipo: 'tcle' | 'conclusao_procedimento';
  pacienteId: string;
  fichaId: string;
  eventoIds: string[];
  assinadoPor: string;
  assinaturaDataUrl: string;
  representante?: DadosParte | null;
  campos: CamposTCLE | CamposConclusao;
}): Promise<{ ok: true; signedUrl: string } | { ok: false; error: string }> {
  if (input.context.role === 'secretaria' || input.context.role === 'protetico') {
    return { ok: false, error: 'Somente o dentista responsável pode emitir este aceite.' };
  }

  const [{ data: ficha }, { data: paciente }, { data: dentista }, { data: clinica }] = await Promise.all([
    input.context.supabase
      .from('fichas')
      .select('id, dentista_id')
      .eq('id', input.fichaId)
      .eq('paciente_id', input.pacienteId)
      .eq('clinica_id', input.context.clinicId)
      .maybeSingle(),
    input.context.supabase
      .from('pacientes').select('nome, cpf').eq('id', input.pacienteId).eq('clinica_id', input.context.clinicId).maybeSingle(),
    input.context.supabase.from('dentistas').select('nome, cro').eq('id', input.context.dentistaId).maybeSingle(),
    input.context.supabase.from('clinicas').select('nome').eq('id', input.context.clinicId).maybeSingle(),
  ]);

  if (!ficha || ficha.dentista_id !== input.context.dentistaId) return { ok: false, error: 'Ficha não encontrada ou sem permissão.' };
  if (!paciente) return { ok: false, error: 'Paciente não encontrado.' };
  if (!dentista) return { ok: false, error: 'Dentista não encontrado.' };

  const { data: eventosRaw } = await input.context.supabase
    .from('odontograma_eventos')
    .select('id, tipo, status, dente, observacao, realizado_em')
    .eq('ficha_id', input.fichaId)
    .eq('paciente_id', input.pacienteId)
    .eq('clinica_id', input.context.clinicId)
    .in('id', input.eventoIds);
  const eventos = (eventosRaw as unknown as EventoClinico[] | null) ?? [];
  if (eventos.length !== input.eventoIds.length) return { ok: false, error: 'Um dos procedimentos não pertence a esta ficha.' };

  const deveSerRealizado = input.tipo === 'conclusao_procedimento';
  if (eventos.some((evento) => (evento.status === 'realizado') !== deveSerRealizado)) {
    return { ok: false, error: deveSerRealizado ? 'Selecione somente procedimentos realizados.' : 'O TCLE deve ser assinado antes da execução.' };
  }

  const dadosBase = {
    clinicaNome: clinica?.nome ?? 'Clínica',
    paciente: { nome: paciente.nome, cpf: paciente.cpf },
    representante: input.representante ?? null,
    dentistaNome: dentista.nome,
    cro: dentista.cro ?? null,
  };
  const corpo = input.tipo === 'tcle'
    ? renderTCLE({
        ...dadosBase,
        procedimento: descricaoEvento(eventos[0]),
        regiao: eventos[0].dente ? `Dente ${eventos[0].dente}` : 'Região clínica registrada',
        ...(input.campos as CamposTCLE),
      })
    : renderConclusao({
        ...dadosBase,
        procedimentos: eventos.map(descricaoEvento),
        ...(input.campos as CamposConclusao),
      });

  return salvarDocumentoAssinado({
    context: input.context,
    pacienteId: input.pacienteId,
    fichaId: input.fichaId,
    tipo: input.tipo,
    titulo: input.tipo === 'tcle' ? 'TCLE odontológico' : 'Conclusão de procedimento',
    corpo,
    snapshot: {
      fichaId: input.fichaId,
      eventoIds: eventos.map((evento) => ({ id: evento.id, descricao: descricaoEvento(evento), status: evento.status })),
      campos: input.campos,
      representante: input.representante ?? null,
    },
    assinaturaPacienteDataUrl: input.assinaturaDataUrl,
    assinadoPor: input.assinadoPor,
    dentistaNome: dentista.nome,
    dentistaCro: dentista.cro ?? null,
    pacienteNome: paciente.nome,
    pacienteCpf: paciente.cpf,
    clinicaNome: clinica?.nome ?? 'Clínica',
  });
}

export type DadosParte = { nome: string; cpf?: string | null };
