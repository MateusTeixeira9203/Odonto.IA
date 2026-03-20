import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getDentistaCached } from "@/lib/get-dentista";
import { createClient } from "@/lib/supabase/server";
import { OrcamentosClient } from "./_components/orcamentos-client";
import type { OrcamentoEnriquecido, MetricasMes } from "./_components/types";

export default async function OrcamentosPage(): Promise<React.JSX.Element> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();
  const clinicaId = dentista.clinica_id;

  const { data: orcamentosRaw } = await supabase
    .from("orcamentos")
    .select("*, paciente:pacientes(id, nome), dentista:dentistas(id, nome)")
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: false });

  const [{ data: itens }, { data: pagamentos }] = await Promise.all([
    supabase.from("orcamento_itens").select("*").eq("clinica_id", clinicaId),
    supabase.from("pagamentos").select("*").eq("clinica_id", clinicaId),
  ]);

  const orcamentos: OrcamentoEnriquecido[] = (orcamentosRaw ?? []).map((o) => ({
    ...o,
    paciente: (o.paciente as { id: string; nome: string } | null) ?? { id: "", nome: "—" },
    dentista: (o.dentista as { id: string; nome: string } | null) ?? { id: "", nome: "—" },
    itens: (itens ?? []).filter((i) => i.orcamento_id === o.id),
    pagamentos: (pagamentos ?? []).filter((p) => p.orcamento_id === o.id),
  }));

  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  const orcsMes = orcamentos.filter((o) => {
    const d = new Date(o.created_at);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const orcsMesAprovados = orcsMes.filter((o) => o.status === "aprovado");

  const metricas: MetricasMes = {
    totalMes: orcsMes.reduce((acc, o) => acc + (o.total ?? 0), 0),
    aprovadosMes: orcsMesAprovados.reduce((acc, o) => acc + (o.total ?? 0), 0),
    recebido: (pagamentos ?? [])
      .filter((p) => {
        const d = new Date(p.created_at);
        return p.status === "pago" && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      })
      .reduce((acc, p) => acc + Number(p.valor ?? 0), 0),
    pendente: (pagamentos ?? [])
      .filter((p) => p.status === "pendente")
      .reduce((acc, p) => acc + Number(p.valor ?? 0), 0),
    taxaConversao:
      orcsMes.length > 0
        ? Math.round((orcsMesAprovados.length / orcsMes.length) * 100)
        : 0,
  };

  return <OrcamentosClient orcamentos={orcamentos} metricas={metricas} />;
}
