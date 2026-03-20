"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/dentai/Logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Mail, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";

const esqueciSchema = z.object({
  email: z.email("Email inválido"),
});

type EsqueciFormData = z.infer<typeof esqueciSchema>;

export default function EsqueciSenhaPage(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

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

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/redefinir-senha`
          : "/redefinir-senha";

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setEnviado(true);
    } catch {
      toast.error("Erro ao enviar o email. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    // Cobre toda a tela independente do layout pai (auth)
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "var(--bg)" }}
    >
      {/* Toggle de tema — canto superior direito */}
      <div className="flex justify-end p-4 shrink-0">
        <ThemeToggle />
      </div>

      {/* Conteúdo centralizado */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
        {/* Logo acima do card */}
        <div className="mb-6">
          <Logo size="sm" variant="default" showTagline={false} />
        </div>

        {/* Card */}
        <div
          className="w-full max-w-[400px] rounded-lg border p-10"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--border-brand)",
          }}
        >
          {enviado ? (
            /* Estado de sucesso */
            <div className="flex flex-col items-center text-center gap-4">
              <CheckCircle
                className="size-10"
                style={{ color: "var(--teal)" }}
              />
              <div className="space-y-1.5">
                <h1 className="font-serif text-2xl text-foreground">
                  Link enviado!
                </h1>
                <p
                  className="font-sans text-sm leading-relaxed"
                  style={{ color: "var(--gray-mid)" }}
                >
                  Verifique seu email. O link expira em 1 hora.
                </p>
              </div>
              <Link
                href="/login"
                className={buttonVariants({ variant: "outline", className: "mt-2 w-full h-11 font-sans font-semibold text-sm" })}
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            /* Formulário */
            <>
              {/* Ícone + títulos */}
              <div className="flex flex-col items-center text-center mb-6">
                <Mail
                  className="size-8 mb-4"
                  style={{ color: "var(--teal)" }}
                />
                <h1 className="font-serif text-2xl text-foreground mb-1.5">
                  Recuperar acesso
                </h1>
                <p
                  className="font-sans text-sm leading-relaxed"
                  style={{ color: "var(--gray-mid)" }}
                >
                  Digite seu email e enviaremos um link para você criar uma nova senha.
                </p>
              </div>

              <Separator className="mb-6" />

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="font-sans font-medium text-sm">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    disabled={isLoading}
                    className="h-11"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 font-sans font-semibold text-sm"
                  disabled={isLoading}
                  style={{ backgroundColor: "var(--teal)", color: "white" }}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Link abaixo do card */}
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-sans text-sm transition-colors"
            style={{ color: "var(--gray-mid)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--gray-mid)")}
          >
            <ArrowLeft className="size-4" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
