import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PacientesList } from './_components/pacientes-list';

export default function PacientesPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="font-heading text-4xl text-foreground mb-2">Pacientes</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Gerencie sua base de pacientes com elegância.
          </p>
        </div>
        <Link
          href="/dashboard/pacientes/novo"
          className="bg-teal text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-teal-lt transition-all shadow-lg self-start md:self-center"
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

function PacientesListSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="h-10 bg-muted rounded-xl animate-pulse w-64" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-6 py-4 border-b border-border flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-48" />
            <div className="h-3 bg-muted rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
