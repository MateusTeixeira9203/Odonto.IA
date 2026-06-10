'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Clock, Stethoscope, Check, Plus, Loader2, Pencil, X, Users, UserCircle, LogOut, AlertTriangle, ImageIcon, FileUp } from 'lucide-react';
import { ImportarProcedimentosModal } from './importar-procedimentos-modal';
import { createClient } from '@/lib/supabase/client';
import { getLabelContexto } from '@/lib/planos';
import type { PlanoId } from '@/lib/planos';
import { motion } from 'motion/react';
import type { ConfiguracaoClinica, HorarioDisponivel, Procedimento, DentistaRole } from '@/types/database';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { UsuariosClient } from '../usuarios/_components/usuarios-client';
import {
  salvarClinica,
  salvarHorarios,
  salvarPerfil,
  salvarLogoUrl,
  atualizarProcedimento,
  toggleProcedimento,
  criarProcedimento,
  sairDaClinicaAction,
  type HorarioDia,
} from '../actions';

type UsuarioRow = { id: string; nome: string; email: string | null; role: DentistaRole; ativo: boolean; created_at: string };
type ConvitePendente = { id: string; email: string; role: DentistaRole; expires_at: string; created_at: string };

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

const ABAS_IDS = ['perfil', 'clinica', 'horarios', 'procedimentos', 'equipe'] as const;
type Aba = (typeof ABAS_IDS)[number];

interface Props {
  plano?: PlanoId;
  dentista: { id: string; nome: string; cro: string | null; role: DentistaRole; clinica: string };
  config: ConfiguracaoClinica | null;
  horarios: HorarioDisponivel[];
  procedimentos: Procedimento[];
  abaInicial?: string;
  equipe?: {
    usuarios: UsuarioRow[];
    convitesPendentes: ConvitePendente[];
    meuId: string;
    meuRole: DentistaRole;
    limiteDentistas: number;
    convitesRestantes: number;
  };
}

