export default function LoadingTeam() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground md:p-12" aria-busy="true" aria-label="Carregando equipe">
      <div className="mx-auto max-w-6xl space-y-6 motion-safe:animate-pulse" aria-hidden="true">
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="h-12 w-56 rounded bg-muted" />
        <div className="h-96 rounded-2xl border border-border bg-card" />
      </div>
    </main>
  );
}
