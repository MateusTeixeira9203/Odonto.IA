'use client';

import { useState, useEffect, useRef } from 'react';
import { Presentation, Sparkles } from 'lucide-react';
import { ApresentarPanel } from '@/components/pacientes/ApresentarPanel';
import { ApresentarFichaPicker, type FichaParaApresentar } from '@/components/pacientes/ApresentarFichaPicker';
import { usePlanejamentoPaciente } from '@/hooks/usePlanejamentoPaciente';

type ApresentarVariant = 'default' | 'compact' | 'header';

interface ApresentarPacienteProps {
  patientId: string;
  clinicaId: string;
  patientName: string;
  /** Autor das seções de planejamento criadas aqui (migration 099). */
  dentistaId: string;
  /** Modo direto: apresenta esta ficha. Modo picker: ignorado (escolhido na lista). */
  fichaId?: string;
  /** 'direct' (default) abre o painel direto; 'picker' abre o seletor de fichas antes. */
  mode?: 'direct' | 'picker';
  /** Lista de fichas para o seletor (obrigatória quando mode='picker'). */
  fichas?: FichaParaApresentar[];
  /** @deprecated use variant='compact'. Mantido por retrocompatibilidade. */
  compact?: boolean;
  variant?: ApresentarVariant;
  /** Texto custom do botão (ex.: "Gerar plano de tratamento" na tela Ficha salva). */
  label?: string;
  /** Ao abrir o painel, gera o rascunho com IA se ainda não há plano (spec 2.3). */
  autoGenerate?: boolean;
  /** Pulso de destaque (só no contexto demo — gatilho do aha 2, DESIGN-KL §2). */
  glow?: boolean;
}

const TRIGGER_CLASS: Record<ApresentarVariant, string> = {
  default:
    'inline-flex items-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all',
  compact:
    'inline-flex items-center gap-1.5 bg-gradient-to-r from-teal to-teal-lt text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-[0_4px_14px_rgba(47,156,133,0.25)] hover:-translate-y-0.5 transition-all',
  // Header: outline-teal — convive com o "Nova Consulta" (teal cheio) sem dois cheios competindo (DESIGN-KL §2).
  header:
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal/50 text-teal bg-surface text-xs font-bold hover:bg-teal/5 hover:border-teal transition-colors',
};

export function ApresentarPaciente({
  patientId,
  clinicaId,
  patientName,
  dentistaId,
  fichaId,
  mode = 'direct',
  fichas,
  compact,
  variant,
  label,
  autoGenerate = false,
  glow = false,
}: ApresentarPacienteProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedFichaId, setSelectedFichaId] = useState<string | undefined>(fichaId);

  // Hook só roda quando o painel abre; no picker o fichaId vem da seleção (invariante 3 da spec).
  const plan = usePlanejamentoPaciente(patientId, clinicaId, patientName, dentistaId, panelOpen, selectedFichaId);

  // Auto-gerar o rascunho ao abrir (spec 2.3) — só quando não há plano ainda,
  // dados já carregados e nenhuma geração em curso. Ref evita disparo duplo.
  const autoGenDone = useRef(false);
  const { loadingData, isGeneratingAI, sections, generateFullPlanWithAI } = plan;
  useEffect(() => {
    if (!panelOpen) { autoGenDone.current = false; return; }
    if (!autoGenerate || autoGenDone.current) return;
    if (loadingData || isGeneratingAI) return;
    autoGenDone.current = true;
    if (sections.length === 0) void generateFullPlanWithAI(); // não sobrescreve plano existente
  }, [panelOpen, autoGenerate, loadingData, isGeneratingAI, sections.length, generateFullPlanWithAI]);

  const resolvedVariant: ApresentarVariant = variant ?? (compact ? 'compact' : 'default');
  const isCompact = resolvedVariant === 'compact';

  const handleTriggerClick = () => {
    if (mode === 'picker') {
      setPickerOpen(true);
    } else {
      setSelectedFichaId(fichaId);
      setPanelOpen(true);
    }
  };

  const handleSelectFicha = (id: string) => {
    setSelectedFichaId(id);
    setPickerOpen(false);
    setPanelOpen(true);
  };

  return (
    <>
      <button onClick={handleTriggerClick} className={`${TRIGGER_CLASS[resolvedVariant]}${glow ? ' btn-glow' : ''}`}>
        {autoGenerate
          ? <Sparkles className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
          : <Presentation className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />}
        {label ?? (isCompact || resolvedVariant === 'header' ? 'Apresentar' : 'Apresentar ao paciente')}
      </button>

      {mode === 'picker' && (
        <ApresentarFichaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          fichas={fichas ?? []}
          onSelect={handleSelectFicha}
        />
      )}

      <ApresentarPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
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
