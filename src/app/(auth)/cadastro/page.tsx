"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const cadastroSchema = z
  .object({
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CadastroFormData>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
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

  async function onSubmit(data: CadastroFormData): Promise<void> {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
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
        toast.success("Conta criada! Verifique seu email para confirmar o cadastro.");
        router.push("/login");
        router.refresh();
      }
    } catch {
      toast.error("Erro ao criar conta");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex flex-col items-center justify-center w-1/2 min-h-screen bg-teal dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="370 648 200 200" className="w-12 h-12">
              <path fill="white" fillRule="nonzero" d="M511.668 653.836L497.934 653.836C487.77 653.836 477.957 657.668 470.457 664.355C462.961 657.668 453.145 653.836 442.984 653.836L429.246 653.836C398.949 653.836 374.301 678.488 374.301 708.785L374.301 735.59C374.301 768.543 382.086 801.535 396.824 831.023C401.504 840.352 410.891 846.152 421.324 846.152C433.137 846.152 443.574 838.629 447.305 827.426L458.895 792.656C460.559 787.68 465.191 784.336 470.484 784.336C475.723 784.336 480.359 787.68 482.023 792.656L493.605 827.426C497.34 838.629 507.777 846.152 519.59 846.152C530.027 846.152 539.41 840.352 544.094 831.016C558.828 801.535 566.617 768.543 566.617 735.59L566.617 708.785C566.617 678.488 541.965 653.836 511.668 653.836ZM552.879 735.59C552.879 766.414 545.594 797.289 531.805 824.863C529.477 829.527 524.797 832.418 519.59 832.418C513.707 832.418 508.504 828.668 506.637 823.082L495.047 788.309C491.512 777.719 481.641 770.602 470.43 770.602C459.277 770.602 449.402 777.719 445.867 788.309L434.273 823.082C432.414 828.668 427.207 832.418 421.324 832.418C416.121 832.418 411.438 829.527 409.113 824.871C395.32 797.289 388.035 766.414 388.035 735.59L388.035 708.785C388.035 686.059 406.523 667.574 429.246 667.574L442.984 667.574C451.57 667.574 459.785 671.688 464.973 678.574C467.563 682.023 473.355 682.023 475.945 678.574C481.129 671.688 489.348 667.574 497.934 667.574L511.668 667.574C534.395 667.574 552.879 686.059 552.879 708.785Z" />
            </svg>
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
          <h1 className="font-serif text-4xl text-text-primary dark:text-white mb-2">Crie sua conta</h1>
          <p className="text-text-secondary dark:text-zinc-400 text-sm font-medium mb-8">Comece a transformar a gestão da sua clínica.</p>

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
                <label className="block font-mono text-xs text-text-secondary dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  disabled={isLoading}
                  placeholder="Mínimo 8 caracteres"
                  className="bg-surface-alt dark:bg-zinc-800 border border-border dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-text-primary dark:text-white w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-xs text-text-secondary dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  disabled={isLoading}
                  placeholder="Repita a senha"
                  className="bg-surface-alt dark:bg-zinc-800 border border-border dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-text-primary dark:text-white w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="bg-teal text-white rounded-xl font-bold py-3 w-full hover:bg-teal-dark transition-all mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ boxShadow: "0 10px 30px -10px rgba(47, 156, 133, 0.4)" }}
              >
                {isLoading ? "Criando conta..." : (
                  <>Criar Conta <ArrowRight className="w-4 h-4" /></>
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
              Cadastrar com Google
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm text-text-secondary dark:text-zinc-400">
                Já tem uma conta?{" "}
                <Link href="/login" className="text-teal font-semibold hover:text-teal-dark transition-colors">
                  Entrar
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
