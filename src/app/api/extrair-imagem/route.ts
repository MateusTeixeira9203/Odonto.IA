import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";

const MIME_POR_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

interface ExtrairImagemBody {
  ficha_arquivo_id: string;
  tipo: "foto_ficha" | "radiografia";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = await withRateLimit(req, "extrair-imagem", 10, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  let body: ExtrairImagemBody;

  try {
    body = (await req.json()) as ExtrairImagemBody;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { ficha_arquivo_id, tipo } = body;

  if (!ficha_arquivo_id) {
    return NextResponse.json(
      { error: "ficha_arquivo_id é obrigatório." },
      { status: 400 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY não configurada." }, { status: 500 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Resolve clínica ativa para escopar leitura e escrita ao tenant correto
  const { data: userRecord } = await supabase
    .from("users")
    .select("active_clinica_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) {
    return NextResponse.json({ error: "Clínica não encontrada." }, { status: 403 });
  }

  const clinicId = userRecord.active_clinica_id as string;

  // Busca o registro do arquivo — escopo explícito por clínica
  const { data: arquivo, error: arquivoError } = await supabase
    .from("ficha_arquivos")
    .select("*")
    .eq("id", ficha_arquivo_id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (arquivoError || !arquivo) {
    return NextResponse.json(
      { error: "Arquivo não encontrado." },
      { status: 404 }
    );
  }

  // Gera URL assinada no bucket correto
  const bucketName = tipo === "foto_ficha" ? "fichas" : "radiografias";
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(arquivo.storage_url, 120);

  if (signedError || !signedData?.signedUrl) {
    console.error("Erro ao gerar URL assinada:", signedError);
    return NextResponse.json(
      { error: "Erro ao acessar o arquivo." },
      { status: 500 }
    );
  }

  // Monta o prompt conforme o tipo do arquivo
  const prompt =
    tipo === "foto_ficha"
      ? "Esta é uma foto de uma ficha odontológica física. Extraia todas as informações visíveis: procedimentos anotados, observações, datas e qualquer dado clínico relevante. Retorne em texto limpo e organizado."
      : "Extraia todas as informações clínicas visíveis nesta imagem odontológica (radiografia).";

  // Baixa a imagem e converte pra base64 — Gemini recebe inlineData, não URL
  const imageResponse = await fetch(signedData.signedUrl);
  if (!imageResponse.ok) {
    return NextResponse.json(
      { error: "Erro ao baixar a imagem." },
      { status: 500 }
    );
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString("base64");
  const ext = (arquivo.nome_original as string | null)?.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_POR_EXTENSAO[ext] ?? "image/jpeg";

  let textoExtraido: string;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
    });

    textoExtraido = response.text ?? "";
  } catch (err) {
    console.error("Erro no Gemini Vision:", err);
    return NextResponse.json(
      { error: "Erro ao processar imagem com IA." },
      { status: 500 }
    );
  }

  // Atualiza o registro com o texto extraído — escopo explícito por clínica
  const { error: updateError } = await supabase
    .from("ficha_arquivos")
    .update({ texto_extraido: textoExtraido, processado: true })
    .eq("id", ficha_arquivo_id)
    .eq("clinica_id", clinicId);

  if (updateError) {
    console.error("Erro ao salvar texto extraído:", updateError);
  }

  return NextResponse.json({ texto: textoExtraido });
}
