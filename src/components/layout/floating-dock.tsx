'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  LayoutDashboard, Users, Calendar, CalendarClock, Wallet, Building2, Settings,
  Sun, Moon, User, LogOut, Bot, Check, ChevronsUpDown, Loader2,
} from 'lucide-react';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTheme } from 'next-themes';
import { useEffect, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { temFeature } from '@/lib/planos';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import { DockNavItem } from './dock-nav-item';
import { useClinicSwitcher } from '@/hooks/use-clinic-switcher';
import { useLogout } from '@/hooks/use-logout';
import { useDexBadge } from '@/hooks/use-dex-badge';

interface FloatingDockProps {
  nome: string;
  clinicaNome: string;
  activeClinicId: string;
  role: DentistaRole;
  avatarUrl?: string | null;
  plano?: PlanoId;
  consultorioPessoalEnabled?: boolean;
}

const ROLE_PT: Record<string, string> = {
  admin: 'Criador',
  dentista: 'Dentista',
  secretaria: 'Secretária',
};

const NAV_ITEMS = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Início',     id: 'dashboard' },
  // R-46g (D7) — Meu dia é a porta principal agora; tem que existir onde o dentista está,
  // não só no hero do dashboard. hideFromSecretaria: agendamentos são silo por dentista_id.
  { href: '/dashboard/meu-dia',       icon: CalendarClock,   label: 'Meu dia',    id: 'meu-dia',    hideFromSecretaria: true },
  { href: '/dashboard/pacientes',    icon: Users,           label: 'Pacientes',  id: 'pacientes' },
  { href: '/dashboard/agendamentos', icon: Calendar,        label: 'Agenda',     id: 'agenda' },
  { href: '/dashboard/financeiro',   icon: Wallet,          label: 'Financeiro', id: 'financeiro', requiresFeature: 'financeiro' as const },
  { href: '/dashboard/configuracoes',icon: Settings,        label: 'Config',     id: 'config',     hideFromSecretaria: true },
] as const;

const CONSULTORIO_PESSOAL_NAV_ITEM = {
  href: '/dashboard/meu-consultorio',
  icon: Building2,
  label: 'Consultório',
  id: 'meu-consultorio',
} as const;

const subscribeMounted = () => () => {};

