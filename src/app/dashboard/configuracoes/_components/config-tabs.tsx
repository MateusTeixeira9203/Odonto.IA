'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ClinicaForm } from './clinica-form';
import { HorariosForm } from './horarios-form';
import { ProcedimentosForm } from './procedimentos-form';
import type { ConfiguracaoClinica, HorarioDisponivel, Procedimento } from '@/types/database';

interface Props {
  configuracao: ConfiguracaoClinica | null;
  horarios: HorarioDisponivel[];
  procedimentos: Procedimento[];
}

export function ConfigTabs({ configuracao, horarios, procedimentos }: Props): React.JSX.Element {
  return (
    <Tabs defaultValue="clinica">
      <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 w-full justify-start gap-0 mb-6">
        {[
          { value: 'clinica', label: 'Clínica' },
          { value: 'horarios', label: 'Horários' },
          { value: 'procedimentos', label: 'Procedimentos' },
        ].map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="rounded-none border-b-2 border-transparent data-[selected]:border-teal data-[selected]:text-teal bg-transparent pb-3 pt-1 px-4 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
        <TabsContent value="clinica">
          <ClinicaForm configuracao={configuracao} />
        </TabsContent>
        <TabsContent value="horarios">
          <HorariosForm horarios={horarios} />
        </TabsContent>
        <TabsContent value="procedimentos">
          <ProcedimentosForm procedimentos={procedimentos} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
