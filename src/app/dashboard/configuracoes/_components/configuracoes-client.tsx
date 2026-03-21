'use client';

import { useState, useTransition } from 'react';
import { Building, Clock, Stethoscope, Check, Plus, Loader2, Pencil, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { ConfiguracaoClinica, HorarioDisponivel, Procedimento } from '@/types/database';
import {
  salvarClinica,
  salvarHorarios,
  atualizarProcedimento,
  toggleProcedimento,
  criarProcedimento,
  type HorarioDia,
} from '../actions';

// Dias da semana (0 = Domingo, 6 = Sábado)
const DIAS_SEMANA = [
  { label: 'Domingo', value: 0 },
  { label: 'Segunda-feira', value: 1 },
  { label: 'Terça-feira', value: 2 },
  { label: 'Quarta-feira', value: 3 },
  { label: 'Quinta-feira', value: 4 },
  { label: 'Sexta-feira', value: 5 },
  { label: 'Sábado', value: 6 },
];

const ABAS = [
  { id: 'clinica', label: 'Clínica', icon: Building },
  { id: 'horarios', label: 'Horários', icon: Clock },
  { id: 'procedimentos', label: 'Procedimentos', icon: Stethoscope },
] as const;

type Aba = (typeof ABAS)[number]['id'];

interface Props {
  dentista: { id: string; nome: string; clinica: string };
  config: ConfiguracaoClinica | null;
  horarios: HorarioDisponivel[];
  procedimentos: Procedimento[];
}

export function ConfiguracoesClient({ dentista, config, horarios, procedimentos: procedimentosIniciais }: Props) {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('clinica');
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Aba Clínica ---
  const [clinicaForm, setClinicaForm] = useState({
    nome_clinica: config?.nome_clinica ?? dentista.clinica,
    telefone: config?.telefone ?? '',
    endereco: config?.endereco ?? '',
    aceita_convenio: config?.aceita_convenio ?? false,
    convenios: config?.convenios ?? [],
    formas_pagamento: config?.formas_pagamento ?? [],
  });

  const handleSalvarClinica = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
    startTransition(async () => {
      const result = await salvarClinica(clinicaForm);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg('Configurações da clínica salvas com sucesso!');
      }
    });
  };

  // --- Aba Horários ---
  // Inicializa com os horários existentes, preenchendo dias faltantes com padrão inativo
  const initHorarios = (): HorarioDia[] =>
    DIAS_SEMANA.map(({ value: dia }) => {
      const existente = horarios.find((h) => h.dia_semana === dia);
      return existente
        ? {
            dia_semana: existente.dia_semana,
            hora_inicio: existente.hora_inicio,
            hora_fim: existente.hora_fim,
            intervalo_minutos: existente.intervalo_minutos,
            ativo: existente.ativo,
          }
        : {
            dia_semana: dia,
            hora_inicio: '08:00',
            hora_fim: '18:00',
            intervalo_minutos: 30,
            ativo: false,
          };
    });

  const [horariosForm, setHorariosForm] = useState<HorarioDia[]>(initHorarios);

  const updateHorario = (dia: number, campo: keyof HorarioDia, valor: string | number | boolean) => {
    setHorariosForm((prev) =>
      prev.map((h) => (h.dia_semana === dia ? { ...h, [campo]: valor } : h))
    );
  };

  const handleSalvarHorarios = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
    startTransition(async () => {
      const result = await salvarHorarios(horariosForm);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg('Horários salvos com sucesso!');
      }
    });
  };

  // --- Aba Procedimentos ---
  const [procedimentos, setProcedimentos] = useState(procedimentosIniciais);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ preco_padrao: 0, duracao_minutos: 0 });
  const [showNovoProcedimento, setShowNovoProcedimento] = useState(false);
  const [novoProc, setNovoProc] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    preco_padrao: '',
    duracao_minutos: '30',
  });

  const handleEditarProcedimento = (proc: Procedimento) => {
    setEditandoId(proc.id);
    setEditForm({
      preco_padrao: proc.preco_padrao ?? 0,
      duracao_minutos: proc.duracao_minutos ?? 30,
    });
  };

  const handleSalvarProcedimento = (id: string) => {
    startTransition(async () => {
      const result = await atualizarProcedimento(id, {
        preco_padrao: editForm.preco_padrao,
        duracao_minutos: editForm.duracao_minutos,
      });
      if (!result.error) {
        setProcedimentos((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, preco_padrao: editForm.preco_padrao, duracao_minutos: editForm.duracao_minutos }
              : p
          )
        );
        setEditandoId(null);
      }
    });
  };

  const handleToggleProcedimento = (id: string, ativo: boolean) => {
    startTransition(async () => {
      const result = await toggleProcedimento(id, !ativo);
      if (!result.error) {
        setProcedimentos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ativo: !ativo } : p))
        );
      }
    });
  };

  const handleCriarProcedimento = () => {
    if (!novoProc.nome.trim()) return;
    startTransition(async () => {
      const result = await criarProcedimento({
        nome: novoProc.nome.trim(),
        descricao: novoProc.descricao.trim(),
        categoria: novoProc.categoria.trim() || 'Geral',
        preco_padrao: parseFloat(novoProc.preco_padrao) || 0,
        duracao_minutos: parseInt(novoProc.duracao_minutos, 10) || 30,
      });
      if (!result.error) {
        // Refresh da lista após criar
        setShowNovoProcedimento(false);
        setNovoProc({ nome: '', descricao: '', categoria: '', preco_padrao: '', duracao_minutos: '30' });
        setSuccessMsg('Procedimento criado! Recarregue a página para ver a lista atualizada.');
      }
    });
  };

  // Agrupa procedimentos por categoria
  const categorias = Array.from(new Set(procedimentos.map((p) => p.categoria)));

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-heading text-4xl text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Gerencie sua clínica, horários e catálogo de procedimentos.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navegação lateral */}
        <motion.nav
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="md:col-span-1 space-y-2"
        >
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setAbaAtiva(id); setSuccessMsg(null); setErrorMsg(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
                abaAtiva === id
                  ? 'bg-teal/10 text-teal border border-teal/20'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </motion.nav>

        {/* Conteúdo da aba */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="md:col-span-3 space-y-6"
        >
          {/* Feedback global */}
          {successMsg && (
            <div className="bg-teal/10 border border-teal/20 rounded-xl p-4 text-sm text-teal flex items-center gap-2">
              <Check className="w-4 h-4" /> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          {/* === ABA: CLÍNICA === */}
          {abaAtiva === 'clinica' && (
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6">
              <h2 className="font-heading text-2xl text-foreground">Dados da Clínica</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Nome da Clínica
                  </label>
                  <input
                    type="text"
                    value={clinicaForm.nome_clinica}
                    onChange={(e) => setClinicaForm((f) => ({ ...f, nome_clinica: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 font-sans text-sm bg-muted outline-none focus:border-teal transition-colors text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={clinicaForm.telefone}
                    onChange={(e) => setClinicaForm((f) => ({ ...f, telefone: e.target.value }))}
                    placeholder="(11) 9 9999-9999"
                    className="w-full border border-border rounded-xl px-4 py-2.5 font-sans text-sm bg-muted outline-none focus:border-teal transition-colors text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={clinicaForm.endereco}
                    onChange={(e) => setClinicaForm((f) => ({ ...f, endereco: e.target.value }))}
                    placeholder="Rua, número, bairro..."
                    className="w-full border border-border rounded-xl px-4 py-2.5 font-sans text-sm bg-muted outline-none focus:border-teal transition-colors text-foreground"
                  />
                </div>
              </div>

              {/* Formas de pagamento */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                  Formas de Pagamento Aceitas
                </label>
                <div className="flex flex-wrap gap-2">
                  {['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto'].map((forma) => {
                    const ativo = clinicaForm.formas_pagamento.includes(forma);
                    return (
                      <button
                        key={forma}
                        type="button"
                        onClick={() =>
                          setClinicaForm((f) => ({
                            ...f,
                            formas_pagamento: ativo
                              ? f.formas_pagamento.filter((x) => x !== forma)
                              : [...f.formas_pagamento, forma],
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                          ativo
                            ? 'bg-teal/10 text-teal border border-teal/20'
                            : 'bg-muted text-muted-foreground hover:bg-accent border border-border'
                        }`}
                      >
                        {forma.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Convênios */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div>
                  <div className="font-semibold text-sm text-foreground">Aceita Convênio</div>
                  <div className="text-xs text-muted-foreground">
                    A clínica atende pacientes com plano odontológico.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={clinicaForm.aceita_convenio}
                    onChange={(e) =>
                      setClinicaForm((f) => ({ ...f, aceita_convenio: e.target.checked }))
                    }
                  />
                  <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal" />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSalvarClinica}
                  disabled={isPending}
                  className="bg-teal hover:bg-teal-lt text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-[0_0_15px_rgba(47,156,133,0.2)] disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          )}

          {/* === ABA: HORÁRIOS === */}
          {abaAtiva === 'horarios' && (
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-2xl text-foreground">Horários de Atendimento</h2>
                <span className="text-xs text-muted-foreground font-medium">
                  Ative os dias em que você atende
                </span>
              </div>

              <div className="space-y-3">
                {DIAS_SEMANA.map(({ label, value: dia }) => {
                  const h = horariosForm.find((x) => x.dia_semana === dia)!;
                  return (
                    <div
                      key={dia}
                      className={`p-4 rounded-xl border transition-colors ${
                        h.ativo ? 'border-teal/20 bg-teal/5' : 'border-border bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Toggle ativo */}
                        <label className="flex items-center gap-2 cursor-pointer min-w-[140px]">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={h.ativo}
                            onChange={(e) => updateHorario(dia, 'ativo', e.target.checked)}
                          />
                          <div className="relative w-9 h-5 bg-border rounded-full peer peer-checked:bg-teal after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border after:border-border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                          <span className={`text-sm font-semibold ${h.ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {label}
                          </span>
                        </label>

                        {h.ativo && (
                          <>
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={h.hora_inicio}
                                onChange={(e) => updateHorario(dia, 'hora_inicio', e.target.value)}
                                className="border border-border rounded-lg px-2 py-1.5 text-xs font-mono bg-background text-foreground outline-none focus:border-teal"
                              />
                              <span className="text-muted-foreground text-xs font-medium">até</span>
                              <input
                                type="time"
                                value={h.hora_fim}
                                onChange={(e) => updateHorario(dia, 'hora_fim', e.target.value)}
                                className="border border-border rounded-lg px-2 py-1.5 text-xs font-mono bg-background text-foreground outline-none focus:border-teal"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-medium">Intervalo:</span>
                              <select
                                value={h.intervalo_minutos}
                                onChange={(e) =>
                                  updateHorario(dia, 'intervalo_minutos', parseInt(e.target.value, 10))
                                }
                                className="border border-border rounded-lg px-2 py-1.5 text-xs font-mono bg-background text-foreground outline-none focus:border-teal"
                              >
                                <option value={15}>15 min</option>
                                <option value={20}>20 min</option>
                                <option value={30}>30 min</option>
                                <option value={45}>45 min</option>
                                <option value={60}>60 min</option>
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSalvarHorarios}
                  disabled={isPending}
                  className="bg-teal hover:bg-teal-lt text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-[0_0_15px_rgba(47,156,133,0.2)] disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPending ? 'Salvando...' : 'Salvar Horários'}
                </button>
              </div>
            </div>
          )}

          {/* === ABA: PROCEDIMENTOS === */}
          {abaAtiva === 'procedimentos' && (
            <div className="space-y-4">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-heading text-2xl text-foreground">Catálogo de Procedimentos</h2>
                  <button
                    onClick={() => setShowNovoProcedimento(true)}
                    className="bg-teal text-white hover:bg-teal-lt px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Novo
                  </button>
                </div>

                {/* Formulário novo procedimento */}
                {showNovoProcedimento && (
                  <div className="mb-6 p-4 border border-teal/20 bg-teal/5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-teal">Novo Procedimento</span>
                      <button onClick={() => setShowNovoProcedimento(false)}>
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="Nome do procedimento *"
                        value={novoProc.nome}
                        onChange={(e) => setNovoProc((f) => ({ ...f, nome: e.target.value }))}
                        className="col-span-2 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-teal"
                      />
                      <input
                        placeholder="Categoria (ex: Ortodontia)"
                        value={novoProc.categoria}
                        onChange={(e) => setNovoProc((f) => ({ ...f, categoria: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-teal"
                      />
                      <input
                        placeholder="Preço (R$)"
                        type="number"
                        value={novoProc.preco_padrao}
                        onChange={(e) => setNovoProc((f) => ({ ...f, preco_padrao: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-teal font-mono"
                      />
                      <input
                        placeholder="Descrição"
                        value={novoProc.descricao}
                        onChange={(e) => setNovoProc((f) => ({ ...f, descricao: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-teal"
                      />
                      <select
                        value={novoProc.duracao_minutos}
                        onChange={(e) => setNovoProc((f) => ({ ...f, duracao_minutos: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:border-teal font-mono"
                      >
                        <option value="15">15 min</option>
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">60 min</option>
                        <option value="90">90 min</option>
                        <option value="120">120 min</option>
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleCriarProcedimento}
                        disabled={isPending || !novoProc.nome.trim()}
                        className="bg-teal text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                      >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Criar Procedimento
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista por categoria */}
                {categorias.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum procedimento cadastrado ainda.
                  </p>
                )}

                {categorias.map((categoria) => (
                  <div key={categoria} className="mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">
                        {categoria}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="space-y-2">
                      {procedimentos
                        .filter((p) => p.categoria === categoria)
                        .map((proc) => (
                          <div
                            key={proc.id}
                            className={`p-4 rounded-xl border transition-colors ${
                              proc.ativo ? 'border-border bg-card' : 'border-border bg-muted/30 opacity-60'
                            }`}
                          >
                            {editandoId === proc.id ? (
                              // Modo edição
                              <div className="flex items-center gap-4 flex-wrap">
                                <span className="font-medium text-sm text-foreground flex-1 min-w-[150px]">
                                  {proc.nome}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">R$</span>
                                  <input
                                    type="number"
                                    value={editForm.preco_padrao}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        preco_padrao: parseFloat(e.target.value) || 0,
                                      }))
                                    }
                                    className="w-24 border border-border rounded-lg px-2 py-1 text-xs font-mono bg-background text-foreground outline-none focus:border-teal"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={editForm.duracao_minutos}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        duracao_minutos: parseInt(e.target.value, 10),
                                      }))
                                    }
                                    className="border border-border rounded-lg px-2 py-1 text-xs font-mono bg-background text-foreground outline-none focus:border-teal"
                                  >
                                    <option value={15}>15 min</option>
                                    <option value={30}>30 min</option>
                                    <option value={45}>45 min</option>
                                    <option value={60}>60 min</option>
                                    <option value={90}>90 min</option>
                                  </select>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSalvarProcedimento(proc.id)}
                                    disabled={isPending}
                                    className="p-1.5 bg-teal text-white rounded-lg hover:bg-teal-lt transition-colors"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditandoId(null)}
                                    className="p-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-accent transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Modo visualização
                              <div className="flex items-center gap-4 flex-wrap">
                                <span className="font-medium text-sm text-foreground flex-1">
                                  {proc.nome}
                                </span>
                                {proc.preco_padrao !== null && (
                                  <span className="font-mono text-sm font-semibold text-foreground">
                                    {proc.preco_padrao.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                )}
                                {proc.duracao_minutos && (
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {proc.duracao_minutos} min
                                  </span>
                                )}
                                <div className="flex gap-2 ml-auto">
                                  <button
                                    onClick={() => handleEditarProcedimento(proc)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleProcedimento(proc.id, proc.ativo)}
                                    disabled={isPending}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                      proc.ativo
                                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                        : 'bg-teal/10 text-teal hover:bg-teal/20'
                                    }`}
                                  >
                                    {proc.ativo ? 'Desativar' : 'Ativar'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
