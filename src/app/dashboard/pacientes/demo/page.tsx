/**
 * Página de demonstração — perfil demo do onboarding/tour (Workstream K · spec 3.3).
 * Rota estática `/dashboard/pacientes/demo` tem prioridade sobre o [id] dinâmico.
 *
 * Mostra o end-state da demo: a ficha enlatada (João Silva, coerente com a consulta demo)
 * morando no prontuário + o "Apresentar" em destaque (aha 2). Quando o demo veio do
 * onboarding (?onboarding=1), exibe o CTA pra voltar e terminar o cadastro (spec 3.1).
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { PacienteDetailClient } from '../[id]/_components/paciente-detail-client';
import type { Paciente } from '@/types/database';

const DEMO_PACIENTE: Omit<Paciente, 'clinica_id'> = {
  id: 'demo',
  dentista_id: null,
  nome: 'João Silva (Demonstração)',
  cpf: null,
  email: 'joao@exemplo.com',
  telefone: '(11) 99999-9999',
  data_nascimento: '1984-03-12',
  endereco: 'Rua das Flores, 123',
  cidade: 'São Paulo',
  estado: 'SP',
  whatsapp: null,
  observacoes: null,
  followup_pendente: false,
  followup_nota: null,
  followup_em: null,
  followup_snooze_ate: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Ficha enlatada — habilita o Apresentar do header e aparece na Atividade Recente (spec 3.3).
// O conteúdo completo da ficha no Prontuário vem do DEMO_EVOLUTION em FichasTab.
const DEMO_FICHAS_RECENTES = [{
  id: 'demo-ficha',
  created_at: new Date().toISOString(),
  queixa_principal: 'Dor ao mastigar no lado direito inferior',
  anotacoes: 'Restauração antiga com infiltração no dente 46. Sensibilidade ao frio.',
  dentista: { nome: 'Você' },
}];

export default async function PacienteDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string; from?: string }>;
}) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const { onboarding } = await searchParams;
  const veioDoOnboarding = onboarding === '1';

  const paciente: Paciente = {
    ...DEMO_PACIENTE,
    clinica_id: dentista.clinica_id,
  };

  return (
    <>
      {veioDoOnboarding && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/30 bg-teal/5 px-5 py-3.5">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">Modo demonstração.</span>{' '}
            Veja a ficha no prontuário e toque em <span className="font-semibold text-teal">Apresentar</span> pra ver o plano visual.
          </p>
          <Link
            href="/onboarding?step=plano"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white px-4 py-2 rounded-xl font-bold text-xs shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all shrink-0"
          >
            Continuar configuração
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
      <PacienteDetailClient
        paciente={paciente}
        agendamentoProximo={null}
        orcamentos={[]}
        fichasRecentesSSR={DEMO_FICHAS_RECENTES}
        clinicaId={dentista.clinica_id}
        dentistaId={dentista.id}
        role={dentista.role}
        plano={dentista.plano}
      />
    </>
  );
}
