export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDentistaCached } from "@/lib/get-dentista";
import { generateStructured } from "@/lib/ai/provider";

type ProcedimentoExtraido = {
  nome: string;
  preco_padrao: number;
  duracao_minutos: number;
  categoria: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (dentista.role === "secretaria")
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  if (!process.env.GROQ_API_KEY)
    return NextResponse.json({ error: "GROQ_API_KEY não configurada." }, { status: 500 });

  let text: string;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    if (ext === "txt" || file.type.startsWith("text/")) {
      text = buffer.toString("utf-8");
    } else if (ext === "pdf" || file.type === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (
      ext === "docx" ||
      file.type.includes("wordprocessingml")
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json(
        { error: "Formato não suportado. Use TXT, PDF ou DOCX." },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error("[importar-procedimentos] Erro ao extrair texto:", err);
    return NextResponse.json({ error: "Erro ao ler o arquivo." }, { status: 500 });
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "O arquivo está vazio ou sem texto legível." },
      { status: 400 }
    );
  }

  const prompt = `Você é um assistente odontológico. Extraia todos os procedimentos dentários e seus valores do texto abaixo.

Retorne APENAS um JSON válido:
{"procedimentos": [{"nome": "string", "preco_padrao": number, "duracao_minutos": number, "categoria": "string"}]}

Regras:
- nome: nome do procedimento
- preco_padrao: valor em reais como número (ex: 150.00). Se não houver preço, use 0
- duracao_minutos: duração estimada em minutos (use 30 se não informado)
- categoria: especialidade odontológica (ex: "Ortodontia", "Endodontia", "Dentística", "Periodontia", "Cirurgia", "Prótese", "Preventivo", "Implante", "Geral")
- Ignore cabeçalhos, rodapés e textos explicativos
- Inclua cada variação de procedimento separada

Texto:
${text.slice(0, 8000)}`;

  try {
    const result = await generateStructured<{ procedimentos: ProcedimentoExtraido[] }>({ prompt, feature: 'importar-procedimentos' });
    const procedimentos = (result.data.procedimentos ?? [])
      .filter((p) => p.nome?.trim())
      .map((p) => ({
        nome: String(p.nome).trim(),
        preco_padrao: Math.max(0, Number(p.preco_padrao) || 0),
        duracao_minutos: Math.max(15, Number(p.duracao_minutos) || 30),
        categoria: String(p.categoria || "Geral").trim(),
      }));

    return NextResponse.json({ procedimentos });
  } catch (err) {
    console.error("[importar-procedimentos] Erro IA:", err);
    return NextResponse.json(
      { error: "Erro ao processar o arquivo com IA. Tente novamente." },
      { status: 500 }
    );
  }
}
