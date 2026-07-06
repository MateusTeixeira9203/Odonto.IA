"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";

export async function deletarFicha(fichaId: string): Promise<void> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  if (role === 'secretaria') throw new Error("Sem permissão para apagar fichas clínicas");

  // Dentista só pode apagar fichas que criou (dentista_id = criador/responsável).
  // Quando o schema evoluir para created_by + responsible_dentista_id, estender aqui.
  if (role === 'dentista') {
    const { data: ficha } = await supabase
      .from("fichas")
      .select("dentista_id")
      .eq("id", fichaId)
      .eq("clinica_id", clinicId)
      .maybeSingle();
    if (ficha && ficha.dentista_id !== dentistaId) {
      throw new Error("Sem permissão para apagar fichas de outro dentista");
    }
  }

  const { error } = await supabase
    .from("fichas")
    .delete()
    .eq("id", fichaId)
    .eq("clinica_id", clinicId);

  if (error) throw new Error("Erro ao apagar ficha");
}

export async function atualizarPaciente(
  pacienteId: string,
  dados: {
    nome?: string;
    cpf?: string | null;
    email?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    data_nascimento?: string | null;
    cidade?: string | null;
    estado?: string | null;
    endereco?: string | null;
    observacoes?: string | null;
    dentista_id?: string | null;
  }
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  // Encaminhamento (hierarquia §3): só a secretária troca o dentista responsável —
  // a ficha não acompanha, fica com quem a criou. RLS já bloqueia na escrita, mas
  // aqui dá um erro claro em vez do erro cru do Postgres.
  if (dados.dentista_id !== undefined && role !== 'secretaria') {
    return { error: 'Só a secretária pode reatribuir o dentista responsável.' };
  }

  const { error } = await supabase
    .from("pacientes")
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq("id", pacienteId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

export async function salvarAnotacoes(
  pacienteId: string,
  observacoes: string
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { error } = await supabase
    .from("pacientes")
    .update({ observacoes, updated_at: new Date().toISOString() })
    .eq("id", pacienteId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

export async function atualizarFicha(
  fichaId: string,
  pacienteId: string,
  dados: {
    queixa_principal?: string | null;
    anotacoes?: string | null;
    status?: "aberta" | "concluida";
  }
): Promise<{ error?: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  if (role === 'secretaria') return { error: "Sem permissão para editar fichas clínicas" };

  // Dentista só pode editar fichas que criou (mesma regra do deletar)
  if (role === 'dentista') {
    const { data: ficha } = await supabase
      .from("fichas")
      .select("dentista_id")
      .eq("id", fichaId)
      .eq("clinica_id", clinicId)
      .maybeSingle();
    if (ficha && ficha.dentista_id !== dentistaId) {
      return { error: "Sem permissão para editar fichas de outro dentista" };
    }
  }

  const { error } = await supabase
    .from("fichas")
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq("id", fichaId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

export async function gerarPlanejamentoIA(
  pacienteId: string
): Promise<{ conteudo?: string; error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === 'secretaria') return { error: "Sem permissão para gerar planejamento clínico" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "Gemini não configurado. Adicione GEMINI_API_KEY." };

  const { data: fichas } = await supabase
    .from("fichas")
    .select("queixa_principal, anotacoes, alergias, medicamentos_em_uso, created_at")
    .eq("paciente_id", pacienteId)
    .eq("clinica_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(10);

  const historico =
    fichas && fichas.length > 0
      ? fichas
          .map(
            (f) =>
              `[${format(new Date(f.created_at), "dd/MM/yyyy")}] Queixa: ${f.queixa_principal ?? "—"} | Anotações: ${f.anotacoes ?? "—"}${f.alergias ? ` | Alergias: ${f.alergias}` : ""}${f.medicamentos_em_uso ? ` | Medicamentos: ${f.medicamentos_em_uso}` : ""}`
          )
          .join("\n")
      : "Sem fichas clínicas anteriores.";

  const prompt = `Você é um assistente odontológico experiente. Com base no histórico clínico do paciente abaixo, gere um planejamento de tratamento detalhado em português. Seja específico, prático e organizado por etapas. Use linguagem profissional mas acessível.\n\nHistórico clínico:\n${historico}\n\nGere um planejamento estruturado com: diagnóstico resumido, etapas de tratamento (numeradas), estimativa de sessões por etapa, e observações gerais.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Erro Gemini:", errorData);
      return { error: "Erro ao chamar a API do Gemini." };
    }

    const data = await res.json();
    const conteudo = data.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    return { conteudo: conteudo ?? "" };
  } catch (err) {
    console.error("Erro ao gerar planejamento:", err);
    return { error: "Erro de rede ao chamar o Gemini." };
  }
}

export async function criarFichaInline(dados: {
  pacienteId: string;
  queixaPrincipal: string;
  anotacoes: string;
  dentesAfetados: string[];
}): Promise<{ error?: string; id?: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  if (role === 'secretaria') return { error: "Sem permissão para criar fichas clínicas" };

  const { data, error } = await supabase
    .from("fichas")
    .insert({
      paciente_id:      dados.pacienteId,
      dentista_id:      dentistaId,
      clinica_id:       clinicId,
      queixa_principal: dados.queixaPrincipal || null,
      anotacoes:        dados.anotacoes || null,
      dentes_afetados:  dados.dentesAfetados.length > 0 ? dados.dentesAfetados : null,
      status:           "aberta",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${dados.pacienteId}`);
  return { id: data.id };
}
