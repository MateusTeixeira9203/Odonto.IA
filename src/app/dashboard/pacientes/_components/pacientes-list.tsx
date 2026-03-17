import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDentistaCached } from "@/lib/get-dentista";
import { PacientesTable } from "@/components/pacientes/pacientes-table";
import type { Paciente } from "@/types/database";

export type PacienteComUltimoAtendimento = Paciente & {
  ultimo_atendimento: string | null;
};

export async function PacientesList(): Promise<React.JSX.Element> {
  const dentista = await getDentistaCached();

  if (!dentista) redirect("/login");

  const supabase = await createClient();

  // Busca pacientes com a data do último atendimento (ficha mais recente)
  const { data: pacientes } = await supabase
    .from("pacientes")
    .select(`
      *,
      fichas (
        data
      )
    `)
    .eq("clinica_id", dentista.clinica_id)
    .order("nome", { ascending: true });

  // Mapeia para incluir o último atendimento
  const pacientesComUltimoAtendimento: PacienteComUltimoAtendimento[] = (pacientes ?? []).map((p) => {
    const fichas = (p.fichas as { data: string }[] | null) ?? [];
    const datasOrdenadas = fichas
      .map((f) => f.data)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    return {
      ...p,
      fichas: undefined,
      ultimo_atendimento: datasOrdenadas[0] ?? null,
    } as PacienteComUltimoAtendimento;
  });

  return (
    <PacientesTable pacientes={pacientesComUltimoAtendimento} />
  );
}
