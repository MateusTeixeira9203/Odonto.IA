import { notFound, redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { getPatientWorkspaceData } from '@/server/patients/get-patient-workspace-data';
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

  return (
    <PacienteDetailClient
      paciente={data.paciente}
      agendamentoProximo={data.agendamentoProximo}
      orcamentos={data.orcamentos}
      fichasRecentesSSR={data.fichasRecentes}
      timeline={data.timeline}
      clinicaId={dentista.clinica_id}
      dentistaId={dentista.id}
      role={dentista.role}
      plano={dentista.plano}
    />
  );
}
