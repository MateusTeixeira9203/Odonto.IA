import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDentistaCached } from "@/lib/get-dentista";
import { PacientesTable } from "@/components/pacientes/pacientes-table";
import type { Paciente } from "@/types/database";

export async function PacientesList(): Promise<React.JSX.Element> {
  const dentista = await getDentistaCached();

  if (!dentista) redirect("/login");

  const supabase = await createClient();

  const { data: pacientes } = await supabase
    .from("pacientes")
    .select("*")
    .eq("clinica_id", dentista.clinica_id)
    .order("nome", { ascending: true });

  return (
    <PacientesTable pacientes={(pacientes as Paciente[]) ?? []} />
  );
}
