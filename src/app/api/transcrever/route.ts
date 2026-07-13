import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';
import { WHISPER_DENTAL_PROMPT } from '@/lib/odonto-dictionary';

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
      // large-v3 cheio (não turbo): visivelmente melhor em PT-BR e número falado —
      // é onde o turbo errava dente/termo (spec fase1-5 §A, decisão 13/07).
      model: 'whisper-large-v3',
      language: 'pt',
      prompt: WHISPER_DENTAL_PROMPT,
      response_format: 'json',
    });

    const transcricao = transcription.text?.trim() ?? '';
    return NextResponse.json({ transcricao });
  } catch (err) {
    console.error('Erro na transcrição (Groq):', err);
    return NextResponse.json({ error: 'Erro ao transcrever o áudio.' }, { status: 500 });
  }
}
