'use client';

import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  User,
  ExternalLink,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday as isDateToday,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgendamentoRow } from '../page';
import {
  atualizarStatusAgendamento,
  criarAgendamento,
  type StatusAgendamento,
} from '../actions';
import { createClient } from '@/lib/supabase/client';

// Mapeamento de status do banco (lowercase) para exibição
const STATUS_DISPLAY: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  realizado: 'Realizado',
  faltou: 'Faltou',
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmado': return 'bg-teal/10 text-teal';
    case 'agendado': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    case 'cancelado': return 'bg-red-500/10 text-red-600 dark:text-red-400';
    case 'realizado': return 'bg-green-500/10 text-green-600 dark:text-green-400';
    case 'faltou': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getTimelineDotColor = (status: string) => {
  switch (status) {
    case 'confirmado': return 'bg-teal';
    case 'agendado': return 'bg-blue-500';
    case 'cancelado': return 'bg-red-500';
    case 'realizado': return 'bg-green-500';
    case 'faltou': return 'bg-orange-500';
    default: return 'bg-muted';
  }
};

interface Props {
  agendamentos: AgendamentoRow[];
  clinicaId: string;
}

export function AgendamentosClient({ agendamentos: inicial, clinicaId: _clinicaId }: Props) {
  const router = useRouter();
  const [agendamentos, setAgendamentos] = useState(inicial);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedApt, setSelectedApt] = useState<AgendamentoRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Estado do formulário de novo agendamento
  const [novoForm, setNovoForm] = useState({
    pacienteSearch: '',
    pacienteId: '',
    pacienteNome: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    hora: '09:00',
    duracao: '30',
    tipo: '',
    observacoes: '',
  });
  const [pacienteSugestoes, setPacienteSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Dias do calendário para o mês atual
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end }).map((date) => ({
      date,
      isCurrentMonth: isSameMonth(date, currentMonth),
      isToday: isDateToday(date),
      isSelected: isSameDay(date, selectedDate),
      hasAppointments: agendamentos.some((apt) => isSameDay(parseISO(apt.data_hora), date)),
    }));
  }, [currentMonth, selectedDate, agendamentos]);

  // Agendamentos do dia selecionado
  const filteredAppointments = useMemo(
    () =>
      agendamentos
        .filter((apt) => isSameDay(parseISO(apt.data_hora), selectedDate))
        .sort((a, b) => a.data_hora.localeCompare(b.data_hora)),
    [agendamentos, selectedDate]
  );

  // Busca pacientes por nome (autocomplete)
  const buscarPacientes = useCallback(async (nome: string) => {
    if (nome.length < 2) {
      setPacienteSugestoes([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from('pacientes')
      .select('id, nome')
      .ilike('nome', `%${nome}%`)
      .limit(6);
    setPacienteSugestoes(data ?? []);
  }, []);

  // Atualiza status do agendamento via server action
  const handleStatusChange = async (id: string, status: string) => {
    const dbStatus = status as StatusAgendamento;
    const result = await atualizarStatusAgendamento(id, dbStatus);
    if (!result.error) {
      setAgendamentos((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
      );
      setSelectedApt((prev) => (prev?.id === id ? { ...prev, status } : prev));
    }
  };

  // Cria novo agendamento via server action
  const handleCriarAgendamento = async () => {
    if (!novoForm.pacienteId) {
      setSaveError('Selecione um paciente.');
      return;
    }
    setSaveError(null);
    setIsSaving(true);

    const dataHora = `${novoForm.data}T${novoForm.hora}:00`;
    const observacoesCombinadas =
      [novoForm.tipo, novoForm.observacoes].filter(Boolean).join(' — ') || null;
    const result = await criarAgendamento({
      pacienteId: novoForm.pacienteId,
      dataHora,
      duracaoMinutos: parseInt(novoForm.duracao, 10) || 30,
      observacoes: observacoesCombinadas,
    });

    if (result.error) {
      setSaveError(result.error);
    } else {
      // Adiciona otimisticamente ao estado local
      const novoAgt: AgendamentoRow = {
        id: result.id ?? crypto.randomUUID(),
        clinica_id: _clinicaId,
        paciente_id: novoForm.pacienteId,
        dentista_id: '',
        data_hora: dataHora,
        duracao_minutos: parseInt(novoForm.duracao, 10) || 30,
        status: 'agendado',
        observacoes: observacoesCombinadas,
        created_at: new Date().toISOString(),
        paciente: { id: novoForm.pacienteId, nome: novoForm.pacienteNome },
        dentista: null,
      };
      setAgendamentos((prev) => [...prev, novoAgt]);
      setIsNewModalOpen(false);
      setNovoForm({
        pacienteSearch: '',
        pacienteId: '',
        pacienteNome: '',
        data: format(new Date(), 'yyyy-MM-dd'),
        hora: '09:00',
        duracao: '30',
        tipo: '',
        observacoes: '',
      });
    }
    setIsSaving(false);
  };

  const handleOpenDetail = (apt: AgendamentoRow) => {
    setSelectedApt(apt);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      {/* Cabeçalho */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="font-heading text-4xl text-foreground mb-2">Agendamentos</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Gerencie sua agenda e compromissos.
          </p>
        </div>
        <button
          onClick={() => { setSaveError(null); setIsNewModalOpen(true); }}
          className="bg-teal text-white hover:bg-teal-lt px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(47,156,133,0.3)] w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </button>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendário */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-foreground capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground" />
                </button>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-accent rounded-lg transition-colors border border-border"
                >
                  <ChevronRight className="w-4 h-4 text-foreground" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map((day) => (
                <div
                  key={day}
                  className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedDate(day.date)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm relative cursor-pointer transition-all
                    ${!day.isCurrentMonth ? 'text-muted-foreground/50' : 'text-foreground hover:bg-accent'}
                    ${day.isToday ? 'border-2 border-teal' : ''}
                    ${day.isSelected ? 'bg-teal text-white hover:bg-teal-lt font-bold shadow-md' : ''}
                  `}
                >
                  <span>{format(day.date, 'd')}</span>
                  {day.hasAppointments && day.isCurrentMonth && !day.isSelected && (
                    <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-teal" />
                  )}
                  {day.hasAppointments && day.isSelected && (
                    <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-white" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mini-resumo do dia */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-teal/10 rounded-2xl p-4 border border-teal/20">
              <div className="text-[10px] font-bold text-teal uppercase tracking-wider mb-1">Hoje</div>
              <div className="font-mono text-2xl font-medium text-teal">
                {agendamentos.filter((a) => isDateToday(parseISO(a.data_hora))).length}
              </div>
              <div className="text-xs text-teal mt-1">Consultas</div>
            </div>
            <div className="bg-muted rounded-2xl p-4 border border-border">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Selecionado
              </div>
              <div className="font-mono text-2xl font-medium text-foreground">
                {filteredAppointments.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Agendadas</div>
            </div>
          </div>
        </motion.div>

        {/* Lista do dia selecionado */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl text-foreground capitalize">
                  {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {filteredAppointments.length} agendamento
                  {filteredAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex-1 p-6">
              <AnimatePresence mode="wait">
                {filteredAppointments.length > 0 ? (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative border-l-2 border-border ml-4 space-y-8 pb-4"
                  >
                    {filteredAppointments.map((apt, i) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.1 }}
                        key={apt.id}
                        className="relative pl-8 group"
                      >
                        {/* Ponto da timeline */}
                        <div
                          className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-background shadow-sm ${getTimelineDotColor(apt.status)}`}
                        />

                        <div
                          onClick={() => handleOpenDetail(apt)}
                          className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group-hover:border-teal/30 cursor-pointer"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-lg font-medium text-foreground">
                                  {format(parseISO(apt.data_hora), 'HH:mm')}
                                </span>
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Select
                                    value={apt.status}
                                    onValueChange={(val) => val && void handleStatusChange(apt.id, val)}
                                  >
                                    <SelectTrigger
                                      className={`h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider border-none shadow-none ${getStatusColor(apt.status)}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                      <SelectItem value="agendado">Agendado</SelectItem>
                                      <SelectItem value="confirmado">Confirmado</SelectItem>
                                      <SelectItem value="cancelado">Cancelado</SelectItem>
                                      <SelectItem value="realizado">Realizado</SelectItem>
                                      <SelectItem value="faltou">Faltou</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                {apt.paciente?.nome ?? '—'}
                              </h3>
                              {apt.observacoes && (
                                <p className="text-sm text-muted-foreground mt-1">{apt.observacoes}</p>
                              )}
                            </div>

                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => router.push(`/dashboard/pacientes/${apt.paciente?.id}`)}
                                className="px-4 py-2 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
                              >
                                Ver Ficha
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full py-20 text-center"
                  >
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <CalendarIcon className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Nenhum agendamento</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                      Não há compromissos marcados para este dia.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-6 rounded-xl border-border text-foreground hover:bg-muted"
                      onClick={() => setIsNewModalOpen(true)}
                    >
                      Agendar agora
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal: Novo Agendamento */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-foreground">
              Novo Agendamento
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Preencha os dados para marcar uma nova consulta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Busca de paciente com autocomplete */}
            <div className="space-y-2 relative">
              <Label htmlFor="patient" className="text-foreground">
                Paciente <span className="text-red-500">*</span>
              </Label>
              <Input
                id="patient"
                placeholder="Digite o nome do paciente..."
                value={novoForm.pacienteSearch}
                autoComplete="off"
                onChange={(e) => {
                  const v = e.target.value;
                  setNovoForm((f) => ({ ...f, pacienteSearch: v, pacienteId: '', pacienteNome: '' }));
                  setShowSugestoes(true);
                  void buscarPacientes(v);
                }}
                className="rounded-xl bg-muted border-border text-foreground"
              />
              {showSugestoes && pacienteSugestoes.length > 0 && (
                <div className="absolute z-50 w-full bg-card border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                  {pacienteSugestoes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setNovoForm((f) => ({
                          ...f,
                          pacienteSearch: p.nome,
                          pacienteId: p.id,
                          pacienteNome: p.nome,
                        }));
                        setShowSugestoes(false);
                        setPacienteSugestoes([]);
                      }}
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors text-foreground"
                    >
                      {p.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apt-date" className="text-foreground">
                  Data
                </Label>
                <Input
                  id="apt-date"
                  type="date"
                  value={novoForm.data}
                  onChange={(e) => setNovoForm((f) => ({ ...f, data: e.target.value }))}
                  className="rounded-xl bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apt-time" className="text-foreground">
                  Hora
                </Label>
                <Input
                  id="apt-time"
                  type="time"
                  value={novoForm.hora}
                  onChange={(e) => setNovoForm((f) => ({ ...f, hora: e.target.value }))}
                  className="rounded-xl bg-muted border-border text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Duração (min)</Label>
                <Select
                  value={novoForm.duracao}
                  onValueChange={(v) => v && setNovoForm((f) => ({ ...f, duracao: v }))}
                >
                  <SelectTrigger className="rounded-xl bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                    <SelectItem value="90">90 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Procedimento</Label>
                <Input
                  placeholder="Ex: Limpeza, Avaliação..."
                  value={novoForm.tipo}
                  onChange={(e) => setNovoForm((f) => ({ ...f, tipo: e.target.value }))}
                  className="rounded-xl bg-muted border-border text-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apt-notes" className="text-foreground">
                Observações
              </Label>
              <textarea
                id="apt-notes"
                value={novoForm.observacoes}
                onChange={(e) => setNovoForm((f) => ({ ...f, observacoes: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-teal/20 transition-all resize-none text-foreground placeholder:text-muted-foreground/50"
                placeholder="Notas adicionais..."
              />
            </div>

            {saveError && (
              <p className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{saveError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewModalOpen(false)}
              className="rounded-xl border-border text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCriarAgendamento()}
              disabled={isSaving}
              className="bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : 'Salvar Agendamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhe do agendamento */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-card border-border">
          {selectedApt && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${getStatusColor(selectedApt.status)}`}
                  >
                    {STATUS_DISPLAY[selectedApt.status] ?? selectedApt.status}
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/pacientes/${selectedApt.paciente?.id}`)}
                    className="text-teal text-xs font-bold flex items-center gap-1 hover:underline"
                  >
                    Ver Ficha <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <DialogTitle className="font-heading text-3xl text-foreground">
                  {selectedApt.paciente?.nome ?? '—'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Detalhes do agendamento clínico.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-6">
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Data e Hora
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CalendarIcon className="w-4 h-4 text-teal" />
                    {format(parseISO(selectedApt.data_hora), "dd/MM/yyyy 'às' HH:mm")}
                  </div>
                </div>

                {selectedApt.observacoes && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Observações
                    </div>
                    <div className="text-sm font-medium text-foreground">{selectedApt.observacoes}</div>
                  </div>
                )}

                <div className="space-y-3">
                  <Label className="text-foreground">Alterar Status</Label>
                  <Select
                    value={selectedApt.status}
                    onValueChange={(val) => val && void handleStatusChange(selectedApt.id, val)}
                  >
                    <SelectTrigger className="rounded-xl bg-muted border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                      <SelectItem value="realizado">Realizado</SelectItem>
                      <SelectItem value="faltou">Faltou</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="rounded-xl border-border text-foreground hover:bg-muted"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
