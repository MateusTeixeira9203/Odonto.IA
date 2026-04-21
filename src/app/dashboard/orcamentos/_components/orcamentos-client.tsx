'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  CircleDollarSign,
  Search,
  Filter,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  FileText,
  Calendar,
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  Banknote,
  QrCode,
  User,
  Languages,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import type { DentistaRole } from '@/types/database';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import type { OrcamentoRow, OrcamentoItemRow, PagamentoRow } from '../page';
import { BotaoDownloadPDF } from '@/components/orcamentos/botao-download-pdf';
import { BotaoEnviarWhatsApp } from '@/components/orcamentos/botao-enviar-whatsapp';
import {
  atualizarStatusOrcamento,
  registrarPagamento,
  registrarPagamentoRapido,
  criarOrcamento,
  editarOrcamento,
  excluirOrcamento,
  type FormaPagamento,
  type StatusOrcamento,
} from '../actions';

// Mapeamento de status para exibição
const STATUS_MAP: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  aprovado: { label: 'Aprovado', icon: CheckCircle2, color: 'text-teal', bg: 'bg-teal/10' },
  enviado:  { label: 'Enviado',  icon: Clock,     color: 'text-text-secondary', bg: 'bg-surface-alt' },
  rascunho: { label: 'Rascunho', icon: FileText,  color: 'text-muted-foreground', bg: 'bg-muted' },
  recusado: { label: 'Recusado', icon: XCircle,   color: 'text-coral',          bg: 'bg-coral/10' },
};

