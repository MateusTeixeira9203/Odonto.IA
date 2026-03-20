'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { FichaArquivo, Orcamento, Paciente, Planejamento } from '@/types/database';
import { atualizarPaciente, salvarAnotacoes } from '../actions';
import { criarAgendamento } from '@/app/dashboard/agendamentos/actions';
import { FichasTab } from '@/components/pacientes/FichasTab';
import { DocumentosTab } from '@/components/pacientes/DocumentosTab';
import { PlanejamentoTab } from '@/components/pacientes/PlanejamentoTab';
import { TabVisaoGeral } from './tab-visao-geral';
import { TabOrcamentos } from './tab-orcamentos';
import type { FichaResumida } from '@/components/pacientes/FichasTab';

// ── Tipos exportados para page.tsx ──────────────────────────────────────────
export type { FichaResumida };

export type PagamentoResumido = {
  valor: number;
  status: 'pendente' | 'pago' | 'cancelado';
  data_pagamento: string | null;
};

export type ProximaConsulta = {
  id: string;
  data_hora: string;
  status: string;
} | null;

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  paciente: Paciente;
  fichas: FichaResumida[];
  orcamentos: Orcamento[];
  planejamentos: Planejamento[];
  arquivos: FichaArquivo[];
  pagamentos: PagamentoResumido[];
  proximaConsulta: ProximaConsulta;
  dentistaId: string;
  clinicaId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getIniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

const TIPOS_CONSULTA = [
  'Consulta de rotina',
  'Urgência / dor',
  'Retorno',
  'Procedimento',
  'Avaliação inicial',
  'Outro',
];

