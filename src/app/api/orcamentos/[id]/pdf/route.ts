import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarPDFOrcamento, type OrcamentoData } from "@/lib/pdf/orcamento";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Buscar orçamento com relacionamentos
    const { data: orcamento, error: orcError } = await supabase
      .from("orcamentos")
      .select(
        `
        id,
        created_at,
        validade_dias,
        status,
        condicoes_pagamento,
        total,
        desconto,
        paciente:pacientes (
          nome,
          cpf,
          telefone
        ),
        clinica:clinicas (
          nome,
          endereco,
          telefone
        ),
        dentista:dentistas (
          nome,
          cro
        ),
        itens:orcamento_itens (
          id,
          descricao,
          dente,
          preco_unitario,
          quantidade
        )
      `
      )
      .eq("id", id)
      .single();

    if (orcError || !orcamento) {
      return NextResponse.json(
        { error: "Orçamento não encontrado" },
        { status: 404 }
      );
    }

    // Calcular validade a partir de created_at + validade_dias
    const dataEmissao = new Date(orcamento.created_at);
    const dataValidade = new Date(dataEmissao);
    dataValidade.setDate(dataValidade.getDate() + (orcamento.validade_dias ?? 30));

    // Calcular subtotal a partir dos itens
    const itens = orcamento.itens ?? [];
    const subtotal = itens.reduce(
      (acc: number, item: { preco_unitario: number | null; quantidade: number }) =>
        acc + (item.preco_unitario ?? 0) * item.quantidade,
      0
    );

    // Derivar número exibível dos últimos 4 chars do UUID
    const numeroExibivel = parseInt(orcamento.id.replace(/-/g, "").slice(-4), 16) % 10000;

    // Tipar os relacionamentos (Supabase infere joins como arrays)
    type PacienteJoin = { nome: string; cpf: string | null; telefone: string | null } | null;
    type ClinicaJoin = { nome: string; endereco: string | null; telefone: string | null } | null;
    type DentistaJoin = { nome: string; cro: string | null } | null;

    const paciente = (orcamento.paciente as unknown as PacienteJoin);
    const clinica = (orcamento.clinica as unknown as ClinicaJoin);
    const dentista = (orcamento.dentista as unknown as DentistaJoin);

    // Montar dados para o PDF
    const pdfData: OrcamentoData = {
      id: orcamento.id,
      numero: numeroExibivel,
      data: orcamento.created_at,
      validade: dataValidade.toISOString(),
      status: orcamento.status,
      paciente: {
        nome: paciente?.nome ?? "Não informado",
        cpf: paciente?.cpf ?? undefined,
        telefone: paciente?.telefone ?? undefined,
      },
      clinica: {
        nome: clinica?.nome ?? "Clínica",
        endereco: clinica?.endereco ?? undefined,
        telefone: clinica?.telefone ?? undefined,
      },
      dentista: {
        nome: dentista?.nome ?? "Dentista",
        cro: dentista?.cro ?? "",
      },
      procedimentos: itens.map(
        (item: {
          id: string;
          descricao: string | null;
          dente: string | null;
          preco_unitario: number | null;
          quantidade: number;
        }) => ({
          id: item.id,
          nome: item.descricao ?? "Procedimento",
          dente: item.dente ?? undefined,
          valor: item.preco_unitario ?? 0,
          quantidade: item.quantidade,
        })
      ),
      subtotal,
      desconto: orcamento.desconto ?? 0,
      total: orcamento.total ?? subtotal,
      forma_pagamento: orcamento.condicoes_pagamento ?? undefined,
    };

    // Gerar PDF
    const pdfBuffer = await gerarPDFOrcamento(pdfData);

    // Retornar PDF (converter Buffer para Uint8Array compatível com BodyInit)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="orcamento-${numeroExibivel}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    return NextResponse.json({ error: "Erro ao gerar PDF" }, { status: 500 });
  }
}
