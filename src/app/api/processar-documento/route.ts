export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";
import { extractTextFromFile } from "@/lib/extract-text";

interface ProcessarDocumentoBody {
  ficha_id: string;
  // clinica_id removido — resolvido server-side a partir de users.active_clinica_id.
  // Aceitar clinica_id do cliente sem validação permitiria inserir em fichas de qualquer clínica.
  nome_original: string;
  storage_url: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = await withRateLimit(req, "processar-documento", 10, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  let body: ProcessarDocumentoBody;

  try {
    body = (await req.json()) as ProcessarDocumentoBody;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { ficha_id, nome_original, storage_url } = body;

  if (!ficha_id || !nome_original || !storage_url) {
    return NextResponse.json(
      { error: "Campos obrigatórios faltando." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Resolve clínica ativa — fonte canônica é users.active_clinica_id, não o body do cliente
  const { data: userRecord } = await supabase
    .from("users")
    .select("active_clinica_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) {
    return NextResponse.json({ error: "Clínica não encontrada." }, { status: 403 });
  }

  const clinicId = userRecord.active_clinica_id as string;

  // Valida que a ficha pertence à clínica ativa antes de inserir
  const { data: ficha } = await supabase
    .from("fichas")
    .select("id")
    .eq("id", ficha_id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!ficha) {
    return NextResponse.json({ error: "Ficha não encontrada." }, { status: 404 });
  }

  // Gera URL assinada para download do arquivo
  const { data: signedData, error: signedError } = await supabase.storage
    .from("documentos")
    .createSignedUrl(storage_url, 120);

  if (signedError || !signedData?.signedUrl) {
    console.error("Erro ao gerar URL assinada:", signedError);
    return NextResponse.json(
      { error: "Erro ao acessar arquivo no storage." },
      { status: 500 }
    );
  }

  // Baixa o arquivo como buffer
  const fileResponse = await fetch(signedData.signedUrl);
  if (!fileResponse.ok) {
    return NextResponse.json(
      { error: "Erro ao baixar o arquivo." },
      { status: 500 }
    );
  }

  const fileBuffer = await fileResponse.arrayBuffer();
  const ext = nome_original.split(".").pop()?.toLowerCase() ?? "";

  let textoExtraido = "";

  try {
    textoExtraido = await extractTextFromFile(fileBuffer, ext);
  } catch (err) {
    console.error("Erro ao extrair texto do arquivo:", err);
    return NextResponse.json(
      { error: "Erro ao extrair texto do arquivo." },
      { status: 500 }
    );
  }

  // Insere registro em ficha_arquivos com clinicId resolvido server-side
  const { data: fichaArquivo, error: insertError } = await supabase
    .from("ficha_arquivos")
    .insert({
      ficha_id,
      clinica_id: clinicId,
      tipo: "documento",
      nome_original,
      storage_url,
      texto_extraido: textoExtraido,
      processado: true,
    })
    .select()
    .single();

  if (insertError || !fichaArquivo) {
    console.error("Erro ao inserir ficha_arquivo:", insertError);
    return NextResponse.json(
      { error: "Erro ao salvar registro do arquivo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ficha_arquivo: fichaArquivo, texto: textoExtraido });
}
