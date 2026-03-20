import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDentistaCached } from "@/lib/get-dentista";
import type { FichaArquivo, Orcamento, Planejamento } from "@/types/database";
import { PacienteDetailClient } from "./_components/paciente-detail-client";
import type { FichaResumida, PagamentoResumido, ProximaConsulta } from "./_components/paciente-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PacienteDetalhePage({ params }: Props) {
  const { id } = await params;
  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  const [
    { data: paciente },
    { data: fichasRaw },
    { data: orcamentos },
    { data: planejamentos },
    { data: agendamentoData },
  ] = await Promise.all([
    supabase
      .from("pacientes")
      .select("*")
      .eq("id", id)
      .eq("clinica_id", dentista.clinica_id)
      .maybeSingle(),
    supabase
      .from("fichas")
      .select("id, status, created_at, queixa_principal, anotacoes, dentes_afetados")
      .eq("paciente_id", id)
      .eq("clinica_id", dentista.clinica_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orcamentos")
      .select("id, status, total, created_at, condicoes_pagamento, validade_dias, ficha_id")
      .eq("paciente_id", id)
      .eq("clinica_id", dentista.clinica_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("planejamentos")
      .select("id, titulo, status, created_at")
      .eq("paciente_id", id)
      .eq("clinica_id", dentista.clinica_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("agendamentos")
      .select("id, data_hora, status")
      .eq("paciente_id", id)
      .gt("data_hora", new Date().toISOString())
      .order("data_hora", { ascending: true })
      .limit(1),
  ]);

  if (!paciente) notFound();

  const fichas = (fichasRaw ?? []) as FichaResumida[];
  const fichaIds = fichas.map((f) => f.id);

  const [{ data: arquivos }, { data: pagamentos }] = await Promise.all([
    supabase
      .from("fichas_arquivos")
      .select("id, tipo, nome_original, storage_url, created_at, ficha_id")
      .in("ficha_id", fichaIds.length > 0 ? fichaIds : [""]),
    supabase
      .from("pagamentos")
      .select("valor, status, data_pagamento")
      .eq("paciente_id", id)
      .eq("clinica_id", dentista.clinica_id),
  ]);

  return (
    <PacienteDetailClient
      paciente={paciente}
      fichas={fichas}
      orcamentos={(orcamentos as Orcamento[]) ?? []}
      planejamentos={(planejamentos as Planejamento[]) ?? []}
      arquivos={(arquivos as FichaArquivo[]) ?? []}
      pagamentos={(pagamentos as PagamentoResumido[]) ?? []}
      proximaConsulta={(agendamentoData?.[0] as ProximaConsulta) ?? null}
      dentistaId={dentista.id}
      clinicaId={dentista.clinica_id}
    />
  );
}
