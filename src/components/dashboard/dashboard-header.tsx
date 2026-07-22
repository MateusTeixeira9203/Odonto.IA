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
    <div className="mb-8 md:mb-10">
      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-2 font-mono capitalize">
        {dataFormatada}
      </p>
      <h1 className="font-heading font-bold text-4xl md:text-5xl text-text-primary tracking-tight">
        {saudacao}, Dr. {primeiroNome}.
      </h1>
      <DexDayButton atendimentos={atendimentos} dataHojeISO={now.toISOString()} />
    </div>
  );
}
