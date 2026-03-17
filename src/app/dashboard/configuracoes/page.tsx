import { redirect } from "next/navigation";
import { getDentistaCached } from "@/lib/get-dentista";
import { createClient } from "@/lib/supabase/server";
import { ConfigTabs } from "./_components/config-tabs";
import type {
  ConfiguracaoClinica,
  HorarioDisponivel,
  ProcedimentoPadrao,
} from "@/types/database";

export default async function ConfiguracoesPage(): Promise<React.JSX.Element> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  // Busca configurações, horários e procedimentos em paralelo
  const [
    { data: configuracao },
    { data: horarios },
    { data: procedimentos },
  ] = await Promise.all([
    supabase
      .from("configuracoes_clinica")
      .select("*")
      .eq("clinica_id", dentista.clinica_id)
      .maybeSingle(),
    supabase
      .from("horarios_disponiveis")
      .select("*")
      .eq("dentista_id", dentista.id)
      .order("dia_semana"),
    supabase
      .from("procedimentos_padrao")
      .select("*")
      .order("categoria")
      .order("nome"),
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          Gerencie as configurações da sua clínica
        </p>
      </div>

      <ConfigTabs
        configuracao={(configuracao as ConfiguracaoClinica | null) ?? null}
        horarios={(horarios ?? []) as HorarioDisponivel[]}
        procedimentos={(procedimentos ?? []) as ProcedimentoPadrao[]}
      />
    </div>
  );
}
