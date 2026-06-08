import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';

// Prompt de contexto odontológico — melhora reconhecimento de termos técnicos no Whisper
const DENTAL_CONTEXT =
  'dentista, endodontia, exodontia, raspagem supra e infragengival, ' +
  'restauração com resina composta, amálgama, faceta de porcelana, ' +
  'implante osseointegrado, enxerto ósseo, prótese total, prótese parcial removível, ' +
  'coroa total, retentores intracanal, placa miorrelaxante, clareamento dental, ' +
  'cárie, periodontia, gengivite, periodontite, bruxismo, oclusão, extração.';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = await withRateLimit(req, 'transcrever', 20, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  // Verifica autenticação
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY não configurada.' }, { status: 500 });
  }

  let audioFile: File;
  try {
    const formData = await req.formData();
    const audio = formData.get('audio');
    if (!audio || !(audio instanceof File)) {
      return NextResponse.json({ error: 'Campo "audio" é obrigatório.' }, { status: 400 });
    }
    audioFile = audio;
  } catch {
    return NextResponse.json({ error: 'Erro ao processar o áudio.' }, { status: 400 });
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      language: 'pt',
      prompt: DENTAL_CONTEXT,
      response_format: 'json',
    });

    const transcricao = transcription.text?.trim() ?? '';
    return NextResponse.json({ transcricao });
  } catch (err) {
    console.error('Erro na transcrição (Groq):', err);
    return NextResponse.json({ error: 'Erro ao transcrever o áudio.' }, { status: 500 });
  }
}
