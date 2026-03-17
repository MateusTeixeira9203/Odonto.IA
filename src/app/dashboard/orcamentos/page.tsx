import { redirect } from "next/navigation";
import { getDentistaCached } from "@/lib/get-dentista";
import { createClient } from "@/lib/supabase/server";
import { OrcamentosClient } from "./_components/orcamentos-client";
import type { OrcamentoEnriquecido, MetricasMes } from "./_components/types";

export default async function OrcamentosPage(): Promise<React.JSX.Element> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();
  const clinicaId = dentista.clinica_id;

  // Busca orçamentos com joins de paciente e dentista
  const { data: orcamentosRaw, error: orcamentosError } = await supabase
    .from("orcamentos")
    .select("*, paciente:pacientes(id, nome), dentista:dentistas(id, nome)")
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: false });
  
  console.log("[v0] Orçamentos query - clinicaId:", clinicaId);
  console.log("[v0] Orçamentos encontrados:", orcamentosRaw?.length ?? 0);
  if (orcamentosError) console.log("[v0] Erro na query:", orcamentosError);

  // Busca itens e pagamentos da clínica em paralelo
  const [{ data: itens }, { data: pagamentos }] = await Promise.all([
    supabase.from("orcamento_itens").select("*").eq("clinica_id", clinicaId),
    supabase.from("pagamentos").select("*").eq("clinica_id", clinicaId),
  ]);

  // Enriquece cada orçamento com seus itens e pagamentos
  const orcamentos: OrcamentoEnriquecido[] = (orcamentosRaw ?? []).map((o) => ({
    ...o,
    paciente: (o.paciente as { id: string; nome: string } | null) ?? { id: "", nome: "—" },
    dentista: (o.dentista as { id: string; nome: string } | null) ?? { id: "", nome: "—" },
    itens: (itens ?? []).filter((i) => i.orcamento_id === o.id),
    pagamentos: (pagamentos ?? []).filter((p) => p.orcamento_id === o.id),
  }));

  // Métricas do mês atual
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  const orcsMes = orcamentos.filter((o) => {
    const d = new Date(o.created_at);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const metricas: MetricasMes = {
    totalMes: orcsMes.reduce((acc, o) => acc + (o.total ?? 0), 0),
    recebido: (pagamentos ?? [])
      .filter((p) => {
        const d = new Date(p.created_at);
        return (
          p.status === "pago" &&
          d.getMonth() === mesAtual &&
          d.getFullYear() === anoAtual
        );
      })
      .reduce((acc, p) => acc + Number(p.valor ?? 0), 0),
    pendente: (pagamentos ?? [])
      .filter((p) => p.status === "pendente")
      .reduce((acc, p) => acc + Number(p.valor ?? 0), 0),
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl tracking-tight text-foreground">
            Orçamentos
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            Controle financeiro da clínica
          </p>
        </div>
      </div>

      <OrcamentosClient orcamentos={orcamentos} metricas={metricas} />
    </div>
  );
}
