'use client';

// R-105a §4.3 — o último beat da primeira fase guiada (estado 7 do artefato
// `plans/artefatos/R-105-onboarding-primeira-fase.html`, v4). Aparece UMA vez, no lugar do
// bloco de fim de dia, logo depois que a primeira ficha do dentista foi salva.
//
// Duas coisas acontecem aqui, e a separação entre elas é contrato:
//
//   1. O RELÓGIO do trial é da Stripe (`STRIPE_BILLING_ENABLED`). Este componente
//      só INFORMA a data. Não existe botão "começar
//      meus 7 dias" de propósito: quem clicasse em "agora não" voltaria ao trial infinito de
//      hoje (`trial_ends_at` NULL) e o bug que este item conserta sobreviveria com outra roupa.
//
//   2. O PLANO é a única pergunta, e ela é operacional ("atendo sozinho" / "somos vários"),
//      não comercial ("escolha um plano"). É a única informação que o sistema não deduz, e o
//      dentista responde sem pensar. Grava por `definirPlano`, que já existe e já cuida do
//      `limite_dentistas`; o relógio do trial é da Stripe (`STRIPE_BILLING_ENABLED`).
//
// Só o admin monta este card (I4): quem entrou por convite não vê preço.

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { definirPlano, type PlanoClinica } from '@/app/onboarding/actions';
import { PLANOS } from '@/lib/planos';

interface AtivacaoCardProps {
  /** ISO do trial da Stripe (`STRIPE_BILLING_ENABLED`), gravado em `clinicas.trial_ends_at` —
   *  nunca recalculada aqui, senão o card e o banco podem divergir. */
  trialEndsAt: string;
  /** Plano provisório que `iniciarOnboarding` gravou (SOLO). Pré-marca a opção. */
  planoAtual: PlanoClinica;
}

const OPCOES: { id: PlanoClinica; pergunta: string; periodo: string }[] = [
  { id: 'SOLO',    pergunta: 'Atendo sozinho',        periodo: '/mês' },
  { id: 'CLINICA', pergunta: 'Somos vários dentistas', periodo: '/dentista/mês' },
];

/** "29 de agosto" — mesmo fuso que o resto do Meu dia usa. Sem o ano: o trial é de 7 dias,
 *  o ano nunca acrescenta informação e só alonga a frase (Krug, corte metade do texto). */
function dataCurtaBRT(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long',
  });
}

export function AtivacaoCard({ trialEndsAt, planoAtual }: AtivacaoCardProps) {
  const [escolhido, setEscolhido] = useState<PlanoClinica>(planoAtual);
  const [salvando, setSalvando] = useState<PlanoClinica | null>(null);

  async function escolher(plano: PlanoClinica) {
    if (salvando) return;
    const anterior = escolhido;
    setEscolhido(plano); // otimista — a escolha é reversível em Configurações → Plano
    setSalvando(plano);
    try {
      const { error } = await definirPlano(plano);
      if (error) {
        setEscolhido(anterior);
        toast.error('Não deu pra salvar o plano. Você pode escolher em Configurações → Plano.');
      }
    } catch {
      setEscolhido(anterior);
      toast.error('Falha de conexão. Você pode escolher em Configurações → Plano.');
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[640px] rounded-2xl border border-teal bg-surface p-6">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-teal text-white">
        <Check className="h-4 w-4 stroke-[3]" />
      </div>

      <p className="text-[17px] font-bold text-text-primary">
        Pronto. Essa ficha nasceu do que você falou.
      </p>

      <p className="mt-1.5 border-b border-border pb-4 text-[12.5px] leading-relaxed text-text-secondary">
        Seus <span className="font-bold text-teal-ink">7 dias de teste começaram agora</span> —
        terminam em {dataCurtaBRT(trialEndsAt)}. Você vai receber um aviso 2 dias antes.
      </p>

      <p className="mb-2.5 mt-4 text-[11.5px] font-bold text-text-primary">
        Uma pergunta só, pra cobrança fazer sentido:
      </p>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {OPCOES.map((op) => {
          const plano = PLANOS[op.id];
          const ativo = escolhido === op.id;
          return (
            <button
              key={op.id}
              type="button"
              aria-pressed={ativo}
              disabled={salvando != null}
              onClick={() => void escolher(op.id)}
              className={`rounded-xl border p-3.5 text-left transition-colors disabled:opacity-60 ${
                ativo ? 'border-teal bg-teal/[0.07]' : 'border-border hover:border-teal/50'
              }`}
            >
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-text-primary">
                {op.pergunta}
                {salvando === op.id && <Loader2 className="h-3 w-3 animate-spin" />}
              </p>
              <p className="mt-1.5 text-[10px] font-extrabold uppercase tracking-widest text-text-secondary">
                {plano.label}
              </p>
              {/* I9 — preço vem de lib/planos.ts, nunca literal aqui. */}
              <p className="mt-0.5 font-mono text-[15px] text-text-primary">
                R${plano.preco}
                <span className="ml-1 text-[10px] text-text-secondary">{op.periodo}</span>
              </p>
            </button>
          );
        })}
      </div>

      <p className="mt-3.5 text-[11px] leading-relaxed text-text-secondary">
        Dá pra trocar depois em Configurações → Plano. Nada é cobrado hoje.
      </p>
    </div>
  );
}
