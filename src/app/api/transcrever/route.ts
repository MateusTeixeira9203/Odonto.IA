import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';
import { WHISPER_DENTAL_PROMPT } from '@/lib/odonto-dictionary';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });

// Recebe o áudio diretamente como multipart/form-data e retorna a transcrição
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = await withRateLimit(req, 'transcrever', 20, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  // Verifica autenticação
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada.' }, { status: 500 });
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
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
      prompt: WHISPER_DENTAL_PROMPT,
    });

    return NextResponse.json({ transcricao: transcription.text });
  } catch (err) {
    console.error('Erro na transcrição:', err);
    return NextResponse.json({ error: 'Erro ao transcrever o áudio.' }, { status: 500 });
  }
}
