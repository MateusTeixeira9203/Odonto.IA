import { notFound, redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { getPatientWorkspaceData } from '@/server/patients/get-patient-workspace-data';
import { getProntuarioLongitudinal } from '@/server/patients/get-prontuario-longitudinal';
import { PacienteDetailClient } from './_components/paciente-detail-client';

export default async function PacienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const data = await getPatientWorkspaceData({
    patientId: id,
    clinicId: dentista.clinica_id,
    role: dentista.role,
  });

  if (!data) notFound();

  const prontuario = dentista.role === 'admin' || dentista.role === 'dentista'
    ? await getProntuarioLongitudinal({ patientId: id, clinicId: dentista.clinica_id })
    : undefined;

  return (
    <PacienteDetailClient
      paciente={data.paciente}
      agendamentoProximo={data.agendamentoProximo}
      orcamentos={data.orcamentos}
      orcamentosAviso={data.orcamentosAviso}
      fichasRecentesSSR={data.fichasRecentes}
      timeline={data.timeline}
      prontuario={prontuario}
      clinicaId={dentista.clinica_id}
      dentistaId={dentista.id}
      role={dentista.role}
      plano={dentista.plano}
    />
  );
}
