import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PacientesList } from "./_components/pacientes-list";
import { PacientesListSkeleton } from "./_components/pacientes-list-skeleton";

export default function PacientesPage(): React.JSX.Element {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl tracking-tight text-foreground">
            Pacientes
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            Gerencie seus pacientes
          </p>
        </div>
        <Link
          href="/dashboard/pacientes/novo"
          className="inline-flex items-center gap-2 h-11 px-5 bg-primary text-primary-foreground font-sans font-medium text-sm rounded-xl hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Novo paciente
        </Link>
      </div>

      <Suspense fallback={<PacientesListSkeleton />}>
        <PacientesList />
      </Suspense>
    </div>
  );
}
