/**
 * Página de demonstração — usada exclusivamente pelo tour DEX (step FICHA_AHA).
 * Rota estática `/dashboard/pacientes/demo` tem prioridade sobre o [id] dinâmico,
 * evitando o notFound() que crashava durante a apresentação do assistente.
 *
 * Renderiza o PacienteDetailClient com dados mockados para que o tour possa
 * destacar o painel de evolução clínica sem precisar de um paciente real.
 */
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { PacienteDetailClient } from '../[id]/_components/paciente-detail-client';
import type { Paciente } from '@/types/database';

const DEMO_PACIENTE: Omit<Paciente, 'clinica_id'> = {
  id: 'demo',
  dentista_id: null,
  nome: 'Maria da Silva (Demonstração)',
  cpf: null,
  email: 'maria@exemplo.com',
  telefone: '(11) 99999-9999',
  data_nascimento: '1990-05-20',
  endereco: 'Rua das Flores, 123',
  cidade: 'São Paulo',
  estado: 'SP',
  whatsapp: null,
  observacoes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default async function PacienteDemoPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const paciente: Paciente = {
    ...DEMO_PACIENTE,
    clinica_id: dentista.clinica_id,
  };

  return (
    <PacienteDetailClient
      paciente={paciente}
      agendamentoProximo={null}
      orcamentos={[]}
      clinicaId={dentista.clinica_id}
      dentistaId={dentista.id}
      role={dentista.role}
      plano={dentista.plano}
    />
  );
}
