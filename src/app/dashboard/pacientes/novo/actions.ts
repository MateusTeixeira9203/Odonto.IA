"use server";

import { createClient } from "@/lib/supabase/server";
import { getDentistaCached } from "@/lib/get-dentista";
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
  /** Preenchido pela secretária para vincular o paciente a um dentista específico */
  dentistaId?: string | null;
}

export async function createPaciente(
  data: CreatePacienteInput
): Promise<{ success: boolean; error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  // Secretária fornece dentistaId explicitamente; dentista usa o próprio ID
  const dentistaAlvo = data.dentistaId ?? dentista.id;

  const supabase = await createClient();
  const { error } = await supabase.from("pacientes").insert({
    clinica_id: dentista.clinica_id,
    dentista_id: dentistaAlvo,
    nome: data.nome,
    cpf: data.cpf,
    email: data.email,
    telefone: data.telefone,
    data_nascimento: data.data_nascimento,
    endereco: data.endereco,
    cidade: data.cidade,
    estado: data.estado,
    observacoes: data.observacoes,
    avatar_url: data.avatar_url,
  });

  if (error) {
    console.error("Erro ao criar paciente:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/pacientes");
  return { success: true };
}
