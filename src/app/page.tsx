'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import {
  Mic,
  ShieldCheck,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Zap,
  Lock,
  Phone,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Lazy-load canvas — doesn't block initial paint, no SSR needed
const ParticleNetwork = dynamic(() => import('@/components/ParticleNetwork'), {
  ssr: false,
  loading: () => null,
});

const words = ['Inteligência.', 'Velocidade.', 'Qualidade.'];

const faqs = [
  {
    question: 'Como funciona o orçamento por voz?',
    answer:
      'Durante a consulta, você ativa o assistente e descreve os procedimentos. A nossa IA processa a fala, identifica os códigos de serviço e gera um PDF profissional com valores e condições de pagamento, pronto para ser enviado ao paciente.',
  },
  {
    question: 'Meus dados estão seguros?',
    answer:
      'Sim. Utilizamos criptografia de nível bancário e silos de dados isolados. Se você compartilha consultório, seus dados financeiros são inacessíveis para outros profissionais, garantindo total privacidade.',
  },
  {
    question: 'Preciso de treinamento para usar?',
    answer:
      'O Odonto.IA foi desenhado para ser intuitivo. Se você sabe usar o WhatsApp, você sabe usar o Odonto.IA. A interface é minimalista e foca no que realmente importa para o seu dia a dia.',
  },
];

const btnPrimary = cn(
  'inline-flex items-center justify-center font-medium transition-all duration-300',
  'bg-teal hover:bg-teal-lt text-white rounded-full btn-glow',
);

const btnOutline = cn(
  'inline-flex items-center justify-center font-medium transition-all duration-300',
  'border border-border hover:bg-surface-alt rounded-full bg-bg/50 backdrop-blur-sm text-text-primary',
);

// Shared easing — ease-out-quart feels snappy on scroll, smooth on entrance
const ease = [0.22, 1, 0.36, 1] as const;