const formatCurrency = (value: number | null) =>
  (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

export function OrcamentosClient({
  orcamentos: inicial,
  clinicaId,
  role,
  temSecretaria = false,
  canEdit = false,
  dentistas = [],
}: {
  orcamentos: OrcamentoRow[];
  clinicaId: string;
  role: DentistaRole;
  temSecretaria?: boolean;
  canEdit?: boolean;
  dentistas?: { id: string; nome: string }[];
}) {
  const isSecretaria = role === 'secretaria';
  const router = useRouter();
  const [orcamentos, setOrcamentos] = useState(inicial);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [selected, setSelected] = useState<OrcamentoRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Novo orçamento
  const [isNovoOrcOpen, setIsNovoOrcOpen] = useState(false);
  const [procedimentosClinica, setProcedimentosClinica] = useState<ProcedimentoClinica[]>([]);
  const [novoOrcItens, setNovoOrcItens] = useState<NovoOrcItem[]>([
    { procedimentoId: '', descricao: '', quantidade: 1, preco: 0 },
  ]);
  const [novoOrcDesconto, setNovoOrcDesconto] = useState(0);
  const [novoOrcPacienteSearch, setNovoOrcPacienteSearch] = useState('');
  const [novoOrcPacienteId, setNovoOrcPacienteId] = useState('');
  const [novoOrcPacienteNome, setNovoOrcPacienteNome] = useState('');
  const [pacienteSugestoes, setPacienteSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [orcSaving, setOrcSaving] = useState(false);
  const [orcError, setOrcError] = useState<string | null>(null);

  // Registrar pagamento (painel lateral)
  const [pagForm, setPagForm] = useState({
    valor: '',
    formaPagamento: 'pix' as FormaPagamento,
    data: new Date().toISOString().split('T')[0],
  });
  const [pagSaving, setPagSaving] = useState(false);
  const [pagError, setPagError] = useState<string | null>(null);

  // Edição de orçamento
  const [editMode, setEditMode] = useState(false);
  const [editItens, setEditItens] = useState<
    Array<{ id?: string; descricao: string; quantidade: number; preco_unitario: number }>
  >([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Exclusão de orçamento
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Traduzir para paciente (DEX Simplificar)
  const [traduzirOpen, setTraduzirOpen] = useState(false);
  const [traduzirTexto, setTraduzirTexto] = useState('');
  const [traduzirLoading, setTraduzirLoading] = useState(false);
  const [traduzirCopied, setTraduzirCopied] = useState(false);

  // Secretaria: controles extras
  const [filterDentista, setFilterDentista] = useState<string>('todos');
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [pixModalOrc, setPixModalOrc] = useState<OrcamentoRow | null>(null);
  const [pagRapidoSaving, setPagRapidoSaving] = useState(false);

  // Busca procedimentos da clínica ao montar
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('procedimentos')
      .select('id, nome, preco_padrao')
      .eq('clinica_id', clinicaId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        setProcedimentosClinica(data ?? []);
      });
  }, [clinicaId]);

  // Autocomplete de pacientes para o modal de novo orçamento
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

  const novoOrcSubtotal = novoOrcItens.reduce((s, i) => s + i.quantidade * i.preco, 0);
  const novoOrcTotal = Math.max(0, novoOrcSubtotal - novoOrcDesconto);

  // Dentistas únicos para o dropdown da secretaria
  const dentistasUnicos = useMemo(() => {
    const map = new Map<string, string>();
    orcamentos.forEach((o) => {
      if (o.dentista?.id) map.set(o.dentista.id, o.dentista.nome);
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [orcamentos]);

  // Hoje para filtro "Pagos hoje"
  const hoje = new Date().toISOString().split('T')[0];

  // Filtra por busca, status, dentista e filtros rápidos da secretaria
  const filtered = useMemo(() => {
    return orcamentos.filter((o) => {
      const nome = o.paciente?.nome ?? '';
      const matchesSearch =
        nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.id.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesStatus = filterStatus === 'todos' || o.status === filterStatus;
      // Filtros rápidos exclusivos da secretaria
      if (filterStatus === 'pendentes') {
        matchesStatus = o.status === 'enviado' || o.status === 'rascunho';
      } else if (filterStatus === 'pagos_hoje') {
        matchesStatus = o.pagamentos.some((p) => p.data_pagamento === hoje);
      }

      const matchesDentista =
        filterDentista === 'todos' || o.dentista?.id === filterDentista;

      return matchesSearch && matchesStatus && matchesDentista;
    });
  }, [orcamentos, searchTerm, filterStatus, filterDentista, hoje]);

  // Métricas do mês atual
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  const totalAprovados = orcamentos
    .filter((o) => o.status === 'aprovado' && new Date(o.created_at) >= inicioMes)
    .reduce((sum, o) => sum + (o.total ?? 0), 0);

  const totalAguardando = orcamentos
    .filter((o) => o.status === 'enviado')
    .reduce((sum, o) => sum + (o.total ?? 0), 0);

  const totalValidos = orcamentos.filter((o) => o.status !== 'rascunho').length;
  const totalAprovadosCount = orcamentos.filter((o) => o.status === 'aprovado').length;
  const taxaConversao = totalValidos > 0 ? Math.round((totalAprovadosCount / totalValidos) * 100) : 0;

  // DEX: Dispara notificação se houver orçamentos novos (somente secretária)
  const notifiedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (isSecretaria) {
      orcamentos.forEach(o => {
        if (o.status === 'enviado' && !viewedIds.has(o.id) && !notifiedIds.current.has(o.id)) {
          notifiedIds.current.add(o.id);
          toast(`🤖 DEX: Novo orçamento de ${o.paciente?.nome} gerado por Dr(a). ${o.dentista?.nome}`, {
            style: { background: '#131313', color: '#2f9c85', borderColor: '#2f9c85' }
          });
        }
      });
    }
  }, [orcamentos, isSecretaria, viewedIds]);

  // DEX Simplificar: traduz orçamento técnico para linguagem de paciente
  const handleTraduzir = async () => {
    if (!selected) return;
    setTraduzirLoading(true);
    setTraduzirTexto('');
    setTraduzirOpen(true);
    try {
      const res = await fetch('/api/dex/simplificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orcamentoId: selected.id }),
      });
      const data = (await res.json()) as { texto?: string; error?: string };
      setTraduzirTexto(data.texto ?? 'Não foi possível simplificar o orçamento.');
    } catch {
      setTraduzirTexto('Erro ao conectar com o DEX. Tente novamente.');
    } finally {
      setTraduzirLoading(false);
    }
  };

  const handleCopyTraduzir = () => {
    void navigator.clipboard.writeText(traduzirTexto).then(() => {
      setTraduzirCopied(true);
      setTimeout(() => setTraduzirCopied(false), 2000);
    });
  };

  // Atualiza status via server action
  const handleStatusChange = async (id: string, status: StatusOrcamento) => {
    setIsSaving(true);
    const result = await atualizarStatusOrcamento(id, status);
    if (!result.error) {
      setOrcamentos((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
    }
    setIsSaving(false);
  };

  // Registra pagamento no orçamento selecionado
  const handleRegistrarPagamento = async () => {
    if (!selected) return;
    const valor = parseFloat(pagForm.valor.replace(',', '.'));
    if (!valor || valor <= 0) {
      setPagError('Informe um valor válido.');
      return;
    }
    setPagError(null);
    setPagSaving(true);

    const result = await registrarPagamento({
      orcamentoId: selected.id,
      pacienteId: selected.paciente?.id ?? '',
      valor,
      formaPagamento: pagForm.formaPagamento,
      data: pagForm.data,
      dentistaId: selected.dentista?.id,
    });

    if (result.error) {
      setPagError(result.error);
    } else {
      const novoPag: PagamentoRow = {
        id: result.id ?? crypto.randomUUID(),
        orcamento_id: selected.id,
        valor,
        status: 'pago',
        forma_pagamento: pagForm.formaPagamento,
        data_pagamento: pagForm.data,
      };
      setOrcamentos((prev) =>
        prev.map((o) => {
          if (o.id !== selected.id) return o;
          const atualizado = { ...o, pagamentos: [...o.pagamentos, novoPag] };
          if (result.autoAprovado) atualizado.status = 'aprovado';
          return atualizado;
        })
      );
      setSelected((prev) => {
        if (!prev) return prev;
        const atualizado = { ...prev, pagamentos: [...prev.pagamentos, novoPag] };
        if (result.autoAprovado) atualizado.status = 'aprovado';
        return atualizado;
      });
      setPagForm({
        valor: '',
        formaPagamento: 'pix',
        data: new Date().toISOString().split('T')[0],
      });
      router.refresh();
    }
    setPagSaving(false);
  };

  // Cria novo orçamento
  const handleCriarOrcamento = async () => {
    if (!novoOrcPacienteId) {
      setOrcError('Selecione um paciente.');
      return;
    }
    const itensValidos = novoOrcItens.filter((i) => i.descricao.trim() && i.preco > 0);
    if (itensValidos.length === 0) {
      setOrcError('Adicione ao menos um procedimento com descrição e valor.');
      return;
    }
    setOrcError(null);
    setOrcSaving(true);

    const result = await criarOrcamento({
      pacienteId: novoOrcPacienteId,
      desconto: novoOrcDesconto,
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
      // Atualização otimista — adiciona o novo orçamento ao topo da lista
      const novoOrc: OrcamentoRow = {
        id: result.id ?? crypto.randomUUID(),
        created_at: new Date().toISOString(),
        status: 'rascunho',
        total: novoOrcTotal,
        desconto: novoOrcDesconto,
        validade_dias: 30,
        condicoes_pagamento: null,
        paciente: { id: novoOrcPacienteId, nome: novoOrcPacienteNome, telefone: null },
        dentista: null,
        itens: itensValidos.map(
          (i): OrcamentoItemRow => ({
            id: crypto.randomUUID(),
            orcamento_id: result.id ?? '',
            descricao: i.descricao,
            quantidade: i.quantidade,
            preco_unitario: i.preco,
            preco_total: i.quantidade * i.preco,
          })
        ),
        pagamentos: [],
      };
      setOrcamentos((prev) => [novoOrc, ...prev]);
      setIsNovoOrcOpen(false);
      setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
      setNovoOrcDesconto(0);
      setNovoOrcPacienteSearch('');
      setNovoOrcPacienteId('');
      setNovoOrcPacienteNome('');
      router.refresh();
    }
    setOrcSaving(false);
  };

  const handleOpenEdit = () => {
    if (!selected) return;
    setEditItens(
      selected.itens.map((item) => ({
        id: item.id,
        descricao: item.descricao ?? '',
        quantidade: item.quantidade,
        preco_unitario:
          item.quantidade > 0
            ? (item.preco_total ?? 0) / item.quantidade
            : (item.preco_total ?? 0),
      }))
    );
    setEditError(null);
    setEditMode(true);
  };

  const handleSalvarEdicao = async () => {
    if (!selected) return;
    const itensValidos = editItens.filter((i) => i.descricao.trim() && i.preco_unitario > 0);
    if (itensValidos.length === 0) {
      setEditError('Adicione ao menos um procedimento com descrição e valor.');
      return;
    }
    setEditSaving(true);
    const result = await editarOrcamento(selected.id, itensValidos);
    if (result.error) {
      setEditError(result.error);
    } else {
      const novoTotal = itensValidos.reduce((sum, i) => sum + i.quantidade * i.preco_unitario, 0);
      const novosItens: OrcamentoItemRow[] = itensValidos.map((i) => ({
        id: i.id ?? crypto.randomUUID(),
        orcamento_id: selected.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        preco_total: i.quantidade * i.preco_unitario,
      }));
      setOrcamentos((prev) =>
        prev.map((o) =>
          o.id === selected.id ? { ...o, total: novoTotal, itens: novosItens } : o
        )
      );
      setSelected((prev) =>
        prev ? { ...prev, total: novoTotal, itens: novosItens } : prev
      );
      setEditMode(false);
      router.refresh();
    }
    setEditSaving(false);
  };

  const handlePagamentoRapido = async (formaPagamento: FormaPagamento) => {
    if (!selected) return;
    setPagRapidoSaving(true);
    const result = await registrarPagamentoRapido({
      orcamentoId: selected.id,
      pacienteId: selected.paciente?.id ?? '',
      total: selected.total ?? 0,
      formaPagamento,
      dentistaId: selected.dentista?.id,
    });
    if (!result.error) {
      const novoPag: PagamentoRow = {
        id: result.id ?? crypto.randomUUID(),
        orcamento_id: selected.id,
        valor: selected.total ?? 0,
        status: 'pago',
        forma_pagamento: formaPagamento,
        data_pagamento: hoje,
      };
      setOrcamentos((prev) =>
        prev.map((o) =>
          o.id === selected.id
            ? { ...o, status: 'aprovado', pagamentos: [...o.pagamentos, novoPag] }
            : o
        )
      );
      setSelected((prev) =>
        prev ? { ...prev, status: 'aprovado', pagamentos: [...prev.pagamentos, novoPag] } : prev
      );
      router.refresh();
    }
    setPagRapidoSaving(false);
  };

  const handleExcluir = async () => {
    if (!confirmDeleteId) return;
    setDeleteSaving(true);
    const result = await excluirOrcamento(confirmDeleteId);
    if (!result.error) {
      setOrcamentos((prev) => prev.filter((o) => o.id !== confirmDeleteId));
      if (selected?.id === confirmDeleteId) setSelected(null);
      setConfirmDeleteId(null);
      router.refresh();
    }
    setDeleteSaving(false);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      {/* Cabeçalho */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="font-heading text-4xl text-foreground mb-2">Orçamentos</h1>
          <p className="text-muted-foreground text-sm font-medium">Acompanhe propostas e conversões.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setOrcError(null);
              setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
              setNovoOrcPacienteSearch('');
              setNovoOrcPacienteId('');
              setNovoOrcPacienteNome('');
              setIsNovoOrcOpen(true);
            }}
            className="bg-teal hover:bg-teal-lt text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(47,156,133,0.3)] w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Novo Orçamento
          </button>
        )}
      </motion.header>

      {/* Cards de métricas (dentista/admin) ou filtros rápidos (secretaria) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        {!isSecretaria && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-teal/10 text-teal flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1">
                  Aprovados (Mês)
                </div>
                <div className="font-mono text-2xl font-semibold text-foreground">
                  {formatCurrency(totalAprovados)}
                </div>
              </div>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface-alt text-text-secondary flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1">
                  Aguardando
                </div>
                <div className="font-mono text-2xl font-semibold text-foreground">
                  {formatCurrency(totalAguardando)}
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl shadow-lg flex items-center gap-4 text-white backdrop-blur-md"
              style={{ background: 'rgba(13,13,13,0.92)', border: '1px solid rgba(47,156,133,0.25)' }}>
              <div className="w-12 h-12 rounded-full bg-teal/15 text-teal flex items-center justify-center">
                <CircleDollarSign className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] mb-1">
                  Taxa de Conversão
                </div>
                <div className="font-mono text-2xl font-semibold text-white">{taxaConversao}%</div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Tabela */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
      >
        {/* Barra de busca e filtros */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-center bg-muted/30">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por paciente ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:border-teal transition-colors font-sans text-foreground"
            />
          </div>

          {/* Filtro de status — visível apenas para dentista/admin */}
          {!isSecretaria && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-border bg-card rounded-xl px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-teal transition-colors w-full sm:w-auto"
              >
                <option value="todos">Todos</option>
                <option value="aprovado">Aprovados</option>
                <option value="enviado">Enviados</option>
                <option value="rascunho">Rascunhos</option>
                <option value="recusado">Recusados</option>
              </select>
            </div>
          )}

          {/* Filtro por dentista — visível para todos quando há mais de um dentista */}
          {dentistasUnicos.length > 1 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <select
                value={filterDentista}
                onChange={(e) => setFilterDentista(e.target.value)}
                className="border border-border bg-card rounded-xl px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-teal transition-colors w-full sm:w-auto"
              >
                <option value="todos">Todos os dentistas</option>
                {dentistasUnicos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  ID / Data
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  Paciente
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  Dentista
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  Valor Total
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                  Status
                </th>
                <th className="px-6 py-4 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Nenhum orçamento encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((o, i) => {
                const s = STATUS_MAP[o.status] ?? STATUS_MAP.rascunho;
                const Icon = s.icon;
                const isNovo = isSecretaria && o.status === 'enviado' && !viewedIds.has(o.id);
                return (
                  <motion.tr
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    key={o.id}
                    onClick={() => {
                      setSelected(o);
                      setPagError(null);
                      setPagForm({
                        valor: '',
                        formaPagamento: 'pix',
                        data: new Date().toISOString().split('T')[0],
                      });
                      // Marca como visto ao abrir
                      setViewedIds((prev) => new Set([...prev, o.id]));
                    }}
                    className="hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {o.id.slice(0, 8).toUpperCase()}
                        </div>
                        {isNovo && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal/15 text-teal text-[9px] font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                            Novo
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {format(parseISO(o.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm text-foreground group-hover:text-teal transition-colors">
                        {o.paciente?.nome ?? '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground">
                        {o.dentista?.nome ?? '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-semibold text-foreground">
                        {formatCurrency(o.total)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.color}`}
                      >
                        <Icon className="w-3 h-3" />
                        {s.label}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground font-medium">
          Exibindo {filtered.length} de {orcamentos.length} orçamento{orcamentos.length !== 1 ? 's' : ''}
        </div>
      </motion.div>

      {/* Painel lateral de detalhe */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setEditMode(false); setEditError(null); }}
              className="fixed inset-0 bg-black/40 z-40"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
            >
              {/* Cabeçalho do painel */}
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1">
                    {selected.id.slice(0, 8).toUpperCase()}
                  </div>
                  <h2 className="font-heading text-2xl text-foreground">
                    {selected.paciente?.nome ?? '—'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(selected.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!editMode && !isSecretaria && (
                    <>
                      <button
                        onClick={() => void handleTraduzir()}
                        className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-teal"
                        title="DEX: Traduzir para o paciente"
                        disabled={traduzirLoading}
                      >
                        <Languages className="w-4 h-4" />
                      </button>
                      <BotaoDownloadPDF orcamentoId={selected.id} />
                      <BotaoEnviarWhatsApp
                        orcamentoId={selected.id}
                        pacienteTelefone={selected.paciente?.telefone}
                        pacienteNome={selected.paciente?.nome ?? ''}
                        valorTotal={selected.total}
                        statusAtual={selected.status}
                      />
                      <button
                        onClick={handleOpenEdit}
                        className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Editar orçamento"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(selected.id)}
                        className="p-2 rounded-xl hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                        title="Excluir orçamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setSelected(null); setEditMode(false); setEditError(null); }}
                    className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Ações rápidas da secretária */}
                {isSecretaria && selected.status !== 'aprovado' && (
                  <div className="bg-muted/40 border border-border rounded-2xl p-5 space-y-3">
                    <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest block">
                      Ações Rápidas
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => void handlePagamentoRapido('dinheiro')}
                        disabled={pagRapidoSaving}
                        className="flex items-center gap-3 px-4 py-3 bg-teal/10 hover:bg-teal/20 border border-teal/20 text-teal rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        <Banknote className="w-4 h-4 shrink-0" />
                        Registrar Dinheiro
                      </button>
                      <button
                        onClick={() => setPixModalOrc(selected)}
                        className="flex items-center gap-3 px-4 py-3 bg-teal/10 hover:bg-teal/20 border border-teal/20 text-teal rounded-xl text-sm font-semibold transition-all"
                      >
                        <QrCode className="w-4 h-4 shrink-0" />
                        Gerar QR Code PIX
                      </button>
                      <BotaoEnviarWhatsApp
                        orcamentoId={selected.id}
                        pacienteTelefone={selected.paciente?.telefone}
                        pacienteNome={selected.paciente?.nome ?? ''}
                        valorTotal={selected.total}
                        statusAtual={selected.status}
                        variant="full"
                      />
                    </div>
                  </div>
                )}

                {/* Confirmar e enviar para secretaria — apenas para rascunhos (dentista/admin) */}
                {!isSecretaria && selected.status === 'rascunho' && (
                  <div className="bg-teal/5 border border-teal/20 rounded-2xl p-4 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      O orçamento está em rascunho. Ao confirmar, a secretaria receberá uma notificação para acompanhar o retorno do paciente.
                    </p>
                    <Button
                      onClick={() => void handleStatusChange(selected.id, 'enviado')}
                      disabled={isSaving}
                      className="w-full bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold gap-2"
                    >
                      {isSaving
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />
                      }
                      Confirmar e enviar para secretaria
                    </Button>
                  </div>
                )}

                {/* Alterar status (apenas dentista/admin) */}
                {!isSecretaria && (
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2 block">
                    Status do Orçamento
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['rascunho', 'enviado', 'aprovado', 'recusado'] as StatusOrcamento[]).map((s) => (
                      <button
                        key={s}
                        disabled={isSaving}
                        onClick={() => void handleStatusChange(selected.id, s)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                          selected.status === s
                            ? `${STATUS_MAP[s].bg} ${STATUS_MAP[s].color} ring-2 ring-current ring-offset-1`
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {STATUS_MAP[s].label}
                      </button>
                    ))}
                  </div>
                </div>
                )}

                {/* Valor total / Pago / Restante */}
                {(() => {
                  const valorPago = selected.pagamentos
                    .filter((p) => p.status === 'pago')
                    .reduce((s, p) => s + p.valor, 0);
                  const total = selected.total ?? 0;
                  const valorRestante = Math.max(0, total - valorPago);
                  const quitado = valorRestante === 0 && valorPago > 0;
                  const percPago = total > 0 ? Math.min(100, Math.round((valorPago / total) * 100)) : 0;

                  return (
                    <div className="bg-teal/10 rounded-2xl p-5 border border-teal/20 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            Valor Total
                          </div>
                          <div className="font-mono text-3xl font-bold text-teal">
                            {formatCurrency(total)}
                          </div>
                          {selected.condicoes_pagamento && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {selected.condicoes_pagamento}
                            </div>
                          )}
                        </div>
                        {quitado && (
                          <span className="shrink-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-teal text-white tracking-wider">
                            Quitado
                          </span>
                        )}
                      </div>

                      {valorPago > 0 && (
                        <div className="space-y-2">
                          {/* Barra de progresso */}
                          <div className="w-full h-1.5 bg-teal/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal rounded-full transition-all duration-500"
                              style={{ width: `${percPago}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3 border-t border-teal/20 pt-2">
                            <div>
                              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                                Pago
                              </div>
                              <div className="font-mono text-lg font-bold text-teal">
                                {formatCurrency(valorPago)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                                {quitado ? 'Saldo' : 'Falta Pagar'}
                              </div>
                              <div
                                className={`font-mono text-lg font-bold ${
                                  valorRestante > 0 ? 'text-amber-500' : 'text-teal'
                                }`}
                              >
                                {formatCurrency(valorRestante)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Alerta de pendência para secretária */}
                      {isSecretaria && valorRestante > 0 && selected.status === 'aprovado' && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            Pagamento pendente: {formatCurrency(valorRestante)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Itens do orçamento */}
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3 block">
                    Procedimentos
                  </label>
                  {editMode ? (
                    <div className="space-y-3">
                      {editItens.map((item, idx) => (
                        <div key={idx} className="bg-muted rounded-2xl border border-border p-4 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Descrição"
                              value={item.descricao}
                              onChange={(e) =>
                                setEditItens((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, descricao: e.target.value } : it
                                  )
                                )
                              }
                              className="rounded-xl bg-card border-border text-foreground text-sm flex-1"
                            />
                            <button
                              onClick={() =>
                                setEditItens((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <div className="space-y-1 w-20">
                              <label className="text-[10px] text-muted-foreground">Qtd</label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(e) =>
                                  setEditItens((prev) =>
                                    prev.map((it, i) =>
                                      i === idx
                                        ? { ...it, quantidade: parseInt(e.target.value) || 1 }
                                        : it
                                    )
                                  )
                                }
                                className="rounded-xl bg-card border-border text-foreground text-sm font-mono"
                              />
                            </div>
                            <div className="space-y-1 flex-1">
                              <label className="text-[10px] text-muted-foreground">
                                Preço unit. (R$)
                              </label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.preco_unitario}
                                onChange={(e) =>
                                  setEditItens((prev) =>
                                    prev.map((it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            preco_unitario: parseFloat(e.target.value) || 0,
                                          }
                                        : it
                                    )
                                  )
                                }
                                className="rounded-xl bg-card border-border text-foreground text-sm font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          setEditItens((prev) => [
                            ...prev,
                            { descricao: '', quantidade: 1, preco_unitario: 0 },
                          ])
                        }
                        className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Adicionar item
                      </button>
                      <div className="bg-teal/10 rounded-xl p-3 border border-teal/20 flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">Total</span>
                        <span className="font-mono text-lg font-bold text-teal">
                          {formatCurrency(editItens.reduce((sum, i) => sum + i.quantidade * i.preco_unitario, 0))}
                        </span>
                      </div>
                      {editError && (
                        <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                          {editError}
                        </p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          onClick={() => { setEditMode(false); setEditError(null); }}
                          disabled={editSaving}
                          className="flex-1 rounded-xl border-border text-foreground hover:bg-muted"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => void handleSalvarEdicao()}
                          disabled={editSaving}
                          className="flex-1 bg-teal text-white hover:bg-teal-lt rounded-xl"
                        >
                          {editSaving ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selected.itens.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum procedimento.</p>
                      )}
                      {selected.itens.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-card rounded-xl border border-border"
                        >
                          <div className="text-sm font-medium text-foreground">{item.descricao ?? '—'}</div>
                          <div className="font-mono text-sm font-semibold text-foreground">
                            {formatCurrency(item.preco_total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagamentos registrados */}
                {selected.pagamentos.length > 0 && (
                  <div>
                    <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                      <CreditCard className="w-3 h-3" /> Pagamentos
                    </label>
                    <div className="space-y-2">
                      {selected.pagamentos.map((pag) => (
                        <div
                          key={pag.id}
                          className="flex items-center justify-between p-3 bg-card rounded-xl border border-border"
                        >
                          <div>
                            <div className="font-mono text-sm font-semibold text-foreground">
                              {formatCurrency(pag.valor)}
                            </div>
                            {pag.forma_pagamento && (
                              <div className="text-[10px] text-muted-foreground uppercase mt-0.5">
                                {pag.forma_pagamento.replace(/_/g, ' ')}
                              </div>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                              pag.status === 'pago'
                                ? 'bg-teal/10 text-teal'
                                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                            }`}
                          >
                            {pag.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Registrar pagamento */}
                {(() => {
                  const pago = selected.pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
                  const restante = Math.max(0, (selected.total ?? 0) - pago);
                  return (
                <div className="bg-muted/40 border border-border rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <CreditCard className="w-3 h-3" /> Registrar Pagamento
                    </label>
                    {restante > 0 && (
                      <button
                        type="button"
                        onClick={() => setPagForm(f => ({ ...f, valor: restante.toFixed(2) }))}
                        className="text-[10px] font-bold text-teal hover:text-teal-lt transition-colors uppercase tracking-wider"
                      >
                        Preencher restante
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-foreground text-xs">Valor (R$)</Label>
                      <Input
                        type="number"
                        placeholder={restante > 0 ? restante.toFixed(2) : '0,00'}
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
                  );
                })()}

                {/* Link para o paciente */}
                {selected.paciente?.id && (
                  <button
                    onClick={() => router.push(`/dashboard/pacientes/${selected.paciente!.id}`)}
                    className="w-full py-3 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    Ver Perfil do Paciente →
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Dialog: QR Code PIX */}
      <Dialog open={!!pixModalOrc} onOpenChange={(open) => { if (!open) setPixModalOrc(null); }}>
        <DialogContent className="max-w-sm rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-foreground">QR Code PIX</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Apresente ao paciente para pagamento no balcão.
            </DialogDescription>
          </DialogHeader>
          {pixModalOrc && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-4 rounded-2xl border border-border">
                <QRCode
                  value={`DentIA | Paciente: ${pixModalOrc.paciente?.nome ?? ''} | Valor: ${formatCurrency(pixModalOrc.total)} | ID: ${pixModalOrc.id.slice(0, 8).toUpperCase()}`}
                  size={180}
                />
              </div>
              <div className="text-center space-y-1">
                <div className="font-semibold text-foreground">{pixModalOrc.paciente?.nome ?? '—'}</div>
                <div className="font-mono text-2xl font-bold text-teal">{formatCurrency(pixModalOrc.total)}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Configure a chave PIX da clínica nas configurações para gerar o QR oficial.
                </p>
              </div>
              <Button
                onClick={() => void handlePagamentoRapido('pix').then(() => setPixModalOrc(null))}
                disabled={pagRapidoSaving}
                className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl"
              >
                {pagRapidoSaving ? 'Registrando...' : 'Confirmar Pagamento PIX'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: DEX Simplificar — tradução para o paciente */}
      <Dialog open={traduzirOpen} onOpenChange={(open) => { if (!open) { setTraduzirOpen(false); setTraduzirCopied(false); } }}>
        <DialogContent className="max-w-lg rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
              <Languages className="w-5 h-5 text-teal" style={{ color: '#2f9c85' }} />
              DEX: Texto para o Paciente
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Versão simplificada gerada pelo DEX — pronto para enviar pelo WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            {traduzirLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#2f9c85' }} />
                <p className="text-sm text-muted-foreground">DEX gerando a versão simplificada...</p>
              </div>
            ) : (
              <textarea
                readOnly
                value={traduzirTexto}
                rows={10}
                className="w-full rounded-xl border border-border bg-muted text-sm text-foreground p-3 resize-none focus:outline-none font-sans leading-relaxed"
              />
            )}
          </div>
          {!traduzirLoading && traduzirTexto && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCopyTraduzir}
                className="rounded-xl border-border text-foreground hover:bg-muted gap-2"
              >
                {traduzirCopied ? <Check className="w-4 h-4 text-teal" style={{ color: '#2f9c85' }} /> : <Copy className="w-4 h-4" />}
                {traduzirCopied ? 'Copiado!' : 'Copiar texto'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar exclusão de orçamento */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
      >
        <DialogContent className="max-w-sm rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-foreground">
              Excluir orçamento?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Esta ação é irreversível. Todos os pagamentos vinculados também serão removidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deleteSaving}
              className="rounded-xl border-border text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleExcluir()}
              disabled={deleteSaving}
              className="bg-red-500 text-white hover:bg-red-600 rounded-xl"
            >
              {deleteSaving ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Novo Orçamento */}
      <Dialog open={isNovoOrcOpen} onOpenChange={setIsNovoOrcOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-card border-border max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-foreground">
              Novo Orçamento
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Selecione o paciente e os procedimentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Busca de paciente */}
            <div className="space-y-2 relative">
              <Label className="text-foreground text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Paciente <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Digite o nome do paciente..."
                value={novoOrcPacienteSearch}
                autoComplete="off"
                onChange={(e) => {
                  const v = e.target.value;
                  setNovoOrcPacienteSearch(v);
                  setNovoOrcPacienteId('');
                  setNovoOrcPacienteNome('');
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
                        setNovoOrcPacienteSearch(p.nome);
                        setNovoOrcPacienteId(p.id);
                        setNovoOrcPacienteNome(p.nome);
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

            {/* Itens / Procedimentos */}
            <div className="space-y-3">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                Procedimentos
              </Label>

              {novoOrcItens.map((item, idx) => (
                <div key={idx} className="bg-muted rounded-2xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                      Procedimento {idx + 1}
                    </span>
                    {novoOrcItens.length > 1 && (
                      <button
                        onClick={() =>
                          setNovoOrcItens((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-red-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

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
                      <SelectValue>
                        {(v: string | null) =>
                          v
                            ? (procedimentosClinica.find((p) => p.id === v)?.nome ?? v)
                            : 'Selecionar da clínica (opcional)...'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {procedimentosClinica.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Descrição do procedimento *"
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-foreground">Qtd</Label>
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
                        className="rounded-xl bg-card border-border text-foreground font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-foreground">Valor unitário (R$)</Label>
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
                        className="rounded-xl bg-card border-border text-foreground font-mono"
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
                className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Procedimento
              </button>
            </div>

            {/* Desconto */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2">
              <Label className="text-sm font-medium text-foreground whitespace-nowrap shrink-0">
                Desconto (R$)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={novoOrcDesconto || ''}
                onChange={(e) => setNovoOrcDesconto(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0,00"
                className="rounded-lg bg-transparent border-0 text-right font-mono text-sm p-0 h-auto focus-visible:ring-0 shadow-none"
              />
            </div>

            {/* Subtotal + Desconto + Total */}
            <div className="bg-teal/10 rounded-xl p-3 space-y-1 border border-teal/20">
              {novoOrcDesconto > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(novoOrcSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-red-500">
                    <span>Desconto</span>
                    <span className="font-mono">- {formatCurrency(novoOrcDesconto)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="font-mono text-xl font-bold text-teal">
                  {formatCurrency(novoOrcTotal)}
                </span>
              </div>
            </div>

            {orcError && (
              <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{orcError}</p>
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
              className="bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 font-bold"
            >
              {orcSaving ? 'Salvando...' : 'Criar Orçamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
