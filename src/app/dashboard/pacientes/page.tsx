import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PacientesList } from './_components/pacientes-list';
import { PageTransition } from '@/components/layout/page-transition';
import { getDentistaCached } from '@/lib/get-dentista';

export default async function PacientesPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Solo/Clinica: dentista cria. Secretária: cria em nome do dentista. BASICO dentista: leitura.
  const canCreate = dentista.plano === 'SOLO' || dentista.plano === 'CLINICA' || dentista.role === 'secretaria';

  return (
    <PageTransition>
      <div className="p-8 max-w-7xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="font-heading text-4xl text-text-primary mb-2">Pacientes</h1>
            <p className="text-text-secondary text-sm font-medium">
              Gerencie sua base de pacientes com elegância.
            </p>
          </div>
          {canCreate && (
            <Link
              href="/dashboard/pacientes/novo"
              className="bg-teal text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-teal-lt transition-all shadow-lg self-start md:self-center btn-scale"
              style={{ boxShadow: '0 8px 24px -8px rgba(47,156,133,0.4)' }}
            >
              <Plus className="w-4 h-4" />
              Novo Paciente
            </Link>
          )}
        </header>

        <Suspense fallback={<PacientesListSkeleton />}>
          <PacientesList canCreate={canCreate} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

function PacientesListSkeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
      <div className="p-4 border-b border-border bg-surface-alt/50">
        <div className="h-10 skeleton-teal rounded-xl w-64" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-6 py-4 border-b border-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl skeleton-teal shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 skeleton-teal rounded-lg w-48" />
            <div className="h-3 skeleton-teal rounded-lg w-24" />
          </div>
          <div className="h-3 skeleton-teal rounded-lg w-16" />
        </div>
      ))}
    </div>
  );
}
