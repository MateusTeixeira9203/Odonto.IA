import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

interface TranscricaoBody {
  ficha_id: string;
  audio_url: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = await withRateLimit(req, "transcricao", 20, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  let body: TranscricaoBody;

  try {
    body = (await req.json()) as TranscricaoBody;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { ficha_id, audio_url } = body;

  if (!ficha_id || !audio_url) {
    return NextResponse.json(
      { error: "ficha_id e audio_url são obrigatórios." },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada." }, { status: 500 });
  }

  const supabase = await createClient();

  // Verifica se o usuário está autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // 1. Gera URL assinada para download do áudio no Storage
  const { data: signedData, error: signedError } = await supabase.storage
    .from("audios")
    .createSignedUrl(audio_url, 60); // expira em 60 segundos

  if (signedError || !signedData?.signedUrl) {
    console.error("Erro ao gerar URL assinada:", signedError);
    return NextResponse.json(
      { error: "Erro ao acessar o arquivo de áudio." },
      { status: 500 }
    );
  }

  // 2. Faz download do arquivo como buffer
  const audioResponse = await fetch(signedData.signedUrl);
  if (!audioResponse.ok) {
    return NextResponse.json(
      { error: "Erro ao baixar o arquivo de áudio." },
      { status: 500 }
    );
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  const audioFile = new File([audioBuffer], "audio.webm", {
    type: "audio/webm",
  });

  // 3. Envia para OpenAI Whisper
  let transcricaoTexto: string;
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "pt",
      prompt:
        "Transcrição de dentista descrevendo procedimentos odontológicos. " +
        "Termos: extração, restauração, canal, faceta, implante, limpeza, " +
        "clareamento, prótese, radiografia, siso, resina, porcelana.",
    });
    transcricaoTexto = transcription.text;
  } catch (err) {
    console.error("Erro no Whisper:", err);
    return NextResponse.json(
      { error: "Erro ao transcrever o áudio." },
      { status: 500 }
    );
  }

  // 4. Atualiza a ficha com a transcrição
  const { error: updateError } = await supabase
    .from("fichas")
    .update({ transcricao: transcricaoTexto })
    .eq("id", ficha_id);

  if (updateError) {
    console.error("Erro ao salvar transcrição:", updateError);
    // Retorna a transcrição mesmo que o update falhe — o front pode salvar
    return NextResponse.json({ transcricao: transcricaoTexto });
  }

  return NextResponse.json({ transcricao: transcricaoTexto });
}
