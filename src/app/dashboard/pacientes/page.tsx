import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PacientesList } from './_components/pacientes-list';
import { PacientesListSkeleton } from './_components/pacientes-list-skeleton';

export default function PacientesPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto w-full animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="font-serif text-4xl text-text-primary mb-2">Pacientes</h1>
          <p className="text-text-secondary text-sm font-medium">Gerencie sua base de pacientes.</p>
        </div>
        <Link
          href="/dashboard/pacientes/novo"
          className="bg-teal text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-teal-dark transition-all shadow-lg self-start md:self-center premium-shadow"
        >
          <Plus className="w-4 h-4" />
          Novo Paciente
        </Link>
      </header>

      <Suspense fallback={<PacientesListSkeleton />}>
        <PacientesList />
      </Suspense>
    </div>
  );
}
