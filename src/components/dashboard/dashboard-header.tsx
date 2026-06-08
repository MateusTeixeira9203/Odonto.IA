import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

function getHoraSaudacao(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function DashboardHeader({ nome, now, atendimentos }: DashboardHeaderProps) {
  const primeiroNome = nome.split(' ')[0];
  const saudacao = getHoraSaudacao(now);
  const dataFormatada = format(now, "EEEE, dd 'de' MMMM", { locale: ptBR });

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
