"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { ArrowRight, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { DentIALogo } from "@/components/ui/dent-ia-logo";

const cadastroSchema = z
  .object({
    nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type CadastroFormData = z.infer<typeof cadastroSchema>;

export default function CadastroPage(): React.JSX.Element {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CadastroFormData>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: { nome: "", email: "", password: "", confirmPassword: "" },
  });

  const handleGoogleSignup = async (): Promise<void> => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  async function onSubmit(data: CadastroFormData): Promise<void> {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { nome: data.nome },
        },
      });

      if (error) {
        if (error.message.includes("User already registered") || error.message.includes("already been registered")) {
          toast.error("Este email já está cadastrado. Faça login ou use outro email.");
        } else {
          toast.error("Erro ao criar conta. Tente novamente.");
        }
        return;
      }

      if (authData.user?.identities?.length === 0) {
        toast.error("Este email já está cadastrado. Faça login ou use outro email.");
        return;
      }

      if (authData.session) {
        toast.success("Conta criada com sucesso!");
        router.push("/onboarding");
        router.refresh();
      } else {
        router.push(`/verifique-email?email=${encodeURIComponent(data.email)}`);
      }
    } catch {
      toast.error("Erro ao criar conta");
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
            <DentIALogo className="w-7 h-7" />
          </div>
          <h1 className="font-serif text-4xl text-text-primary mb-2">Crie sua conta</h1>
          <p className="text-text-secondary text-sm font-medium">
            Comece a transformar a gestão da sua clínica.
          </p>
        </div>

        <div className="bg-surface p-8 rounded-3xl border border-border shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Nome */}
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
                Nome
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-text-secondary" />
                </div>
                <input
                  type="text"
                  disabled={isLoading}
                  placeholder="Seu nome completo"
                  className="bg-surface-alt border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all placeholder:text-text-secondary"
                  {...register("nome")}
                />
              </div>
              {errors.nome && (
                <p className="mt-1 text-xs text-red-500">{errors.nome.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
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
                  className="bg-surface-alt border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all placeholder:text-text-secondary"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Senha */}
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-text-secondary" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  disabled={isLoading}
                  placeholder="Mínimo 8 caracteres"
                  className="bg-surface-alt border border-border rounded-xl pl-11 pr-11 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all"
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

            {/* Confirmar Senha */}
            <div>
              <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
                Confirmar Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-text-secondary" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  disabled={isLoading}
                  placeholder="Repita a senha"
                  className="bg-surface-alt border border-border rounded-xl pl-11 pr-11 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all"
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
              className="bg-teal text-white rounded-xl font-bold py-3.5 w-full hover:bg-teal-dark transition-all mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ boxShadow: "0 10px 30px -10px rgba(47, 156, 133, 0.4)" }}
            >
              {isLoading ? "Criando conta..." : (
                <>Cadastrar <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface px-2 text-text-secondary font-mono">ou</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignup}
            className="bg-surface border border-border rounded-xl py-3 w-full flex items-center justify-center gap-3 text-sm font-medium text-text-primary hover:bg-surface-alt transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Cadastrar com Google
          </button>

          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              Já tem uma conta?{" "}
              <Link href="/login" className="text-teal font-semibold hover:text-teal-dark transition-colors">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
