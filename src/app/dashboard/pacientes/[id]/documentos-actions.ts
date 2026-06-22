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

  // Revalida campos obrigatórios no servidor (server action é exposta).
  const faltandoObrigatorio = modelo.campos.some((c) => c.obrigatorio && !params.valores[c.id]?.trim());
  if (faltandoObrigatorio) return { error: 'Preencha os campos obrigatórios.' };

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
  if (dbErr) {
    console.error('[emitirDocumento] insert:', dbErr.message);
    await supabase.storage.from('fichas').remove([storagePath]); // evita PDF órfão no storage
    return { error: 'Erro ao registrar o documento.' };
  }

  const { data: signed } = await supabase.storage.from('fichas').createSignedUrl(storagePath, 3600);

  return { docId: (docRow as { id: string }).id, signedUrl: signed?.signedUrl, nome };
}
