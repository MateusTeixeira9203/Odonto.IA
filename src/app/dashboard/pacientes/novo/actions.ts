"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

interface CreatePacienteInput {
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  avatar_url?: string | null;
  dentistaId?: string | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
  responsavel_parentesco?: string | null;
}

export async function createPaciente(
  data: CreatePacienteInput
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from("dentistas")
    .select("id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect("/onboarding");

  const dentistaAlvo = data.dentistaId ?? dentistaPerfil.id;

  if (data.cpf) {
    const cpfFormatted = data.cpf.trim();
    const cpfRaw = cpfFormatted.replace(/\D/g, '');
    const { data: existente } = await supabase
      .from('pacientes')
      .select('id, nome')
      .eq('clinica_id', clinicId)
      .or(`cpf.eq.${cpfFormatted},cpf.eq.${cpfRaw}`)
      .maybeSingle();
    if (existente) {
      return { success: false, error: `CPF já cadastrado para o paciente "${existente.nome}".` };
    }
  }

  const { error } = await supabase.from("pacientes").insert({
    clinica_id:      clinicId,
    dentista_id:     dentistaAlvo,
    nome:            data.nome,
    cpf:             data.cpf,
    email:           data.email,
    telefone:        data.telefone,
    data_nascimento: data.data_nascimento,
    endereco:        data.endereco,
    cidade:          data.cidade,
    estado:          data.estado,
    observacoes:             data.observacoes,
    avatar_url:              data.avatar_url,
    responsavel_nome:        data.responsavel_nome ?? null,
    responsavel_telefone:    data.responsavel_telefone ?? null,
    responsavel_parentesco:  data.responsavel_parentesco ?? null,
  });

  if (error) {
    console.error("Erro ao criar paciente:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/pacientes");
  return { success: true };
}
