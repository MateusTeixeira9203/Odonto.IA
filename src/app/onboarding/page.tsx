"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeOnboarding } from "./actions";
import { toast } from "sonner";

const ESPECIALIDADES = [
  "Clínico Geral",
  "Ortodontia",
  "Endodontia",
  "Implantodontia",
  "Periodontia",
  "Odontopediatria",
  "Cirurgia",
  "Outro",
] as const;

const onboardingSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cro: z.string().min(1, "Informe o CRO"),
  especialidade: z.enum(ESPECIALIDADES),
  nomeConsultorio: z.string().min(2, "Nome do consultório é obrigatório"),
  telefone: z.string().optional(),
  cidade: z.string().min(2, "Informe a cidade"),
  estado: z
    .string()
    .min(2, "Informe o estado (UF)")
    .max(2, "Use a sigla (ex: SP)"),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

// Mapa de passos para a barra de progresso
const TOTAL_FIELDS = 7;

export default function OnboardingPage(): React.JSX.Element {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      nome: "",
      cro: "",
      especialidade: undefined,
      nomeConsultorio: "",
      telefone: "",
      cidade: "",
      estado: "",
    },
  });

  const watchedValues = watch();
  const especialidadeValue = watchedValues.especialidade;

  // Calcula progresso com base nos campos preenchidos
  const filledCount = [
    watchedValues.nome,
    watchedValues.cro,
    watchedValues.especialidade,
    watchedValues.nomeConsultorio,
    watchedValues.telefone,
    watchedValues.cidade,
    watchedValues.estado,
  ].filter((v) => v && String(v).trim().length > 0).length;

  const progress = Math.round((filledCount / TOTAL_FIELDS) * 100);

  async function onSubmit(data: OnboardingFormData): Promise<void> {
    setIsLoading(true);
    try {
      const result = await completeOnboarding({
        nome: data.nome,
        cro: data.cro,
        especialidade: data.especialidade,
        nomeConsultorio: data.nomeConsultorio,
        telefone: data.telefone ?? "",
        cidade: data.cidade,
        estado: data.estado,
      });

      if (result.success) {
        toast.success("Tudo pronto! Seu consultório está configurado.");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao salvar. Tente novamente.");
      }
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass =
    "w-full font-sans text-sm px-3 py-2.5 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all";

  return (
    <div className="w-full max-w-lg">
      {/* Cabeçalho */}
      <div className="text-center mb-8">
        <h1 className="font-heading text-4xl text-text-primary mb-2">
          Configure seu consultório
        </h1>
        <p className="text-text-secondary text-sm font-medium">
          Isso leva menos de 2 minutos.
        </p>
      </div>

      {/* Card */}
      <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden">
        {/* Barra de progresso */}
        <div className="h-1 w-full bg-surface-alt">
          <div
            className="h-full bg-teal transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Nome completo */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                Nome completo
              </label>
              <input
                id="nome"
                placeholder="Ex: Dr. João Silva"
                disabled={isLoading}
                className={inputClass}
                {...register("nome")}
              />
              {errors.nome && (
                <p className="text-xs text-red-500">{errors.nome.message}</p>
              )}
            </div>

            {/* CRO + Especialidade */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                  CRO
                </label>
                <input
                  id="cro"
                  placeholder="Ex: CRO-SP 12345"
                  disabled={isLoading}
                  className={inputClass}
                  {...register("cro")}
                />
                {errors.cro && (
                  <p className="text-xs text-red-500">{errors.cro.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                  Especialidade
                </label>
                <Select
                  value={especialidadeValue ?? ""}
                  onValueChange={(v) =>
                    setValue(
                      "especialidade",
                      v as (typeof ESPECIALIDADES)[number],
                      { shouldValidate: true }
                    )
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full h-10 rounded-xl border border-border bg-surface-alt text-text-primary text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESPECIALIDADES.map((esp) => (
                      <SelectItem key={esp} value={esp}>
                        {esp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.especialidade && (
                  <p className="text-xs text-red-500">
                    {errors.especialidade.message}
                  </p>
                )}
              </div>
            </div>

            {/* Nome do consultório */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                Nome do consultório
              </label>
              <input
                id="nomeConsultorio"
                placeholder="Ex: Consultório Dr. João"
                disabled={isLoading}
                className={inputClass}
                {...register("nomeConsultorio")}
              />
              {errors.nomeConsultorio && (
                <p className="text-xs text-red-500">
                  {errors.nomeConsultorio.message}
                </p>
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                Telefone{" "}
                <span className="normal-case font-normal">(opcional)</span>
              </label>
              <input
                id="telefone"
                placeholder="(00) 00000-0000"
                disabled={isLoading}
                className={inputClass}
                {...register("telefone")}
              />
            </div>

            {/* Cidade + Estado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                  Cidade
                </label>
                <input
                  id="cidade"
                  placeholder="Cidade"
                  disabled={isLoading}
                  className={inputClass}
                  {...register("cidade")}
                />
                {errors.cidade && (
                  <p className="text-xs text-red-500">
                    {errors.cidade.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                  Estado
                </label>
                <input
                  id="estado"
                  placeholder="UF"
                  maxLength={2}
                  disabled={isLoading}
                  className={inputClass + " uppercase"}
                  {...register("estado")}
                />
                {errors.estado && (
                  <p className="text-xs text-red-500">
                    {errors.estado.message}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md mt-2 disabled:opacity-60"
            >
              {isLoading ? "Salvando..." : "Concluir configuração →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
