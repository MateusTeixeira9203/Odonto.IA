'use client';

const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const TOOTH_W: Record<number, string> = {
  1: 'w-6', 2: 'w-6', 3: 'w-6', 4: 'w-7', 5: 'w-7', 6: 'w-8', 7: 'w-8', 8: 'w-8',
};
const tw = (t: number) => TOOTH_W[t % 10] ?? 'w-7';

interface MiniOdontogramaProps {
  /** Dentes confirmados pelo dentista — cor teal */
  selected: number[];
  /** Dentes detectados pela IA ainda não confirmados — cor amber */
  aiDetected?: number[];
  onChange: (teeth: number[]) => void;
}

export function MiniOdontograma({ selected, aiDetected = [], onChange }: MiniOdontogramaProps) {
  const toggle = (t: number) => {
    if (selected.includes(t)) {
      onChange(selected.filter(x => x !== t));
    } else {
      onChange([...selected, t]);
    }
  };

  const getStyle = (t: number, isUpper: boolean): string => {
    const shape = isUpper
      ? 'rounded-t-md rounded-b-[2px]'
      : 'rounded-b-md rounded-t-[2px]';
    const base = `${tw(t)} h-8 ${shape} border text-[9px] font-mono font-bold transition-all hover:scale-105 active:scale-95`;
    const lift = isUpper ? '-translate-y-1' : 'translate-y-1';

    if (selected.includes(t)) {
      return `${base} bg-teal border-teal text-white ${lift} shadow-[0_3px_8px_rgba(47,156,133,0.4)]`;
    }
    if (aiDetected.includes(t)) {
      return `${base} bg-amber-500/10 border-amber-500 border-2 text-amber-600 dark:text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)] ${lift}`;
    }
    return `${base} bg-surface-alt border-border text-text-secondary hover:border-teal/50 hover:text-teal hover:bg-teal/5`;
  };

  const renderRow = (teeth: number[], isUpper: boolean) => (
    <div className={`flex justify-center ${isUpper ? 'items-end' : 'items-start'} gap-0.5`}>
      {teeth.map((t, i) => (
        <div key={t} className={`flex ${isUpper ? 'items-end' : 'items-start'}`}>
          {i === 8 && <div className="w-px h-6 bg-border mx-0.5 self-stretch" />}
          <button
            onClick={() => toggle(t)}
            title={
              selected.includes(t)
                ? `Dente ${t} — confirmado`
                : aiDetected.includes(t)
                  ? `Dente ${t} — detectado pela IA (clique para confirmar)`
                  : `Dente ${t}`
            }
            className={getStyle(t, isUpper)}
          >
            {t}
          </button>
        </div>
      ))}
    </div>
  );

  const pendingCount = aiDetected.filter(t => !selected.includes(t)).length;

  return (
    <div className="space-y-1">
      {renderRow(TEETH_UPPER, true)}
      <div className="h-px bg-border/60" />
      {renderRow(TEETH_LOWER, false)}
      {pendingCount > 0 && (
        <p className="text-[10px] text-amber-500 dark:text-amber-400 text-center mt-2 font-medium">
          {pendingCount} dente{pendingCount > 1 ? 's' : ''} detectado{pendingCount > 1 ? 's' : ''} pela IA — clique para confirmar
        </p>
      )}
    </div>
  );
}
