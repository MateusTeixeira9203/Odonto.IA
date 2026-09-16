import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { PacientesTable } from '@/components/pacientes/pacientes-table';
import { normalizarNome } from '@/lib/normalizar-nome';

export const PAGE_SIZE = 25;

const VALID_SORT_COLS = ['nome', 'created_at'] as const;
type SortCol = (typeof VALID_SORT_COLS)[number];

interface PacientesListProps {
  canCreate: boolean;
  canOpenDetail?: boolean;
  /** Contexto operacional já resolve a clínica, sem fabricar um perfil dentista. */
  clinicaId?: string;
  params: {
    q?: string;
    sort?: string;
    order?: string;
    page?: string;
  };
}

export async function PacientesList({ canCreate, canOpenDetail = true, clinicaId, params }: PacientesListProps) {
  const dentista = clinicaId ? null : await getDentistaCached();
  if (!clinicaId && !dentista) redirect('/login');
  const activeClinicaId = clinicaId ?? dentista!.clinica_id;

  const supabase = await createClient();

  const q = params.q?.trim() ?? '';
  const sortCol: SortCol = VALID_SORT_COLS.includes(params.sort as SortCol)
    ? (params.sort as SortCol)
    : 'nome';
  const sortAsc = params.order !== 'desc';
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // R-29 — paciente é da clínica, todo dentista vê todos (decisão do Mateus 29/07).
  // Sem filtro por dentista_id: a RLS de pacientes já libera a clínica inteira, e um
  // filtro extra aqui só criava divergência entre a lista (vazia) e a URL direta (abre).
  let query = supabase
    .from('pacientes')
    .select(
      `id, nome, email, telefone, created_at, data_nascimento,
       followup_pendente, dentista:dentistas(nome)`,
      { count: 'exact' },
    )
    .eq('clinica_id', activeClinicaId);

  if (q) {
    // R-31a §3.3 — nome_busca é insensível a acento; email/telefone continuam como antes.
    query = query.or(
      `nome_busca.ilike.%${normalizarNome(q)}%,email.ilike.%${q}%,telefone.ilike.%${q}%`,
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
      canOpenDetail={canOpenDetail}
      currentParams={{
        q,
        sort: sortCol,
        order: sortAsc ? 'asc' : 'desc',
        page,
      }}
    />
  );
}
