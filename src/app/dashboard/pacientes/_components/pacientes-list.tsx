import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { PacientesTable } from '@/components/pacientes/pacientes-table';

export const PAGE_SIZE = 25;

const VALID_SORT_COLS = ['nome', 'created_at'] as const;
type SortCol = (typeof VALID_SORT_COLS)[number];

interface PacientesListProps {
  canCreate: boolean;
  params: {
    q?: string;
    sort?: string;
    order?: string;
    page?: string;
  };
}

export async function PacientesList({ canCreate, params }: PacientesListProps) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  const q = params.q?.trim() ?? '';
  const sortCol: SortCol = VALID_SORT_COLS.includes(params.sort as SortCol)
    ? (params.sort as SortCol)
    : 'nome';
  const sortAsc = params.order !== 'desc';
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Dentista vê apenas os seus pacientes. Admin e secretária vêem todos da clínica.
  const isDentista = dentista.role === 'dentista';

  let query = supabase
    .from('pacientes')
    .select(
      `id, nome, email, telefone, created_at, data_nascimento,
       followup_pendente, dentista:dentistas(nome)`,
      { count: 'exact' },
    )
    .eq('clinica_id', dentista.clinica_id);

  if (isDentista) {
    // Filtro estrito: Dentistas convidados veem apenas os próprios pacientes
    query = query.eq('dentista_id', dentista.id);
  }

  if (q) {
    query = query.or(
      `nome.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%`,
    );
  }

  const { data: pacientes, count } = await query
    .order(sortCol, { ascending: sortAsc })
    .range(from, to);

  return (
    <PacientesTable
      pacientes={pacientes ?? []}
      total={count ?? 0}
      canCreate={canCreate}
      currentParams={{
        q,
        sort: sortCol,
        order: sortAsc ? 'asc' : 'desc',
        page,
      }}
    />
  );
}
