import { redirect } from "next/navigation";
import { Users, FileText, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getDentistaCached } from "@/lib/get-dentista";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ActivityList } from "@/components/dashboard/activity-list";
import type { Activity } from "@/components/dashboard/activity-list";

// Saudação baseada no horário do servidor
function getSaudacao(): string {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();
  const saudacao = getSaudacao();
  const primeiroNome = dentista.nome.split(" ")[0] ?? dentista.nome;

  // Data formatada no servidor
  const dataFormatada = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const dataDisplay = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  // Todas as queries em paralelo
  const [
    { count: totalPacientes },
    { count: fichasAbertas },
    { count: orcamentosPendentes },
    { data: fichasRaw },
  ] = await Promise.all([
    supabase
      .from("pacientes")
      .select("*", { count: "exact", head: true })
      .eq("clinica_id", dentista.clinica_id),
    supabase
      .from("fichas")
      .select("*", { count: "exact", head: true })
      .eq("clinica_id", dentista.clinica_id)
      .eq("status", "aberta"),
    supabase
      .from("orcamentos")
      .select("*", { count: "exact", head: true })
      .eq("clinica_id", dentista.clinica_id)
      .in("status", ["rascunho", "enviado"]),
    supabase
      .from("fichas")
      .select("id, created_at, pacientes(nome)")
      .eq("clinica_id", dentista.clinica_id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Normaliza atividade recente para o formato Activity
  const atividades: Activity[] = (fichasRaw ?? []).map((f) => {
    const p = f.pacientes;
    const nome =
      Array.isArray(p) && p[0]
        ? (p[0] as { nome: string }).nome
        : p && typeof p === "object" && "nome" in p
          ? (p as { nome: string }).nome
          : "—";
    return {
      id: f.id as string,
      patientName: nome,
      patientInitials: getIniciais(nome),
      date: format(new Date(f.created_at as string), "dd MMM yyyy", { locale: ptBR }),
      status: "aberta" as const,
      type: "ficha",
      href: `/dashboard/fichas/${f.id as string}`,
    };
  });

  return (
    <div className="animate-fade-in space-y-8">
      {/* Saudação */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          {saudacao}, Dr. {primeiroNome}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          {dataDisplay}
        </p>
      </div>

      {/* Cards de métricas — 3 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <MetricCard
          label="Pacientes"
          value={totalPacientes ?? 0}
          subtitle="Total cadastrados"
          icon={<Users className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />}
        />
        <MetricCard
          label="Fichas Abertas"
          value={fichasAbertas ?? 0}
          subtitle="Aguardando conclusão"
          icon={<FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />}
        />
        <MetricCard
          label="Orçamentos Pendentes"
          value={orcamentosPendentes ?? 0}
          subtitle="Aguardando aprovação"
          icon={<Receipt className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />}
        />
      </div>

      {/* Atividade recente */}
      {atividades.length > 0 ? (
        <ActivityList title="Atividade Recente" activities={atividades} />
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-sans font-semibold text-base text-foreground mb-5">
            Atividade Recente
          </h3>
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <FileText className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="font-sans text-sm text-muted-foreground">
              Nenhuma atividade ainda
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
