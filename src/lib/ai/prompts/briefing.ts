export interface BriefingInput {
  pacienteNome: string;
  idadeStr: string;
  hora: string;
  observacoesAgendamento: string | null;
  observacoesPaciente: string | null;
  fichas: {
    data: string;
    queixa: string | null;
    anotacoes: string | null;
    alergias: string | null;
    medicamentos: string | null;
    historicoDental: string | null;
  }[];
  orcamentos: {
    status: string;
    total: number;
    itens: string[];
    diasAtualizacao: number;
  }[];
  planejamento: {
    titulo: string;
    etapas: { titulo: string; dente: string | null; status: string }[];
  } | null;
}

export interface BriefingOutput {
  resumo: string;
  alertas: string[];
  pendencias: string[];
  historico_relevante: string[];
  perguntas_sugeridas: string[];
  tratamento_ativo: string | null;
}

export function buildBriefingPrompt(input: BriefingInput): string {
  const fichasTexto = input.fichas.length > 0
    ? input.fichas.map((f, i) => {
        const lines = [`Consulta ${i + 1} (${f.data}):`, `  Queixa: ${f.queixa ?? 'não registrada'}`];
        if (f.anotacoes) lines.push(`  Anotações: ${f.anotacoes}`);
        if (f.alergias) lines.push(`  ⚠ Alergias: ${f.alergias}`);
        if (f.medicamentos) lines.push(`  ⚠ Medicamentos: ${f.medicamentos}`);
        if (f.historicoDental) lines.push(`  Histórico: ${f.historicoDental}`);
        return lines.join('\n');
      }).join('\n\n')
    : 'Nenhuma consulta anterior.';

  const orcamentosTexto = input.orcamentos.length > 0
    ? input.orcamentos.map(o => {
        const itens = o.itens.slice(0, 4).join(', ') || 'sem itens';
        const atraso = o.status === 'enviado' && o.diasAtualizacao > 3
          ? ` — enviado há ${o.diasAtualizacao} dias sem retorno`
          : '';
        return `• ${o.status.toUpperCase()}: R$ ${o.total.toFixed(2)} (${itens})${atraso}`;
      }).join('\n')
    : 'Nenhum orçamento.';

  const planejamentoTexto = input.planejamento
    ? `${input.planejamento.titulo}\nEtapas: ${input.planejamento.etapas.map(e => `${e.titulo}${e.dente ? ` (${e.dente})` : ''} — ${e.status}`).join(', ')}`
    : 'Nenhum planejamento ativo.';

  return `Você é o DEX, assistente clínico de uma clínica odontológica.
Gere um briefing pré-consulta ESTRUTURADO em JSON para o dentista.
Seja conciso — o dentista tem poucos minutos antes de entrar no consultório.

DADOS:
Paciente: ${input.pacienteNome}, ${input.idadeStr}
Horário: ${input.hora}
Motivo: ${input.observacoesAgendamento ?? 'não informado'}
Observações gerais: ${input.observacoesPaciente ?? 'nenhuma'}

HISTÓRICO:
${fichasTexto}

ORÇAMENTOS:
${orcamentosTexto}

PLANEJAMENTO ATIVO:
${planejamentoTexto}

Retorne SOMENTE JSON válido, sem markdown, com esta estrutura:
{
  "resumo": "1-2 frases sobre o contexto clínico mais relevante deste paciente hoje",
  "alertas": ["alerta crítico como alergia ou medicamento importante"],
  "pendencias": ["orçamento ou follow-up financeiro pendente"],
  "historico_relevante": ["procedimento ou evento clínico recente relevante"],
  "perguntas_sugeridas": ["pergunta aberta relevante para esta consulta?"],
  "tratamento_ativo": "título curto do tratamento em andamento ou null"
}

Regras:
- alertas: máx 3, SOMENTE se houver informação concreta (alergias, medicamentos, complicações)
- pendencias: SOMENTE orçamentos reais em aberto ou follow-up necessário
- historico_relevante: máx 3 itens, priorize o mais recente
- perguntas_sugeridas: máx 3, contextuais para ESTA consulta específica, não genéricas
- Arrays vazios [] se não houver informação. null para tratamento_ativo se não houver
- Português brasileiro`;
}

export function sanitizeBriefingOutput(raw: unknown): BriefingOutput {
  const r = raw as Record<string, unknown>;
  return {
    resumo:             typeof r?.resumo === 'string' ? r.resumo : '',
    alertas:            Array.isArray(r?.alertas) ? (r.alertas as string[]).filter(s => typeof s === 'string') : [],
    pendencias:         Array.isArray(r?.pendencias) ? (r.pendencias as string[]).filter(s => typeof s === 'string') : [],
    historico_relevante: Array.isArray(r?.historico_relevante) ? (r.historico_relevante as string[]).filter(s => typeof s === 'string') : [],
    perguntas_sugeridas: Array.isArray(r?.perguntas_sugeridas) ? (r.perguntas_sugeridas as string[]).filter(s => typeof s === 'string') : [],
    tratamento_ativo:   typeof r?.tratamento_ativo === 'string' ? r.tratamento_ativo : null,
  };
}
