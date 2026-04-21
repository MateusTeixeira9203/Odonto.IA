'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface Props {
  clinicaNome: string;
}

export function WelcomeModal({ clinicaNome }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  // Só exibe se ?welcome=true estiver na URL e não tiver sido fechado
  const open = searchParams.get('welcome') === 'true' && !dismissed;

  function handleClose() {
    setDismissed(true);
    // Remove o parâmetro da URL sem recarregar a página
    router.replace('/dashboard');
    // Sinaliza ao DEX que o modal foi dispensado — ele aguarda este evento
    // antes de iniciar o tour quando ?welcome=true está na URL
    window.dispatchEvent(new Event('welcome-modal-dismissed'));
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay — clicável para fechar */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div
              className="pointer-events-auto bg-surface rounded-3xl shadow-2xl p-10 max-w-md w-full text-center"
              style={{ boxShadow: '0 24px 64px -16px rgba(47,156,133,0.25)' }}
            >
              {/* Ícone decorativo */}
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-teal/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-teal" />
                </div>
              </div>

              <h2 className="font-serif text-2xl text-text-primary mb-2">
                Bem-vindo(a) à
              </h2>
              <h3 className="font-serif text-3xl text-teal font-semibold mb-4">
                {clinicaNome}
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed mb-8">
                Você já faz parte da equipe. Explore o painel para gerenciar
                pacientes, agendamentos e muito mais.
              </p>

              <button
                onClick={handleClose}
                className="w-full bg-teal hover:bg-teal-dark text-white font-semibold py-3 rounded-xl transition-all"
                style={{ boxShadow: '0 10px 30px -10px rgba(47,156,133,0.4)' }}
              >
                Começar a usar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
