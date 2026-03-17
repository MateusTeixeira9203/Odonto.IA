"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Input,
  SectionLabel,
} from "@/components/dentai";
import { Textarea } from "@/components/ui/textarea";
import { createPaciente } from "./actions";

// ── Máscaras ──────────────────────────────────────────────────────
function mascaraCPF(valor: string): string {
  return valor
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function mascaraTelefone(valor: string): string {
  const digits = valor.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

// ── Schema Zod ────────────────────────────────────────────────────
const pacienteSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cpf: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "Email inválido"
    ),
  telefone: z.string().optional(),
  data_nascimento: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  whatsapp: z.string().optional(),
  observacoes: z.string().optional(),
});

type PacienteFormData = z.infer<typeof pacienteSchema>;

// Classe base para inputs manuais com máscara
const inputMascaraClass =
  "w-full font-mono text-sm px-4 py-3 rounded-xl border border-brand-border bg-brand-bg text-brand-black focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal placeholder:text-brand-muted/50 transition-all duration-200";

export default function NovoPacientePage(): React.JSX.Element {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsappIgualTelefone, setWhatsappIgualTelefone] = useState(false);
  const [cpfValue, setCpfValue] = useState("");
  const [telefoneValue, setTelefoneValue] = useState("");
  const [whatsappValue, setWhatsappValue] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PacienteFormData>({
    resolver: zodResolver(pacienteSchema),
    defaultValues: {
      nome: "",
      cpf: "",
      email: "",
      telefone: "",
      data_nascimento: "",
      endereco: "",
      cidade: "",
      estado: "",
      whatsapp: "",
      observacoes: "",
    },
  });

  // Sincroniza WhatsApp com telefone quando checkbox está marcado
  useEffect(() => {
    if (whatsappIgualTelefone) {
      setWhatsappValue(telefoneValue);
      setValue("whatsapp", telefoneValue);
    }
  }, [whatsappIgualTelefone, telefoneValue, setValue]);

  function handleCPFChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const masked = mascaraCPF(e.target.value);
    setCpfValue(masked);
    setValue("cpf", masked);
  }

  function handleTelefoneChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const masked = mascaraTelefone(e.target.value);
    setTelefoneValue(masked);
    setValue("telefone", masked);
    if (whatsappIgualTelefone) {
      setWhatsappValue(masked);
      setValue("whatsapp", masked);
    }
  }

  function handleWhatsappChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const masked = mascaraTelefone(e.target.value);
    setWhatsappValue(masked);
    setValue("whatsapp", masked);
  }

  async function onSubmit(data: PacienteFormData): Promise<void> {
    setIsSubmitting(true);
    try {
      const result = await createPaciente({
        nome: data.nome,
        cpf: data.cpf ?? null,
        email: data.email ?? null,
        telefone: data.telefone ?? null,
        data_nascimento: data.data_nascimento ?? null,
        endereco: data.endereco ?? null,
        cidade: data.cidade ?? null,
        estado: data.estado ?? null,
        whatsapp: data.whatsapp ?? null,
        observacoes: data.observacoes ?? null,
      });

      if (result.success) {
        toast.success("Paciente cadastrado com sucesso!");
        router.push("/dashboard/pacientes");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao cadastrar paciente");
      }
    } catch {
      toast.error("Erro inesperado ao cadastrar paciente");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link href="/dashboard/pacientes">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft size={16} />
            Voltar
          </Button>
        </Link>
        <div className="space-y-1">
          <h1 className="font-serif text-2xl tracking-tight text-foreground">Novo Paciente</h1>
          <p className="font-mono text-sm text-muted-foreground">Preencha os dados do paciente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Dados Pessoais ── */}
        <Card>
          <CardHeader>
            <SectionLabel className="text-muted-foreground">Dados Pessoais</SectionLabel>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nome */}
            <Input
              label="Nome completo *"
              placeholder="Ex: Maria da Silva"
              error={errors.nome?.message}
              {...register("nome")}
            />

            {/* CPF + Data de nascimento */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">CPF</label>
                <input
                  value={cpfValue}
                  onChange={handleCPFChange}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className={inputMascaraClass}
                />
              </div>
              <Input
                label="Data de nascimento"
                type="date"
                {...register("data_nascimento")}
              />
            </div>

            {/* Email + Telefone */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Email"
                type="email"
                placeholder="email@exemplo.com"
                error={errors.email?.message}
                {...register("email")}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Telefone</label>
                <input
                  value={telefoneValue}
                  onChange={handleTelefoneChange}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                  className={inputMascaraClass}
                />
              </div>
            </div>

            {/* WhatsApp */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">WhatsApp</label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={whatsappIgualTelefone}
                    onChange={(e) => setWhatsappIgualTelefone(e.target.checked)}
                    className="size-3.5 rounded border-brand-border accent-teal"
                  />
                  Mesmo que telefone
                </label>
              </div>
              <input
                value={whatsappValue}
                onChange={handleWhatsappChange}
                placeholder="(00) 00000-0000"
                inputMode="numeric"
                disabled={whatsappIgualTelefone}
                className={`${inputMascaraClass} disabled:opacity-50`}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Endereço ── */}
        <Card>
          <CardHeader>
            <SectionLabel className="text-muted-foreground">Endereço</SectionLabel>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Endereço"
              placeholder="Rua, número, complemento"
              {...register("endereco")}
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_100px]">
              <Input
                label="Cidade"
                placeholder="Cidade"
                {...register("cidade")}
              />
              <Input
                label="Estado"
                placeholder="UF"
                maxLength={2}
                {...register("estado")}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Observações ── */}
        <Card>
          <CardHeader>
            <SectionLabel className="text-muted-foreground">Observações</SectionLabel>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register("observacoes")}
              placeholder="Alergias, condições especiais, observações..."
              rows={4}
              className="font-sans text-sm border-brand-border bg-brand-bg text-brand-black focus:border-teal focus:ring-teal/30 placeholder:text-brand-muted/60 resize-none"
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-6"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin size-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Salvando...
            </>
          ) : (
            <>
              <Check size={16} />
              Salvar Paciente
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
