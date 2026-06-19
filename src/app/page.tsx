'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import {
  Mic, ShieldCheck, ArrowRight, CheckCircle2, Sparkles,
  Brain, ChevronDown, Menu, X,
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import ParticleNetwork from '@/components/ParticleNetwork';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const TEAL    = '#2f9c85';
const TEAL_LT = '#5dbeb0';

// ── Shared animation preset ───────────────────────────────────────────────────
const fadeIn = {
  initial:     { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport:    { once: true },
  transition:  { duration: 0.6 },
} as const;

// ── Hero rotating words ───────────────────────────────────────────────────────

// ── Plans ─────────────────────────────────────────────────────────────────────
const PLANOS = [
  {
    id: 'SOLO', nome: 'Consultório', preco: '249', precoSuffix: '/mês',
    desc: 'Sistema completo para atendimento clínico — IA, fichas, planejamento, orçamentos, agenda e secretária.',
    features: [
      '1 Dentista + 1 Secretária',
      'Ficha clínica estruturada por IA',
      'Planejamento visual e orçamentos',
      'Transcrição de voz por IA',
      'Agenda e financeiro completo',
      '14 dias grátis para testar',
    ],
    popular: false, cta: '14 dias grátis',
  },
  {
    id: 'CLINICA', nome: 'Clínica', preco: '179', precoSuffix: '/dentista/mês',
    desc: 'Tudo do Consultório, mais secretária com visão unificada de todos os dentistas e WhatsApp integrado.',
    features: [
      'A partir de 3 dentistas',
      'Secretária gerencia todos os dentistas',
      'WhatsApp com bot e lembretes',
      'Gestão de funções (admin/dentista)',
      '14 dias grátis para testar',
    ],
    popular: true, cta: '14 dias grátis',
  },
];

// ── FAQs ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Como funciona o Modo Consulta?',
    a: 'Durante o atendimento, você ativa a gravação e fala livremente. O Dex transcreve, identifica dentes e procedimentos, e estrutura a ficha clínica automaticamente. Você revisa e salva em menos de 30 segundos.',
  },
  {
    q: 'Como funciona o orçamento por voz?',
    a: 'Descreva os procedimentos durante a consulta. A IA processa a fala, identifica os serviços e gera um PDF profissional com valores e condições de pagamento, pronto para ser enviado ao paciente via WhatsApp.',
  },
  {
    q: 'Meus dados estão seguros?',
    a: 'Sim. Utilizamos criptografia de nível bancário e silos de dados isolados. Se você compartilha consultório, seus dados financeiros são completamente inacessíveis para outros profissionais.',
  },
  {
    q: 'Preciso de treinamento para usar?',
    a: 'Não. O Odonto.IA foi desenhado para ser intuitivo. Se você sabe usar o WhatsApp, você sabe usar o Odonto.IA. A adoção acontece em minutos, não em dias.',
  },
];

// ── Antes / Depois ────────────────────────────────────────────────────────────
const ANTES_DEPOIS = [
  { before: '20–30 min de ficha por paciente',            after: 'Ficha estruturada automaticamente em < 30s' },
  { before: 'Planejamento no Word ou no papel',           after: 'Planejamento visual gerado pelo Dex' },
  { before: 'Orçamento explicado verbalmente',            after: 'PDF profissional + envio via WhatsApp' },
  { before: 'Confirmação de agenda por ligação',          after: 'Confirmação automática, sem esforço' },
  { before: 'Secretária e dentista via WhatsApp pessoal', after: 'Equipe sincronizada em tempo real no sistema' },
];

