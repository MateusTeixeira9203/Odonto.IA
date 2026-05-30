export default function AgendamentosLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div className="space-y-2.5">
          <div className="h-2.5 w-20 bg-surface-alt animate-pulse rounded-full" />
          <div className="h-9 w-52 bg-surface-alt animate-pulse rounded-xl" />
          <div className="h-4 w-72 bg-surface-alt animate-pulse rounded-lg" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-9 w-32 bg-surface-alt animate-pulse rounded-xl" />
          <div className="h-9 w-24 bg-surface-alt animate-pulse rounded-xl" />
          <div className="h-9 w-40 bg-surface-alt animate-pulse rounded-xl" />
        </div>
      </div>

      {/* Day view skeleton */}
      <div
        className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden"
        style={{ height: '680px' }}
      >
        {/* Nav header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-alt/40">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-surface-alt animate-pulse" />
            <div className="h-5 w-44 bg-surface-alt animate-pulse rounded-lg" />
            <div className="w-7 h-7 rounded-lg bg-surface-alt animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-20 bg-surface-alt animate-pulse rounded-lg" />
            <div className="h-8 w-14 bg-surface-alt animate-pulse rounded-lg" />
          </div>
        </div>

        {/* Time grid skeleton */}
        <div className="flex h-[calc(100%-56px)]">
          {/* Time gutter */}
          <div className="w-16 shrink-0 border-r border-border/40 pt-5 space-y-[44px] px-3">
            {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => (
              <div key={h} className="h-3 w-8 bg-surface-alt animate-pulse rounded-full ml-auto opacity-60" />
            ))}
          </div>

          {/* Day column */}
          <div className="flex-1 relative overflow-hidden pt-5 px-3 space-y-[44px]">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div
                key={i}
                className="h-px w-full bg-border/30"
              />
            ))}
            {/* Appointment placeholders */}
            <div
              className="absolute left-3 right-3 rounded-xl bg-teal/8 border border-teal/15 animate-pulse"
              style={{ top: '76px', height: '64px' }}
            />
            <div
              className="absolute left-3 right-3 rounded-xl bg-surface-alt animate-pulse"
              style={{ top: '220px', height: '48px', opacity: 0.7 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
