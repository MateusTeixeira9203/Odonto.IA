'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useClinicSwitcher } from '@/hooks/use-clinic-switcher';

interface ClinicSwitcherProps {
  isExpanded: boolean;
  activeClinicId: string;
  activeClinicNome: string;
}

const ROLE_PT: Record<string, string> = {
  admin: 'admin',
  dentista: 'dentista',
  secretaria: 'secretária',
};

export function ClinicSwitcher({ isExpanded, activeClinicId, activeClinicNome }: ClinicSwitcherProps) {
  const { clinicas, loading, switching, switchClinic } = useClinicSwitcher();

  const canSwitch = clinicas.length > 1;
  const activeClinica = clinicas.find((c) => c.id === activeClinicId);
  const roleLabel = activeClinica ? (ROLE_PT[activeClinica.role] ?? activeClinica.role) : '';

  // Skeleton enquanto carrega a lista
  if (loading) {
    return (
      <div className={`px-3 mb-2 ${!isExpanded ? 'flex justify-center' : ''}`}>
        <div
          className={`h-9 rounded-lg bg-white/[0.04] animate-pulse ${isExpanded ? 'w-full' : 'w-10'}`}
        />
      </div>
    );
  }

  // Usuário com apenas uma clínica — exibe label não-interativo
  if (!canSwitch) {
    return (
      <div className={`px-3 mb-2 ${!isExpanded ? 'flex justify-center' : ''}`}>
        <div
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-transparent ${!isExpanded ? 'w-10 justify-center px-0' : ''}`}
        >
          <Building2 className="w-4 h-4 text-teal/60 shrink-0" />
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-zinc-500 truncate whitespace-nowrap overflow-hidden"
              >
                {activeClinicNome}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Usuário com múltiplas clínicas — switcher interativo
  return (
    <div className={`px-3 mb-2 ${!isExpanded ? 'flex justify-center' : ''}`}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            disabled={switching}
            className={`flex items-center gap-2.5 px-3 py-2 w-full rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-teal/20 transition-all group disabled:opacity-50 ${!isExpanded ? 'w-10 justify-center px-0' : ''}`}
          >
            {switching ? (
              <Loader2 className="w-4 h-4 text-teal animate-spin shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 text-teal/60 group-hover:text-teal shrink-0 transition-colors" />
            )}

            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 text-left overflow-hidden min-w-0"
                >
                  <div className="text-xs font-medium text-zinc-300 truncate whitespace-nowrap group-hover:text-white transition-colors">
                    {activeClinicNome}
                  </div>
                  {roleLabel && (
                    <div className="text-[10px] text-zinc-600 font-mono whitespace-nowrap">{roleLabel}</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isExpanded && !switching && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="shrink-0"
                >
                  <ChevronsUpDown className="w-3 h-3 text-zinc-600" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[220px] rounded-xl p-1.5 shadow-2xl z-[100] animate-in fade-in zoom-in duration-200 text-white"
            style={{ background: 'rgba(13,13,13,0.97)', border: '1px solid rgba(47,156,133,0.2)' }}
            sideOffset={6}
            align={isExpanded ? 'start' : 'center'}
            side="right"
          >
            <div className="px-3 pt-1.5 pb-1">
              <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em]">
                Suas Clínicas
              </span>
            </div>

            {clinicas.map((clinica) => {
              const isActive = clinica.id === activeClinicId;
              return (
                <DropdownMenu.Item
                  key={clinica.id}
                  disabled={isActive || switching}
                  onSelect={() => {
                    void switchClinic(clinica.id);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm outline-none cursor-pointer transition-colors ${
                    isActive
                      ? 'text-teal-lt bg-teal/[0.08] cursor-default'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                    {isActive && <Check className="w-3.5 h-3.5 text-teal" />}
                  </div>
                  <span className="flex-1 truncate">{clinica.nome}</span>
                  <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                    {ROLE_PT[clinica.role] ?? clinica.role}
                  </span>
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
