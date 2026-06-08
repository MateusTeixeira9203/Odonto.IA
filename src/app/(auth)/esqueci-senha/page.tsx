"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { ArrowLeft, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { OdontoIALogo } from "@/components/ui/dent-ia-logo";

const esqueciSchema = z.object({
  email: z.string().email("Email inválido"),
});

type EsqueciFormData = z.infer<typeof esqueciSchema>;

export default function EsqueciSenhaPage(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EsqueciFormData>({
    resolver: zodResolver(esqueciSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: EsqueciFormData): Promise<void> {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/redefinir-senha`;

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo });

      if (error) {
        toast.error(error.message);
        return;
      }

      setEmailEnviado(data.email);
      setEnviado(true);
    } catch {
      toast.error("Erro ao enviar o email. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

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
          <h1 className="font-heading text-4xl text-text-primary mb-2">Recuperar Senha</h1>
          <p className="text-text-secondary text-sm font-medium">
            Enviaremos um link para você criar uma nova senha. Verifique também a pasta de spam.
          </p>
        </div>

        <div className="bg-surface p-8 rounded-3xl border border-border shadow-sm">
          {enviado ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-pale text-teal mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-heading text-2xl text-text-primary mb-2">E-mail Enviado!</h3>
              <p className="text-sm text-text-secondary mb-2">
                Enviamos as instruções para <strong>{emailEnviado}</strong>.
              </p>
              <p className="text-xs text-text-secondary mb-6">
                Não encontrou? Verifique a pasta de spam ou lixo eletrônico.
              </p>
              <Link
                href="/login"
                className="w-full bg-teal text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-teal-dark"
              >
                Voltar para o Login
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-text-secondary" />
                  </div>
                  <input
                    type="email"
                    disabled={isLoading}
                    placeholder="seu@email.com"
                    className="w-full pl-11 pr-4 py-3 bg-surface-alt border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all text-text-primary placeholder:text-text-secondary"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-coral">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-teal hover:bg-teal-dark text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Link de Recuperação"
                )}
              </button>
            </form>
          )}

          {!enviado && (
            <div className="mt-8 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-text-secondary font-semibold hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o Login
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
