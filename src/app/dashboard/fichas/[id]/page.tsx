import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDentistaCached } from "@/lib/get-dentista";
import { FichaClient } from "./ficha-client";
import type {
  Ficha,
  Paciente,
  Dentista,
  FichaArquivo,
  Planejamento,
  PlanejamentoEtapa,
  Orcamento,
  OrcamentoItem,
  ProcedimentoPadrao,
} from "@/types/database";

interface FichaPageProps {
  params: Promise<{ id: string }>;
}

export default async function FichaPage({ params }: FichaPageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const dentista = await getDentistaCached();
  if (!dentista) redirect("/login");

  const supabase = await createClient();

  // Busca a ficha garantindo isolamento por clínica
  const { data: ficha } = await supabase
    .from("fichas")
    .select("*")
    .eq("id", id)
    .eq("clinica_id", dentista.clinica_id)
    .maybeSingle();

  if (!ficha) notFound();

  // Queries paralelas
  const [
    { data: paciente },
    { data: dentistaFicha },
    { data: arquivos },
    { data: planejamento },
    { data: orcamento },
    { data: procedimentosPadrao },
  ] = await Promise.all([
    supabase
      .from("pacientes")
      .select("*")
      .eq("id", ficha.paciente_id)
      .maybeSingle(),
    supabase
      .from("dentistas")
      .select("id, nome, especialidade")
      .eq("id", ficha.dentista_id)
      .maybeSingle(),
    supabase
      .from("ficha_arquivos")
      .select("*")
      .eq("ficha_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("planejamentos")
      .select("*")
      .eq("ficha_id", id)
      .maybeSingle(),
    supabase
      .from("orcamentos")
      .select("*")
      .eq("ficha_id", id)
      .maybeSingle(),
    supabase
      .from("procedimentos_padrao")
      .select("id, nome, preco_sugerido")
      .eq("ativo", true),
  ]);

  // Busca etapas e itens do orçamento em paralelo
  const etapas: PlanejamentoEtapa[] = [];
  const orcamentoItens: OrcamentoItem[] = [];

  await Promise.all([
    planejamento
      ? supabase
          .from("planejamento_etapas")
          .select("*")
          .eq("planejamento_id", planejamento.id)
          .order("ordem", { ascending: true })
          .then(({ data }) => {
            if (data) etapas.push(...(data as PlanejamentoEtapa[]));
          })
      : Promise.resolve(),
    orcamento
      ? supabase
          .from("orcamento_itens")
          .select("*")
          .eq("orcamento_id", orcamento.id)
          .order("created_at", { ascending: true })
          .then(({ data }) => {
            if (data) orcamentoItens.push(...(data as OrcamentoItem[]));
          })
      : Promise.resolve(),
  ]);

  return (
    <FichaClient
      ficha={ficha as Ficha}
      paciente={paciente as Paciente}
      dentista={dentistaFicha as Dentista}
      clinicaId={dentista.clinica_id}
      arquivosIniciais={(arquivos as FichaArquivo[]) ?? []}
      planejamentoInicial={(planejamento as Planejamento) ?? null}
      etapasIniciais={etapas}
      orcamentoInicial={(orcamento as Orcamento) ?? null}
      orcamentoItensIniciais={orcamentoItens}
      procedimentosPadrao={(procedimentosPadrao as ProcedimentoPadrao[]) ?? []}
    />
  );
}
