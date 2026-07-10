'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, Loader2, Stethoscope, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { criarEncaixe } from '@/app/dashboard/agendamentos/actions';
import { criarPacienteRapido } from '@/app/dashboard/pacientes/[id]/actions';
import { buildClinicDatetime } from './date-helpers';

interface AtenderAgoraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * #2 — Walk-in "Atender agora". Busca-primeiro: acha o paciente (desduplica, traz
 * histórico) ou cria rápido com nome+telefone. Cria um encaixe no horário atual e
 * entra direto no Modo Consulta. O encaixe usa o dentista da sessão (criarEncaixe).
 */
export function AtenderAgoraModal({ open, onOpenChange }: AtenderAgoraModalProps) {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const buscar = useCallback((nome: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (nome.trim().length < 2) {
      setSugestoes([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const supabase = createClient();
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome')
        .ilike('nome', `%${nome.trim()}%`)
        .limit(6)
        .abortSignal(controller.signal);
      if (!controller.signal.aborted) {
        setSugestoes(data ?? []);
        setBuscando(false);
      }
    }, 300);
  }, []);

  const reset = () => {
    setBusca('');
    setSugestoes([]);
    setNovoTelefone('');
    setErro(null);
    setBuscando(false);
  };

  const iniciarConsulta = async (pacienteId: string) => {
    setErro(null);
    setIniciando(true);
    const agora = new Date();
    const dataHora = buildClinicDatetime(format(agora, 'yyyy-MM-dd'), format(agora, 'HH:mm'));
    // Walk-in: força o encaixe (atende agora, mesmo que sobreponha um horário existente).
    const result = await criarEncaixe({
      pacienteId,
      dataHora,
      duracaoMinutos: 30,
      observacoes: '[Walk-in — Atender agora]',
      forcarEncaixe: true,
    });
    if (result.error || !result.id) {
      setErro(result.error ?? 'Não foi possível iniciar a consulta.');
      setIniciando(false);
      return;
    }
    onOpenChange(false);
    reset();
    router.push(`/consulta/${result.id}`);
  };

  const criarEIniciar = async () => {
    const nome = busca.trim();
    if (!nome) {
      setErro('Informe o nome do paciente.');
      return;
    }
    setErro(null);
    setIniciando(true);
    const res = await criarPacienteRapido({ nome, telefone: novoTelefone.trim() || null });
    if (res.error || !res.id) {
      setErro(res.error ?? 'Não foi possível cadastrar o paciente.');
      setIniciando(false);
      return;
    }
    await iniciarConsulta(res.id);
  };

  const nomeTrim = busca.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md rounded-2xl bg-surface border-border">
        <DialogTitle className="font-heading text-xl text-text-primary flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-teal" />
          Atender agora
        </DialogTitle>
        <DialogDescription className="text-text-secondary text-sm">
          Busque o paciente ou cadastre um novo para iniciar a consulta imediatamente.
        </DialogDescription>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <Input
            autoFocus
            value={busca}
            onChange={(e) => { setBusca(e.target.value); buscar(e.target.value); }}
            placeholder="Buscar por nome..."
            className="pl-9 rounded-xl bg-surface-alt border-border text-text-primary"
          />
          {buscando && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary animate-spin" />
          )}
        </div>

        {/* Sugestões */}
        {sugestoes.length > 0 && (
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {sugestoes.map((p) => (
              <button
                key={p.id}
                onClick={() => void iniciarConsulta(p.id)}
                disabled={iniciando}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-surface-alt hover:border-teal/40 hover:bg-teal/5 transition-all text-left disabled:opacity-50 group"
              >
                <span className="text-sm font-medium text-text-primary truncate group-hover:text-teal transition-colors">
                  {p.nome}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0 text-text-secondary group-hover:text-teal transition-colors" />
              </button>
            ))}
          </div>
        )}

        {/* Cadastro rápido — quando a busca não achou (ou pra criar mesmo assim) */}
        {nomeTrim.length >= 2 && !buscando && (
          <div className="rounded-xl border border-dashed border-border p-3 space-y-2.5">
            <p className="text-xs text-text-secondary">
              Não encontrou? Cadastre e atenda:
            </p>
            <Input
              value={novoTelefone}
              onChange={(e) => setNovoTelefone(e.target.value)}
              placeholder="Telefone (opcional)"
              inputMode="tel"
              className="rounded-xl bg-surface-alt border-border text-text-primary"
            />
            <Button
              onClick={() => void criarEIniciar()}
              disabled={iniciando}
              className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl font-bold disabled:opacity-50"
            >
              {iniciando ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Iniciando...</>
              ) : (
                <><UserPlus className="w-4 h-4 mr-2" /> Cadastrar &ldquo;{nomeTrim}&rdquo; e atender</>
              )}
            </Button>
          </div>
        )}

        {erro && (
          <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{erro}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
