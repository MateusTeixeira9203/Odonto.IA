"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasDentistaRegistro } from "@/lib/auth";
import { toast } from "sonner";
import { DentIALogo } from "@/components/ui/dent-ia-logo";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginFormContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleGoogleLogin = async (): Promise<void> => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  async function onSubmit(data: LoginFormData): Promise<void> {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(
          error.message.includes("Invalid login credentials")
            ? "Email ou senha incorretos. Verifique e tente novamente."
            : error.message
        );
        return;
      }

      if (authData.session) {
        const temDentista = await hasDentistaRegistro(supabase);
        toast.success("Login realizado com sucesso!");
        router.push(temDentista ? redirectTo : "/onboarding");
        router.refresh();
      }
    } catch {
      toast.error("Erro ao fazer login");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex flex-col items-center justify-center w-1/2 min-h-screen bg-teal dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <DentIALogo className="w-12 h-12 text-white" />
            <span className="font-heading text-3xl text-white tracking-widest">DENT <em className="font-serif">IA</em></span>
          </div>
          <p className="font-serif text-2xl text-white text-center italic px-12">
            Do atendimento ao orçamento, em segundos.
          </p>
        </div>
      </div>
      <div className="flex-1 bg-bg dark:bg-zinc-950 flex flex-col items-center justify-center min-h-screen px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <h1 className="font-serif text-4xl text-text-primary dark:text-white mb-2">Bem-vindo de volta</h1>
          <p className="text-text-secondary dark:text-zinc-400 text-sm font-medium mb-8">Acesse sua conta para gerenciar sua clínica.</p>

          <div className="bg-surface dark:bg-zinc-900 rounded-3xl border border-border dark:border-zinc-800 shadow-sm p-8 w-full max-w-md">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block font-mono text-xs text-text-secondary dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  disabled={isLoading}
                  placeholder="seu@email.com"
                  className="bg-surface-alt dark:bg-zinc-800 border border-border dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-text-primary dark:text-white w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all placeholder:text-text-secondary"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-mono text-xs text-text-secondary dark:text-zinc-400 uppercase tracking-widest">
                    Senha
                  </label>
                  <Link
                    href="/esqueci-senha"
                    className="text-xs font-semibold text-teal hover:text-teal-dark transition-colors"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <input
                  type="password"
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="bg-surface-alt dark:bg-zinc-800 border border-border dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-text-primary dark:text-white w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="bg-teal text-white rounded-xl font-bold py-3 w-full hover:bg-teal-dark transition-all mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ boxShadow: "0 10px 30px -10px rgba(47, 156, 133, 0.4)" }}
              >
                {isLoading ? "Entrando..." : (
                  <>Entrar <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface dark:bg-zinc-900 px-2 text-text-secondary dark:text-zinc-500 font-mono">ou</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="bg-surface dark:bg-zinc-800 border border-border dark:border-zinc-700 rounded-xl py-3 w-full flex items-center justify-center gap-3 text-sm font-medium text-text-primary dark:text-white hover:bg-surface-alt dark:hover:bg-zinc-700 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm text-text-secondary dark:text-zinc-400">
                Não tem uma conta?{" "}
                <Link href="/cadastro" className="text-teal font-semibold hover:text-teal-dark transition-colors">
                  Cadastre-se
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-4">
            <div className="h-12 rounded-xl bg-surface-alt animate-pulse" />
            <div className="h-11 rounded-xl bg-surface-alt animate-pulse" />
            <div className="h-11 rounded-xl bg-surface-alt animate-pulse" />
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
