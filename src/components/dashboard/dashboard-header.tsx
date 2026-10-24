import { saudacaoBRT, dataExtensaBRT } from '@/lib/hora-brt';
import { DexDayButton } from './dex-day-button';

type AtendimentoDia = {
  id: string;
  data_hora: string;
  status: string;
  observacoes: string | null;
  paciente: { id: string; nome: string; observacoes: string | null } | null;
};

interface DashboardHeaderProps {
  nome: string;
  now: Date;
  atendimentos: AtendimentoDia[];
}

export function DashboardHeader({ nome, now, atendimentos }: DashboardHeaderProps) {
  // Remove prefixo "Dr."/"Dra." do nome cadastrado pra não duplicar ("Dr. Dr.").
  const primeiroNome = nome.replace(/^(dr\.?|dra\.?)\s*/i, '').trim().split(' ')[0] || nome;
  // BRT explícito: este componente é renderizado no servidor (dentista-dashboard não
  // é 'use client'), onde `getHours()` devolvia UTC — 9h virava "Boa tarde".
  const saudacao = saudacaoBRT(now);
  const dataFormatada = dataExtensaBRT(now);

  return (
    <header className="mb-6 flex items-end justify-between gap-4 max-[600px]:flex-col max-[600px]:items-start">
      <div className="min-w-0">
        <p className="mb-2 text-[12.5px] uppercase tracking-wider text-text-secondary">
          {dataFormatada}
        </p>
        <h1 className="font-heading text-[32px] font-normal leading-[1.15] text-text-primary">
          {saudacao}, Dr. {primeiroNome}.
        </h1>
      </div>
      {atendimentos.length > 0 && <div className="shrink-0 max-[600px]:w-full [&>button]:mt-0 [&>button]:h-10 [&>button]:rounded-[8px] [&>button]:border [&>button]:border-border [&>button]:px-[13px] [&>button]:text-[15px] [&>button]:text-text-secondary [&>button]:hover:bg-teal-pale [&>button]:hover:text-teal-ink [&>button]:focus-visible:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-teal/20 max-[600px]:[&>button]:w-full [&>button>span:first-child]:text-teal-ink">
        <DexDayButton atendimentos={atendimentos} dataHojeISO={now.toISOString()} />
      </div>}
    </header>
  );
}
