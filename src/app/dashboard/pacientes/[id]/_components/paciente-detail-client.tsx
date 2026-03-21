'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Clock,
  CreditCard,
  Plus,
  Edit2,
  ChevronRight,
  Activity,
  Save,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Trash2,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DocumentosTab } from '@/components/pacientes/DocumentosTab';
import { PlanejamentoTab } from '@/components/pacientes/PlanejamentoTab';
import { FichasTab } from '@/components/pacientes/FichasTab';
import { createClient } from '@/lib/supabase/client';
import { atualizarPaciente, salvarAnotacoes } from '../actions';
import {
  atualizarStatusOrcamento,
  registrarPagamento,
  criarOrcamento,
  type FormaPagamento,
  type StatusOrcamento,
} from '@/app/dashboard/orcamentos/actions';
import { criarAgendamento } from '@/app/dashboard/agendamentos/actions';
import type { Paciente } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FichaRecente = {
  id: string;
  created_at: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentista: { nome: string } | null;
};

type AgendamentoProximo = {
  id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  observacoes: string | null;
  dentista: { nome: string } | null;
};

type OrcamentoItem = {
  id: string;
  descricao: string | null;
  preco_total: number | null;
  quantidade: number;
};

type Pagamento = {
  id: string;
  valor: number;
  status: string;
  forma_pagamento: string | null;
};

type OrcamentoComItens = {
  id: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  total: number | null;
  created_at: string;
  validade_dias: number;
  condicoes_pagamento: string | null;
  itens: OrcamentoItem[];
  pagamentos: Pagamento[];
};

interface ProcedimentoClinica {
  id: string;
  nome: string;
  preco_padrao: number | null;
}

interface NovoOrcItem {
  procedimentoId: string;
  descricao: string;
  quantidade: number;
  preco: number;
}

interface PacienteDetailClientProps {
  paciente: Paciente;
  agendamentoProximo: AgendamentoProximo | null;
  orcamentos: OrcamentoComItens[];
  clinicaId: string;
  dentistaId: string;
}

const STATUS_ORCAMENTO: Record<string, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' },
  enviado: { label: 'Enviado', cls: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  aprovado: { label: 'Aprovado', cls: 'bg-teal/10 text-teal' },
  recusado: { label: 'Recusado', cls: 'bg-red-500/10 text-red-500' },
};

