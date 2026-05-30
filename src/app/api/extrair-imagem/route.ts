import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada." }, { status: 500 });
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
      : "Extraia todas as informações clínicas visíveis nesta imagem odontológica.";

  let textoExtraido: string;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: signedData.signedUrl },
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    textoExtraido = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error("Erro no GPT-4o Vision:", err);
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
