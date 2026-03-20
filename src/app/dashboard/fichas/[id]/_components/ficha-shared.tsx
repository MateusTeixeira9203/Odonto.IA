export function FichaSectionLabel({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
      {children}
    </p>
  );
}

export function FichaWaveform(): React.JSX.Element {
  return (
    <div className="flex items-center gap-0.5">
      {[4, 7, 5, 8, 4, 6, 3].map((altura, index) => (
        <div
          key={index}
          className="w-0.5 rounded-full bg-teal animate-pulse"
          style={{ height: altura * 2 }}
        />
      ))}
    </div>
  );
}