export function PacienteDetailClient({
  paciente,
  agendamentoProximo,
  orcamentos,
  clinicaId,
  dentistaId,
}: PacienteDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState('visao-geral');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [notes, setNotes] = useState(paciente.observacoes ?? '');
  const [saveNotesDone, setSaveNotesDone] = useState(false);
  const [saveNotesError, setSaveNotesError] = useState<string | null>(null);

  const [editNome, setEditNome] = useState(paciente.nome);
  const [editTelefone, setEditTelefone] = useState(paciente.telefone ?? '');
  const [editEmail, setEditEmail] = useState(paciente.email ?? '');
  const [editEndereco, setEditEndereco] = useState(paciente.endereco ?? '');
  const [editError, setEditError] = useState<string | null>(null);

  // Orçamentos — cópia local para atualizações otimistas
  const [orcamentosState, setOrcamentosState] = useState<OrcamentoComItens[]>(orcamentos);
  const [detalheOrcId, setDetalheOrcId] = useState<string | null>(null);
  const [isNovoOrcOpen, setIsNovoOrcOpen] = useState(false);
  const [procedimentosClinica, setProcedimentosClinica] = useState<ProcedimentoClinica[]>([]);
  const [novoOrcItens, setNovoOrcItens] = useState<NovoOrcItem[]>([
    { procedimentoId: '', descricao: '', quantidade: 1, preco: 0 },
  ]);
  const [pagForm, setPagForm] = useState({
    valor: '',
    formaPagamento: 'pix' as FormaPagamento,
    data: new Date().toISOString().split('T')[0],
  });
  const [orcSaving, setOrcSaving] = useState(false);
  const [pagSaving, setPagSaving] = useState(false);
  const [orcError, setOrcError] = useState<string | null>(null);
  const [pagError, setPagError] = useState<string | null>(null);
  const [isLoadingFichaParaOrc, setIsLoadingFichaParaOrc] = useState(false);

  // Nova Consulta
  const [isNovaConsultaOpen, setIsNovaConsultaOpen] = useState(false);
  const [consultaForm, setConsultaForm] = useState({
    data: '',
    hora: '',
    duracao: '30',
    observacoes: '',
  });
  const [consultaSaving, setConsultaSaving] = useState(false);
  const [consultaError, setConsultaError] = useState<string | null>(null);

  // Atividades recentes (visão geral)
  const [fichasRecentes, setFichasRecentes] = useState<FichaRecente[]>([]);

  const iniciais = paciente.nome
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const endereco = [
    paciente.endereco,
    paciente.cidade && paciente.estado
      ? `${paciente.cidade}, ${paciente.estado}`
      : (paciente.cidade ?? paciente.estado),
  ]
    .filter(Boolean)
    .join(' — ');

  const dataNascimento = paciente.data_nascimento
    ? format(parseISO(paciente.data_nascimento), 'dd/MM/yyyy', { locale: ptBR })
    : null;

  const membroDesde = format(parseISO(paciente.created_at), "MMM 'de' yyyy", { locale: ptBR });

  // Orçamento selecionado no detalhe
  const detalheOrc = orcamentosState.find((o) => o.id === detalheOrcId) ?? null;
  const novoOrcTotal = novoOrcItens.reduce((s, i) => s + i.quantidade * i.preco, 0);

  const totalPago = orcamentosState
    .flatMap((o) => o.pagamentos)
    .filter((p) => p.status === 'pago')
    .reduce((sum, p) => sum + p.valor, 0);

  const totalOrcado = orcamentosState.reduce((sum, o) => sum + (o.total ?? 0), 0);

  const handleSaveNotes = () => {
    setSaveNotesError(null);
    setSaveNotesDone(false);
    startTransition(async () => {
      const result = await salvarAnotacoes(paciente.id, notes);
      if (result.error) {
        setSaveNotesError(result.error);
      } else {
        setSaveNotesDone(true);
        router.refresh();
      }
    });
  };

  const handleSaveEdit = () => {
    setEditError(null);
    startTransition(async () => {
      const result = await atualizarPaciente(paciente.id, {
        nome: editNome,
        telefone: editTelefone || null,
        email: editEmail || null,
        endereco: editEndereco || null,
      });
      if (result.error) {
        setEditError(result.error);
      } else {
        setIsEditModalOpen(false);
        router.refresh();
      }
    });
  };

  // Busca procedimentos da clínica e fichas recentes ao montar
  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from('procedimentos')
      .select('id, nome, preco_padrao')
      .eq('clinica_id', clinicaId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setProcedimentosClinica(data ?? []));

    void supabase
      .from('fichas')
      .select('id, created_at, queixa_principal, anotacoes, dentista:dentistas(nome)')
      .eq('paciente_id', paciente.id)
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setFichasRecentes((data as unknown as FichaRecente[]) ?? []));
  }, [clinicaId, paciente.id]);

  const handleStatusChange = useCallback(async (orcId: string, status: StatusOrcamento) => {
    const result = await atualizarStatusOrcamento(orcId, status);
    if (!result.error) {
      setOrcamentosState((prev) =>
        prev.map((o) => (o.id === orcId ? { ...o, status } : o))
      );
    }
  }, []);

  const handleRegistrarPagamento = async () => {
    if (!detalheOrcId) return;
    const valor = parseFloat(pagForm.valor.replace(',', '.'));
    if (!valor || valor <= 0) {
      setPagError('Informe um valor válido.');
      return;
    }
    setPagError(null);
    setPagSaving(true);

    const result = await registrarPagamento({
      orcamentoId: detalheOrcId,
      valor,
      formaPagamento: pagForm.formaPagamento,
      data: pagForm.data,
    });

    if (result.error) {
      setPagError(result.error);
    } else {
      const novoPag: Pagamento = {
        id: result.id ?? crypto.randomUUID(),
        valor,
        status: 'pago',
        forma_pagamento: pagForm.formaPagamento,
      };
      setOrcamentosState((prev) =>
        prev.map((o) =>
          o.id === detalheOrcId
            ? { ...o, pagamentos: [...o.pagamentos, novoPag] }
            : o
        )
      );
      setPagForm({
        valor: '',
        formaPagamento: 'pix',
        data: new Date().toISOString().split('T')[0],
      });
      router.refresh();
    }
    setPagSaving(false);
  };

  const abrirNovoOrcamento = async () => {
    setOrcError(null);
    setIsLoadingFichaParaOrc(true);
    try {
      const supabase = createClient();
      const { data: ficha } = await supabase
        .from('fichas')
        .select('dentes_afetados, dentes_observacoes')
        .eq('paciente_id', paciente.id)
        .eq('clinica_id', clinicaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const dentes = (ficha?.dentes_afetados as number[] | null) ?? [];
      const obs = (ficha?.dentes_observacoes as Record<string, string> | null) ?? {};

      if (dentes.length > 0) {
        const itens: NovoOrcItem[] = dentes.map((tooth) => {
          const toothObs = obs[String(tooth)] ?? '';
          const match = toothObs
            ? procedimentosClinica.find(
                (p) =>
                  p.nome.toLowerCase().includes(toothObs.toLowerCase()) ||
                  toothObs.toLowerCase().includes(p.nome.toLowerCase())
              )
            : undefined;
          return {
            procedimentoId: match?.id ?? '',
            descricao: `Dente ${tooth}${toothObs ? ` — ${match?.nome ?? toothObs}` : ''}`,
            quantidade: 1,
            preco: match?.preco_padrao ?? 0,
          };
        });
        setNovoOrcItens(itens);
      } else {
        setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
      }
    } catch {
      setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
    } finally {
      setIsLoadingFichaParaOrc(false);
    }
    setIsNovoOrcOpen(true);
  };

  const handleCriarOrcamento = async () => {
    const itensValidos = novoOrcItens.filter((i) => i.descricao.trim() && i.preco > 0);
    if (itensValidos.length === 0) {
      setOrcError('Adicione ao menos um procedimento com descrição e valor.');
      return;
    }
    setOrcError(null);
    setOrcSaving(true);

    const result = await criarOrcamento({
      pacienteId: paciente.id,
      itens: itensValidos.map((i) => ({
        procedimentoId: i.procedimentoId || null,
        descricao: i.descricao,
        quantidade: i.quantidade,
        precoUnitario: i.preco,
      })),
    });

    if (result.error) {
      setOrcError(result.error);
    } else {
      setIsNovoOrcOpen(false);
      setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
      router.refresh();
    }
    setOrcSaving(false);
  };

  const handleNovaConsulta = async () => {
    if (!consultaForm.data || !consultaForm.hora) {
      setConsultaError('Informe data e hora.');
      return;
    }
    setConsultaError(null);
    setConsultaSaving(true);
    const dataHora = `${consultaForm.data}T${consultaForm.hora}:00`;
    const result = await criarAgendamento({
      pacienteId: paciente.id,
      dataHora,
      duracaoMinutos: parseInt(consultaForm.duracao, 10) || 30,
      observacoes: consultaForm.observacoes || null,
    });
    if (result.error) {
      setConsultaError(result.error);
    } else {
      setIsNovaConsultaOpen(false);
      setConsultaForm({ data: '', hora: '', duracao: '30', observacoes: '' });
      router.refresh();
    }
    setConsultaSaving(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <button
          onClick={() => router.push('/dashboard/pacientes')}
          className="p-2 hover:bg-card rounded-xl transition-colors border border-transparent hover:border-border/40"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="font-heading text-4xl text-foreground">{paciente.nome}</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Paciente desde {membroDesde}
            {dataNascimento && ` • Nascimento: ${dataNascimento}`}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3 space-y-6"
        >
          {/* Header Card */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-teal flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {iniciais}
              </div>
              <div className="space-y-1">
                {paciente.telefone && (
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Phone className="w-4 h-4 text-teal" /> {paciente.telefone}
                  </div>
                )}
                {paciente.email && (
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Mail className="w-4 h-4 text-teal" /> {paciente.email}
                  </div>
                )}
                {endereco && (
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <MapPin className="w-4 h-4 text-teal" /> {endereco}
                  </div>
                )}
                {!paciente.telefone && !paciente.email && !endereco && (
                  <div className="text-sm text-muted-foreground">Sem informações de contato</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setConsultaError(null); setIsNovaConsultaOpen(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal text-white rounded-xl text-xs font-bold hover:bg-teal-lt transition-colors shadow-md"
              >
                <Calendar className="w-3.5 h-3.5" />
                Nova Consulta
              </button>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-xl text-xs font-bold text-foreground hover:bg-accent transition-colors border border-border/40"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar Perfil
              </button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/40 mb-6 flex-wrap h-auto gap-1">
              {[
                ['visao-geral', 'Visão Geral'],
                ['fichas', 'Fichas Clínicas'],
                ['documentos', 'Documentos'],
                ['planejamento', 'Planejamento'],
                ['orcamentos', 'Orçamentos'],
              ].map(([val, label]) => (
                <TabsTrigger
                  key={val}
                  value={val}
                  className="rounded-lg px-4 py-2 text-xs font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Visão Geral */}
                <TabsContent value="visao-geral" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Próxima Consulta */}
                    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-heading text-xl text-foreground">Próxima Consulta</h3>
                        <Clock className="w-5 h-5 text-teal" />
                      </div>
                      {agendamentoProximo ? (
                        <div className="flex items-center gap-4 p-4 bg-muted rounded-2xl border border-border/20">
                          <div className="w-12 h-12 bg-card rounded-xl flex flex-col items-center justify-center shadow-sm shrink-0">
                            <span className="text-[10px] font-bold text-teal uppercase">
                              {format(parseISO(agendamentoProximo.data_hora), 'MMM', { locale: ptBR })}
                            </span>
                            <span className="text-lg font-bold text-foreground leading-none">
                              {format(parseISO(agendamentoProximo.data_hora), 'dd')}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-sm text-foreground">
                              {agendamentoProximo.observacoes ?? 'Consulta agendada'}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(parseISO(agendamentoProximo.data_hora), "EEEE, 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </div>
                            {agendamentoProximo.dentista && (
                              <div className="text-xs text-teal mt-0.5 font-medium">
                                {agendamentoProximo.dentista.nome}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-muted rounded-2xl border border-border/20 text-center">
                          <p className="text-sm text-muted-foreground">Nenhuma consulta agendada.</p>
                        </div>
                      )}
                      <button
                        onClick={() => router.push('/dashboard/agendamentos')}
                        className="w-full mt-4 py-3 text-xs font-bold text-teal hover:text-teal-lt transition-colors flex items-center justify-center gap-2"
                      >
                        Ver Agendamentos <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Resumo Financeiro */}
                    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-heading text-xl text-foreground">Resumo Financeiro</h3>
                        <CreditCard className="w-5 h-5 text-teal" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">
                            Total orçado
                          </span>
                          <span className="font-mono text-sm font-bold text-foreground">
                            R${' '}
                            {totalOrcado.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">
                            Total pago
                          </span>
                          <span className="font-mono text-sm font-bold text-teal">
                            R${' '}
                            {totalPago.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="h-px bg-border w-full" />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">
                            {orcamentosState.length} orçamento{orcamentosState.length !== 1 ? 's' : ''} no total
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {orcamentosState.filter((o) => o.status === 'aprovado').length} aprovado
                            {orcamentosState.filter((o) => o.status === 'aprovado').length !== 1
                              ? 's'
                              : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('orcamentos')}
                        className="w-full mt-4 py-3 bg-muted hover:bg-accent rounded-xl text-xs font-bold text-foreground transition-colors"
                      >
                        Ver Orçamentos
                      </button>
                    </div>
                  </div>

                  {/* Atividade Recente */}
                  <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-heading text-xl text-foreground">Atividade Recente</h3>
                      <FileText className="w-5 h-5 text-teal" />
                    </div>
                    {fichasRecentes.length === 0 ? (
                      <div className="text-center py-6">
                        <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhum registro clínico ainda.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {fichasRecentes.map((ficha) => (
                          <div
                            key={ficha.id}
                            className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
                              <FileText className="w-4 h-4 text-teal" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">
                                {ficha.queixa_principal ?? 'Evolução clínica'}
                              </div>
                              {ficha.anotacoes && (
                                <div className="text-xs text-muted-foreground truncate mt-0.5">
                                  {ficha.anotacoes}
                                </div>
                              )}
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-muted-foreground">
                                  {format(parseISO(ficha.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                                {ficha.dentista && (
                                  <span className="text-[10px] text-teal font-medium">
                                    {ficha.dentista.nome}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="fichas" className="mt-0">
                  <FichasTab
                    patientId={paciente.id}
                    clinicaId={clinicaId}
                    dentistaId={dentistaId}
                  />
                </TabsContent>

                <TabsContent value="documentos" className="mt-0">
                  <DocumentosTab patientId={paciente.id} clinicaId={clinicaId} />
                </TabsContent>

                <TabsContent value="planejamento" className="mt-0">
                  <PlanejamentoTab patientId={paciente.id} clinicaId={clinicaId} patientName={paciente.nome} />
                </TabsContent>

                {/* Orçamentos */}
                <TabsContent value="orcamentos" className="mt-0 space-y-4">
                  {/* Botão novo orçamento — sempre visível */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-medium">
                      {orcamentosState.length} orçamento{orcamentosState.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => void abrirNovoOrcamento()}
                      disabled={isLoadingFichaParaOrc}
                      className="bg-teal text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-teal-lt transition-all shadow-md disabled:opacity-60"
                    >
                      {isLoadingFichaParaOrc ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Novo Orçamento
                    </button>
                  </div>

                  {orcamentosState.length === 0 ? (
                    <div className="bg-card rounded-2xl border border-border shadow-sm p-8 text-center">
                      <CreditCard className="w-12 h-12 text-teal/20 mx-auto mb-4" />
                      <h3 className="font-heading text-2xl text-foreground mb-2">
                        Nenhum orçamento
                      </h3>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Nenhum orçamento ainda. Clique em + Novo Orçamento para criar.
                      </p>
                    </div>
                  ) : (
                    orcamentosState.map((orc) => {
                      const st = STATUS_ORCAMENTO[orc.status] ?? STATUS_ORCAMENTO.rascunho;
                      const StatusIcon =
                        orc.status === 'aprovado'
                          ? CheckCircle2
                          : orc.status === 'recusado'
                          ? XCircle
                          : AlertCircle;
                      return (
                        <div
                          key={orc.id}
                          onClick={() => setDetalheOrcId(orc.id)}
                          className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 cursor-pointer hover:border-teal/30 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <StatusIcon className="w-5 h-5 text-teal" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${st.cls}`}
                                  >
                                    {st.label}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(parseISO(orc.created_at), 'dd/MM/yyyy', {
                                    locale: ptBR,
                                  })}
                                  {orc.validade_dias && (
                                    <> • Validade: {orc.validade_dias} dias</>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-mono text-lg font-bold text-foreground">
                                  R${' '}
                                  {(orc.total ?? 0).toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>

                          {orc.itens.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {orc.itens.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <FileText className="w-3 h-3" />
                                    {item.descricao ?? '—'}
                                    {item.quantidade > 1 && (
                                      <span className="font-mono">×{item.quantidade}</span>
                                    )}
                                  </div>
                                  <span className="font-mono text-foreground font-medium">
                                    R${' '}
                                    {(item.preco_total ?? 0).toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {orc.pagamentos.length > 0 && (
                            <div className="pt-3 border-t border-border/40">
                              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                                Pagamentos
                              </div>
                              {orc.pagamentos.map((pg) => (
                                <div
                                  key={pg.id}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-muted-foreground capitalize">
                                    {pg.forma_pagamento ?? 'Não informado'} •{' '}
                                    <span
                                      className={
                                        pg.status === 'pago' ? 'text-teal' : 'text-yellow-600'
                                      }
                                    >
                                      {pg.status}
                                    </span>
                                  </span>
                                  <span className="font-mono font-medium text-foreground">
                                    R${' '}
                                    {pg.valor.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </motion.div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <div className="bg-teal/10 rounded-2xl border border-teal/20 shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-teal" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-teal font-bold">
                Resumo Rápido
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Orçamentos</span>
                <span className="font-bold text-foreground">{orcamentosState.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Aprovados</span>
                <span className="font-bold text-teal">
                  {orcamentosState.filter((o) => o.status === 'aprovado').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total pago</span>
                <span className="font-mono text-xs font-bold text-foreground">
                  R${' '}
                  {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Anotações */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h3 className="font-heading text-lg text-foreground mb-4">Anotações</h3>
            <textarea
              className="w-full bg-muted border-none rounded-xl p-4 text-xs font-medium text-foreground placeholder:text-muted-foreground/50 min-h-[120px] focus:ring-2 focus:ring-teal/20 transition-all resize-none"
              placeholder="Observações sobre o paciente..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaveNotesDone(false);
              }}
            />
            {saveNotesError && <p className="text-xs text-red-500 mt-2">{saveNotesError}</p>}
            {saveNotesDone && <p className="text-xs text-teal mt-2">Salvo com sucesso.</p>}
            <button
              onClick={handleSaveNotes}
              disabled={isPending}
              className="w-full mt-4 py-2.5 bg-teal/10 hover:bg-teal/20 text-teal rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isPending ? 'Salvando...' : 'Salvar Anotações'}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Dialog: Editar Perfil */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-foreground">
              Editar Perfil
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Atualize as informações cadastrais do paciente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome Completo</Label>
              <Input
                id="edit-nome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="rounded-xl bg-muted border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-telefone">Telefone</Label>
                <Input
                  id="edit-telefone"
                  value={editTelefone}
                  onChange={(e) => setEditTelefone(e.target.value)}
                  className="rounded-xl bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="rounded-xl bg-muted border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-endereco">Endereço</Label>
              <Input
                id="edit-endereco"
                value={editEndereco}
                onChange={(e) => setEditEndereco(e.target.value)}
                className="rounded-xl bg-muted border-border"
              />
            </div>
            {editError && <p className="text-xs text-red-500">{editError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isPending || !editNome.trim()}
              className="bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhe do orçamento */}
      <Dialog
        open={!!detalheOrcId}
        onOpenChange={(open) => {
          if (!open) {
            setDetalheOrcId(null);
            setPagError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          {detalheOrc && (
            <>
              <DialogHeader>
                <div className="mb-1">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${STATUS_ORCAMENTO[detalheOrc.status]?.cls ?? ''}`}
                  >
                    {STATUS_ORCAMENTO[detalheOrc.status]?.label}
                  </span>
                </div>
                <DialogTitle className="font-heading text-2xl text-foreground">
                  Orçamento de{' '}
                  {format(parseISO(detalheOrc.created_at), "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Validade: {detalheOrc.validade_dias} dias
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Alterar status */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Status
                  </Label>
                  <Select
                    value={detalheOrc.status}
                    onValueChange={(v) =>
                      v && void handleStatusChange(detalheOrc.id, v as StatusOrcamento)
                    }
                  >
                    <SelectTrigger className="rounded-xl bg-muted border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="recusado">Recusado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Procedimentos */}
                {detalheOrc.itens.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Procedimentos
                    </div>
                    <div className="bg-muted rounded-xl p-4 space-y-2">
                      {detalheOrc.itens.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="text-foreground">
                            {item.descricao ?? '—'}
                            {item.quantidade > 1 && (
                              <span className="text-muted-foreground font-mono ml-2 text-xs">
                                ×{item.quantidade}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-foreground font-medium">
                            R${' '}
                            {(item.preco_total ?? 0).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between font-bold">
                        <span className="text-sm text-foreground">Total</span>
                        <span className="font-mono text-lg text-foreground">
                          R${' '}
                          {(detalheOrc.total ?? 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Histórico de pagamentos */}
                {detalheOrc.pagamentos.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Histórico de Pagamentos
                    </div>
                    <div className="bg-muted rounded-xl p-4 space-y-2">
                      {detalheOrc.pagamentos.map((pg) => (
                        <div
                          key={pg.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-foreground capitalize">
                              {pg.forma_pagamento ?? 'Não informado'}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                pg.status === 'pago'
                                  ? 'bg-teal/10 text-teal'
                                  : 'bg-yellow-500/10 text-yellow-600'
                              }`}
                            >
                              {pg.status}
                            </span>
                          </div>
                          <span className="font-mono font-medium text-foreground">
                            R${' '}
                            {pg.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Registrar pagamento */}
                <div className="space-y-3 border-t border-border/40 pt-4">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Registrar Pagamento
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-foreground text-xs">Valor (R$)</Label>
                      <Input
                        type="number"
                        placeholder="0,00"
                        min="0"
                        step="0.01"
                        value={pagForm.valor}
                        onChange={(e) =>
                          setPagForm((f) => ({ ...f, valor: e.target.value }))
                        }
                        className="rounded-xl bg-muted border-border text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground text-xs">Data</Label>
                      <Input
                        type="date"
                        value={pagForm.data}
                        onChange={(e) =>
                          setPagForm((f) => ({ ...f, data: e.target.value }))
                        }
                        className="rounded-xl bg-muted border-border text-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs">Forma de Pagamento</Label>
                    <Select
                      value={pagForm.formaPagamento}
                      onValueChange={(v) =>
                        v && setPagForm((f) => ({ ...f, formaPagamento: v as FormaPagamento }))
                      }
                    >
                      <SelectTrigger className="rounded-xl bg-muted border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                        <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {pagError && (
                    <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                      {pagError}
                    </p>
                  )}
                  <Button
                    onClick={() => void handleRegistrarPagamento()}
                    disabled={pagSaving || !pagForm.valor}
                    className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50"
                  >
                    {pagSaving ? 'Salvando...' : 'Confirmar Pagamento'}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetalheOrcId(null);
                    setPagError(null);
                  }}
                  className="rounded-xl border-border text-foreground hover:bg-muted"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Consulta */}
      <Dialog open={isNovaConsultaOpen} onOpenChange={setIsNovaConsultaOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-foreground">
              Nova Consulta
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Agende uma consulta para {paciente.nome}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="consulta-data">Data</Label>
                <Input
                  id="consulta-data"
                  type="date"
                  value={consultaForm.data}
                  onChange={(e) => setConsultaForm((f) => ({ ...f, data: e.target.value }))}
                  className="rounded-xl bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consulta-hora">Hora</Label>
                <Input
                  id="consulta-hora"
                  type="time"
                  value={consultaForm.hora}
                  onChange={(e) => setConsultaForm((f) => ({ ...f, hora: e.target.value }))}
                  className="rounded-xl bg-muted border-border text-foreground"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="consulta-duracao">Duração (minutos)</Label>
              <Input
                id="consulta-duracao"
                type="number"
                min="15"
                step="15"
                value={consultaForm.duracao}
                onChange={(e) => setConsultaForm((f) => ({ ...f, duracao: e.target.value }))}
                className="rounded-xl bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consulta-obs">Observações</Label>
              <Input
                id="consulta-obs"
                placeholder="Ex: Consulta de rotina, limpeza..."
                value={consultaForm.observacoes}
                onChange={(e) => setConsultaForm((f) => ({ ...f, observacoes: e.target.value }))}
                className="rounded-xl bg-muted border-border text-foreground"
              />
            </div>
            {consultaError && (
              <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                {consultaError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNovaConsultaOpen(false)}
              className="rounded-xl border-border text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleNovaConsulta()}
              disabled={consultaSaving}
              className="bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 flex items-center gap-2"
            >
              {consultaSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : (
                'Agendar Consulta'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Novo Orçamento */}
      <Dialog open={isNovoOrcOpen} onOpenChange={setIsNovoOrcOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-foreground">
              Novo Orçamento
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Selecione procedimentos e defina os valores.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {novoOrcItens.map((item, idx) => (
              <div key={idx} className="bg-muted rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Procedimento {idx + 1}
                  </span>
                  {novoOrcItens.length > 1 && (
                    <button
                      onClick={() =>
                        setNovoOrcItens((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-foreground text-xs">Procedimento da clínica</Label>
                  <Select
                    value={item.procedimentoId}
                    onValueChange={(v) => {
                      if (!v) return;
                      const proc = procedimentosClinica.find((p) => p.id === v);
                      setNovoOrcItens((prev) =>
                        prev.map((it, i) =>
                          i === idx
                            ? {
                                ...it,
                                procedimentoId: v,
                                descricao: proc?.nome ?? it.descricao,
                                preco: proc?.preco_padrao ?? it.preco,
                              }
                            : it
                        )
                      );
                    }}
                  >
                    <SelectTrigger className="rounded-xl bg-card border-border text-foreground">
                      <SelectValue placeholder="Selecionar (opcional)..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {procedimentosClinica.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-foreground text-xs">Descrição *</Label>
                  <Input
                    placeholder="Ex: Restauração dente 36"
                    value={item.descricao}
                    onChange={(e) =>
                      setNovoOrcItens((prev) =>
                        prev.map((it, i) =>
                          i === idx ? { ...it, descricao: e.target.value } : it
                        )
                      )
                    }
                    className="rounded-xl bg-card border-border text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs">Qtd</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(e) =>
                        setNovoOrcItens((prev) =>
                          prev.map((it, i) =>
                            i === idx
                              ? { ...it, quantidade: parseInt(e.target.value) || 1 }
                              : it
                          )
                        )
                      }
                      className="rounded-xl bg-card border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-xs">Valor unitário (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.preco}
                      onChange={(e) =>
                        setNovoOrcItens((prev) =>
                          prev.map((it, i) =>
                            i === idx
                              ? { ...it, preco: parseFloat(e.target.value) || 0 }
                              : it
                          )
                        )
                      }
                      className="rounded-xl bg-card border-border text-foreground"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() =>
                setNovoOrcItens((prev) => [
                  ...prev,
                  { procedimentoId: '', descricao: '', quantidade: 1, preco: 0 },
                ])
              }
              className="w-full py-3 border-2 border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Procedimento
            </button>

            {novoOrcTotal > 0 && (
              <div className="bg-teal/10 rounded-xl p-4 flex items-center justify-between border border-teal/20">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="font-mono text-xl font-bold text-teal">
                  R$ {novoOrcTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {orcError && (
              <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                {orcError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNovoOrcOpen(false)}
              className="rounded-xl border-border text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCriarOrcamento()}
              disabled={orcSaving}
              className="bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50"
            >
              {orcSaving ? 'Salvando...' : 'Criar Orçamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
