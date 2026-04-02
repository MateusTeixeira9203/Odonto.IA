import { redirect } from 'next/navigation';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { isGoogleCalendarConnected } from '@/lib/calendar/google-provider';
import { AgendamentosClient } from './_components/agendamentos-client';

export type AgendamentoRow = {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  observacoes: string | null;
  created_at: string;
  paciente: { id: string; nome: string } | null;
  dentista: { id: string; nome: string } | null;
};

interface PageProps {
  searchParams: Promise<{ mes?: string }>;
}

export default async function AgendamentosPage({ searchParams }: PageProps) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Determinar o mês sendo visualizado (default: mês atual)
  const { mes } = await searchParams;
  const mesDate =
    mes && /^\d{4}-\d{2}$/.test(mes) ? parseISO(`${mes}-01`) : new Date();
  const mesAtual = format(mesDate, 'yyyy-MM');
  const inicioMes = startOfMonth(mesDate).toISOString();
  const fimMes = endOfMonth(mesDate).toISOString();

  const supabase = await createClient();
  const isSecretaria = dentista.role === 'secretaria';

  // Secretária: vê todos os agendamentos da clínica
  // Dentista/admin: vê apenas seus próprios
  // Ambos: filtrado pelo mês selecionado
  const query = supabase
    .from('agendamentos')
    .select(
      'id, clinica_id, paciente_id, dentista_id, data_hora, duracao_minutos, status, observacoes, created_at, paciente:pacientes(id, nome), dentista:dentistas(id, nome)'
    )
    .eq('clinica_id', dentista.clinica_id)
    .gte('data_hora', inicioMes)
    .lte('data_hora', fimMes)
    .order('data_hora', { ascending: true });

  if (!isSecretaria) {
    query.eq('dentista_id', dentista.id);
  }

  const [{ data: agendamentosRaw }, calendarConnected] = await Promise.all([
    query,
    // Secretária não tem calendário próprio — mostrar botão apenas para dentistas
    isSecretaria ? Promise.resolve(false) : isGoogleCalendarConnected(dentista.id),
  ]);

  // Lista de dentistas da clínica (apenas para secretária montar o filtro/form)
  let dentistasClinica: { id: string; nome: string }[] = [];
  if (isSecretaria) {
    const { data } = await supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', dentista.clinica_id)
      .neq('role', 'secretaria')
      .eq('ativo', true)
      .order('nome', { ascending: true });
    dentistasClinica = data ?? [];
  }

  return (
    // key={mesAtual} força remount ao trocar de mês — estado do cliente reseta
    // e useState(inicial) recebe os novos agendamentos do servidor
    <AgendamentosClient
      key={mesAtual}
      agendamentos={(agendamentosRaw ?? []) as unknown as AgendamentoRow[]}
      clinicaId={dentista.clinica_id}
      role={dentista.role}
      dentistaAtualId={dentista.id}
      dentistas={dentistasClinica}
      calendarConnected={calendarConnected}
      mesAtual={mesAtual}
    />
  );
}
