export function ClinicHubLoading(): React.JSX.Element {
  return (
    <div aria-busy="true" aria-label="Carregando seção do consultório" className="space-y-6 motion-reduce:animate-none">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-8 w-56 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />)}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" />
    </div>
  );
}
