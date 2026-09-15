import { requireOwnerWorkspace } from '@/server/clinica/page-context';
import { listarResultadosClinica } from '@/server/clinica/operations';
import { ResultadosClinicaClient } from '@/components/clinica/resultados-client';
import { hojeBRT } from '@/lib/hora-brt';
import { mesValido } from '@/lib/financeiro/calculos';
export default async function ClinicaPage({ searchParams }: { searchParams: Promise<{ mes?: string; dentista?: string }> }) {
  const { context } = await requireOwnerWorkspace();
  const { mes, dentista } = await searchParams;
  const mesAtual = mes && mesValido(mes) ? mes : hojeBRT().slice(0, 7);
  const result = await listarResultadosClinica({ clinicaIdEsperada: context.clinicaId, mes: mesAtual, dentistaId: dentista ?? null });
  return <ResultadosClinicaClient key={`${context.clinicaId}:${mesAtual}:${dentista ?? ''}`} clinicaId={context.clinicaId} mesInicial={mesAtual} initialResult={result} />;
}
