'use client';

import { useState, useTransition } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createPaciente } from './actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NovoPacientePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    data_nascimento: '',
    endereco: '',
    cidade: '',
    estado: '',
    whatsapp: '',
    observacoes: '',
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.nome.trim()) {
      setError('O nome do paciente é obrigatório.');
      return;
    }

    startTransition(async () => {
      const result = await createPaciente({
        nome: form.nome.trim(),
        cpf: form.cpf.trim() || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        data_nascimento: form.data_nascimento || null,
        endereco: form.endereco.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        observacoes: form.observacoes.trim() || null,
      });

      if (result.success) {
        router.push('/dashboard/pacientes');
      } else {
        setError(result.error ?? 'Erro ao cadastrar paciente.');
      }
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-10">
        <button
          onClick={() => router.push('/dashboard/pacientes')}
          className="p-2 hover:bg-card rounded-xl transition-colors border border-transparent hover:border-border/40"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="font-heading text-4xl text-foreground mb-1">Novo Paciente</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Preencha os dados cadastrais do paciente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados Pessoais */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="font-heading text-xl text-foreground mb-2">Dados Pessoais</h2>

          <div className="space-y-2">
            <Label htmlFor="nome" className="text-foreground">
              Nome Completo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={set('nome')}
              placeholder="Ex: Maria Almeida"
              className="rounded-xl bg-muted border-border text-foreground"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-foreground">
                CPF
              </Label>
              <Input
                id="cpf"
                value={form.cpf}
                onChange={set('cpf')}
                placeholder="000.000.000-00"
                className="rounded-xl bg-muted border-border text-foreground font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_nascimento" className="text-foreground">
                Data de Nascimento
              </Label>
              <Input
                id="data_nascimento"
                type="date"
                value={form.data_nascimento}
                onChange={set('data_nascimento')}
                className="rounded-xl bg-muted border-border text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="font-heading text-xl text-foreground mb-2">Contato</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefone" className="text-foreground">
                Telefone
              </Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={set('telefone')}
                placeholder="(11) 9 9999-9999"
                className="rounded-xl bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="text-foreground">
                WhatsApp
              </Label>
              <Input
                id="whatsapp"
                value={form.whatsapp}
                onChange={set('whatsapp')}
                placeholder="(11) 9 9999-9999"
                className="rounded-xl bg-muted border-border text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="paciente@email.com"
              className="rounded-xl bg-muted border-border text-foreground"
            />
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="font-heading text-xl text-foreground mb-2">Endereço</h2>

          <div className="space-y-2">
            <Label htmlFor="endereco" className="text-foreground">
              Logradouro
            </Label>
            <Input
              id="endereco"
              value={form.endereco}
              onChange={set('endereco')}
              placeholder="Rua, número, complemento..."
              className="rounded-xl bg-muted border-border text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cidade" className="text-foreground">
                Cidade
              </Label>
              <Input
                id="cidade"
                value={form.cidade}
                onChange={set('cidade')}
                placeholder="São Paulo"
                className="rounded-xl bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado" className="text-foreground">
                Estado
              </Label>
              <Input
                id="estado"
                value={form.estado}
                onChange={set('estado')}
                placeholder="SP"
                maxLength={2}
                className="rounded-xl bg-muted border-border text-foreground uppercase"
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h2 className="font-heading text-xl text-foreground mb-4">Observações</h2>
          <textarea
            id="observacoes"
            value={form.observacoes}
            onChange={set('observacoes')}
            placeholder="Alergias, histórico médico relevante, preferências de atendimento..."
            rows={4}
            className="w-full bg-muted border-none rounded-xl p-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-teal/20 transition-all resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-4 pb-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard/pacientes')}
            className="px-6 py-3 rounded-xl border border-border text-foreground hover:bg-muted text-sm font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-8 py-3 bg-teal text-white rounded-xl font-bold text-sm hover:bg-teal-lt transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? 'Salvando...' : 'Cadastrar Paciente'}
          </button>
        </div>
      </form>
    </div>
  );
}
