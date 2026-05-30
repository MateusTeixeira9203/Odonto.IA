"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { OdontoIALogo } from "@/components/ui/dent-ia-logo";

const redefinirSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type RedefinirFormData = z.infer<typeof redefinirSchema>;
type PageState = "loading" | "form" | "expired" | "success";

export default function RedefinirSenhaPage(): React.JSX.Element {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RedefinirFormData>({
    resolver: zodResolver(redefinirSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Aguarda o Supabase processar o token de recuperação; detecta link expirado após 3s
  useEffect(() => {
    const supabase = createClient();
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setPageState("expired");
      }
    }, 3000);

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        setPageState("form");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        setPageState("form");
      }
    });

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(data: RedefinirFormData): Promise<void> {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setPageState("success");
      setTimeout(() => {
        toast.success("Senha redefinida com sucesso! Faça login para continuar.");
        router.push("/login");
        router.refresh();
      }, 2000);
    } catch {
      toast.error("Erro ao redefinir senha. Tente novamente.");
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
          <h1 className="font-heading font-bold text-4xl text-text-primary mb-2">Nova senha</h1>
          <p className="text-text-secondary text-sm font-medium">
            Escolha uma senha segura com pelo menos 8 caracteres.
          </p>
        </div>

        <div className="bg-surface p-8 rounded-3xl border border-border shadow-sm">
          <AnimatePresence mode="wait">
            {pageState === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 py-2"
              >
                <div className="h-11 rounded-xl bg-surface-alt animate-pulse" />
                <div className="h-11 rounded-xl bg-surface-alt animate-pulse" />
                <div className="h-12 rounded-xl bg-surface-alt animate-pulse" />
              </motion.div>
            )}

            {pageState === "expired" && (
              <motion.div
                key="expired"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-coral/10 text-coral mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="font-heading font-semibold text-2xl text-text-primary mb-2">Link Expirado</h3>
                <p className="text-sm text-text-secondary mb-6">
                  Este link expirou ou já foi utilizado. Solicite um novo para continuar.
                </p>
                <Link
                  href="/esqueci-senha"
                  className="w-full bg-teal hover:bg-teal-dark text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  style={{ boxShadow: "0 10px 30px -10px rgba(47, 156, 133, 0.4)" }}
                >
                  Solicitar novo link
                </Link>
                <div className="mt-4">
                  <Link
                    href="/login"
                    className="text-sm text-text-secondary font-semibold hover:text-text-primary transition-colors"
                  >
                    Voltar para o Login
                  </Link>
                </div>
              </motion.div>
            )}

            {pageState === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-pale text-teal mb-4"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </motion.div>
                <h3 className="font-heading font-semibold text-2xl text-text-primary mb-2">Senha atualizada!</h3>
                <p className="text-sm text-text-secondary">
                  Redirecionando para o login...
                </p>
              </motion.div>
            )}

            {pageState === "form" && (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <div>
                  <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      disabled={isLoading}
                      placeholder="Mínimo 8 caracteres"
                      className="bg-surface-alt border border-border rounded-xl px-4 py-3 pr-11 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all placeholder:text-text-secondary"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      disabled={isLoading}
                      placeholder="Repita a nova senha"
                      className="bg-surface-alt border border-border rounded-xl px-4 py-3 pr-11 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all"
                      {...register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-teal text-white rounded-xl font-bold py-3.5 w-full hover:bg-teal-dark transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ boxShadow: "0 10px 30px -10px rgba(47, 156, 133, 0.4)" }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar nova senha"
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
