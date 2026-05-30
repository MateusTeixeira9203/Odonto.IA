import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PacientesList } from './_components/pacientes-list';
import { PageTransition } from '@/components/layout/page-transition';
import { getDentistaCached } from '@/lib/get-dentista';

interface PacientesPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    order?: string;
    page?: string;
  }>;
}

export default async function PacientesPage({ searchParams }: PacientesPageProps) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Solo/Clinica: dentista cria. Secretária: cria em nome do dentista. BASICO dentista: leitura.
  const canCreate =
    dentista.plano === 'SOLO' ||
    dentista.plano === 'CLINICA' ||
    dentista.role === 'secretaria';

  const params = await searchParams;

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary mb-1">Pacientes</h1>
            <p className="text-text-secondary text-sm font-medium">
              Gerencie sua base de pacientes com elegância.
            </p>
          </div>
          {canCreate && (
            <Link
              href="/dashboard/pacientes/novo"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl
                         text-[15px] font-bold text-white
                         hover:-translate-y-0.5 active:scale-[0.98] transition-all
                         self-start md:self-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #2f9c85 0%, #1d7a65 100%)',
                boxShadow:
                  '0 8px 32px rgba(47,156,133,0.38), inset 0 1px 0 rgba(255,255,255,0.14)',
              }}
            >
              <Plus className="w-4 h-4" />
              Novo Paciente
            </Link>
          )}
        </header>

        <Suspense fallback={<PacientesListSkeleton />}>
          <PacientesList canCreate={canCreate} params={params} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

function PacientesListSkeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border bg-surface-alt/50">
        <div className="h-10 skeleton-teal rounded-xl w-72 animate-pulse" />
      </div>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="px-6 py-4 border-b border-border flex items-center gap-4 animate-pulse"
        >
          <div className="w-10 h-10 rounded-xl skeleton-teal shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 skeleton-teal rounded-lg w-48" />
            <div className="h-3 skeleton-teal rounded-lg w-24" />
          </div>
          <div className="hidden lg:block h-3 skeleton-teal rounded-lg w-20" />
          <div className="h-3 skeleton-teal rounded-lg w-16" />
        </div>
      ))}
    </div>
  );
}
