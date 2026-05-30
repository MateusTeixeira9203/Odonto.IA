import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardHeaderProps {
  nome: string;
  totalHoje: number;
  proximoAtendimento: { data_hora: string } | null;
  now: Date;
}

function getHoraSaudacao(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getSubtitulo(
  totalHoje: number,
  proximoAtendimento: { data_hora: string } | null,
): string {
  if (totalHoje === 0) {
    return 'Você não possui atendimentos agendados hoje.';
  }
  if (proximoAtendimento) {
    const hora = format(parseISO(proximoAtendimento.data_hora), 'HH:mm');
    return `Hoje você tem ${totalHoje} atendimento${totalHoje !== 1 ? 's' : ''}. Próximo: às ${hora}.`;
  }
  return 'Todos os atendimentos de hoje foram concluídos.';
}

export function DashboardHeader({
  nome,
  totalHoje,
  proximoAtendimento,
  now,
}: DashboardHeaderProps) {
  const primeiroNome = nome.split(' ')[0];
  const saudacao = getHoraSaudacao(now);
  const subtitulo = getSubtitulo(totalHoje, proximoAtendimento);
  const dataFormatada = format(now, "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="mb-8 md:mb-10">
      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-2 font-mono capitalize">
        {dataFormatada}
      </p>
      <h1 className="font-heading font-bold text-4xl md:text-5xl text-text-primary tracking-tight">
        {saudacao}, Dr. {primeiroNome}.
      </h1>
      <p className="text-text-secondary text-base font-medium mt-2">{subtitulo}</p>
    </div>
  );
}
