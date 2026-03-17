import Link from "next/link";
import { Plus, FileText } from "lucide-react";

export default function FichasPage(): React.JSX.Element {
  return (
    <div className="animate-fade-in space-y-8">
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl tracking-tight text-foreground">
            Fichas Clínicas
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            Fichas clínicas dos pacientes
          </p>
        </div>
        <Link
          href="/dashboard/fichas/nova"
          className="inline-flex items-center gap-2 h-11 px-5 bg-primary text-primary-foreground font-sans font-medium text-sm rounded-xl hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Nova Ficha
        </Link>
      </div>

      {/* Estado vazio */}
      <div className="bg-card border border-border rounded-2xl">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-5">
            <FileText className="w-9 h-9 text-muted-foreground/40" />
          </div>
          <h3 className="font-serif text-xl text-foreground mb-2">Nenhuma ficha ainda</h3>
          <p className="font-sans text-sm text-muted-foreground mb-7 text-center max-w-sm">
            Crie fichas clínicas para registrar o histórico dos seus pacientes
          </p>
          <Link
            href="/dashboard/fichas/nova"
            className="inline-flex items-center gap-2 h-11 px-5 bg-primary text-primary-foreground font-sans font-medium text-sm rounded-xl hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nova Ficha
          </Link>
        </div>
      </div>
    </div>
  );
}