// ── Componente principal ─────────────────────────────────────────────────────
export function PacienteDetailClient({
  paciente,
  fichas,
  orcamentos,
  planejamentos,
  arquivos,
  pagamentos,
  proximaConsulta,
  dentistaId,
  clinicaId,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('visao-geral');

  // Lê ?tab= da URL para abrir a aba correta ao navegar da lista de fichas
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const tabs = ['visao-geral', 'fichas', 'documentos', 'planejamento', 'orcamentos'];
    if (tab && tabs.includes(tab)) setActiveTab(tab);
  }, []);

  const [dialogEditarAberto, setDialogEditarAberto] = useState(false);
  const [dialogConsultaAberto, setDialogConsultaAberto] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoConsulta, setSalvandoConsulta] = useState(false);
  const [anotacoesRapidas, setAnotacoesRapidas] = useState(paciente.observacoes ?? '');
  const [salvandoAnotacoes, setSalvandoAnotacoes] = useState(false);

  const [formPaciente, setFormPaciente] = useState({
    nome: paciente.nome,
    cpf: paciente.cpf ?? '',
    email: paciente.email ?? '',
    telefone: paciente.telefone ?? '',
    whatsapp: paciente.whatsapp ?? '',
    data_nascimento: paciente.data_nascimento ?? '',
    cidade: paciente.cidade ?? '',
    estado: paciente.estado ?? '',
    observacoes: paciente.observacoes ?? '',
  });

  const [formConsulta, setFormConsulta] = useState({
    data: '',
    hora: '',
    tipo: TIPOS_CONSULTA[0],
    duracao: '60',
    observacoes: '',
  });

  // Progresso de tratamento baseado em fichas concluídas
  const totalFichas = fichas.length;
  const fichasConcluidas = fichas.filter((f) => f.status === 'concluida').length;
  const progressoPct = totalFichas > 0 ? Math.round((fichasConcluidas / totalFichas) * 100) : 0;

  async function handleSalvarPerfil(): Promise<void> {
    setSalvandoPerfil(true);
    const result = await atualizarPaciente(paciente.id, {
      nome: formPaciente.nome,
      cpf: formPaciente.cpf || null,
      email: formPaciente.email || null,
      telefone: formPaciente.telefone || null,
      whatsapp: formPaciente.whatsapp || null,
      data_nascimento: formPaciente.data_nascimento || null,
      cidade: formPaciente.cidade || null,
      estado: formPaciente.estado || null,
      observacoes: formPaciente.observacoes || null,
    });
    setSalvandoPerfil(false);
    if (result.error) {
      toast.error('Erro ao salvar perfil');
    } else {
      toast.success('Perfil atualizado');
      setDialogEditarAberto(false);
      router.refresh();
    }
  }

  async function handleSalvarAnotacoes(): Promise<void> {
    setSalvandoAnotacoes(true);
    const result = await salvarAnotacoes(paciente.id, anotacoesRapidas);
    setSalvandoAnotacoes(false);
    if (result.error) {
      toast.error('Erro ao salvar');
    } else {
      toast.success('Anotações salvas');
    }
  }

  async function handleCriarConsulta(): Promise<void> {
    if (!formConsulta.data || !formConsulta.hora) {
      toast.error('Data e hora são obrigatórios');
      return;
    }
    setSalvandoConsulta(true);
    const dataHora = new Date(`${formConsulta.data}T${formConsulta.hora}`).toISOString();
    const result = await criarAgendamento({
      pacienteId: paciente.id,
      dataHora,
      duracaoMinutos: Number(formConsulta.duracao) || 60,
      tipo: formConsulta.tipo || null,
      observacoes: formConsulta.observacoes || null,
    });
    setSalvandoConsulta(false);
    if (result.error) {
      toast.error('Erro ao agendar consulta');
    } else {
      toast.success('Consulta agendada!');
      setDialogConsultaAberto(false);
      setFormConsulta({ data: '', hora: '', tipo: TIPOS_CONSULTA[0], duracao: '60', observacoes: '' });
      router.refresh();
    }
  }

  const inputClass =
    'w-full font-sans text-sm px-3 py-2 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-teal/40 transition-colors';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8 max-w-7xl mx-auto w-full space-y-6 pb-12"
    >
      {/* Breadcrumb */}
      <Link
        href="/dashboard/pacientes"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Pacientes
      </Link>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-teal flex items-center justify-center text-white font-mono text-xl shrink-0 select-none">
          {getIniciais(paciente.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-4xl leading-tight text-text-primary truncate">
            {paciente.nome}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="bg-teal/10 text-teal text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              Ativo
            </span>
            {paciente.cpf && (
              <span className="font-mono text-xs text-text-secondary">{paciente.cpf}</span>
            )}
            <span className="font-mono text-xs text-text-secondary">
              Desde{' '}
              {format(new Date(paciente.created_at), "MMM yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 pt-1">
          <button
            type="button"
            onClick={() => setDialogEditarAberto(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar Perfil
          </button>
          <button
            type="button"
            onClick={() => setDialogConsultaAberto(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark transition-colors"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            Nova Consulta
          </button>
        </div>
      </div>

      {/* ── Layout principal ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Abas — 3 colunas */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
            <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 w-full justify-start gap-0">
              {[
                { value: 'visao-geral', label: 'Visão Geral' },
                { value: 'fichas', label: 'Fichas Clínicas' },
                { value: 'documentos', label: 'Documentos' },
                { value: 'planejamento', label: 'Planejamento' },
                { value: 'orcamentos', label: 'Orçamentos' },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[selected]:border-teal data-[selected]:text-teal bg-transparent pb-3 pt-1 px-4 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="visao-geral" className="mt-6">
              <TabVisaoGeral
                fichas={fichas}
                orcamentos={orcamentos}
                pagamentos={pagamentos}
                proximaConsulta={proximaConsulta}
                pacienteId={paciente.id}
              />
            </TabsContent>

            <TabsContent value="fichas" className="mt-6">
              <FichasTab
                patientId={paciente.id}
                fichas={fichas}
                dentistaId={dentistaId}
                clinicaId={clinicaId}
              />
            </TabsContent>

            <TabsContent value="documentos" className="mt-6">
              <DocumentosTab patientId={paciente.id} clinicaId={clinicaId} arquivos={arquivos} />
            </TabsContent>

            <TabsContent value="planejamento" className="mt-6">
              <PlanejamentoTab patientId={paciente.id} planejamentos={planejamentos} />
            </TabsContent>

            <TabsContent value="orcamentos" className="mt-6">
              <TabOrcamentos orcamentos={orcamentos} pacienteId={paciente.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Sidebar direita — 1 coluna ───────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Status clínico */}
          <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-secondary">
              Status Clínico
            </p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Fichas abertas</span>
                <span className="font-mono font-medium text-text-primary">
                  {fichas.filter((f) => f.status === 'aberta').length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Fichas concluídas</span>
                <span className="font-mono font-medium text-text-primary">
                  {fichasConcluidas}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Orçamentos</span>
                <span className="font-mono font-medium text-text-primary">
                  {orcamentos.length}
                </span>
              </div>
              {totalFichas > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Progresso</span>
                    <span className="font-mono text-teal">{progressoPct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-alt rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal rounded-full transition-all duration-500"
                      style={{ width: `${progressoPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Anotações rápidas */}
          <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-secondary">
              Anotações Rápidas
            </p>
            <textarea
              value={anotacoesRapidas}
              onChange={(e) => setAnotacoesRapidas(e.target.value)}
              placeholder="Observações sobre o paciente…"
              rows={4}
              className="w-full font-sans text-sm px-3 py-2 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-teal/40 transition-colors resize-none"
            />
            <button
              type="button"
              onClick={handleSalvarAnotacoes}
              disabled={salvandoAnotacoes}
              className="w-full py-1.5 rounded-xl text-xs font-medium bg-teal/10 text-teal hover:bg-teal/20 transition-colors disabled:opacity-50"
            >
              {salvandoAnotacoes ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

          {/* Alertas — anotações da ficha mais recente */}
          <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-secondary">
              Alertas / Histórico
            </p>
            {fichas[0]?.anotacoes ? (
              <p className="font-sans text-sm text-text-secondary line-clamp-4">
                {fichas[0].anotacoes}
              </p>
            ) : (
              <p className="font-sans text-xs text-text-muted">
                Sem alertas registrados
              </p>
            )}
            {fichas[0] && (
              <Link
                href={`/dashboard/fichas/${fichas[0].id}`}
                className="block text-xs font-medium text-teal hover:text-teal-dark transition-colors"
              >
                Ver última ficha →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialog: Editar Perfil ────────────────────────────────────────────── */}
      <Dialog open={dialogEditarAberto} onOpenChange={setDialogEditarAberto}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Editar Perfil</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-text-secondary">Nome completo</label>
              <input
                className={inputClass}
                value={formPaciente.nome}
                onChange={(e) => setFormPaciente((p) => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">CPF</label>
              <input
                className={inputClass}
                value={formPaciente.cpf}
                onChange={(e) => setFormPaciente((p) => ({ ...p, cpf: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Data de nascimento</label>
              <input
                type="date"
                className={inputClass}
                value={formPaciente.data_nascimento}
                onChange={(e) => setFormPaciente((p) => ({ ...p, data_nascimento: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Telefone</label>
              <input
                className={inputClass}
                value={formPaciente.telefone}
                onChange={(e) => setFormPaciente((p) => ({ ...p, telefone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">WhatsApp</label>
              <input
                className={inputClass}
                value={formPaciente.whatsapp}
                onChange={(e) => setFormPaciente((p) => ({ ...p, whatsapp: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-text-secondary">E-mail</label>
              <input
                type="email"
                className={inputClass}
                value={formPaciente.email}
                onChange={(e) => setFormPaciente((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Cidade</label>
              <input
                className={inputClass}
                value={formPaciente.cidade}
                onChange={(e) => setFormPaciente((p) => ({ ...p, cidade: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Estado</label>
              <input
                className={inputClass}
                value={formPaciente.estado}
                onChange={(e) => setFormPaciente((p) => ({ ...p, estado: e.target.value }))}
                placeholder="SP"
                maxLength={2}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-text-secondary">Observações</label>
              <textarea
                rows={3}
                className={inputClass + ' resize-none'}
                value={formPaciente.observacoes}
                onChange={(e) => setFormPaciente((p) => ({ ...p, observacoes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogEditarAberto(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarPerfil}
              disabled={salvandoPerfil || !formPaciente.nome.trim()}
              className="px-6 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark disabled:opacity-50 transition-colors"
            >
              {salvandoPerfil ? 'Salvando…' : 'Salvar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova Consulta ────────────────────────────────────────────── */}
      <Dialog open={dialogConsultaAberto} onOpenChange={setDialogConsultaAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Nova Consulta</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Data</label>
              <input
                type="date"
                className={inputClass}
                value={formConsulta.data}
                onChange={(e) => setFormConsulta((f) => ({ ...f, data: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Hora</label>
              <input
                type="time"
                className={inputClass}
                value={formConsulta.hora}
                onChange={(e) => setFormConsulta((f) => ({ ...f, hora: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-text-secondary">Tipo</label>
              <select
                className={inputClass}
                value={formConsulta.tipo}
                onChange={(e) => setFormConsulta((f) => ({ ...f, tipo: e.target.value }))}
              >
                {TIPOS_CONSULTA.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-text-secondary">Duração (minutos)</label>
              <input
                type="number"
                min="15"
                max="480"
                step="15"
                className={inputClass}
                value={formConsulta.duracao}
                onChange={(e) => setFormConsulta((f) => ({ ...f, duracao: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-text-secondary">Observações</label>
              <textarea
                rows={3}
                className={inputClass + ' resize-none'}
                value={formConsulta.observacoes}
                onChange={(e) => setFormConsulta((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Informações adicionais…"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogConsultaAberto(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCriarConsulta}
              disabled={salvandoConsulta || !formConsulta.data || !formConsulta.hora}
              className="px-6 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark disabled:opacity-50 transition-colors"
            >
              {salvandoConsulta ? 'Agendando…' : 'Agendar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