export default function LandingPage() {
  const [wordIndex, setWordIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -80]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(prev => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fadeUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.6, ease },
  };

  return (
    <div className="min-h-screen bg-bg selection:bg-teal/20 relative overflow-hidden">
      <ParticleNetwork />

      {/* Decorative blobs */}
      <div className="blob-shape top-[-10%] left-[-10%] w-[40vw] h-[40vw] opacity-60" />
      <div className="blob-shape top-[40%] right-[-10%] w-[35vw] h-[35vw] opacity-50" style={{ animationDelay: '-5s' }} />
      <div className="blob-shape bottom-[-10%] left-[20%] w-[45vw] h-[45vw] opacity-60" style={{ animationDelay: '-10s' }} />

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-bg/60 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-20 grid grid-cols-2 md:grid-cols-3 items-center">
          <div className="flex items-center gap-2 justify-self-start">
            <span className="text-2xl font-heading font-medium tracking-tight text-text-primary">
              Dent<span className="italic text-teal">IA</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 justify-self-center">
            {(['#funcionalidades', '#vantagens', '#faq'] as const).map((href, i) => (
              <a
                key={i}
                href={href}
                className="text-sm font-medium text-text-secondary hover:text-teal transition-colors"
              >
                {['Funcionalidades', 'Vantagens', 'FAQ'][i]}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4 justify-self-end">
            <Link
              href="/login"
              className="hidden lg:inline-flex items-center justify-center text-sm font-medium text-text-secondary hover:text-teal transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-alt"
            >
              Entrar
            </Link>
            <Link href="/planos" className={cn(btnPrimary, 'px-6 py-2 text-sm')}>
              Começar Agora
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 relative z-10">
        {/* ── Hero ── */}
        <section className="relative px-6 py-20 md:py-32">
          <div className="max-w-7xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 text-teal text-xs font-semibold mb-8 border border-teal/20 backdrop-blur-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              A Nova Era da Gestão Odontológica
            </motion.div>

            <div className="text-5xl md:text-7xl lg:text-8xl font-heading font-medium leading-[1.1] tracking-tight mb-8 h-[3.3em] md:h-[2.2em]">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease }}
              >
                A Odontologia na <br />
                <span className="text-teal italic">Era da </span>
                <span className="inline-block relative text-teal italic">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={words[wordIndex]}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -18 }}
                      transition={{ duration: 0.38, ease }}
                      className="absolute left-0"
                    >
                      {words[wordIndex]}
                    </motion.span>
                  </AnimatePresence>
                  <span className="invisible">{words[0]}</span>
                </span>
              </motion.div>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease }}
              className="max-w-3xl mx-auto text-lg md:text-xl text-text-secondary mb-12 leading-relaxed text-balance"
            >
              Otimize o seu atendimento, maximize o seu tempo. <br className="hidden md:block" />
              Do atendimento ao orçamento em segundos. A ferramenta que transforma a sua voz em gestão.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/planos" className={cn(btnPrimary, 'h-14 px-10 text-lg group')}>
                Começar Agora
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#funcionalidades" className={cn(btnOutline, 'h-14 px-10 text-lg')}>
                Ver Funcionalidades
              </a>
            </motion.div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="funcionalidades" className="px-6 py-24 relative">
          <div className="absolute inset-0 bg-surface-alt/30 backdrop-blur-md -z-10" />
          <div className="max-w-7xl mx-auto">
            <motion.div {...fadeUp} className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-heading mb-6 text-text-primary">
                O Poder da <span className="italic text-teal">IA</span> no seu Consultório
              </h2>
              <p className="text-text-secondary max-w-xl mx-auto">Tecnologia de ponta desenhada para a rotina real do dentista.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: 'DEX — O seu Concierge',
                  description:
                    'Um assistente que reconhece o dono. Consulte a sua agenda e o lucro do dia diretamente no WhatsApp.',
                  icon: MessageSquare,
                  color: 'bg-teal/10 text-teal',
                },
                {
                  title: 'Orçamentos por Voz',
                  description:
                    'Grave os procedimentos durante a consulta. A nossa IA gera o orçamento e envia o PDF profissional instantaneamente.',
                  icon: Mic,
                  color: 'bg-teal/10 text-teal',
                },
                {
                  title: 'Privacidade em Silos',
                  description:
                    'Perfeito para consultórios partilhados. Dados financeiros isolados e protegidos por dentista.',
                  icon: ShieldCheck,
                  color: 'bg-teal-pale text-teal-dark',
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.55, delay: i * 0.1, ease }}
                >
                  <Card className="h-full border-none shadow-sm hover:shadow-xl transition-all duration-500 group bg-surface/60 backdrop-blur-xl">
                    <CardContent className="p-8">
                      <div className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                        <feature.icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-heading mb-4 text-text-primary">{feature.title}</h3>
                      <p className="text-text-secondary leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Vantagens ── */}
        <section id="vantagens" className="px-6 py-24">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -32 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.65, ease }}
                className="relative"
                style={{ y: yParallax, willChange: 'transform' }}
              >
                <div className="aspect-square rounded-3xl bg-gradient-to-br from-teal/20 to-teal-lt/20 overflow-hidden relative backdrop-blur-md">
                  <Image
                    src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=800&auto=format&fit=crop"
                    alt="Dentista usando tecnologia"
                    fill
                    className="object-cover mix-blend-overlay opacity-80"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-surface/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-border/20 max-w-[80%]">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-teal/10 flex items-center justify-center">
                          <Zap className="text-teal w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-mono text-teal font-bold">LUCRO DO DIA</p>
                          <p className="text-2xl font-mono font-bold text-text-primary">R$ 4.250,00</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 w-full bg-surface-alt rounded-full overflow-hidden">
                          <div className="h-full bg-teal w-[85%]" />
                        </div>
                        <p className="text-xs text-text-secondary font-medium">85% da meta mensal atingida</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 32 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.65, ease }}
              >
                <Badge variant="outline" className="mb-6 border-teal/30 text-teal px-4 py-1 rounded-full backdrop-blur-sm bg-teal/5">
                  A Nova Era
                </Badge>
                <h2 className="text-4xl md:text-5xl font-heading mb-8 leading-tight text-text-primary">
                  Transforme o seu consultório numa{' '}
                  <span className="italic text-teal">empresa de alta performance.</span>
                </h2>

                <div className="space-y-8">
                  {[
                    {
                      title: 'Eliminação da Burocracia',
                      desc: 'Chega de preencher fichas intermináveis. Fale, e a IA organiza tudo para você.',
                    },
                    {
                      title: 'Aumento na Aprovação',
                      desc: 'Orçamentos profissionais enviados em segundos aumentam a percepção de valor e a taxa de fechamento.',
                    },
                    {
                      title: 'Organização Automática',
                      desc: 'Fluxo de caixa e agenda sincronizados sem que você precise tocar num teclado.',
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.45, delay: i * 0.1, ease }}
                      className="flex gap-4"
                    >
                      <div className="mt-1 shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-teal" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold mb-1 text-text-primary">{item.title}</h4>
                        <p className="text-text-secondary">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <Link href="/planos" className={cn(btnPrimary, 'mt-12 h-14 px-10 text-lg')}>
                  Quero Modernizar meu Consultório
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="px-6 py-24 relative">
          <div className="absolute inset-0 bg-surface-alt/20 backdrop-blur-md -z-10" />
          <div className="max-w-3xl mx-auto">
            <motion.div {...fadeUp} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-heading mb-4 text-text-primary">Dúvidas Frequentes</h2>
              <p className="text-text-secondary">Tudo o que você precisa saber sobre o Odonto.IA.</p>
            </motion.div>

            <motion.div {...fadeUp}>
              <div className="bg-surface/50 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-border/50 space-y-1">
                {faqs.map((faq, i) => (
                  <div key={i} className="border-b border-border/40 last:border-b-0">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full text-left py-4 flex items-center justify-between gap-4 font-semibold hover:text-teal transition-colors text-text-primary"
                    >
                      <span>{faq.question}</span>
                      <motion.div
                        animate={{ rotate: openFaq === i ? 180 : 0 }}
                        transition={{ duration: 0.22, ease }}
                      >
                        <ChevronDown
                          className={cn('w-4 h-4 shrink-0', openFaq === i ? 'text-teal' : 'text-text-secondary')}
                        />
                      </motion.div>
                    </button>

                    <AnimatePresence initial={false}>
                      {openFaq === i && (
                        <motion.div
                          key="answer"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease }}
                          className="overflow-hidden"
                        >
                          <p className="pb-4 text-text-secondary leading-relaxed">{faq.answer}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── CTA Final ── */}
        <section className="px-6 py-24">
          <motion.div {...fadeUp} className="max-w-5xl mx-auto">
            <div
              className="rounded-3xl p-12 md:p-20 text-center text-white relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #2f9c85 0%, #1e7060 100%)',
                boxShadow: '0 20px 60px -20px rgba(47,156,133,0.5)',
              }}
            >
              <div className="relative z-10">
                <h2 className="text-4xl md:text-6xl font-heading mb-8">
                  Pronto para elevar o nível do seu atendimento?
                </h2>
                <p className="text-white/90 text-lg md:text-xl mb-12 max-w-2xl mx-auto">
                  Junte-se aos dentistas que já estão economizando horas de burocracia semanal com a nossa inteligência.
                </p>
                <Link
                  href="/cadastro"
                  className="inline-flex items-center justify-center h-16 px-12 rounded-full text-xl font-medium bg-white text-teal hover:bg-bg transition-all duration-300 shadow-xl hover:scale-105"
                >
                  Começar Teste Grátis
                </Link>
                <p className="mt-6 text-sm text-white/70">Sem cartão de crédito. 7 dias grátis no Plano Clínica.</p>
              </div>

              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-lt/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-border/40 bg-bg/80 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col items-center md:items-start gap-4">
              <span className="text-2xl font-heading font-medium text-text-primary">
                Dent<span className="italic text-teal">IA</span>
              </span>
              <p className="text-sm text-text-secondary">© 2024 Odonto.IA. Todos os direitos reservados.</p>
            </div>

            <div className="flex gap-8">
              {['Termos', 'Privacidade', 'Contato'].map(label => (
                <a key={label} href="#" className="text-sm text-text-secondary hover:text-teal transition-colors">
                  {label}
                </a>
              ))}
            </div>

            <div className="flex gap-4">
              <button className="p-2 rounded-full hover:text-teal hover:bg-surface-alt transition-colors text-text-secondary">
                <Phone className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-full hover:text-teal hover:bg-surface-alt transition-colors text-text-secondary">
                <Lock className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
