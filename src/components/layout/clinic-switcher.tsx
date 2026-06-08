'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronsUpDown, Crown, Loader2 } from 'lucide-react';
import { useClinicSwitcher } from '@/hooks/use-clinic-switcher';

interface ClinicSwitcherProps {
  isExpanded: boolean;
  activeClinicId: string;
  activeClinicNome: string;
}

const ROLE_PT: Record<string, string> = {
  admin: 'Admin',
  dentista: 'Dentista',
  secretaria: 'Secretária',
};

export function ClinicSwitcher({ activeClinicId, activeClinicNome }: ClinicSwitcherProps) {
  const { clinicas, loading, switching, switchClinic } = useClinicSwitcher();

  const canSwitch = clinicas.length > 1;
  const activeClinica = clinicas.find((c) => c.id === activeClinicId);
  const roleLabel = activeClinica ? (ROLE_PT[activeClinica.role] ?? activeClinica.role) : '';

  if (loading) {
    return (
      <div className="px-5 pb-4">
        <div className="h-8 w-48 rounded-lg bg-white/[0.06] animate-pulse mb-2" />
        <div className="h-4 w-20 rounded bg-white/[0.04] animate-pulse" />
      </div>
    );
  }

  if (!canSwitch) {
    return (
      <div className="px-5 pb-4">
        <div className="text-[20px] font-bold text-white leading-tight truncate">
          {activeClinicNome}
        </div>
        {roleLabel && (
          <div className="flex items-center gap-1.5 mt-2">
            <Crown className="w-3.5 h-3.5 text-teal-lt shrink-0" />
            <span className="text-[13px] text-teal-lt font-medium">{roleLabel}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 pb-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            disabled={switching}
            className="flex items-start gap-2 px-2 py-2 w-full rounded-xl
              hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06]
              transition-all group disabled:opacity-50 text-left"
          >
            {switching && (
              <Loader2 className="w-4 h-4 text-teal animate-spin shrink-0 mt-1" />
            )}

            <div className="flex-1 min-w-0">
              <div className="text-[20px] font-bold text-white leading-tight truncate group-hover:text-white/95 transition-colors">
                {activeClinicNome}
              </div>
              {roleLabel && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Crown className="w-3.5 h-3.5 text-teal-lt shrink-0" />
                  <span className="text-[13px] text-teal-lt font-medium group-hover:text-teal transition-colors">
                    {roleLabel}
                  </span>
                </div>
              )}
            </div>

            {!switching && (
              <ChevronsUpDown className="w-3.5 h-3.5 text-white/22 group-hover:text-white/50 transition-colors shrink-0 mt-1.5" />
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[220px] rounded-xl p-1.5 shadow-2xl z-[100] animate-in fade-in zoom-in duration-200 text-white"
            style={{ background: 'rgba(13,13,13,0.97)', border: '1px solid rgba(47,156,133,0.2)' }}
            sideOffset={6}
            align="start"
            side="right"
          >
            <div className="px-3 pt-1.5 pb-1">
              <span className="text-[10px] text-white/22 font-mono uppercase tracking-[0.15em]">
                Suas Clínicas
              </span>
            </div>

            {clinicas.map((clinica) => {
              const isActive = clinica.id === activeClinicId;
              return (
                <DropdownMenu.Item
                  key={clinica.id}
                  disabled={isActive || switching}
                  onSelect={() => { void switchClinic(clinica.id); }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm outline-none cursor-pointer transition-colors ${
                    isActive
                      ? 'text-teal bg-teal/[0.08] cursor-default'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                    {isActive && <Check className="w-3.5 h-3.5 text-teal" />}
                  </div>
                  <span className="flex-1 truncate">{clinica.nome}</span>
                  <span className="text-xs font-mono text-white/28 shrink-0">
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
