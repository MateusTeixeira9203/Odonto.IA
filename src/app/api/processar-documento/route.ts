export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";

interface ProcessarDocumentoBody {
  ficha_id: string;
  clinica_id: string;
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

  const { ficha_id, clinica_id, nome_original, storage_url } = body;

  if (!ficha_id || !clinica_id || !nome_original || !storage_url) {
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
    if (ext === "docx" || ext === "doc") {
      // Extrai texto de documentos Word com mammoth
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(fileBuffer),
      });
      textoExtraido = result.value;
    } else if (ext === "pdf") {
      // Extrai texto de PDFs com pdf-parse
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(Buffer.from(fileBuffer));
      textoExtraido = result.text;
    } else if (ext === "txt") {
      // Lê arquivo de texto diretamente
      textoExtraido = new TextDecoder("utf-8").decode(fileBuffer);
    } else if (ext === "pptx") {
      // Extrai texto de apresentações PowerPoint com officeparser
      const officeParser = (await import("officeparser")).default;
      const resultado = await officeParser.parseOffice(Buffer.from(fileBuffer), {
        outputErrorToConsole: true,
        newlineDelimiter: "\n",
        ignoreNotes: false,
      });
      textoExtraido = String(resultado);
    }
  } catch (err) {
    console.error("Erro ao extrair texto do arquivo:", err);
    return NextResponse.json(
      { error: "Erro ao extrair texto do arquivo." },
      { status: 500 }
    );
  }

  // Insere registro em ficha_arquivos
  const { data: fichaArquivo, error: insertError } = await supabase
    .from("ficha_arquivos")
    .insert({
      ficha_id,
      clinica_id,
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
