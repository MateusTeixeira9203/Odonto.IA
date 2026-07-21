// Job A Fatia B (§6) — extrai texto de um documento anexado no campo mágico.
// Sem persistência: processa em memória e descarta (≠ processar-documento, que
// grava em ficha_arquivos — invariante #7). Parsers compartilhados: lib/extract-text.ts.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";
import { extractTextFromFile } from "@/lib/extract-text";

const EXTENSOES_SUPORTADAS = new Set(["pdf", "docx", "doc", "txt"]);
// Vercel limita o corpo da request a ~4.5MB nas rotas serverless (App Router,
// runtime nodejs) — checar antes de tentar ler evita um 500 genérico da plataforma.
const LIMITE_BYTES = 4.5 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = await withRateLimit(req, "extrair-texto", 20, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let arquivo: File;
  try {
    const formData = await req.formData();
    const campo = formData.get("arquivo");
    if (!campo || !(campo instanceof File)) {
      return NextResponse.json({ error: 'Campo "arquivo" é obrigatório.' }, { status: 400 });
    }
    arquivo = campo;
  } catch {
    return NextResponse.json({ error: "Erro ao processar o arquivo." }, { status: 400 });
  }

  const ext = arquivo.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSOES_SUPORTADAS.has(ext)) {
    return NextResponse.json(
      { error: "Extensão não suportada. Envie .pdf, .docx, .doc ou .txt." },
      { status: 400 },
    );
  }

  if (arquivo.size > LIMITE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo acima do limite de 4,5MB." },
      { status: 413 },
    );
  }

  let texto: string;
  try {
    const buffer = await arquivo.arrayBuffer();
    texto = (await extractTextFromFile(buffer, ext)).trim();
  } catch (err) {
    console.error("[extrair-texto] falha do parser:", err);
    return NextResponse.json({ error: "Erro ao extrair texto do arquivo." }, { status: 500 });
  }

  // PDF escaneado (imagem, sem texto embutido) — OCR está fora do v1 (spec §2).
  // Mensagem orienta o caminho de escape em vez de devolver uma ficha vazia.
  if (!texto) {
    return NextResponse.json(
      { error: "Não encontramos texto neste arquivo — use áudio ou digite o relato." },
      { status: 400 },
    );
  }

  return NextResponse.json({ texto });
}
