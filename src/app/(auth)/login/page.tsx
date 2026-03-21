"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { ArrowRight, Mail, Lock, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasDentistaRegistro } from "@/lib/auth";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm(): React.JSX.Element {
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
      <div className="hidden md:flex md:w-1/2 bg-teal flex-col items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 mb-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-heading text-5xl text-white mb-4">DentAI</h2>
          <p className="text-white/80 text-lg font-medium max-w-xs">
            Gestão inteligente para sua clínica odontológica.
          </p>
        </div>
      </div>
      <div className="w-full md:w-1/2 bg-bg flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal text-white mb-4 shadow-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="font-heading text-4xl text-text-primary mb-2">Bem-vindo de volta</h1>
          <p className="text-text-secondary text-sm font-medium">Acesse sua conta para gerenciar sua clínica.</p>
        </div>

        <div className="bg-surface p-8 rounded-3xl border border-border shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest mb-2">
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
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                  Senha
                </label>
                <Link
                  href="/esqueci-senha"
                  className="text-xs font-semibold text-teal hover:text-teal-dark transition-colors"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-text-secondary" />
                </div>
                <input
                  type="password"
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-surface-alt border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all text-text-primary"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md mt-2 disabled:opacity-60"
            >
              {isLoading ? "Entrando..." : (
                <>Entrar <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface px-2 text-text-secondary">ou</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-surface border border-border rounded-xl py-3 text-sm font-medium text-text-primary flex items-center justify-center gap-3 hover:bg-surface-alt transition-colors"
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
            <p className="text-sm text-text-secondary font-medium">
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
      <LoginForm />
    </Suspense>
  );
}
