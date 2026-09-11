'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Clock, Stethoscope, Check, Loader2, UserCircle, LogOut, AlertTriangle, ImageIcon, CreditCard, Gift, ArrowUpRight, Sparkles, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { MigrarClinicaModal } from './migrar-clinica-modal';
import { createClient } from '@/lib/supabase/client';
import { getLabelContexto, getPlano } from '@/lib/planos';
import type { PlanoId } from '@/lib/planos';
import type { EstadoComercial } from '@/lib/billing/estado-comercial';
import { motion } from 'motion/react';
import { PageContainer } from '@/components/layout/page-container';
import type { ConfiguracaoClinica, HorarioDisponivel, Procedimento, DentistaRole } from '@/types/database';
import { ProcedimentosCatalogo } from './procedimentos-catalogo';
import { UsuariosClient } from '../usuarios/_components/usuarios-client';
import {
  salvarClinica,
  salvarHorarios,
  salvarPerfil,
  salvarLogoUrl,
  sairDaClinicaAction,
  type HorarioDia,
} from '../actions';
import {
  abrirPortalCobrancaAction,
  continuarClinicaBloqueadaAction,
  migrarParaConsultorioAction,
} from '../plano-actions';

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

type Aba = 'perfil' | 'clinica' | 'horarios' | 'procedimentos' | 'plano';

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
  estadoComercial?: {
    estado: EstadoComercial;
    trialEndsAt: string | null;
    graceEndsAt: string | null;
  };
  formacao?: { status: string; expiresAt: string | null; cartoesProntos: number };
  elegibilidade?: { status: string; prazoEquipe: string | null };
  abrirFormacaoInicial?: boolean;
  procedimentosPendente?: boolean;
  clinicId?: string;
}

