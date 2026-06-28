import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { ConsultaClient } from '../[agendamentoId]/_components/consulta-client';

export default async function ConsultaDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const { from } = await searchParams;

  return (
    <ConsultaClient
      isDemo
      retornoOnboarding={from === 'onboarding'}
      dentistaFoco={dentista.foco_principal}
      dentistaId={dentista.id}
      agendamentoId="demo"
      paciente={{
        id: 'demo',
        nome: 'João Silva (Demonstração)',
        idadeStr: '42 anos',
        observacoes: null,
      }}
      hora="09:00"
      observacoesAgendamento="Paciente relata dor ao mastigar no lado direito inferior."
      ultimaQueixa="Dor no molar inferior direito — última consulta há 3 meses"
      ultimasAnotacoes="Restauração de compósito no dente 46. Orientado sobre higiene interdental."
      fichas={[{
        data: '10/03/2026',
        queixa: 'Dor ao morder no lado direito',
        anotacoes: 'Restauração de compósito no dente 46. Boa adaptação.',
        dentes: [46],
        procedimentos: ['Restauração de compósito'],
      }]}
      orcamentos={[]}
      agendamentoStatus="scheduled"
      alertasClinicos={[]}
      procedimentosClinica={[]}
      planejamento={null}
    />
  );
}