export function FloatingDock({ nome, clinicaNome, activeClinicId, role, avatarUrl, plano, consultorioPessoalEnabled = false }: FloatingDockProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);
  const dexBadge = useDexBadge(role !== 'protetico');
  const { clinicas, loading: clinicasLoading, switching, switchClinic } = useClinicSwitcher();

  // R-19 — convenção de zona segura: o dock publica sua presença (body.has-dock) pra que barras
  // contextuais fixas no bottom-center (EncaminharBar, voice-ux, futuras) ancorem ACIMA dele via
  // var(--dock-inset) no CSS (ver globals.css). No body porque a EncaminharBar portaliza pro body
  // e escaparia de um wrapper. Desmonta em rota sem dock (ex. consulta) → var some → barra volta pro rodapé.
  useEffect(() => {
    document.body.classList.add('has-dock');
    return () => { document.body.classList.remove('has-dock'); };
  }, []);

  const canSwitch = clinicas.length > 1;
  const { logout, isLoggingOut } = useLogout();

  const avatarInitials = nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const financeiroLocked = !temFeature(plano ?? 'SOLO', 'financeiro');

  // R-94 — protético só acessa /dashboard/protetico (gate em dashboard/layout.tsx);
  // nenhum destino da nav faz sentido pra ele.
  const navItems = consultorioPessoalEnabled
    ? NAV_ITEMS.map(item => item.id === 'financeiro' ? CONSULTORIO_PESSOAL_NAV_ITEM : item)
    : NAV_ITEMS;
  const visibleItems = role === 'protetico' ? [] : navItems.filter(item => {
    if ('hideFromSecretaria' in item && item.hideFromSecretaria && role === 'secretaria') return false;
    return true;
  });

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-3 xl:bottom-6 left-1/2 -translate-x-1/2 z-50 hidden md:flex items-center gap-0 xl:gap-1 px-1 py-1.5 xl:px-2 xl:py-2 rounded-xl xl:rounded-2xl"
      style={{
        background: 'rgba(12, 17, 14, 0.88)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 40px -8px rgba(47,156,133,0.22), 0 2px 12px -4px rgba(0,0,0,0.5)',
      }}
    >
      {/* ── Logo + nome ── */}
      <div className="hidden xl:flex items-center gap-2 px-3 py-2 shrink-0">
        <OdontoIALogo className="w-5 h-5 text-teal shrink-0" />
        <span className="font-bold text-[14px] tracking-[0.03em] text-white whitespace-nowrap">
          Odonto<span className="text-teal">.IA</span>
        </span>
      </div>

      {/* ── Separador ── */}
      <div className="hidden xl:block w-px h-6 bg-white/[0.07] mx-1 shrink-0" />

      {/* ── Nav items ── */}
      {visibleItems.map(item => {
        const isActive = item.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname.startsWith(item.href);
        const locked = 'requiresFeature' in item && item.requiresFeature === 'financeiro'
          ? financeiroLocked
          : false;

        return (
          <DockNavItem
            key={item.id}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={isActive}
            locked={locked}
          />
        );
      })}

      {/* ── Separador centro ── */}
      <div className="w-px h-6 bg-white/[0.07] mx-1 shrink-0" />

      {/* ── Dex ball — protético não usa o assistente clínico ── */}
      {role !== 'protetico' && (
        <button
          title="Abrir DEX"
          onClick={() => window.dispatchEvent(new Event('dex-toggle'))}
          className="relative w-9 h-9 xl:w-11 xl:h-11 rounded-full flex items-center justify-center shrink-0 hover:scale-110 active:scale-95 transition-transform mx-0.5 xl:mx-1 outline-none"
          style={{
            background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)',
            boxShadow: '0 4px 16px -4px rgba(47,156,133,0.6)',
          }}
        >
          <Bot className="w-4 h-4 text-white" />
          <span className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: 'rgba(47,156,133,0.4)' }} />
          {dexBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
              {dexBadge > 9 ? '9+' : dexBadge}
            </span>
          )}
        </button>
      )}

      {/* ── Toggle tema ── */}
      <button
        title={mounted ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : 'Tema'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="w-9 h-9 xl:w-11 xl:h-11 rounded-lg xl:rounded-xl flex items-center justify-center shrink-0 text-white/45 hover:text-white/80 hover:bg-white/[0.07] transition-all mx-0.5 outline-none"
      >
        {mounted && theme === 'dark'
          ? <Sun style={{ width: 18, height: 18 }} />
          : <Moon style={{ width: 18, height: 18 }} />
        }
      </button>

      {/* ── Separador direita ── */}
      <div className="w-px h-6 bg-white/[0.07] mx-1 shrink-0" />

      {/* ── Avatar + dropdown ── */}
      {/* Radix DropdownMenu só monta no cliente para evitar hydration mismatch com useId */}
      {mounted ? (
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            title={nome}
            className="relative mx-0.5 xl:ml-1 xl:mr-1 h-9 w-9 xl:h-11 xl:w-11 flex items-center justify-center hover:brightness-110 active:opacity-80 transition-all outline-none"
          >
            <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-teal flex items-center justify-center text-white font-bold text-[11px] ring-2 ring-teal/20 overflow-hidden">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={nome} width={32} height={32} className="w-full h-full object-cover" />
              ) : avatarInitials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-[1.5px] border-[#0c110e]" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            sideOffset={12}
            align="end"
            className="rounded-2xl p-1.5 shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-150 min-w-[224px]"
            style={{ background: 'rgba(11,16,13,0.98)', border: '1px solid rgba(47,156,133,0.18)', backdropFilter: 'blur(12px)' }}
          >
            {/* User header */}
            <div className="px-2.5 py-3 border-b mb-1.5 flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden font-bold text-[11px] text-teal"
                style={{ background: 'rgba(47,156,133,0.18)', border: '1px solid rgba(47,156,133,0.28)' }}>
                {avatarUrl
                  ? <Image src={avatarUrl} alt={nome} width={36} height={36} className="w-full h-full object-cover" />
                  : avatarInitials}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white leading-tight truncate">{nome}</div>
                <div className="text-[11px] truncate mt-0.5 font-medium" style={{ color: 'rgba(47,156,133,0.75)' }}>{clinicaNome}</div>
              </div>
            </div>

            {/* Clinic switcher */}
            {clinicasLoading ? (
              <div className="px-2.5 py-2 mb-1.5">
                <div className="h-6 w-32 rounded-lg bg-white/[0.06] animate-pulse" />
              </div>
            ) : canSwitch ? (
              <div className="mb-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-2.5 pt-1 pb-0.5">
                  <span className="text-[10px] text-white/30 font-mono uppercase tracking-[0.15em]">
                    Clínicas
                  </span>
                </div>
                {clinicas.map((clinica) => {
                  const isActive = clinica.id === activeClinicId;
                  return (
                    <DropdownMenu.Item
                      key={clinica.id}
                      disabled={isActive || switching}
                      onSelect={() => { void switchClinic(clinica.id); }}
                      className={`flex items-center gap-2.5 px-2 py-2 rounded-xl outline-none cursor-pointer transition-all text-sm ${
                        isActive
                          ? 'text-teal bg-teal/[0.08] cursor-default'
                          : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: isActive ? 'rgba(47,156,133,0.18)' : 'rgba(255,255,255,0.05)' }}>
                        {isActive
                          ? <Check className="w-3.5 h-3.5 text-teal" />
                          : switching
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <ChevronsUpDown className="w-3 h-3 opacity-40" />
                        }
                      </div>
                      <span className="flex-1 truncate">{clinica.nome}</span>
                      <span className="text-[10px] font-mono text-white/28 shrink-0">
                        {ROLE_PT[clinica.role] ?? clinica.role}
                      </span>
                    </DropdownMenu.Item>
                  );
                })}
                <div className="pb-1.5" />
              </div>
            ) : null}

            {/* Perfil — protético não tem essa rota (gate em dashboard/layout.tsx bloqueia
                qualquer coisa fora de /dashboard/protetico); item sumiria num redirect de volta */}
            {role !== 'protetico' && (
              <DropdownMenu.Item
                onSelect={() => router.push('/dashboard/perfil')}
                className="flex items-center gap-2.5 px-2 py-2 text-sm text-white/55 hover:text-white hover:bg-white/[0.06] rounded-xl outline-none cursor-pointer transition-all group"
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-white/[0.08]"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <User className="w-3.5 h-3.5" />
                </div>
                Meu Perfil
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Separator className="h-px my-1.5 mx-1" style={{ background: 'rgba(255,255,255,0.07)' }} />

            {/* Sair */}
            <DropdownMenu.Item
              onSelect={(e) => { e.preventDefault(); void logout(); }}
              disabled={isLoggingOut}
              className="flex items-center gap-2.5 px-2 py-2 text-sm text-white/40 hover:text-red-400 hover:bg-red-400/[0.08] rounded-xl outline-none cursor-pointer transition-all group disabled:opacity-60 disabled:cursor-wait"
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-red-400/[0.12]"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                {isLoggingOut
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <LogOut className="w-3.5 h-3.5" />}
              </div>
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      ) : (
        /* Fallback estático durante SSR/hydration — sem Radix, sem mismatch */
        <button
          title={nome}
          className="relative ml-1 mr-1 outline-none"
          aria-label="Menu do usuário"
        >
          <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-white font-bold text-[11px] ring-2 ring-teal/20 overflow-hidden">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={nome} width={32} height={32} className="w-full h-full object-cover" />
            ) : avatarInitials}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-[1.5px] border-[#0c110e]" />
        </button>
      )}
    </motion.div>
  );
}