export function ConfiguracoesClient({ plano, dentista, config, horarios, procedimentos: procedimentosIniciais, abaInicial, equipe, estadoComercial, formacao, elegibilidade, abrirFormacaoInicial = false, procedimentosPendente = false, clinicId }: Props) {
  const labelContexto = getLabelContexto(plano); // "Consultório" (SOLO) ou "Clínica" (CLINICA)
  const isSolo = !plano || plano === 'SOLO' || (plano as string) === 'BASICO';
  const planoConfig = getPlano(plano);
  const estadoPlano = estadoComercial?.estado ?? 'inativo';
  const clinicaIsenta = estadoPlano === 'isento';

  const ABAS_TODAS = [
    { id: 'perfil'        as const, label: 'Meu Perfil',      icon: UserCircle  },
    { id: 'clinica'       as const, label: labelContexto,      icon: isSolo ? Stethoscope : Building2 },
    { id: 'horarios'      as const, label: 'Horários',         icon: Clock       },
    { id: 'procedimentos' as const, label: 'Procedimentos',    icon: Stethoscope },
    { id: 'plano'         as const, label: 'Plano',            icon: CreditCard  },
  ];
  const podeGerirClinica = dentista.role === 'admin' || dentista.role === 'dentista';
  const ABAS = podeGerirClinica
    ? ABAS_TODAS
    : ABAS_TODAS.filter((aba) => aba.id !== 'clinica');
  const abaPadrao: Aba = ABAS[0]?.id ?? 'perfil';
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<Aba>((ABAS.some(a => a.id === abaInicial) ? abaInicial : abaPadrao) as Aba);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Plano e Indicação ---
  const [migrarOpen, setMigrarOpen]   = useState(abrirFormacaoInicial);
  const dentistasAtivos = (equipe?.usuarios ?? []).filter((u) => ['admin', 'dentista'].includes(u.role) && u.ativo).length;
  function formatarDataTrial(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  const resolverElegibilidade = (acao: 'solo' | 'bloqueada') => {
    setSuccessMsg(null);
    setErrorMsg(null);
    startTransition(async () => {
      const result = acao === 'solo'
        ? await migrarParaConsultorioAction()
        : await continuarClinicaBloqueadaAction();
      if (!result.ok) setErrorMsg(result.error);
      else {
        setSuccessMsg(acao === 'solo' ? 'Plano alterado para Consultório.' : 'Clínica mantida sem cobrança até recompor a equipe.');
        router.refresh();
      }
    });
  };

  const abrirPortalCobranca = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await abrirPortalCobrancaAction();
      if (!result.ok) setErrorMsg(result.error);
      else window.location.assign(result.url);
    });
  };

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
      const path = `clinicas/${clinicId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: signedData, error: signError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(path, 60 * 60);
      if (signError) throw signError;

      const result = await salvarLogoUrl(path);
      if (result.error) throw new Error(result.error);

      setLogoUrl(signedData.signedUrl);
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

  return (
    <>
    <PageContainer>
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
              const showBadge = (id === 'perfil' && !dentista.cro) || (id === 'procedimentos' && procedimentosPendente);
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
                  <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
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
                  <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
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

            </div>

          )}

          {/* === ABA: CLÍNICA / CONSULTÓRIO === */}
          {abaAtiva === 'clinica' && (
            <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm space-y-6">
              <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-teal/20 bg-teal/10">
                    <Building2 className="size-5 text-teal" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal">Gestão compartilhada</p>
                    <h2 className="font-heading text-2xl font-bold text-text-primary">{clinicaForm.nome_clinica || labelContexto}</h2>
                    <p className="text-sm text-text-secondary">Dados, equipe e convites em um só lugar.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-xl border border-border bg-surface-alt px-3 py-2 text-xs font-semibold text-text-secondary">
                    {dentistasAtivos}/8 dentistas
                  </span>
                  <span className="rounded-xl border border-teal/20 bg-teal/10 px-3 py-2 text-xs font-semibold text-teal">
                    {formacao ? `${formacao.cartoesProntos}/2 cartões` : 'Clínica ativa'}
                  </span>
                </div>
              </div>

              {elegibilidade && elegibilidade.status !== 'regular' && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-text-primary">
                        {elegibilidade.status === 'recompondo_equipe'
                          ? 'A clínica precisa voltar ao mínimo de 2 dentistas'
                          : 'Escolha como continuar'}
                      </h3>
                      <p className="mt-1 text-sm text-text-secondary">
                        {elegibilidade.status === 'recompondo_equipe'
                          ? `Convide outro dentista até ${elegibilidade.prazoEquipe ? new Date(elegibilidade.prazoEquipe).toLocaleString('pt-BR') : 'o fim do prazo'}. Durante esse período, o acesso continua normal.`
                          : 'Você pode migrar sua assinatura para Consultório sem cobrança imediata, ou manter a clínica bloqueada e sem acumular cobrança até recompor a equipe.'}
                      </p>
                      {elegibilidade.status !== 'recompondo_equipe' && (
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => resolverElegibilidade('solo')}
                            className="min-h-11 rounded-xl bg-teal px-4 text-sm font-bold text-white transition-opacity disabled:opacity-50"
                          >
                            Migrar para Consultório
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => resolverElegibilidade('bloqueada')}
                            className="min-h-11 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-alt disabled:opacity-50"
                          >
                            Manter clínica bloqueada
                          </button>
                          <Link
                            href="/dashboard/arquivo-clinico"
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-alt"
                          >
                            Ler ou exportar prontuários
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {formacao && formacao.status !== 'ativa' && (
                <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Formação da clínica em andamento</p>
                    <p className="mt-1 text-xs text-text-secondary">{formacao.cartoesProntos}/2 cartões confirmados. O teste só começa quando os dois estiverem prontos.</p>
                  </div>
                  {formacao.expiresAt && <span className="shrink-0 rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-amber-600">Até {new Date(formacao.expiresAt).toLocaleString('pt-BR')}</span>}
                </div>
              )}

              {equipe && (
                <section aria-labelledby="equipe-clinica" className="rounded-2xl border border-border bg-surface-alt/30 p-5">
                  <UsuariosClient
                    usuarios={equipe.usuarios}
                    convitesPendentes={equipe.convitesPendentes}
                    meuId={equipe.meuId}
                    meuRole={equipe.meuRole}
                    limiteDentistas={8}
                    convitesRestantes={Math.max(0, 8 - dentistasAtivos - equipe.convitesPendentes.filter((c) => ['admin', 'dentista'].includes(c.role)).length)}
                    plano={plano}
                    asTab
                  />
                </section>
              )}

              <div className="border-t border-border pt-6">
                <h3 className="font-heading text-xl font-bold text-text-primary">Dados da clínica</h3>
                <p className="mt-1 text-sm text-text-secondary">Informações compartilhadas por toda a equipe.</p>
              </div>

              {/* Logo da clínica */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide block">
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
                    <p className="text-xs text-text-secondary">JPG, PNG ou WebP · máx. 2 MB</p>
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
                  <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
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
                  <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
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
                  <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
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
                <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide block">
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

              <div className="grid gap-4 border-t border-border pt-6 lg:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface-alt/40 p-5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal/10"><MessageCircle className="size-4 text-teal" /></div>
                  <div>
                    <div className="flex items-center gap-2"><h3 className="font-semibold text-text-primary">WhatsApp da clínica</h3><span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Em breve</span></div>
                    <p className="mt-1 text-sm text-text-secondary">Confirmações e mensagens compartilhadas chegarão na próxima atualização.</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                  <div><p className="text-sm font-semibold text-text-primary">Sair desta clínica</p><p className="mt-1 text-xs text-text-secondary">Seu vínculo é encerrado; prontuários e autoria são preservados.</p></div>
                  <button onClick={() => { setSairError(null); setShowSairDialog(true); }} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-red-500/30 px-3 text-sm font-semibold text-red-600 hover:bg-red-500/10"><LogOut className="size-4" />Sair</button>
                </div>
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

          {/* === ABA: PROCEDIMENTOS === */}
          {abaAtiva === 'procedimentos' && (
            <ProcedimentosCatalogo
              key={`${clinicId}:${dentista.id}`}
              procedimentosIniciais={procedimentosIniciais}
            />
          )}
          {/* === ABA: PLANO === */}
          {abaAtiva === 'plano' && (
            <div className="space-y-6">

              {/* Card: Plano Atual */}
              <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-heading font-bold text-2xl text-text-primary">Plano e Assinatura</h2>
                    <p className="text-sm text-text-secondary mt-1">
                      Acompanhe seu plano e gerencie sua assinatura.
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${
                    estadoPlano === 'ativo'  ? 'bg-teal/10 text-teal' :
                    estadoPlano === 'trial'  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                    estadoPlano === 'past_due' ? 'bg-red-500/10 text-red-500' :
                    estadoPlano === 'suspenso' ? 'bg-red-500/10 text-red-500' :
                                                      'bg-surface-alt text-text-secondary'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      estadoPlano === 'ativo'  ? 'bg-teal' :
                      estadoPlano === 'trial'  ? 'bg-amber-500 animate-pulse' :
                      estadoPlano === 'past_due' || estadoPlano === 'suspenso' ? 'bg-red-500' :
                                                        'bg-text-secondary'
                    }`} />
                    {estadoPlano === 'isento' ? 'Cortesia permanente' :
                     estadoPlano === 'ativo'  ? 'Ativo' :
                     estadoPlano === 'trial'  ? 'Teste de 7 dias' :
                     estadoPlano === 'em_formacao' ? 'Clínica em formação' :
                     estadoPlano === 'past_due' ? 'Pagamento pendente' :
                     estadoPlano === 'suspenso' ? 'Suspenso' : 'Inativo'}
                  </span>
                </div>

                <div className="flex items-center gap-4 p-5 rounded-2xl bg-surface-alt border border-border/60">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(47,156,133,0.12)', border: '1px solid rgba(47,156,133,0.25)' }}
                  >
                    {isSolo
                      ? <Stethoscope className="w-5 h-5 text-teal" />
                      : <Building2 className="w-5 h-5 text-teal" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text-primary text-base">{labelContexto}</p>
                    <p className="text-sm text-text-secondary font-mono">
                      R${planoConfig.preco}{isSolo ? '/mês' : '/dentista/mês'}
                    </p>
                  </div>
                  {isSolo && estadoPlano === 'inativo' && (
                    <button
                      onClick={() => setMigrarOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-teal bg-teal/10 border border-teal/20 hover:bg-teal/20 transition-colors shrink-0"
                    >
                      Criar Clínica
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {estadoPlano === 'trial' && estadoComercial?.trialEndsAt && (
                  <div className="mt-4 flex items-start gap-3 p-4 rounded-xl border border-amber-300/40 bg-amber-50/60 dark:bg-amber-900/15">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0 animate-pulse" />
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                      Trial ativo. Expira em{' '}
                      <span className="font-bold">{formatarDataTrial(estadoComercial.trialEndsAt)}</span>.{' '}
                      Assine para não perder o acesso.
                    </p>
                  </div>
                )}

                {estadoPlano === 'past_due' && (
                  <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                    <p className="text-sm font-semibold text-red-500">Não conseguimos confirmar a última cobrança.</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Atualize o cartão no portal Stripe{estadoComercial?.graceEndsAt ? ` até ${new Date(estadoComercial.graceEndsAt).toLocaleString('pt-BR')}` : ''} para evitar a suspensão do acesso.
                    </p>
                  </div>
                )}

                {estadoPlano === 'inativo' && (
                  <div className="mt-4">
                    <Link
                      href="/planos"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                      style={{
                        background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)',
                        boxShadow: '0 4px 20px -4px rgba(47,156,133,0.45)',
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                      Ativar assinatura
                    </Link>
                  </div>
                )}
              </div>

              {clinicaIsenta ? (
                <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10">
                      <Gift className="size-5 text-teal" />
                    </div>
                    <div>
                      <h2 className="font-heading text-xl font-bold text-text-primary">Acesso de cortesia</h2>
                      <p className="mt-1 text-sm text-text-secondary">Esta clínica é parceira do Odonto.IA e não possui cobrança, cartão ou faturas vinculadas.</p>
                    </div>
                  </div>
                </div>
              ) : (
              <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-alt">
                      <CreditCard className="size-5 text-text-secondary" />
                    </div>
                    <div>
                      <h2 className="font-heading text-xl font-bold text-text-primary">Cobrança segura pela Stripe</h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        Atualize cartão, consulte faturas e gerencie sua assinatura no portal protegido da Stripe.
                      </p>
                    </div>
                  </div>
                  {estadoPlano !== 'inativo' && estadoPlano !== 'em_formacao' ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={abrirPortalCobranca}
                      className="min-h-11 shrink-0 rounded-xl border border-teal/25 bg-teal/10 px-4 text-sm font-bold text-teal transition-colors hover:bg-teal/15 disabled:opacity-50"
                    >
                      Abrir portal de cobrança
                    </button>
                  ) : (
                    <Link
                      href="/planos"
                      className="flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-teal px-4 text-sm font-bold text-white"
                    >
                      Escolher plano
                    </Link>
                  )}
                </div>
                <p className="mt-4 text-xs text-text-secondary">O Odonto.IA não armazena o número completo do seu cartão.</p>
              </div>
              )}

              {formacao && formacao.status !== 'ativa' && (
                <div className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Formação em andamento</p>
                  <h3 className="mt-1 font-heading text-lg text-text-primary">Plano Clínica: {formacao.cartoesProntos}/2 cartões confirmados</h3>
                  <p className="mt-2 text-sm text-text-secondary">Nenhuma assinatura começa e nenhuma cobrança é feita antes de dois dentistas confirmarem seus cartões.</p>
                  <button
                    type="button"
                    onClick={() => setMigrarOpen(true)}
                    className="mt-4 min-h-11 rounded-xl border border-amber-500/30 bg-surface px-4 text-sm font-bold text-text-primary"
                  >
                    Continuar configuração
                  </button>
                </div>
              )}

              {/* A indicação ainda não possui rastreio/cobrança implementados: não prometemos benefício automático. */}
              <div
                className="rounded-3xl overflow-hidden"
                style={{
                  border: '1px solid rgba(47,156,133,0.25)',
                  background: 'linear-gradient(135deg, rgba(47,156,133,0.07) 0%, rgba(14,28,24,0.02) 100%)',
                }}
              >
                <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono text-teal">
                      Programa de Indicação
                    </span>
                    <h3 className="font-heading font-bold text-xl text-text-primary mt-1">
                      Indicações em breve
                    </h3>
                    <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                      Estamos preparando o programa de indicação com regras e benefícios transparentes.
                    </p>
                  </div>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(47,156,133,0.12)', border: '1px solid rgba(47,156,133,0.25)' }}
                  >
                    <Gift className="w-7 h-7 text-teal" />
                  </div>
                </div>

                <div className="px-6 pb-6 space-y-6">
                  <p className="rounded-2xl border border-border/60 bg-surface/80 px-4 py-3 text-sm text-text-secondary">
                    Você será avisado aqui quando o programa estiver disponível.
                  </p>
                </div>
              </div>

            </div>
          )}

        </motion.div>
      </div>

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
    </PageContainer>

    <MigrarClinicaModal
      open={migrarOpen}
      onClose={() => setMigrarOpen(false)}
      dentistasAtivos={dentistasAtivos}
    />
    </>
  );
}
