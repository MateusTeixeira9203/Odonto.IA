'use client';

import { useState } from 'react';
import { Presentation } from 'lucide-react';
import { ApresentarPanel } from '@/components/pacientes/ApresentarPanel';
import { usePlanejamentoPaciente } from '@/hooks/usePlanejamentoPaciente';

interface ApresentarPacienteProps {
  patientId: string;
  clinicaId: string;
  patientName: string;
  fichaId?: string;
  compact?: boolean;
}

export function ApresentarPaciente({ patientId, clinicaId, patientName, fichaId, compact }: ApresentarPacienteProps) {
  const [open, setOpen] = useState(false);
  const plan = usePlanejamentoPaciente(patientId, clinicaId, patientName, open, fichaId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={compact
          ? "inline-flex items-center gap-1.5 bg-gradient-to-r from-teal to-teal-lt text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-[0_4px_14px_rgba(47,156,133,0.25)] hover:-translate-y-0.5 transition-all"
          : "inline-flex items-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"
        }
      >
        <Presentation className={compact ? "w-3 h-3" : "w-4 h-4"} />
        {compact ? 'Apresentar' : 'Apresentar ao paciente'}
      </button>

      <ApresentarPanel
        open={open}
        onClose={() => setOpen(false)}
        patientName={patientName}
        planningTitle={patientName}
        tratamentoAtivo={null}
        sections={plan.sections}
        planProcs={plan.planProcs}
        documents={plan.documents}
        budgetProcedures={plan.budgetProcedures}
        budgetExists={plan.budgetExists}
        concluidosCount={plan.concluidosCount}
        progressPercent={plan.progressPercent}
        totalBudget={plan.totalBudget}
        savingIds={plan.savingIds}
        isGeneratingAI={plan.isGeneratingAI}
        isImagePickerOpen={plan.isImagePickerOpen}
        setIsImagePickerOpen={plan.setIsImagePickerOpen}
        onUpdateSection={plan.updateSection}
        onRemoveSection={plan.removeSection}
        onAddSection={plan.addSection}
        onGenerateSectionWithAI={plan.generateSectionWithAI}
        onToggleImageSelection={plan.toggleImageSelection}
        onGenerateFullPlanWithAI={plan.generateFullPlanWithAI}
        onSaveSectionToDb={plan.saveSectionToDb}
      />
    </>
  );
}
