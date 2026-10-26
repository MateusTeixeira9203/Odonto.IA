"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { revalidatePath } from "next/cache";
import { buscarPossiveisDuplicatas, type CandidatoDuplicata } from "@/server/patients/buscar-duplicatas";

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
    responsavel_nome?: string | null;
    responsavel_telefone?: string | null;
    responsavel_parentesco?: string | null;
  }
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  // Encaminhamento (hierarquia §3): só a secretária troca o dentista responsável —
  // a ficha não acompanha, fica com quem a criou. RLS já bloqueia na escrita, mas
  // aqui dá um erro claro em vez do erro cru do Postgres.
  if (dados.dentista_id !== undefined && role !== 'secretaria') {
    return { error: 'Só a secretária pode reatribuir o dentista responsável.' };
  }

  // R-41 §3.2 — CPF é identificador de pessoa, bloqueia igual ao cadastro (R-31a). Sem
  // isto, colidir com uq_pacientes_clinica_cpf vazaria o erro cru do Postgres (:38).
  // `d.id !== pacienteId` é o que impede o paciente de colidir consigo mesmo.
  if (dados.cpf && dados.nome) {
    const duplicatas = await buscarPossiveisDuplicatas(supabase, clinicId, {
      nome: dados.nome,
      cpf: dados.cpf,
    });
    const outro = duplicatas.find((d) => d.motivo === 'cpf' && d.id !== pacienteId);
    if (outro) {
      return { error: `CPF já cadastrado para o paciente "${outro.nome}".` };
    }
  }

  const { data: afetados, error } = await supabase
    .from("pacientes")
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq("id", pacienteId)
    .eq("clinica_id", clinicId)
    .select("id");

  if (error) return { error: error.message };
  if (!afetados?.length) return { error: "Registro nao encontrado." };
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

export async function gerarPlanejamentoIA(
  pacienteId: string
): Promise<{ conteudo?: string; error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === 'secretaria') return { error: "Sem permissão para gerar planejamento clínico" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "Gemini não configurado. Adicione GEMINI_API_KEY." };

  const { data: fichas } = await supabase
    .from("fichas")
    .select("queixa_principal, anotacoes, alergias, medicamentos_em_uso, data_atendimento")
    .eq("paciente_id", pacienteId)
    .eq("clinica_id", clinicId)
    .order("data_atendimento", { ascending: false })
    .limit(10);

  const historico =
    fichas && fichas.length > 0
      ? fichas
          .map(
            // 'YYYY-MM-DD' formatado na mão — `new Date()` parseia como UTC meia-noite
            // e desloca um dia pra trás em fusos negativos (BRT).
            (f) =>
              `[${f.data_atendimento.split('-').reverse().join('/')}] Queixa: ${f.queixa_principal ?? "—"} | Anotações: ${f.anotacoes ?? "—"}${f.alergias ? ` | Alergias: ${f.alergias}` : ""}${f.medicamentos_em_uso ? ` | Medicamentos: ${f.medicamentos_em_uso}` : ""}`
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

// #2 — Cadastro rápido de paciente: quando a busca não acha ninguém, cria com o
// mínimo (nome, e opcionalmente telefone) e devolve o id. Usado no walk-in ("Atender
// agora") e no autocomplete de "Novo Agendamento"/Encaixe — ali a secretária pode
// estar agendando para OUTRO dentista, então dentistaId deixa explícito de quem é o
// paciente (RLS de pacientes é siloado por dentista_id; sem isso o cadastro nasceria
// preso ao perfil da secretária, e o dentista não veria o paciente dele depois).
export async function criarPacienteRapido(dados: {
  nome: string;
  telefone: string | null;
  dentistaId?: string;
  /** R-31a §3.1 — mesmo campo de `createPaciente`: true depois que o dentista já viu o
   *  aviso de nome duplicado e quer cadastrar mesmo assim. */
  confirmarMesmoAssim?: boolean;
}): Promise<{ error?: string; id?: string; duplicatas?: CandidatoDuplicata[] }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();

  const nome = dados.nome.trim();
  if (!nome) return { error: "Informe o nome do paciente." };

  // R-31a §3.1 — hoje este caminho não checava nada; passa a chamar a mesma função do
  // cadastro completo. Sem CPF/data de nascimento aqui, então "cpf"/"nome_e_nascimento"
  // nunca aparecem — mas nome exato e nome+telefone sim.
  if (!dados.confirmarMesmoAssim) {
    const duplicatas = await buscarPossiveisDuplicatas(supabase, clinicId, {
      nome, telefone: dados.telefone,
    });
    if (duplicatas.length > 0) return { duplicatas };
  }

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) return { error: "Perfil de dentista não encontrado." };

  let dentistaAlvo = dentistaPerfil.id;
  if (dados.dentistaId && dados.dentistaId !== dentistaPerfil.id) {
    if (role !== 'secretaria') return { error: "Sem permissão para atribuir a outro dentista." };
    const { count } = await supabase
      .from('dentistas')
      .select('id', { count: 'exact', head: true })
      .eq('id', dados.dentistaId)
      .eq('clinica_id', clinicId);
    if ((count ?? 0) === 0) return { error: "Dentista não encontrado." };
    dentistaAlvo = dados.dentistaId;
  }

  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      clinica_id:  clinicId,
      dentista_id: dentistaAlvo,
      nome,
      telefone:    dados.telefone?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao criar paciente rápido:", error);
    return { error: "Não foi possível cadastrar o paciente. Tente novamente." };
  }

  revalidatePath("/dashboard/pacientes");
  return { id: (data as { id: string }).id };
}
