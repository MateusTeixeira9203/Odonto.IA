import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDentistaCached } from '@/lib/get-dentista';
import { withRateLimit } from '@/lib/rate-limit';
import { pluginPorId } from '@/lib/especialidades/registry';
import type { ExtractorResult } from '@/lib/especialidades/plugin';

// Rota de despacho do pass 2 (Roadmap A — Fatia A0, esqueleto).
// Spec: plans/specs/spec-a0-fundacao-plugins-especialidade.md §2.3.
//
// Depois do pass 1 (formatar-evolucao), o client computa `especialidadesDetectadas`
// e chama esta rota em paralelo (Promise.all) pra cada especialidade cujo extractor
// é de IA. A0 entrega o esqueleto: valida entrada, resolve o plugin pelo registry e
// devolve `sem-extractor` (nenhum plugin da A0 tem extractor de IA). A1 pluga o
// `endodontiaPlugin.extractor.extrair` — a orquestração no client não muda.

const requestSchema = z.object({
  especialidade: z.string().min(1),
  texto: z.string().trim().min(1),            // relato ORIGINAL, narrativa crua
  contexto: z.object({ dentes: z.array(z.number().int()) }),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:extrair-especialidade', 20, 60_000);
  if (limited) return limited; // 429

  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (dentista.role === 'secretaria') {
    // Secretária não escreve registro clínico (núcleo clínico 099).
    return NextResponse.json({ error: 'Sem permissão de escrita clínica' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const plugin = pluginPorId(parsed.data.especialidade);
  if (!plugin) {
    return NextResponse.json({ error: 'Especialidade desconhecida' }, { status: 400 });
  }

  const extractor = plugin.extractor;
  if (!extractor || extractor.modo !== 'ia') {
    // A0: todos caem aqui. Determinístico (perio) roda na UI, não nesta rota (I6).
    return NextResponse.json({ ok: false, motivo: 'sem-extractor' } satisfies ExtractorResult<unknown>);
  }

  try {
    const resultado = await extractor.extrair({
      especialidade: plugin.id,
      texto: parsed.data.texto,
      contexto: parsed.data.contexto,
    });
    return NextResponse.json(resultado);
  } catch (err) {
    // Fail-soft (I4): o pass 1 já salvou; sem o detalhe o dentista preenche pelo form.
    console.error('[extrair-especialidade] extractor falhou:', err);
    return NextResponse.json(
      { ok: false, motivo: 'erro', mensagem: 'falha no extractor' } satisfies ExtractorResult<unknown>,
      { status: 500 },
    );
  }
}
