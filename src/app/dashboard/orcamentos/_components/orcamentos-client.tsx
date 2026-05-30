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
import dynamic from 'next/dynamic';
const QRCode = dynamic(() => import('react-qr-code'), { ssr: false });
import type { DentistaRole } from '@/types/database';
import { motion, AnimatePresence } from 'motion/react';
import { DexLoader } from '@/components/ui/dex-loader';
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
import { BotaoMensagemIA } from '@/components/orcamentos/botao-mensagem-ia';
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
  rascunho: { label: 'Rascunho', icon: FileText,  color: 'text-text-secondary', bg: 'bg-surface-alt' },
  recusado: { label: 'Recusado', icon: XCircle,   color: 'text-coral',          bg: 'bg-coral/10' },
};

const formatCurrency = (value: number | null) =>
  (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Helpers para input de valor estilo calculadora (dígitos → centavos)
// "32555" → 325.55 → exibe "325,55"
const centsToFloat  = (digits: string): number => parseInt(digits || '0', 10) / 100;
const floatToCents  = (value: number): string  => String(Math.round(value * 100));
const formatCents   = (digits: string): string  =>
  centsToFloat(digits).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ProcedimentoClinica {
  id: string;
  nome: string;
  preco_padrao: number | null;
}

interface FichaProc {
  fichaId: string;
  fichaDate: string;
  tooth: number;
  descricao: string;
  /** `${fichaId}::${tooth}_${noteIndex}` — chave global única */
  globalKey: string;
}

interface NovoOrcItem {
  procedimentoId: string;
  descricao: string;
  quantidade: number;
  preco: string;
  /** Preenchido quando o item veio da seleção na ficha do paciente */
  fichaKey?: string;
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
    { procedimentoId: '', descricao: '', quantidade: 1, preco: '' },
  ]);
  const [novoOrcDesconto, setNovoOrcDesconto] = useState(0);
  const [novoOrcPacienteSearch, setNovoOrcPacienteSearch] = useState('');
  const [novoOrcPacienteId, setNovoOrcPacienteId] = useState('');
  const [novoOrcPacienteNome, setNovoOrcPacienteNome] = useState('');
  const [novoOrcDentistaId, setNovoOrcDentistaId] = useState<string>(() => dentistas[0]?.id ?? '');
  const [pacienteSugestoes, setPacienteSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [orcSaving, setOrcSaving] = useState(false);
  const [orcError, setOrcError] = useState<string | null>(null);

  // Procedimentos da ficha (carregados ao selecionar paciente)
  const [fichaProcs, setFichaProcs] = useState<FichaProc[]>([]);
  const [fichaProcsLoading, setFichaProcsLoading] = useState(false);
  const [selectedFichaKeys, setSelectedFichaKeys] = useState<Set<string>>(new Set());

  // Desconto por percentual (null = sem percentual ativo, controle manual)
  const [descontoPercent, setDescontoPercent] = useState<5 | 10 | 15 | null>(null);

  // Registrar pagamento (painel lateral)
  const [pagForm, setPagForm] = useState({
    valor: '',
    formaPagamento: 'pix' as FormaPagamento,
    data: new Date().toISOString().split('T')[0],
    dataVencimento: '',
  });
  const [pagSaving, setPagSaving] = useState(false);
  const [pagError, setPagError] = useState<string | null>(null);

  // Edição de orçamento
  const [editMode, setEditMode] = useState(false);
  const [editItens, setEditItens] = useState<
    Array<{ id?: string; descricao: string; quantidade: number; preco_unitario: string }>
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

  // Limpa debounce ao desmontar
  useEffect(() => () => {
    if (buscarDebounceRef.current) clearTimeout(buscarDebounceRef.current);
    buscarAbortRef.current?.abort();
  }, []);

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

  // Autocomplete de pacientes — debounced 300ms + AbortController
  const buscarPacientes = useCallback((nome: string) => {
    if (buscarDebounceRef.current) clearTimeout(buscarDebounceRef.current);
    buscarAbortRef.current?.abort();
    if (nome.length < 2) { setPacienteSugestoes([]); return; }
    buscarDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      buscarAbortRef.current = controller;
      const supabase = createClient();
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome')
        .ilike('nome', `%${nome}%`)
        .limit(6)
        .abortSignal(controller.signal);
      if (!controller.signal.aborted) setPacienteSugestoes(data ?? []);
    }, 300);
  }, []);

  const buscarProcedimentosFicha = useCallback(async (pacienteId: string) => {
    if (!pacienteId) { setFichaProcs([]); return; }
    setFichaProcsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('fichas')
      .select('id, created_at, dentes_afetados, dentes_observacoes, procedimentos_concluidos')
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false });

    const procs: FichaProc[] = [];
    for (const ficha of (data ?? []) as {
      id: string;
      created_at: string;
      dentes_afetados: number[];
      dentes_observacoes: Record<string, string>;
      procedimentos_concluidos: string[];
    }[]) {
      const done = new Set(ficha.procedimentos_concluidos ?? []);
      for (const tooth of (ficha.dentes_afetados ?? [])) {
        const raw = ficha.dentes_observacoes?.[String(tooth)] ?? '';
        raw.split('\n').filter(Boolean).forEach((note, i) => {
          const key = `${tooth}_${i}`;
          if (!done.has(key)) {
            procs.push({
              fichaId: ficha.id,
              fichaDate: ficha.created_at,
              tooth,
              descricao: note,
              globalKey: `${ficha.id}::${key}`,
            });
          }
        });
      }
    }
    setFichaProcs(procs);
    setFichaProcsLoading(false);
  }, [clinicaId]);

  const handleToggleFichaProc = useCallback((proc: FichaProc) => {
    const isSelected = selectedFichaKeys.has(proc.globalKey);

    if (isSelected) {
      setNovoOrcItens(prev => prev.filter(i => i.fichaKey !== proc.globalKey));
      setSelectedFichaKeys(prev => {
        const next = new Set(prev);
        next.delete(proc.globalKey);
        return next;
      });
    } else {
      const newItem: NovoOrcItem = {
        procedimentoId: '',
        descricao: `Dente ${proc.tooth} – ${proc.descricao}`,
        quantidade: 1,
        preco: '',
        fichaKey: proc.globalKey,
      };
      setNovoOrcItens(prev => {
        const cleaned = prev.filter(i => i.descricao !== '' || i.preco !== '');
        return [...cleaned, newItem];
      });
      setSelectedFichaKeys(prev => new Set([...prev, proc.globalKey]));
    }
  }, [selectedFichaKeys]);

  const novoOrcSubtotal = useMemo(
    () => novoOrcItens.reduce((s, i) => s + i.quantidade * centsToFloat(i.preco), 0),
    [novoOrcItens]
  );
  const novoOrcTotal = useMemo(
    () => Math.max(0, novoOrcSubtotal - novoOrcDesconto),
    [novoOrcSubtotal, novoOrcDesconto]
  );

  // Recalcula desconto em R$ quando percentual ou subtotal mudam
  useEffect(() => {
    if (descontoPercent !== null) {
      setNovoOrcDesconto(Math.round(novoOrcSubtotal * descontoPercent) / 100);
    }
  }, [descontoPercent, novoOrcSubtotal]);

  // Dentistas únicos para o dropdown da secretaria
  const dentistasUnicos = useMemo(() => {
    const map = new Map<string, string>();
    orcamentos.forEach((o) => {
      if (o.dentista?.id) map.set(o.dentista.id, o.dentista.nome);
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [orcamentos]);

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
  }, [orcamentos, searchTerm, filterStatus, filterDentista]);

  // Métricas do mês atual
  const { totalAprovados, totalAguardando, totalValidos, totalAprovadosCount, taxaConversao } = useMemo(() => {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const validos = orcamentos.filter((o) => o.status !== 'rascunho').length;
    const aprovadosCount = orcamentos.filter((o) => o.status === 'aprovado').length;
    return {
      totalAprovados: orcamentos
        .filter((o) => o.status === 'aprovado' && new Date(o.created_at) >= inicioMes)
        .reduce((sum, o) => sum + (o.total ?? 0), 0),
      totalAguardando: orcamentos
        .filter((o) => o.status === 'enviado')
        .reduce((sum, o) => sum + (o.total ?? 0), 0),
      totalValidos: validos,
      totalAprovadosCount: aprovadosCount,
      taxaConversao: validos > 0 ? Math.round((aprovadosCount / validos) * 100) : 0,
    };
  }, [orcamentos]);

  // DEX: Dispara notificação se houver orçamentos novos (somente secretária)
  const notifiedIds      = useRef<Set<string>>(new Set());
  const buscarDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscarAbortRef    = useRef<AbortController | null>(null);
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
  const handleStatusChange = useCallback(async (id: string, status: StatusOrcamento) => {
    setIsSaving(true);
    const result = await atualizarStatusOrcamento(id, status);
    if (!result.error) {
      setOrcamentos((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
    }
    setIsSaving(false);
  }, []);

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

    const hoje = new Date().toISOString().split('T')[0];
    const isAgendado = pagForm.dataVencimento && pagForm.dataVencimento > hoje;

    const result = await registrarPagamento({
      orcamentoId: selected.id,
      pacienteId: selected.paciente?.id ?? '',
      valor,
      formaPagamento: pagForm.formaPagamento,
      data: pagForm.data,
      dataVencimento: pagForm.dataVencimento || undefined,
      dentistaId: selected.dentista?.id,
    });

    if (result.error) {
      setPagError(result.error);
    } else {
      const novoPag: PagamentoRow = {
        id: result.id ?? crypto.randomUUID(),
        orcamento_id: selected.id,
        valor,
        status: isAgendado ? 'pendente' : 'pago',
        forma_pagamento: isAgendado ? null : pagForm.formaPagamento,
        data_pagamento: isAgendado ? null : pagForm.data,
        data_vencimento: pagForm.dataVencimento || null,
        marcado_por: null,
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
        dataVencimento: '',
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
    const itensValidos = novoOrcItens.filter((i) => i.descricao.trim() && centsToFloat(i.preco) > 0);
    if (itensValidos.length === 0) {
      setOrcError('Adicione ao menos um procedimento com descrição e valor.');
      return;
    }
    setOrcError(null);
    setOrcSaving(true);

    const result = await criarOrcamento({
      pacienteId: novoOrcPacienteId,
      desconto: novoOrcDesconto,
      dentistaId: isSecretaria ? novoOrcDentistaId : undefined,
      itens: itensValidos.map((i) => ({
        procedimentoId: i.procedimentoId || null,
        descricao: i.descricao,
        quantidade: i.quantidade,
        precoUnitario: centsToFloat(i.preco),
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
        dentista: isSecretaria
          ? (dentistas.find((d) => d.id === novoOrcDentistaId) ?? null)
          : null,
        itens: itensValidos.map(
          (i): OrcamentoItemRow => ({
            id: crypto.randomUUID(),
            orcamento_id: result.id ?? '',
            descricao: i.descricao,
            quantidade: i.quantidade,
            preco_unitario: centsToFloat(i.preco),
            preco_total: i.quantidade * centsToFloat(i.preco),
          })
        ),
        pagamentos: [],
      };
      setOrcamentos((prev) => [novoOrc, ...prev]);
      setIsNovoOrcOpen(false);
      setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: '' }]);
      setNovoOrcDesconto(0);
      setNovoOrcPacienteSearch('');
      setNovoOrcPacienteId('');
      setNovoOrcPacienteNome('');
      setNovoOrcDentistaId(dentistas[0]?.id ?? '');
      setFichaProcs([]);
      setSelectedFichaKeys(new Set());
      setDescontoPercent(null);
      setFichaProcsLoading(false);
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
        preco_unitario: floatToCents(
          item.quantidade > 0
            ? (item.preco_total ?? 0) / item.quantidade
            : (item.preco_total ?? 0)
        ),
      }))
    );
    setEditError(null);
    setEditMode(true);
  };

  const handleSalvarEdicao = async () => {
    if (!selected) return;
    const itensValidos = editItens.filter((i) => i.descricao.trim() && centsToFloat(i.preco_unitario) > 0);
    if (itensValidos.length === 0) {
      setEditError('Adicione ao menos um procedimento com descrição e valor.');
      return;
    }
    setEditSaving(true);
    const result = await editarOrcamento(selected.id, itensValidos.map(i => ({ ...i, preco_unitario: centsToFloat(i.preco_unitario) })));
    if (result.error) {
      setEditError(result.error);
    } else {
      const novoTotal = itensValidos.reduce((sum, i) => sum + i.quantidade * centsToFloat(i.preco_unitario), 0);
      const novosItens: OrcamentoItemRow[] = itensValidos.map((i) => ({
        id: i.id ?? crypto.randomUUID(),
        orcamento_id: selected.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_unitario: centsToFloat(i.preco_unitario),
        preco_total: i.quantidade * centsToFloat(i.preco_unitario),
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
        data_vencimento: null,
        marcado_por: null,
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
      {/* Cabeçalho */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary mb-2">Orçamentos</h1>
          <p className="text-text-secondary text-sm font-medium">Acompanhe propostas e conversões.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setOrcError(null);
              setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: '' }]);
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
            <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-teal/10 text-teal flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1">
                  Aprovados (Mês)
                </div>
                <div className="font-mono text-2xl font-semibold text-text-primary">
                  {formatCurrency(totalAprovados)}
                </div>
              </div>
            </div>

            <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface-alt text-text-secondary flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1">
                  Aguardando
                </div>
                <div className="font-mono text-2xl font-semibold text-text-primary">
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
        className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden"
      >
        {/* Barra de busca e filtros */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-center bg-surface-alt/30">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Buscar por paciente ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm outline-none focus:border-teal transition-colors font-sans text-text-primary"
            />
          </div>

          {/* Filtro de status — visível apenas para dentista/admin */}
          {!isSecretaria && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-text-secondary shrink-0" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-border bg-surface rounded-xl px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-teal transition-colors w-full sm:w-auto"
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
              <User className="w-4 h-4 text-text-secondary shrink-0" />
              <select
                value={filterDentista}
                onChange={(e) => setFilterDentista(e.target.value)}
                className="border border-border bg-surface rounded-xl px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-teal transition-colors w-full sm:w-auto"
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
              <tr className="border-b border-border bg-surface-alt/50">
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                  ID / Data
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                  Paciente
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                  Dentista
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                  Valor Total
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                  Status
                </th>
                <th className="px-6 py-4 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-text-secondary">
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
                        dataVencimento: '',
                      });
                      // Marca como visto ao abrir
                      setViewedIds((prev) => new Set([...prev, o.id]));
                    }}
                    className="hover:bg-surface-alt/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-xs font-semibold text-text-primary">
                          {o.id.slice(0, 8).toUpperCase()}
                        </div>
                        {isNovo && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal/15 text-teal text-[9px] font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                            Novo
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-text-secondary mt-1">
                        {format(parseISO(o.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm text-text-primary group-hover:text-teal transition-colors">
                        {o.paciente?.nome ?? '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-text-secondary">
                        {o.dentista?.nome ?? '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-semibold text-text-primary">
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
                      <button className="p-2 text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-alt transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-border bg-surface-alt/20 text-xs text-text-secondary font-medium">
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
              className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col"
            >
              {/* Cabeçalho teal */}
              <div className="relative px-6 pt-5 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                      <CircleDollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h2 className="font-heading text-xl text-white leading-tight truncate">
                          {selected.paciente?.nome ?? '—'}
                        </h2>
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/20 text-white">
                          {STATUS_MAP[selected.status]?.label ?? selected.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/70 text-xs">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(selected.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!editMode && !isSecretaria && (
                      <>
                        <button onClick={() => void handleTraduzir()} disabled={traduzirLoading}
                          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-colors" title="DEX: Traduzir">
                          <Languages className="w-4 h-4" />
                        </button>
                        <BotaoDownloadPDF orcamentoId={selected.id} />
                        <BotaoMensagemIA
                          pacienteNome={selected.paciente?.nome ?? ''}
                          dentistaNome={selected.dentista?.nome ?? dentistas[0]?.nome ?? ''}
                          valorTotal={selected.total}
                          defaultTipo={selected.status === 'enviado' ? 'follow_up' : 'confirmacao'}
                          variant="icon"
                        />
                        <BotaoEnviarWhatsApp
                          orcamentoId={selected.id}
                          pacienteTelefone={selected.paciente?.telefone}
                          pacienteNome={selected.paciente?.nome ?? ''}
                          valorTotal={selected.total}
                          statusAtual={selected.status}
                        />
                        <button onClick={handleOpenEdit}
                          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-colors" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(selected.id)}
                          className="p-2 rounded-xl text-white/70 hover:text-red-300 hover:bg-red-500/20 transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => { setSelected(null); setEditMode(false); setEditError(null); }}
                      className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Ações rápidas da secretária */}
                {isSecretaria && selected.status !== 'aprovado' && (
                  <div className="bg-surface-alt/40 border border-border rounded-2xl p-5 space-y-3">
                    <label className="font-mono text-[10px] text-text-secondary uppercase tracking-widest block">
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
                      <BotaoMensagemIA
                        pacienteNome={selected.paciente?.nome ?? ''}
                        dentistaNome={selected.dentista?.nome ?? dentistas[0]?.nome ?? ''}
                        valorTotal={selected.total}
                        defaultTipo={selected.status === 'enviado' ? 'follow_up' : 'cobranca'}
                        variant="full"
                      />
                    </div>
                  </div>
                )}

                {/* Confirmar e enviar para secretaria — apenas para rascunhos (dentista/admin) */}
                {!isSecretaria && selected.status === 'rascunho' && (
                  <div className="bg-teal/5 border border-teal/20 rounded-2xl p-4 space-y-2">
                    <p className="text-xs text-text-secondary">
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
                  <label className="font-mono text-[10px] text-text-secondary uppercase tracking-widest mb-2 block">
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
                            : 'bg-surface-alt text-text-secondary hover:bg-surface-alt'
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
                          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">
                            Valor Total
                          </div>
                          <div className="font-mono text-3xl font-bold text-teal">
                            {formatCurrency(total)}
                          </div>
                          {selected.condicoes_pagamento && (
                            <div className="text-xs text-text-secondary mt-1">
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
                              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5">
                                Pago
                              </div>
                              <div className="font-mono text-lg font-bold text-teal">
                                {formatCurrency(valorPago)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5">
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
                  <label className="font-mono text-[10px] text-text-secondary uppercase tracking-widest mb-3 block">
                    Procedimentos
                  </label>
                  {editMode ? (
                    <div className="space-y-3">
                      {editItens.map((item, idx) => (
                        <div key={idx} className="bg-surface-alt rounded-2xl border border-border p-4 space-y-2">
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
                              className="rounded-xl bg-surface border-border text-text-primary text-sm flex-1"
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
                              <label className="text-[10px] text-text-secondary">Qtd</label>
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
                                className="rounded-xl bg-surface border-border text-text-primary text-sm font-mono"
                              />
                            </div>
                            <div className="space-y-1 flex-1">
                              <label className="text-[10px] text-text-secondary">
                                Preço unit. (R$)
                              </label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="0,00"
                                value={formatCents(item.preco_unitario)}
                                onChange={(e) =>
                                  setEditItens((prev) =>
                                    prev.map((it, i) =>
                                      i === idx ? { ...it, preco_unitario: e.target.value.replace(/\D/g, '') } : it
                                    )
                                  )
                                }
                                className="rounded-xl bg-surface border-border text-text-primary text-sm font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          setEditItens((prev) => [
                            ...prev,
                            { descricao: '', quantidade: 1, preco_unitario: '' },
                          ])
                        }
                        className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Adicionar item
                      </button>
                      <div className="bg-teal/10 rounded-xl p-3 border border-teal/20 flex items-center justify-between">
                        <span className="text-sm font-bold text-text-primary">Total</span>
                        <span className="font-mono text-lg font-bold text-teal">
                          {formatCurrency(editItens.reduce((sum, i) => sum + i.quantidade * centsToFloat(i.preco_unitario), 0))}
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
                          className="flex-1 rounded-xl border-border text-text-primary hover:bg-surface-alt"
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
                        <p className="text-sm text-text-secondary">Nenhum procedimento.</p>
                      )}
                      {selected.itens.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border"
                        >
                          <div className="text-sm font-medium text-text-primary">{item.descricao ?? '—'}</div>
                          <div className="font-mono text-sm font-semibold text-text-primary">
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
                    <label className="font-mono text-[10px] text-text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                      <CreditCard className="w-3 h-3" /> Parcelas
                    </label>
                    <div className="space-y-2">
                      {selected.pagamentos.map((pag) => {
                        const isVencido = pag.status === 'pendente' && pag.data_vencimento && pag.data_vencimento < hoje;
                        return (
                          <div
                            key={pag.id}
                            className={`flex items-center justify-between p-3 rounded-xl border ${
                              isVencido
                                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40'
                                : 'bg-surface border-border'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-mono text-sm font-semibold text-text-primary">
                                {formatCurrency(pag.valor)}
                              </div>
                              <div className="text-[10px] text-text-secondary mt-0.5 flex items-center gap-2 flex-wrap">
                                {pag.forma_pagamento && (
                                  <span className="uppercase">{pag.forma_pagamento.replace(/_/g, ' ')}</span>
                                )}
                                {pag.data_vencimento && (
                                  <span className={isVencido ? 'text-red-500 font-semibold' : ''}>
                                    vence {format(parseISO(pag.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                )}
                                {pag.data_pagamento && pag.status === 'pago' && (
                                  <span>
                                    pago em {format(parseISO(pag.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                                    {pag.marcado_por?.nome && (
                                      <> · por {pag.marcado_por.nome}</>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                pag.status === 'pago'
                                  ? 'bg-teal/10 text-teal'
                                  : isVencido
                                    ? 'bg-red-500/10 text-red-500'
                                    : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                              }`}
                            >
                              {pag.status === 'pago' ? 'Pago' : isVencido ? 'Vencido' : 'Pendente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Registrar pagamento */}
                {(() => {
                  const pago = selected.pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
                  const restante = Math.max(0, (selected.total ?? 0) - pago);
                  return (
                <div className="bg-surface-alt/40 border border-border rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10px] text-text-secondary uppercase tracking-widest flex items-center gap-2">
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

                  {(() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isAgendado = pagForm.dataVencimento && pagForm.dataVencimento > todayStr;
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-text-primary text-xs">Valor (R$)</Label>
                            <Input
                              type="number"
                              placeholder={restante > 0 ? restante.toFixed(2) : '0,00'}
                              min="0"
                              step="0.01"
                              value={pagForm.valor}
                              onChange={(e) => setPagForm((f) => ({ ...f, valor: e.target.value }))}
                              className="rounded-xl bg-surface-alt border-border text-text-primary"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-text-primary text-xs">
                              Vencimento <span className="text-text-secondary font-normal">(parcela futura)</span>
                            </Label>
                            <Input
                              type="date"
                              value={pagForm.dataVencimento}
                              min={todayStr}
                              onChange={(e) => setPagForm((f) => ({ ...f, dataVencimento: e.target.value }))}
                              className="rounded-xl bg-surface-alt border-border text-text-primary"
                            />
                          </div>
                        </div>

                        {!isAgendado && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-text-primary text-xs">Data do Pagamento</Label>
                              <Input
                                type="date"
                                value={pagForm.data}
                                onChange={(e) => setPagForm((f) => ({ ...f, data: e.target.value }))}
                                className="rounded-xl bg-surface-alt border-border text-text-primary"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-text-primary text-xs">Forma de Pagamento</Label>
                              <Select
                                value={pagForm.formaPagamento}
                                onValueChange={(v) => v && setPagForm((f) => ({ ...f, formaPagamento: v as FormaPagamento }))}
                              >
                                <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-surface border-border">
                                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                  <SelectItem value="pix">PIX</SelectItem>
                                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                                  <SelectItem value="boleto">Boleto</SelectItem>
                                  <SelectItem value="outro">Outro</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {isAgendado && (
                          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              Parcela futura — será registrada como <strong>pendente</strong>
                            </p>
                          </div>
                        )}

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
                          {pagSaving
                            ? 'Salvando...'
                            : isAgendado
                              ? 'Agendar Parcela'
                              : 'Confirmar Pagamento'}
                        </Button>
                      </>
                    );
                  })()}
                </div>
                  );
                })()}

                {/* Link para o paciente */}
                {selected.paciente?.id && (
                  <button
                    onClick={() => router.push(`/dashboard/pacientes/${selected.paciente!.id}`)}
                    className="w-full py-3 border border-border rounded-xl text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors"
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
        <DialogContent className="max-w-sm rounded-2xl bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-text-primary">QR Code PIX</DialogTitle>
            <DialogDescription className="text-text-secondary text-sm">
              Apresente ao paciente para pagamento no balcão.
            </DialogDescription>
          </DialogHeader>
          {pixModalOrc && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-4 rounded-2xl border border-border">
                <QRCode
                  value={`Odonto.IA | Paciente: ${pixModalOrc.paciente?.nome ?? ''} | Valor: ${formatCurrency(pixModalOrc.total)} | ID: ${pixModalOrc.id.slice(0, 8).toUpperCase()}`}
                  size={180}
                />
              </div>
              <div className="text-center space-y-1">
                <div className="font-semibold text-text-primary">{pixModalOrc.paciente?.nome ?? '—'}</div>
                <div className="font-mono text-2xl font-bold text-teal">{formatCurrency(pixModalOrc.total)}</div>
                <p className="text-xs text-text-secondary mt-2">
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
        <DialogContent className="max-w-lg rounded-2xl bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-text-primary flex items-center gap-2">
              <Languages className="w-5 h-5 text-teal" />
              DEX: Texto para o Paciente
            </DialogTitle>
            <DialogDescription className="text-text-secondary text-sm">
              Versão simplificada gerada pelo DEX — pronto para enviar pelo WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            {traduzirLoading ? (
              <DexLoader size="sm" label="DEX gerando a versão simplificada..." className="py-10" />
            ) : (
              <textarea
                readOnly
                value={traduzirTexto}
                rows={10}
                className="w-full rounded-xl border border-border bg-surface-alt text-sm text-text-primary p-3 resize-none focus:outline-none font-sans leading-relaxed"
              />
            )}
          </div>
          {!traduzirLoading && traduzirTexto && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCopyTraduzir}
                className="rounded-xl border-border text-text-primary hover:bg-surface-alt gap-2"
              >
                {traduzirCopied ? <Check className="w-4 h-4 text-teal" /> : <Copy className="w-4 h-4" />}
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
        <DialogContent className="max-w-sm rounded-2xl bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-text-primary">
              Excluir orçamento?
            </DialogTitle>
            <DialogDescription className="text-text-secondary">
              Esta ação é irreversível. Todos os pagamentos vinculados também serão removidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deleteSaving}
              className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
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
      <Dialog
        open={isNovoOrcOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsNovoOrcOpen(false);
            setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: '' }]);
            setNovoOrcDesconto(0);
            setNovoOrcPacienteSearch('');
            setNovoOrcPacienteId('');
            setNovoOrcPacienteNome('');
            setOrcError(null);
            setFichaProcs([]);
            setSelectedFichaKeys(new Set());
            setDescontoPercent(null);
            setFichaProcsLoading(false);
          } else {
            setIsNovoOrcOpen(true);
          }
        }}
      >
        <DialogContent
          className="rounded-3xl bg-surface border-border p-0 overflow-hidden gap-0"
          style={{ width: '58vw', maxWidth: 'none', maxHeight: '82vh', left: '55%' }}
          showCloseButton={false}
        >

          {/* Banner teal */}
          <div className="relative px-8 pt-6 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <CircleDollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="font-heading text-2xl text-white leading-tight">Novo Orçamento</DialogTitle>
                <DialogDescription className="text-white/70 text-xs mt-0.5">Selecione o paciente e os procedimentos a cobrar.</DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex" style={{ height: 'calc(82vh - 92px)', minHeight: 0 }}>

            {/* ── Coluna esquerda: scrollável ── */}
            <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-5">
              <DialogHeader className="sr-only">
                <DialogTitle>Novo Orçamento</DialogTitle>
                <DialogDescription>Selecione o paciente e os procedimentos a cobrar.</DialogDescription>
              </DialogHeader>

              {/* Seletor de dentista — apenas para secretária */}
              {isSecretaria && dentistas.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                    Dentista <span className="text-coral">*</span>
                  </Label>
                  <Select value={novoOrcDentistaId} onValueChange={(v) => v && setNovoOrcDentistaId(v)}>
                    <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {dentistas.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Busca de paciente */}
              <div className="space-y-2 relative">
                <Label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  Paciente <span className="text-coral">*</span>
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
                  onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
                  className="rounded-xl bg-surface-alt border-border text-text-primary"
                />
                {showSugestoes && pacienteSugestoes.length > 0 && (
                  <div className="absolute z-50 w-full bg-surface border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
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
                          setSelectedFichaKeys(new Set());
                          setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: '' }]);
                          void buscarProcedimentosFicha(p.id);
                        }}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-alt transition-colors text-text-primary"
                      >
                        {p.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Checklist de procedimentos da ficha ── */}
              {novoOrcPacienteId && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
                    Procedimentos Pendentes na Ficha
                  </Label>
                  {fichaProcsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-text-secondary py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando fichas...
                    </div>
                  ) : fichaProcs.length === 0 ? (
                    <p className="text-xs text-text-secondary bg-surface-alt rounded-xl px-4 py-3 border border-border">
                      Nenhum procedimento pendente registrado nas fichas deste paciente.
                    </p>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      {fichaProcs.map((proc) => {
                        const isSelected = selectedFichaKeys.has(proc.globalKey);
                        const date = new Date(proc.fichaDate).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                        });
                        return (
                          <button
                            key={proc.globalKey}
                            type="button"
                            onClick={() => handleToggleFichaProc(proc)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-b-0 ${
                              isSelected ? 'bg-teal/5 hover:bg-teal/10' : 'hover:bg-surface-alt'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-teal border-teal' : 'border-border bg-transparent'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary truncate">
                                {proc.descricao}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[10px] font-bold text-teal">D{proc.tooth}</span>
                                <span className="text-[10px] text-text-secondary">{date}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Itens do orçamento ── */}
              <div className="space-y-3">
                <Label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
                  Itens do Orçamento
                </Label>

                {novoOrcItens.map((item, idx) => (
                  <div key={idx} className="bg-surface-alt rounded-2xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
                        {item.fichaKey ? 'Da ficha' : `Item ${idx + 1}`}
                      </span>
                      {novoOrcItens.length > 1 && (
                        <button
                          onClick={() => {
                            if (item.fichaKey) {
                              setSelectedFichaKeys(prev => {
                                const next = new Set(prev);
                                next.delete(item.fichaKey!);
                                return next;
                              });
                            }
                            setNovoOrcItens(prev => prev.filter((_, i) => i !== idx));
                          }}
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
                        setNovoOrcItens(prev =>
                          prev.map((it, i) =>
                            i === idx
                              ? {
                                  ...it,
                                  procedimentoId: v,
                                  descricao: proc?.nome ?? it.descricao,
                                  preco: proc?.preco_padrao != null ? floatToCents(proc.preco_padrao) : it.preco,
                                }
                              : it
                          )
                        );
                      }}
                    >
                      <SelectTrigger className="rounded-xl bg-surface border-border text-text-primary">
                        <SelectValue>
                          {(v: string | null) =>
                            v
                              ? (procedimentosClinica.find((p) => p.id === v)?.nome ?? v)
                              : 'Vincular ao catálogo (preenche preço)...'
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-surface border-border">
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
                        setNovoOrcItens(prev =>
                          prev.map((it, i) =>
                            i === idx ? { ...it, descricao: e.target.value } : it
                          )
                        )
                      }
                      className="rounded-xl bg-surface border-border text-text-primary"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-text-secondary">Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantidade}
                          onChange={(e) =>
                            setNovoOrcItens(prev =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, quantidade: parseInt(e.target.value) || 1 } : it
                              )
                            )
                          }
                          className="rounded-xl bg-surface border-border text-text-primary font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-text-secondary">Valor unitário (R$)</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          value={formatCents(item.preco)}
                          onChange={(e) =>
                            setNovoOrcItens(prev =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, preco: e.target.value.replace(/\D/g, '') } : it
                              )
                            )
                          }
                          className="rounded-xl bg-surface border-border text-text-primary font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setNovoOrcItens(prev => [
                      ...prev,
                      { procedimentoId: '', descricao: '', quantidade: 1, preco: '' },
                    ])
                  }
                  className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar item manual
                </button>
              </div>
            </div>

            {/* ── Coluna direita: sticky ── */}
            <div className="w-80 shrink-0 border-l border-border flex flex-col" style={{ background: 'rgba(47,156,133,0.04)' }}>
              <div className="flex-1 p-6 space-y-5 overflow-y-auto">

                {/* Desconto */}
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
                    Desconto
                  </Label>

                  {/* Botões rápidos de % */}
                  <div className="flex gap-2">
                    {([5, 10, 15] as const).map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDescontoPercent(prev => (prev === pct ? null : pct))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                          descontoPercent === pct
                            ? 'bg-teal text-white border-teal shadow-[0_0_12px_rgba(47,156,133,0.3)]'
                            : 'bg-surface border-border text-text-secondary hover:border-teal/50 hover:text-text-primary'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  {/* Input manual em R$ */}
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
                    <span className="text-xs text-text-secondary shrink-0">R$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={novoOrcDesconto || ''}
                      onChange={(e) => {
                        setDescontoPercent(null);
                        setNovoOrcDesconto(Math.max(0, parseFloat(e.target.value) || 0));
                      }}
                      placeholder="0,00"
                      className="rounded-lg bg-transparent border-0 text-right font-mono text-sm p-0 h-auto focus-visible:ring-0 shadow-none"
                    />
                  </div>
                </div>

                {/* Resumo financeiro */}
                <div className="bg-teal/5 rounded-2xl p-4 space-y-2 border border-teal/15">
                  {novoOrcDesconto > 0 && (
                    <>
                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <span>Subtotal</span>
                        <span className="font-mono">{formatCurrency(novoOrcSubtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-red-500">
                        <span>Desconto{descontoPercent ? ` (${descontoPercent}%)` : ''}</span>
                        <span className="font-mono">– {formatCurrency(novoOrcDesconto)}</span>
                      </div>
                      <div className="border-t border-teal/15 pt-2" />
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-text-primary">Total</span>
                    <span className="font-mono text-2xl font-bold text-teal">
                      {formatCurrency(novoOrcTotal)}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-secondary text-right font-mono">
                    {novoOrcItens.filter(i => i.descricao || i.preco).length} item(s)
                  </p>
                </div>
              </div>

              {/* Botões de ação — fixos no rodapé da coluna direita */}
              <div className="p-6 border-t border-border space-y-2">
                {orcError && (
                  <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{orcError}</p>
                )}
                <Button
                  onClick={() => void handleCriarOrcamento()}
                  disabled={orcSaving}
                  className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 font-bold"
                >
                  {orcSaving ? 'Salvando...' : 'Criar Orçamento'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsNovoOrcOpen(false)}
                  className="w-full rounded-xl border-border text-text-primary hover:bg-surface-alt"
                >
                  Cancelar
                </Button>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
