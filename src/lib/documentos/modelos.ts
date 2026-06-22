// Registry tipado de modelos de documentos clínicos.
// Adicionar um tipo/modelo novo = adicionar uma entrada aqui (sem tela nova).

export type TipoDocumento = 'receita' | 'atestado' | 'pedido_exame';

export interface CampoModelo {
  id: string;
  label: string;
  tipo: 'texto' | 'textarea' | 'numero';
  placeholder?: string;
  obrigatorio?: boolean;
  default?: string;
}

export interface DocumentoContexto {
  pacienteNome: string;
  hoje: string; // já formatado pt-BR
}

export interface ModeloDocumento {
  id: string;
  tipo: TipoDocumento;
  label: string;   // chip
  titulo: string;  // título no PDF
  campos: CampoModelo[];
  permiteDuasVias?: boolean;
  montarCorpo: (valores: Record<string, string>, ctx: DocumentoContexto) => string;
}

export const TIPO_LABEL: Record<TipoDocumento, string> = {
  receita:      'Receita',
  atestado:     'Atestado',
  pedido_exame: 'Pedido de exame',
};

export const MODELOS: ModeloDocumento[] = [
  // ── Receita ──────────────────────────────────────────────
  {
    id: 'simples',
    tipo: 'receita',
    label: 'Receita simples',
    titulo: 'Receituário',
    permiteDuasVias: true,
    campos: [
      {
        id: 'medicamentos',
        label: 'Medicamentos e posologia',
        tipo: 'textarea',
        obrigatorio: true,
        placeholder: 'Ex.: Amoxicilina 500mg — 21 cápsulas\nTomar 1 cápsula de 8/8h por 7 dias',
      },
    ],
    montarCorpo: (v) => (v.medicamentos ?? '').trim(),
  },
  // ── Atestado ─────────────────────────────────────────────
  {
    id: 'comparecimento',
    tipo: 'atestado',
    label: 'Comparecimento',
    titulo: 'Atestado de Comparecimento',
    campos: [
      { id: 'periodo', label: 'Período (opcional)', tipo: 'texto', placeholder: 'das 14h às 15h' },
    ],
    montarCorpo: (v, ctx) =>
      `Atesto para os devidos fins que ${ctx.pacienteNome} compareceu a esta clínica odontológica ` +
      `na data de ${ctx.hoje}${v.periodo?.trim() ? `, ${v.periodo.trim()}` : ''} para atendimento.`,
  },
  {
    id: 'afastamento',
    tipo: 'atestado',
    label: 'Afastamento',
    titulo: 'Atestado Médico-Odontológico',
    campos: [
      { id: 'dias', label: 'Dias de afastamento', tipo: 'numero', obrigatorio: true, default: '1' },
    ],
    montarCorpo: (v, ctx) => {
      const dias = parseInt(v.dias ?? '1', 10) || 1;
      return (
        `Atesto para os devidos fins que ${ctx.pacienteNome} necessita de afastamento de ` +
        `suas atividades pelo período de ${dias} dia(s), a partir de ${ctx.hoje}, ` +
        `por motivo odontológico.`
      );
    },
  },
  // ── Pedido de exame ──────────────────────────────────────
  ...([
    ['panoramica',          'Panorâmica',              'radiografia panorâmica'],
    ['periapical',          'Periapical',              'radiografia periapical'],
    ['tomografia',          'Tomografia (cone beam)',  'tomografia computadorizada de feixe cônico (cone beam)'],
    ['documentacao_orto',   'Documentação ortodôntica','documentação ortodôntica completa'],
  ] as const).map(([id, label, exame]): ModeloDocumento => ({
    id,
    tipo: 'pedido_exame',
    label,
    titulo: 'Solicitação de Exame',
    campos: [
      { id: 'justificativa', label: 'Justificativa clínica (opcional)', tipo: 'textarea',
        placeholder: 'Indicação clínica do exame' },
    ],
    montarCorpo: (v, ctx) =>
      `Solicito ${exame} para o(a) paciente ${ctx.pacienteNome}.` +
      (v.justificativa?.trim() ? `\n\nIndicação clínica: ${v.justificativa.trim()}` : ''),
  })),
];

export function modelosPorTipo(tipo: TipoDocumento): ModeloDocumento[] {
  return MODELOS.filter((m) => m.tipo === tipo);
}

export function getModelo(tipo: TipoDocumento, id: string): ModeloDocumento | undefined {
  return MODELOS.find((m) => m.tipo === tipo && m.id === id);
}