export function ConfiguracoesClient({ plano, dentista, config, horarios, procedimentos: procedimentosIniciais, abaInicial, equipe }: Props) {
  const labelContexto = getLabelContexto(plano); // "Consultório" (SOLO) ou "Clínica" (CLINICA)
  const isSolo = !plano || plano === 'SOLO' || (plano as string) === 'BASICO';

  const ABAS = [
    { id: 'perfil'        as const, label: 'Meu Perfil',      icon: UserCircle  },
    { id: 'clinica'       as const, label: labelContexto,      icon: isSolo ? Stethoscope : Building2 },
    { id: 'horarios'      as const, label: 'Horários',         icon: Clock       },
    { id: 'procedimentos' as const, label: 'Procedimentos',    icon: Stethoscope },
    { id: 'equipe'        as const, label: 'Equipe',           icon: Users       },
  ];
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<Aba>((ABAS.some(a => a.id === abaInicial) ? abaInicial : 'clinica') as Aba);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Sair da clínica ---
  const [showSairDialog, setShowSairDialog] = useState(false);
  const [isSaindo, setIsSaindo] = useState(false);
  const [sairError, setSairError] = useState<string | null>(null);

  const handleSairDaClinica = async () => {
    setIsSaindo(true);
    setSairError(null);
    try {
      const result = await sairDaClinicaAction();
      if (result?.error) {
        setSairError(result.error);
        return;
      }
      // Se chegou aqui sem error, a action redirecionou via redirect()
      router.refresh();
    } catch {
      // redirect() lança internamente — comportamento esperado
    } finally {
      setIsSaindo(false);
    }
  };

  // --- Aba Perfil ---
  const [perfilForm, setPerfilForm] = useState({
    nome: dentista.nome,
    cro: dentista.cro ?? '',
  });

  const handleSalvarPerfil = () => {
    if (!perfilForm.nome.trim()) return;
    setSuccessMsg(null);
    setErrorMsg(null);
    startTransition(async () => {
      const result = await salvarPerfil({ nome: perfilForm.nome, cro: perfilForm.cro });
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg('Perfil atualizado com sucesso!');
      }
    });
  };

  // --- Logo da clínica ---
  const [logoUrl, setLogoUrl] = useState<string | null>(config?.logo_url ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErrorMsg('Selecione uma imagem (JPG, PNG, WebP)'); return; }
    if (file.size > 2 * 1024 * 1024) { setErrorMsg('A imagem deve ter no máximo 2 MB'); return; }

    setUploadingLogo(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `clinicas/${config?.clinica_id ?? 'logo'}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const urlComCache = `${publicUrl}?t=${Date.now()}`;

      const result = await salvarLogoUrl(urlComCache);
      if (result.error) throw new Error(result.error);

      setLogoUrl(urlComCache);
      setSuccessMsg('Logo atualizada com sucesso!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao fazer upload da logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

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
        setSuccessMsg(`Configurações do ${labelContexto.toLowerCase()} salvas com sucesso!`);
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
            almoco_inicio: existente.almoco_inicio ?? null,
            almoco_fim:    existente.almoco_fim    ?? null,
          }
        : {
            dia_semana: dia,
            hora_inicio: '08:00',
            hora_fim: '18:00',
            intervalo_minutos: 30,
            ativo: false,
            almoco_inicio: null,
            almoco_fim: null,
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
  const [editForm, setEditForm] = useState({ nome: '', preco_padrao: 0, duracao_minutos: 0 });
  const [showNovoProcedimento, setShowNovoProcedimento] = useState(false);
  const [showImportar, setShowImportar] = useState(false);
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
      nome: proc.nome,
      preco_padrao: proc.preco_padrao ?? 0,
      duracao_minutos: proc.duracao_minutos ?? 30,
    });
  };

  const handleSalvarProcedimento = (id: string) => {
    startTransition(async () => {
      const result = await atualizarProcedimento(id, {
        nome: editForm.nome.trim() || 'Procedimento',
        preco_padrao: editForm.preco_padrao,
        duracao_minutos: editForm.duracao_minutos,
      });
      if (!result.error) {
        setProcedimentos((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, nome: editForm.nome.trim() || p.nome, preco_padrao: editForm.preco_padrao, duracao_minutos: editForm.duracao_minutos }
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        {dentista.clinica && (
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] font-mono text-text-secondary mb-1">
            {dentista.clinica}
          </span>
        )}
        <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary mb-1">Configurações</h1>
        <p className="text-text-secondary text-sm font-medium">
          Gerencie {labelContexto.toLowerCase()}, horários, equipe e catálogo de procedimentos.
        </p>
      </motion.header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Navegação lateral */}
        <motion.nav
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="md:col-span-1"
        >
          <div id="dex-tour-procedimentos" className="bg-surface rounded-3xl border border-border shadow-sm p-2 space-y-1">
            {ABAS.map(({ id, label, icon: Icon }) => {
              if (id === 'equipe' && !equipe) return null;
              const showBadge = id === 'perfil' && !dentista.cro;
              const isActive = abaAtiva === id;
              return (
                <button
                  key={id}
                  onClick={() => { setAbaAtiva(id); setSuccessMsg(null); setErrorMsg(null); }}
                  className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-semibold text-sm transition-all ${
                    isActive
                      ? 'bg-teal/10 text-teal'
                      : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-teal/20' : 'bg-surface-alt'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {label}
                  {showBadge && (
                    <span className="ml-auto flex items-center">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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

          {/* === ABA: MEU PERFIL === */}
          {abaAtiva === 'perfil' && (
            <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm space-y-6">
              <div>
                <h2 className="font-heading font-bold text-2xl text-text-primary">Meu Perfil</h2>
                <p className="text-sm text-text-secondary mt-1">
                  Seu nome e CRO aparecem em documentos, planejamentos e orçamentos gerados.
                </p>
              </div>

              {!dentista.cro && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300/40 bg-amber-50/60 dark:bg-amber-900/15 dark:border-amber-500/25">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0 animate-pulse" />
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    Seu CRO ainda não foi cadastrado. Preencha abaixo para que ele apareça nos documentos do paciente.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={perfilForm.nome}
                    onChange={(e) => setPerfilForm((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="Dr. João da Silva"
                    className="w-full border border-border rounded-xl px-4 py-2.5 font-sans text-sm bg-surface-alt outline-none focus:border-teal transition-colors text-text-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                    CRO
                  </label>
                  <input
                    type="text"
                    value={perfilForm.cro}
                    onChange={(e) => setPerfilForm((f) => ({ ...f, cro: e.target.value }))}
                    placeholder="CRO-SP 12345"
                    className="w-full border border-border rounded-xl px-4 py-2.5 font-mono text-sm bg-surface-alt outline-none focus:border-teal transition-colors text-text-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSalvarPerfil}
                  disabled={isPending || !perfilForm.nome.trim()}
                  className="bg-gradient-to-r from-teal to-teal-lt text-white px-6 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)] disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPending ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>

              {/* Zona de risco */}
              <div className="border-t border-border pt-6">
                <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">
                  Zona de risco
                </p>
                <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Sair deste {labelContexto.toLowerCase()}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Você perderá acesso imediatamente. Seus dados clínicos serão preservados.
                    </p>
                  </div>
                  <button
                    onClick={() => { setSairError(null); setShowSairDialog(true); }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </div>
            </div>

          )}

          {/* === ABA: CLÍNICA / CONSULTÓRIO === */}
          {abaAtiva === 'clinica' && (
            <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm space-y-6">
              <h2 className="font-heading font-bold text-2xl text-text-primary">Dados do {labelContexto}</h2>

              {/* Logo da clínica */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block">
                  Logo do {labelContexto}
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-surface-alt flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-7 h-7 text-text-secondary/40" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm text-text-secondary">
                      A logo aparece nos PDFs de planejamento enviados aos pacientes.
                    </p>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface-alt hover:bg-surface text-sm font-semibold text-text-primary transition-colors disabled:opacity-50"
                    >
                      {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      {logoUrl ? 'Trocar logo' : 'Enviar logo'}
                    </button>
                    <p className="text-[11px] text-text-secondary/60">JPG, PNG ou WebP · máx. 2 MB</p>
                  </div>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleLogoUpload(e)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                    Nome do {labelContexto}
                  </label>
                  <input
                    type="text"
                    value={clinicaForm.nome_clinica}
                    onChange={(e) => setClinicaForm((f) => ({ ...f, nome_clinica: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 font-sans text-sm bg-surface-alt outline-none focus:border-teal transition-colors text-text-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={clinicaForm.telefone}
                    onChange={(e) => setClinicaForm((f) => ({ ...f, telefone: e.target.value }))}
                    placeholder="(11) 9 9999-9999"
                    className="w-full border border-border rounded-xl px-4 py-2.5 font-sans text-sm bg-surface-alt outline-none focus:border-teal transition-colors text-text-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={clinicaForm.endereco}
                    onChange={(e) => setClinicaForm((f) => ({ ...f, endereco: e.target.value }))}
                    placeholder="Rua, número, bairro..."
                    className="w-full border border-border rounded-xl px-4 py-2.5 font-sans text-sm bg-surface-alt outline-none focus:border-teal transition-colors text-text-primary"
                  />
                </div>
              </div>

              {/* Formas de pagamento */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block">
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
                            : 'bg-surface-alt text-text-secondary hover:bg-surface-alt border border-border'
                        }`}
                      >
                        {forma.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Convênios */}
              <div className="flex items-center justify-between p-4 bg-surface-alt rounded-xl">
                <div>
                  <div className="font-semibold text-sm text-text-primary">Aceita Convênio</div>
                  <div className="text-xs text-text-secondary">
                    O {labelContexto.toLowerCase()} atende pacientes com plano odontológico.
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
                  className="bg-gradient-to-r from-teal to-teal-lt text-white px-6 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)] disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          )}

          {/* === ABA: HORÁRIOS === */}
          {abaAtiva === 'horarios' && (
            <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-2xl text-text-primary">Horários de Atendimento</h2>
                <span className="text-xs text-text-secondary font-medium">
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
                        h.ativo ? 'border-teal/20 bg-teal/5' : 'border-border bg-surface-alt/30'
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
                          <span className={`text-sm font-semibold ${h.ativo ? 'text-text-primary' : 'text-text-secondary'}`}>
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
                                className="border border-border rounded-lg px-2 py-1.5 text-xs font-mono bg-surface-alt text-text-primary outline-none focus:border-teal"
                              />
                              <span className="text-text-secondary text-xs font-medium">até</span>
                              <input
                                type="time"
                                value={h.hora_fim}
                                onChange={(e) => updateHorario(dia, 'hora_fim', e.target.value)}
                                className="border border-border rounded-lg px-2 py-1.5 text-xs font-mono bg-surface-alt text-text-primary outline-none focus:border-teal"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-text-secondary font-medium">Almoço:</span>
                              <input
                                type="time"
                                value={h.almoco_inicio ?? ''}
                                onChange={(e) => updateHorario(dia, 'almoco_inicio', e.target.value)}
                                placeholder="--:--"
                                className="border border-border rounded-lg px-2 py-1.5 text-xs font-mono bg-surface-alt text-text-primary outline-none focus:border-teal"
                              />
                              <span className="text-text-secondary text-xs font-medium">até</span>
                              <input
                                type="time"
                                value={h.almoco_fim ?? ''}
                                onChange={(e) => updateHorario(dia, 'almoco_fim', e.target.value)}
                                placeholder="--:--"
                                className="border border-border rounded-lg px-2 py-1.5 text-xs font-mono bg-surface-alt text-text-primary outline-none focus:border-teal"
                              />
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
                  className="bg-gradient-to-r from-teal to-teal-lt text-white px-6 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)] disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPending ? 'Salvando...' : 'Salvar Horários'}
                </button>
              </div>
            </div>
          )}

          {/* === ABA: EQUIPE === */}
          {abaAtiva === 'equipe' && equipe && (
            <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm">
              <UsuariosClient
                usuarios={equipe.usuarios}
                convitesPendentes={equipe.convitesPendentes}
                meuId={equipe.meuId}
                meuRole={equipe.meuRole}
                limiteDentistas={equipe.limiteDentistas}
                convitesRestantes={equipe.convitesRestantes}
                asTab
              />
            </div>
          )}

          {/* === ABA: PROCEDIMENTOS === */}
          {abaAtiva === 'procedimentos' && (
            <div className="space-y-4">
              <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-heading font-bold text-2xl text-text-primary flex items-center">
                    Catálogo de Procedimentos
                    <HelpTooltip content="Cadastre seus procedimentos e valores para uso nos orçamentos." />
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowImportar(true)}
                      className="border border-border text-text-secondary px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all hover:border-teal/40 hover:text-teal hover:bg-teal/5"
                    >
                      <FileUp className="w-4 h-4" /> Importar
                    </button>
                    <button
                      onClick={() => setShowNovoProcedimento(true)}
                      className="bg-gradient-to-r from-teal to-teal-lt text-white px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5"
                    >
                      <Plus className="w-4 h-4" /> Novo
                    </button>
                  </div>
                </div>

                {/* Formulário novo procedimento */}
                {showNovoProcedimento && (
                  <div className="mb-6 p-4 border border-teal/20 bg-teal/5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-teal">Novo Procedimento</span>
                      <button onClick={() => setShowNovoProcedimento(false)}>
                        <X className="w-4 h-4 text-text-secondary" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="Nome do procedimento *"
                        value={novoProc.nome}
                        onChange={(e) => setNovoProc((f) => ({ ...f, nome: e.target.value }))}
                        className="col-span-2 border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal"
                      />
                      <input
                        placeholder="Categoria (ex: Ortodontia)"
                        value={novoProc.categoria}
                        onChange={(e) => setNovoProc((f) => ({ ...f, categoria: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal"
                      />
                      <input
                        placeholder="Preço (R$)"
                        type="number"
                        value={novoProc.preco_padrao}
                        onChange={(e) => setNovoProc((f) => ({ ...f, preco_padrao: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal font-mono"
                      />
                      <input
                        placeholder="Descrição"
                        value={novoProc.descricao}
                        onChange={(e) => setNovoProc((f) => ({ ...f, descricao: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal"
                      />
                      <select
                        value={novoProc.duracao_minutos}
                        onChange={(e) => setNovoProc((f) => ({ ...f, duracao_minutos: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal font-mono"
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
                  <p className="text-sm text-text-secondary text-center py-8">
                    Nenhum procedimento cadastrado ainda.
                  </p>
                )}

                {categorias.map((categoria) => (
                  <div key={categoria} className="mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-2">
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
                              proc.ativo ? 'border-border bg-surface' : 'border-border bg-surface-alt/30 opacity-60'
                            }`}
                          >
                            {editandoId === proc.id ? (
                              // Modo edição
                              <div className="flex flex-col gap-3">
                                <input
                                  type="text"
                                  value={editForm.nome}
                                  onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                                  placeholder="Nome do procedimento"
                                  className="w-full border border-teal/40 rounded-lg px-3 py-1.5 text-sm font-medium bg-surface-alt text-text-primary outline-none focus:border-teal transition-colors"
                                />
                                <div className="flex items-center gap-4 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-text-secondary">R$</span>
                                    <input
                                      type="number"
                                      value={editForm.preco_padrao}
                                      onChange={(e) =>
                                        setEditForm((f) => ({
                                          ...f,
                                          preco_padrao: parseFloat(e.target.value) || 0,
                                        }))
                                      }
                                      className="w-24 border border-border rounded-lg px-2 py-1 text-xs font-mono bg-surface-alt text-text-primary outline-none focus:border-teal"
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
                                      className="border border-border rounded-lg px-2 py-1 text-xs font-mono bg-surface-alt text-text-primary outline-none focus:border-teal"
                                    >
                                      <option value={15}>15 min</option>
                                      <option value={30}>30 min</option>
                                      <option value={45}>45 min</option>
                                      <option value={60}>60 min</option>
                                      <option value={90}>90 min</option>
                                    </select>
                                  </div>
                                  <div className="flex gap-2 ml-auto">
                                    <button
                                      onClick={() => handleSalvarProcedimento(proc.id)}
                                      disabled={isPending}
                                      className="p-1.5 bg-teal text-white rounded-lg hover:bg-teal-lt transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditandoId(null)}
                                      className="p-1.5 bg-surface-alt text-text-secondary rounded-lg hover:bg-surface-alt transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // Modo visualização
                              <div className="flex items-center gap-4 flex-wrap">
                                <span className="font-medium text-sm text-text-primary flex-1">
                                  {proc.nome}
                                </span>
                                {proc.preco_padrao !== null && (
                                  <span className="font-mono text-sm font-semibold text-text-primary">
                                    {proc.preco_padrao.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                )}
                                {proc.duracao_minutos && (
                                  <span className="text-xs text-text-secondary font-medium">
                                    {proc.duracao_minutos} min
                                  </span>
                                )}
                                <div className="flex gap-2 ml-auto">
                                  <button
                                    onClick={() => handleEditarProcedimento(proc)}
                                    className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-alt transition-colors"
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

      <ImportarProcedimentosModal
        open={showImportar}
        onOpenChange={setShowImportar}
        onSaved={() => router.refresh()}
      />

      {/* Dialog de confirmação — sair da clínica */}
      {showSairDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-3xl border border-border shadow-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-text-primary">Sair do {labelContexto.toLowerCase()}?</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Você perderá acesso imediatamente. Esta ação não pode ser desfeita sem que um admin te convide novamente.
                </p>
              </div>
            </div>

            {sairError && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5">
                {sairError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowSairDialog(false)}
                disabled={isSaindo}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSairDaClinica()}
                disabled={isSaindo}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaindo && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaindo ? 'Saindo...' : 'Sim, sair'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
