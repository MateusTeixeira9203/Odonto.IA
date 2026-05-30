"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { OdontoIALogo } from "@/components/ui/dent-ia-logo";

export default function EmailConfirmadoPage(): React.JSX.Element {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal text-white mb-4 shadow-lg">
            <OdontoIALogo className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-surface p-8 rounded-3xl border border-border shadow-sm text-center">
          {/* Ícone animado */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal-pale text-teal mb-6"
          >
            <CheckCircle2 className="w-10 h-10" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="font-heading text-3xl text-text-primary mb-3">
              Email confirmado!
            </h1>
            <p className="text-text-secondary text-sm font-medium mb-8 leading-relaxed">
              Sua conta foi ativada com sucesso. Agora você pode acessar o Odonto.IA e começar a
              configurar sua clínica.
            </p>

            <Link
              href="/onboarding"
              className="w-full bg-teal text-white rounded-xl font-bold py-3.5 flex items-center justify-center gap-2 hover:bg-teal-dark transition-all"
              style={{ boxShadow: "0 10px 30px -10px rgba(47, 156, 133, 0.4)" }}
            >
              Configurar minha clínica
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="mt-4">
              <Link
                href="/login"
                className="text-sm text-text-secondary font-semibold hover:text-text-primary transition-colors"
              >
                Já tenho conta configurada — Fazer login
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