// ── DexCard — mockup decorativo ───────────────────────────────────────────────
function DexCard() {
  const bars  = [3, 5, 8, 12, 9, 6, 14, 10, 7, 5, 11, 8, 13, 6, 4, 10];
  const steps = [
    { done: true,  label: 'Queixa principal identificada' },
    { done: true,  label: 'Dente 16 mapeado — região oclusal' },
    { done: false, label: 'Estruturando ficha clínica...' },
  ];
  const fields = [
    { k: 'queixa',  v: 'Sensibilidade dental — #16' },
    { k: 'dentes',  v: '#16, região oclusal (FDI)' },
    { k: 'conduta', v: 'Avaliação periapical + vitalidade' },
  ];

  return (
    <div
      aria-hidden="true"
      className="rounded-[2rem] overflow-hidden w-full"
      style={{
        background: '#ffffff',
        border: `1px solid color-mix(in srgb, ${TEAL} 20%, transparent)`,
        boxShadow: `0 40px 100px -20px rgba(0,0,0,0.12), 0 0 60px -10px color-mix(in srgb, ${TEAL} 18%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b"
        style={{ borderColor: `color-mix(in srgb, ${TEAL} 12%, transparent)`, background: `color-mix(in srgb, ${TEAL} 4%, #fff)` }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
          </div>
          <span className="text-xs font-mono font-bold" style={{ color: TEAL }}>◆ Dex</span>
          <span className="text-xs font-mono text-gray-400">— modo-consulta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-red-400" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400">ao vivo</span>
        </div>
      </div>

      <div className="px-5 py-4 border-b" style={{ borderColor: `color-mix(in srgb, ${TEAL} 8%, transparent)` }}>
        <div className="flex items-end gap-[2.5px] h-10 mb-3">
          {bars.map((h, i) => (
            <motion.div key={i} className="flex-1 rounded-full"
              style={{ background: `linear-gradient(to top, ${TEAL}, ${TEAL_LT})`, opacity: 0.35 + (i % 5) * 0.1 }}
              animate={{ height: [`${h * 2}px`, `${h * 2.8}px`, `${h * 1.8}px`, `${h * 2.4}px`, `${h * 2}px`] }}
              transition={{ duration: 1.8 + (i % 4) * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.04 }}
            />
          ))}
        </div>
        <p className="text-xs font-mono italic text-gray-400">
          &ldquo;...sensibilidade ao morder, piora com gelado, há três dias...&rdquo;
        </p>
      </div>

      <div className="px-5 py-3.5 space-y-2.5 border-b" style={{ borderColor: `color-mix(in srgb, ${TEAL} 8%, transparent)` }}>
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            {s.done
              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: TEAL }} />
              : <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin shrink-0"
                  style={{ borderColor: TEAL, borderTopColor: 'transparent' }} />
            }
            <span className="text-xs font-mono" style={{ color: s.done ? '#0d0d0d' : '#9ca3af' }}>
              {s.done ? '✓ ' : '⟳ '}{s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">
            ficha_clinica.json
          </span>
          <span className="font-mono text-xs font-bold" style={{ color: TEAL }}>28s ↗</span>
        </div>
        <div className="rounded-xl p-3 space-y-1.5 font-mono text-xs"
          style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid color-mix(in srgb, ${TEAL} 10%, transparent)` }}>
          <p className="text-gray-400">{`{`}</p>
          {fields.map(f => (
            <p key={f.k} className="pl-3">
              <span style={{ color: TEAL_LT }}>&ldquo;{f.k}&rdquo;</span>
              <span className="text-gray-400">: </span>
              <span style={{ color: '#b45309' }}>&ldquo;{f.v}&rdquo;</span>
            </p>
          ))}
          <p className="text-gray-400">{`}`}</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [openFaq,    setOpenFaq]    = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [mounted,    setMounted]    = useState(false);

  const { resolvedTheme } = useTheme();

  const vantagensRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: vantagensScroll } = useScroll({
    target: vantagensRef,
    offset: ['start end', 'end start'],
  });
  const yParallax = useTransform(vantagensScroll, [0, 1], [30, -30]);

  useEffect(() => { setMounted(true); }, []);


  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Theme-aware tokens (safe: defaults to light until mounted) ────────────
  const dark = mounted && resolvedTheme === 'dark';

  const cardBg          = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)';
  const cardBorder      = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
  const navBg           = scrolled ? (dark ? 'rgba(8,22,18,0.88)' : 'rgba(245,243,239,0.92)') : 'transparent';
  const navBorderColor  = scrolled ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent';
  const drawerBg        = dark ? 'rgba(8,22,18,0.97)'      : 'rgba(245,243,239,0.98)';
  const drawerLinkColor = dark ? '#d1d5db'                  : '#374151';
  const drawerBtnBorder = dark ? 'rgba(255,255,255,0.15)'  : 'rgba(0,0,0,0.1)';
  const navLinkColor    = dark ? '#d1d5db'                  : '#6b7280';
  const heroSecBg       = dark ? 'rgba(255,255,255,0.08)'  : 'rgba(255,255,255,0.5)';
  const heroSecBorder   = dark ? 'rgba(255,255,255,0.18)'  : 'rgba(0,0,0,0.1)';
  const heroSecColor    = dark ? '#e2e8f0'                  : '#6b7280';
  const stripGapBg      = dark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.06)';
  const stripCellBg     = dark ? 'rgba(255,255,255,0.07)'  : 'rgba(255,255,255,0.5)';
  const tableHeadBg     = dark ? 'rgba(0,0,0,0.30)'        : 'rgba(0,0,0,0.04)';
  const tableHeadBorder = dark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.06)';
  const tableRowBorder  = dark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.05)';
  const tableRowAltBg   = dark ? 'rgba(255,255,255,0.04)'  : 'rgba(255,255,255,0.35)';
  const afterColor      = dark ? '#f1f5f9'                  : '#0d0d0d';
  const pricingCtaColor = dark ? '#e2e8f0'                  : '#374151';
  const pricingCtaBorder= dark ? 'rgba(255,255,255,0.15)'  : 'rgba(0,0,0,0.1)';
  const pricingBorderFn = (popular: boolean) => popular ? TEAL : (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)');
  const faqBorder       = (open: boolean) => open
    ? `color-mix(in srgb, ${TEAL} 30%, transparent)`
    : (dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)');
  const faqBtnColor     = (open: boolean) => open ? TEAL : (dark ? '#f1f5f9' : '#0d0d0d');
  const footerBg        = dark ? 'rgba(8,22,18,0.60)'      : 'rgba(245,243,239,0.75)';
  const footerBorder    = dark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.07)';

  const NAV_LINKS = [
    ['#funcionalidades', 'Funcionalidades'],
    ['#vantagens',       'Vantagens'],
    ['#precos',          'Preços'],
    ['#faq',             'FAQ'],
  ] as const;

  return (
    <div className="min-h-screen selection:bg-teal/20 relative overflow-x-hidden">
      <ParticleNetwork />

      {/* Background blobs */}
      <div className="blob-shape top-[-10%] left-[-10%] w-[40vw] h-[40vw] opacity-60" />
      <div className="blob-shape top-[40%] right-[-10%] w-[35vw] h-[35vw] opacity-50" style={{ animationDelay: '-5s' }} />
      <div className="blob-shape bottom-[-5%] left-[20%] w-[45vw] h-[45vw] opacity-55" style={{ animationDelay: '-10s' }} />

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 w-full z-50 border-b transition-all duration-300"
        style={{
          background:         navBg,
          backdropFilter:     scrolled ? 'blur(20px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderColor:        navBorderColor,
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <Link href="/" className="text-2xl font-[family-name:var(--font-dm-serif)] tracking-tight">
            Odonto<span className="italic text-teal">.IA</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href}
                className="text-sm font-medium hover:text-teal transition-colors"
                style={{ color: navLinkColor }}
              >
                {label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login"
              className="text-sm font-medium hover:text-teal transition-colors px-3 py-1.5"
              style={{ color: navLinkColor }}
            >
              Entrar
            </Link>
            <Link
              href="/cadastro?plano=CLINICA"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white btn-glow transition-all duration-200 hover:-translate-y-px hover:brightness-110"
              style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LT})` }}
            >
              Começar agora
            </Link>
          </div>

          <button
            className="md:hidden p-2 rounded-lg transition-colors hover:bg-black/5"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            <motion.div animate={{ rotate: mobileOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.div>
          </button>
        </div>
      </nav>

      {/* ── MOBILE DRAWER ───────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-0 top-20 bottom-0 z-40 flex flex-col px-6 py-6 md:hidden"
            style={{ background: drawerBg, backdropFilter: 'blur(24px)' }}
          >
            <div className="flex flex-col gap-0">
              {NAV_LINKS.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center py-4 text-lg font-medium hover:text-teal transition-colors"
                  style={{ color: drawerLinkColor, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}` }}
                >
                  {label}
                </a>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-3 pt-6">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center justify-center py-3.5 rounded-xl border text-sm font-semibold hover:text-teal hover:border-teal/40 transition-all"
                style={{ borderColor: drawerBtnBorder, color: drawerLinkColor }}
              >
                Entrar
              </Link>
              <Link
                href="/cadastro?plano=CLINICA"
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white btn-glow"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LT})` }}
              >
                Começar 7 Dias Grátis
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-20 relative z-10">

        {/* ══════════════════════════════════════ HERO */}
        <section className="relative px-6 pt-20 pb-16 md:pt-32 md:pb-24">
          <div className="max-w-7xl mx-auto text-center relative z-10">

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 border"
              style={{
                background:  `color-mix(in srgb, ${TEAL} 8%, transparent)`,
                borderColor: `color-mix(in srgb, ${TEAL} 22%, transparent)`,
                color: TEAL,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              O sistema operacional da sua clínica
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl md:text-7xl lg:text-8xl font-[family-name:var(--font-dm-serif)] leading-[1.08] tracking-tight mb-8"
            >
              Você atende.<br />
              <span className="italic text-teal">A IA documenta.</span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-2xl mx-auto text-lg md:text-xl text-gray-500 dark:text-gray-300 mb-12 leading-relaxed"
            >
              O Odonto.IA transcreve a consulta, estrutura a ficha clínica e prepara
              o orçamento automaticamente — sem digitar nada.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                href="/cadastro?plano=CLINICA"
                className="group inline-flex items-center gap-2 h-14 px-10 rounded-full text-lg font-semibold text-white btn-glow transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LT})` }}
              >
                Começar 7 Dias Grátis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#funcionalidades"
                className="inline-flex items-center h-14 px-10 rounded-full text-lg font-medium border transition-all duration-200 hover:border-teal/30 hover:text-teal"
                style={{ borderColor: heroSecBorder, background: heroSecBg, color: heroSecColor }}
              >
                Ver Funcionalidades
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-5 text-xs font-mono text-gray-400"
            >
              sem cartão de crédito · cancele quando quiser · LGPD compliant
            </motion.p>
          </div>
        </section>

        {/* ══════════════════════════════════════ STATS STRIP */}
        <section className="px-6 pb-20">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden"
              style={{ background: stripGapBg, boxShadow: `0 0 0 1px color-mix(in srgb, ${TEAL} 10%, transparent)` }}
            >
              {[
                { value: '< 30s',  label: 'Por ficha clínica' },
                { value: '0',      label: 'Digitação durante a consulta' },
                { value: '100%',   label: 'Dados seus, sempre' },
                { value: 'LGPD',   label: 'Compliance nativo' },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex flex-col items-center justify-center px-4 py-6 text-center"
                  style={{ background: stripCellBg, backdropFilter: 'blur(12px)' }}
                >
                  <p
                    className="font-[family-name:var(--font-dm-serif)] text-2xl mb-1"
                    style={{
                      background:           `linear-gradient(135deg, ${TEAL}, ${TEAL_LT})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor:  'transparent',
                      backgroundClip:       'text',
                    }}
                  >
                    {item.value}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-300 font-mono leading-snug">{item.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════ FEATURES */}
        <section id="funcionalidades" className="px-6 py-24 relative">
          <div className="max-w-7xl mx-auto">
            <motion.div {...fadeIn} className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-[family-name:var(--font-dm-serif)] mb-6">
                O Poder da <span className="italic text-teal">IA</span> no seu Consultório
              </h2>
              <p className="text-gray-500 dark:text-gray-300 max-w-xl mx-auto">
                Tecnologia de ponta desenhada para a rotina real do dentista.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Modo Consulta — IA em Tempo Real',
                  description: 'Fale livremente com o paciente. O Dex transcreve, identifica dentes e procedimentos, e estrutura a ficha clínica automaticamente em menos de 30 segundos.',
                  icon: Brain,
                  iconClass: 'bg-teal/10 text-teal',
                },
                {
                  title: 'Orçamentos por Voz',
                  description: 'Descreva os procedimentos durante a consulta. A IA gera o orçamento e envia o PDF profissional via WhatsApp instantaneamente.',
                  icon: Mic,
                  iconClass: 'bg-teal/10 text-teal',
                },
                {
                  title: 'Privacidade em Silos',
                  description: 'Perfeito para consultórios compartilhados. Fichas e dados financeiros isolados por dentista — nenhum profissional acessa os dados do outro.',
                  icon: ShieldCheck,
                  iconClass: 'bg-orange-500/10 text-orange-500',
                },
              ].map((feat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <div
                    className="h-full rounded-2xl p-8 border group hover:shadow-xl transition-all duration-500 backdrop-blur-md"
                    style={{ background: cardBg, borderColor: cardBorder }}
                  >
                    <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500', feat.iconClass)}>
                      <feat.icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-[family-name:var(--font-dm-serif)] mb-4">{feat.title}</h3>
                    <p className="text-gray-500 dark:text-gray-300 leading-relaxed">{feat.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ VANTAGENS */}
        <section id="vantagens" ref={vantagensRef} className="px-6 py-24">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative order-2 lg:order-1"
                style={{ y: yParallax }}
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-4 -right-3 z-20 px-3 py-2 rounded-xl text-xs font-mono font-semibold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LT})`,
                    boxShadow: `0 8px 24px color-mix(in srgb, ${TEAL} 45%, transparent)`,
                  }}
                >
                  ✓ Ficha estruturada em 28s
                </motion.div>
                <DexCard />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-1 lg:order-2"
              >
                <div
                  className="inline-flex items-center px-4 py-1.5 rounded-full border text-sm font-medium mb-6"
                  style={{
                    borderColor: `color-mix(in srgb, ${TEAL} 25%, transparent)`,
                    background:  `color-mix(in srgb, ${TEAL} 6%, transparent)`,
                    color: TEAL,
                  }}
                >
                  A Nova Era
                </div>

                <h2 className="text-4xl md:text-5xl font-[family-name:var(--font-dm-serif)] mb-8 leading-tight">
                  Transforme seu consultório numa{' '}
                  <span className="italic text-teal">empresa de alta performance.</span>
                </h2>

                <div className="space-y-8">
                  {[
                    { title: 'Eliminação da Burocracia',      desc: 'Chega de preencher fichas intermináveis. Fale, e a IA organiza tudo em segundos. Zero digitação durante a consulta.' },
                    { title: 'Planejamentos que Convertem',   desc: 'Apresentações visuais do plano de tratamento aumentam a percepção de valor e a taxa de fechamento dos orçamentos.' },
                    { title: 'Equipe em Sincronia',           desc: 'Secretária e dentista conectados em tempo real. Agenda, check-in e cancelamentos sem WhatsApp de trabalho.' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <CheckCircle2 className="w-6 h-6 text-teal mt-1 shrink-0" />
                      <div>
                        <h4 className="text-lg font-semibold mb-1">{item.title}</h4>
                        <p className="text-gray-500 dark:text-gray-300">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/cadastro?plano=CLINICA"
                  className="mt-12 inline-flex items-center gap-2 h-14 px-10 rounded-full text-lg font-semibold text-white btn-glow transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                  style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LT})` }}
                >
                  Começar agora
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ ANTES / DEPOIS */}
        <section className="relative px-6 py-20 overflow-hidden">
          <div className="max-w-4xl mx-auto">
            <motion.div {...fadeIn} className="text-center mb-14">
              <p className="text-xs font-mono font-bold uppercase tracking-[0.22em] mb-3" style={{ color: TEAL }}>
                // a mudança real
              </p>
              <h2 className="text-3xl md:text-5xl font-[family-name:var(--font-dm-serif)] leading-tight">
                O que muda no <span className="italic text-teal">seu dia.</span>
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl overflow-hidden border backdrop-blur-md"
              style={{
                borderColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                boxShadow: `0 0 0 1px color-mix(in srgb, ${TEAL} 6%, transparent)`,
                background: cardBg,
              }}
            >
              <div
                className="grid grid-cols-2 px-6 py-3 text-[10px] font-mono font-bold uppercase tracking-widest"
                style={{ background: tableHeadBg, borderBottom: `1px solid ${tableHeadBorder}` }}
              >
                <span className="text-gray-400">// antes</span>
                <span style={{ color: TEAL }}>// com odonto.ia</span>
              </div>

              {ANTES_DEPOIS.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 px-6 py-4 border-t"
                  style={{
                    borderColor: tableRowBorder,
                    background: i % 2 === 0 ? tableRowAltBg : 'transparent',
                  }}
                >
                  <p className="text-sm font-mono leading-relaxed pr-4 text-gray-400 line-through">
                    {row.before}
                  </p>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-teal" />
                    <p className="text-sm leading-relaxed" style={{ color: afterColor }}>{row.after}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════ PREÇOS */}
        <section id="precos" className="px-6 py-24 relative">
          <div className="max-w-5xl mx-auto">
            <motion.div {...fadeIn} className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-[family-name:var(--font-dm-serif)] mb-4">
                Preços <span className="italic text-teal">sem surpresa</span>
              </h2>
              <p className="text-gray-500 dark:text-gray-300">
                Sem taxa de setup. Sem contratos. Todos os planos incluem{' '}
                <strong className="text-teal">14 dias de teste gratuito.</strong>
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6 items-stretch max-w-3xl mx-auto">
              {PLANOS.map((plano, i) => (
                <motion.div
                  key={plano.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.1 }}
                  className="relative"
                >
                  {plano.popular && (
                    <div
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 text-xs font-bold text-white px-4 py-1.5 rounded-full whitespace-nowrap"
                      style={{
                        background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LT})`,
                        boxShadow:  `0 4px 12px color-mix(in srgb, ${TEAL} 40%, transparent)`,
                      }}
                    >
                      ★ Mais popular
                    </div>
                  )}
                  <div
                    className={cn('h-full rounded-2xl p-7 flex flex-col border backdrop-blur-md transition-all duration-300', plano.popular && 'shadow-xl')}
                    style={{
                      background:   cardBg,
                      borderColor:  pricingBorderFn(plano.popular),
                      boxShadow:    plano.popular
                        ? `0 0 0 2px ${TEAL}, 0 24px 60px -16px color-mix(in srgb, ${TEAL} 25%, transparent)`
                        : undefined,
                      paddingTop: plano.popular ? '2.25rem' : undefined,
                    }}
                  >
                    <div className="mb-6">
                      <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 mb-3">
                        {plano.nome}
                      </p>
                      <div className="flex items-end gap-1.5 mb-3">
                        <span className="font-[family-name:var(--font-dm-serif)] text-5xl">
                          R${plano.preco}
                        </span>
                        <span className="text-sm text-gray-400 mb-1.5">{plano.precoSuffix}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-300 leading-relaxed">{plano.desc}</p>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {plano.features.map(feat => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-teal" />
                          <span className="text-sm text-gray-500 dark:text-gray-300">{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={`/cadastro?plano=${plano.id}`}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5',
                        plano.popular ? 'text-white' : 'border hover:border-teal/60 hover:text-teal'
                      )}
                      style={plano.popular
                        ? { background: `linear-gradient(135deg, ${TEAL}, ${TEAL_LT})`, boxShadow: `0 4px 16px color-mix(in srgb, ${TEAL} 35%, transparent)` }
                        : { borderColor: pricingCtaBorder, color: pricingCtaColor }
                      }
                    >
                      {plano.cta}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="text-center text-xs font-mono text-gray-400 mt-6">
              plano clínica: mínimo 3 dentistas · cada dentista paga individualmente
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════ FAQ */}
        <section id="faq" className="px-6 py-24 relative">
          <div className="max-w-3xl mx-auto">
            <motion.div {...fadeIn} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-[family-name:var(--font-dm-serif)] mb-4">
                Dúvidas Frequentes
              </h2>
              <p className="text-gray-500 dark:text-gray-300">Tudo o que você precisa saber sobre o Odonto.IA.</p>
            </motion.div>

            <motion.div {...fadeIn} className="space-y-3">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden border backdrop-blur-md transition-colors duration-200"
                  style={{ background: cardBg, borderColor: faqBorder(openFaq === i) }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full text-left px-6 py-4 flex items-center justify-between gap-4"
                    style={{ color: faqBtnColor(openFaq === i) }}
                  >
                    <span className="font-semibold">{faq.q}</span>
                    <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4 shrink-0" style={{ color: openFaq === i ? TEAL : '#9ca3af' }} />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="mx-6 mb-4 border-t" style={{ borderColor: `color-mix(in srgb, ${TEAL} 12%, transparent)` }} />
                        <p className="px-6 pb-5 text-sm text-gray-500 dark:text-gray-300 leading-relaxed">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════ CTA FINAL */}
        <section className="px-6 py-24">
          <motion.div {...fadeIn} className="max-w-5xl mx-auto">
            <div
              className="relative rounded-[3rem] p-12 md:p-20 text-center text-white overflow-hidden"
              style={{
                background: `linear-gradient(135deg, #1a5c50 0%, ${TEAL} 50%, #1e7060 100%)`,
                boxShadow:  `0 32px 80px -20px color-mix(in srgb, ${TEAL} 50%, transparent)`,
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
              />
              <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(0,0,0,0.2)' }} />

              <div className="relative z-10">
                <h2 className="text-4xl md:text-6xl font-[family-name:var(--font-dm-serif)] mb-8">
                  Pronto para elevar o nível do seu atendimento?
                </h2>
                <p className="text-white/80 text-lg md:text-xl mb-12 max-w-2xl mx-auto">
                  Cada minuto que você passa documentando é um minuto longe do paciente.
                  <br className="hidden md:block" />
                  O Odonto.IA resolve isso.
                </p>
                <Link
                  href="/cadastro?plano=CLINICA"
                  className="inline-flex items-center gap-2 h-16 px-12 rounded-full text-xl font-semibold transition-all duration-300 hover:scale-105"
                  style={{ background: '#ffffff', color: TEAL, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
                >
                  Começar 7 Dias Grátis
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <p className="mt-6 text-sm text-white/60 font-mono">
                  Sem cartão de crédito. Cancele quando quiser.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

      </main>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer
        className="px-6 py-12 border-t relative z-10"
        style={{ borderColor: footerBorder, background: footerBg, backdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <span className="text-2xl font-[family-name:var(--font-dm-serif)]">
            Odonto<span className="italic text-teal">.IA</span>
          </span>
          <div className="flex gap-8">
            {['Termos', 'Privacidade', 'Contato'].map(label => (
              <a key={label} href="#" className="text-sm text-gray-500 dark:text-gray-300 hover:text-teal transition-colors">
                {label}
              </a>
            ))}
          </div>
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Odonto.IA. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
