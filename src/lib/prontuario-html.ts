// Shared helpers e builders para export de prontuário e PDF de ficha

import { formatarDataFicha } from './format-data-ficha';

export type PacienteExport = {
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  created_at: string;
};

export type FichaExport = {
  id: string;
  created_at: string;
  data_atendimento: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentes_afetados: number[] | null;
  dentes_observacoes: Record<string, string> | null;
  procedimentos_concluidos: string[] | null;
  assinatura_url: string | null;
  assinado_em: string | null;
  dentista: { nome: string; cro?: string | null } | null;
};

/** v3 §1.10 — evento do odontograma no documento impresso (fiscalização CRO). */
export type EventoFichaPdf = {
  tipo: string;
  status: string;
  origem: string;
  dente: number | null;
  faces: string[] | null;
  observacao: string | null;
  realizado_em: string | null;   // date 'YYYY-MM-DD'
  registrado_em: string;         // date 'YYYY-MM-DD'
};

export type OrcamentoExport = {
  id: string;
  status: string;
  total: number | null;
  created_at: string;
  condicoes_pagamento: string | null;
  orcamento_itens: Array<{ descricao: string | null; preco_total: number | null; quantidade: number }> | null;
  pagamentos: Array<{ valor: number; status: string; forma_pagamento: string | null }> | null;
};

export type AgendamentoExport = {
  data_hora: string;
  status: string;
  observacoes: string | null;
  dentista: { nome: string } | null;
};

export type FichaComPaciente = FichaExport & {
  paciente: { nome: string; data_nascimento: string | null } | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtMoney(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Data-only ('YYYY-MM-DD') → 'DD/MM/YYYY' SEM passar por Date (evita o shift de fuso UTC−3). */
function fmtDateOnly(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const TIPO_EVENTO_PDF: Record<string, string> = {
  carie_restauracao: 'Restauração', exodontia: 'Extração', endodontia: 'Tratamento de canal',
  lesao_periapical: 'Lesão periapical', implante: 'Implante', coroa: 'Coroa total',
  ponte: 'Ponte', selante: 'Selante', inclusao: 'Dente incluso', esfoliacao: 'Esfoliação',
  fratura: 'Fratura dentária', pino_nucleo: 'Pino/núcleo',
};

/** v3 §1.10 — tabela de eventos do odontograma: o quê · onde · situação · data. */
function renderEventosOdontograma(eventos: EventoFichaPdf[]): string {
  if (eventos.length === 0) return '';
  const rows = eventos.map((ev) => {
    const label = TIPO_EVENTO_PDF[ev.tipo] ?? ev.tipo;
    const onde = ev.dente != null
      ? `Dente ${ev.dente}${(ev.faces ?? []).length ? ` · faces ${(ev.faces ?? []).join(', ')}` : ''}`
      : '—';
    const situacao = ev.status === 'indicado'
      ? 'Indicado'
      : ev.origem === 'preexistente' ? 'Pré-existente' : 'Realizado';
    const data = ev.status !== 'realizado'
      ? '—'
      : ev.realizado_em ? fmtDateOnly(ev.realizado_em) : 'anterior ao cadastro';
    return `<div class="tooth-row">
      <span class="tooth-num">${esc(label)}</span>
      <span class="tooth-note">${esc(onde)}${ev.observacao ? ` — ${esc(ev.observacao)}` : ''}</span>
      <span class="badge badge-teal" style="margin-left:auto">${esc(situacao)}</span>
      <span style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#555;white-space:nowrap">${esc(data)}</span>
    </div>`;
  }).join('');
  return `
  <div class="section">
    <div class="section-title">Odontograma — procedimentos <span class="section-count">${eventos.length}</span></div>
    ${rows}
    <div style="font-size:10px;color:#999;margin-top:6px">Data = dia clínico da execução informado pelo profissional; registros indicados ainda não foram executados.</div>
  </div>`;
}

function calcIdade(dataNascimento: string): number {
  const nasc = new Date(dataNascimento);
  const hoje = new Date();
  let a = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) a--;
  return a;
}

const STATUS_PT: Record<string, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', realizado: 'Realizado',
  cancelado: 'Cancelado', faltou: 'Faltou', na_recepcao: 'Na recepção',
  em_atendimento: 'Em atendimento', rascunho: 'Rascunho', enviado: 'Enviado',
  aprovado: 'Aprovado', recusado: 'Recusado', pendente: 'Pendente', pago: 'Pago',
};

// ── CSS compartilhado ──────────────────────────────────────────────────────────

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff;font-size:13px;line-height:1.55}
.no-print{background:#f5f3ef;border-bottom:1px solid #d4d1ca;padding:10px 36px;display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;z-index:10}
.no-print-brand{font-size:15px;font-weight:700;color:#2f9c85;margin-right:12px}
.no-print-sub{font-size:12px;color:#888}
.print-btn{background:#2f9c85;color:#fff;border:none;padding:8px 22px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px}
.print-btn:hover{background:#1e7a67}
.page{max-width:800px;margin:0 auto;padding:36px 48px}
.ph{border-left:4px solid #2f9c85;padding-left:16px;margin-bottom:28px}
.ph-tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#2f9c85;margin-bottom:6px}
.ph-name{font-size:26px;font-weight:700;color:#0d0d0d;margin-bottom:14px;line-height:1.2}
.ph-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ph-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#bbb;margin-bottom:1px}
.ph-val{font-size:12px;color:#333;font-weight:500}
.section{margin-bottom:30px}
.section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#2f9c85;padding-bottom:7px;border-bottom:2px solid #e8f5f2;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.section-count{background:rgba(47,156,133,0.1);color:#2f9c85;padding:1px 8px;border-radius:20px;font-size:9px}
.empty{font-size:12px;color:#aaa;font-style:italic}
.card{border:1px solid #ebebeb;border-radius:8px;padding:13px 16px;margin-bottom:9px;page-break-inside:avoid}
.card-header{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.card-date{font-weight:600;font-size:12px;color:#111}
.card-prof{font-size:11px;color:#999;margin-left:auto}
.money-lg{font-size:14px;font-weight:700;color:#2f9c85;font-family:ui-monospace,Menlo,monospace}
.badge{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:2px 8px;border-radius:20px;white-space:nowrap}
.badge-teal{background:rgba(47,156,133,0.1);color:#2f9c85}
.badge-green{background:rgba(16,185,129,0.1);color:#10b981}
.badge-amber{background:rgba(245,158,11,0.1);color:#d97706}
.badge-gray{background:rgba(0,0,0,0.06);color:#888}
.field{margin-bottom:8px}
.field:last-child{margin-bottom:0}
.field-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#ccc;margin-bottom:3px}
.field-val{font-size:12px;color:#333;white-space:pre-wrap;line-height:1.6}
.teeth-list{display:flex;flex-direction:column;gap:2px}
.tooth-row{display:flex;align-items:baseline;gap:8px;padding:3px 0;border-bottom:1px solid #fafafa}
.tooth-num{font-size:10px;font-weight:700;color:#2f9c85;min-width:30px;font-family:ui-monospace,Menlo,monospace}
.tooth-note{font-size:12px;color:#444}
.signed{font-size:11px;color:#10b981;margin-top:8px;padding-top:8px;border-top:1px solid #f0fdf4}
.items-list{display:flex;flex-direction:column;gap:2px}
.item-row{display:flex;align-items:center;gap:10px;padding:3px 0;border-bottom:1px solid #fafafa;font-size:12px}
.item-row .item-desc{flex:1;color:#444}
.item-row .item-qty{color:#bbb;font-size:11px}
.money{font-family:ui-monospace,Menlo,monospace;font-weight:600;color:#2f9c85;white-space:nowrap}
.ag-table{width:100%;border-collapse:collapse;font-size:12px}
.ag-table th{text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#ccc;padding:6px 8px;border-bottom:1px solid #ebebeb}
.ag-table td{padding:6px 8px;border-bottom:1px solid #f7f7f7;color:#444;vertical-align:top}
.ag-table tr:last-child td{border-bottom:none}
.footer{margin-top:36px;padding-top:12px;border-top:1px solid #ebebeb;font-size:10px;color:#ccc;text-align:center}
@media print{
  .no-print{display:none!important}
  body{background:white}
  .page{padding:0;max-width:none}
  .card{page-break-inside:avoid}
  @page{margin:15mm;size:A4}
}
`;

// ── Partials ───────────────────────────────────────────────────────────────────

function renderFichaCard(f: FichaExport): string {
  const dentes = (f.dentes_afetados ?? []).filter(d => d < 97);

  const dentesHtml = dentes.length > 0 ? `
    <div class="field">
      <div class="field-lbl">Dentes afetados</div>
      <div class="teeth-list">
        ${dentes.map(t => {
          const raw = f.dentes_observacoes?.[String(t)] ?? '';
          const procs = raw.split('\n').filter(Boolean);
          return `<div class="tooth-row"><span class="tooth-num">D${t}</span><span class="tooth-note">${procs.length > 0 ? procs.map(esc).join(' · ') : '—'}</span></div>`;
        }).join('')}
      </div>
    </div>` : '';

  const concluidos = f.procedimentos_concluidos ?? [];
  const concluidosHtml = concluidos.length > 0 ? `
    <div class="field">
      <div class="field-lbl">Procedimentos concluídos</div>
      <div class="field-val">${concluidos.map(c => `✓ ${esc(c)}`).join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>
    </div>` : '';

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-date">${esc(formatarDataFicha(f.data_atendimento, f.created_at))}</span>
        <span class="badge badge-teal">${esc(f.queixa_principal ?? 'Evolução')}</span>
        <span class="card-prof">Dr(a). ${esc(f.dentista?.nome ?? 'Profissional')}${f.dentista?.cro ? ` · CRO ${esc(f.dentista.cro)}` : ''}</span>
      </div>
      ${f.anotacoes ? `<div class="field"><div class="field-lbl">Anotações</div><div class="field-val">${esc(f.anotacoes)}</div></div>` : ''}
      ${dentesHtml}
      ${concluidosHtml}
      ${f.assinado_em ? `<div class="signed">✓ Assinado digitalmente em ${esc(fmtDateTime(f.assinado_em))}</div>` : ''}
    </div>`;
}

function renderOrcamentoCard(o: OrcamentoExport): string {
  const itens = o.orcamento_itens ?? [];
  const pagamentos = o.pagamentos ?? [];

  const itensHtml = itens.length > 0 ? `
    <div class="field">
      <div class="field-lbl">Itens</div>
      <div class="items-list">
        ${itens.map(i => `
          <div class="item-row">
            <span class="item-desc">${esc(i.descricao ?? '—')}</span>
            <span class="item-qty">${i.quantidade}×</span>
            <span class="money">${fmtMoney(i.preco_total)}</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  const pagamentosHtml = pagamentos.length > 0 ? `
    <div class="field">
      <div class="field-lbl">Pagamentos</div>
      <div class="items-list">
        ${pagamentos.map(pg => `
          <div class="item-row">
            <span class="item-desc">${esc(STATUS_PT[pg.status] ?? pg.status)} · ${esc(pg.forma_pagamento ?? '—')}</span>
            <span class="money">${fmtMoney(pg.valor)}</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  const badgeClass = o.status === 'aprovado' ? 'badge-green' : o.status === 'enviado' ? 'badge-amber' : 'badge-gray';

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-date">${esc(fmtDate(o.created_at))}</span>
        <span class="badge ${badgeClass}">${STATUS_PT[o.status] ?? o.status}</span>
        <span class="card-prof money-lg">${fmtMoney(o.total)}</span>
      </div>
      ${itensHtml}
      ${pagamentosHtml}
      ${o.condicoes_pagamento ? `<div class="field"><div class="field-lbl">Condições</div><div class="field-val">${esc(o.condicoes_pagamento)}</div></div>` : ''}
    </div>`;
}

// ── Tipo orçamento ─────────────────────────────────────────────────────────────

export type OrcamentoHtmlData = {
  id: string;
  created_at: string;
  status: string;
  total: number | null;
  desconto: number;
  validade_dias: number;
  condicoes_pagamento: string | null;
  paciente: { nome: string; telefone: string | null } | null;
  dentista: { nome: string } | null;
  itens: Array<{
    descricao: string | null;
    quantidade: number;
    preco_unitario: number | null;
    preco_total: number | null;
  }>;
  pagamentos: Array<{
    valor: number;
    status: string;
    forma_pagamento: string | null;
    data_pagamento: string | null;
  }>;
};

// CSS premium do orçamento — visual moderno e limpo para o paciente
const ORC_CSS = `
*{box-sizing:border-box}
body{background:#fafafa;margin:0;padding:0}
.orc-page{max-width:680px;margin:0 auto;background:#fff;min-height:100vh}
.orc-header{background:linear-gradient(135deg,#2f9c85 0%,#1a7a65 100%);padding:36px 40px 32px;position:relative;overflow:hidden}
.orc-header::before{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,0.06)}
.orc-header::after{content:'';position:absolute;bottom:-20px;left:60px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.04)}
.orc-brand{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:rgba(255,255,255,0.6);margin-bottom:12px;position:relative}
.orc-patient{font-size:28px;font-weight:800;color:#fff;margin:0 0 4px;position:relative;line-height:1.2}
.orc-subtitle{font-size:13px;color:rgba(255,255,255,0.7);position:relative}
.orc-meta{display:flex;gap:24px;margin-top:20px;position:relative;flex-wrap:wrap}
.orc-meta-item{background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 14px}
.orc-meta-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.6);margin-bottom:3px}
.orc-meta-val{font-size:13px;font-weight:600;color:#fff}
.orc-body{padding:32px 40px}
.orc-section{margin-bottom:32px}
.orc-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:#2f9c85;margin-bottom:14px}
.orc-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;margin-bottom:6px;background:#f9fafb;border:1px solid #f0f0f0}
.orc-item-num{width:24px;height:24px;border-radius:6px;background:rgba(47,156,133,0.12);color:#2f9c85;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.orc-item-desc{flex:1;font-size:14px;color:#1a1a1a;font-weight:500}
.orc-item-qty{font-size:11px;color:#999;font-family:ui-monospace,monospace;white-space:nowrap}
.orc-item-price{font-size:14px;font-weight:700;color:#1a1a1a;font-family:ui-monospace,monospace;white-space:nowrap}
.orc-totals{display:flex;justify-content:flex-end;margin-top:16px}
.orc-totals-box{background:linear-gradient(135deg,rgba(47,156,133,0.08) 0%,rgba(47,156,133,0.04) 100%);border:1px solid rgba(47,156,133,0.2);border-radius:14px;padding:18px 22px;width:280px}
.orc-totals-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;color:#666}
.orc-totals-row .val{font-family:ui-monospace,monospace;font-weight:600}
.orc-divider{border:none;border-top:1px solid rgba(47,156,133,0.15);margin:8px 0}
.orc-grand-total{display:flex;justify-content:space-between;align-items:baseline;padding:6px 0 2px}
.orc-grand-total .lbl{font-size:15px;font-weight:700;color:#0d0d0d}
.orc-grand-total .val{font-size:22px;font-weight:800;color:#2f9c85;font-family:ui-monospace,monospace}
.orc-payment-card{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;margin-bottom:8px;border:1px solid}
.orc-payment-pago{background:rgba(47,156,133,0.05);border-color:rgba(47,156,133,0.2)}
.orc-payment-pendente{background:#fafafa;border-color:#ebebeb}
.orc-payment-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.orc-payment-icon-pago{background:rgba(47,156,133,0.15)}
.orc-payment-icon-pendente{background:#f0f0f0}
.orc-payment-label{flex:1;font-size:13px;font-weight:500;color:#1a1a1a}
.orc-payment-sub{font-size:11px;color:#999;margin-top:1px}
.orc-payment-amount{font-family:ui-monospace,monospace;font-size:14px;font-weight:700}
.orc-payment-amount-pago{color:#2f9c85}
.orc-payment-amount-pendente{color:#999}
.orc-progress{background:#ebebeb;border-radius:99px;height:6px;overflow:hidden;margin:12px 0 6px}
.orc-progress-bar{height:100%;background:linear-gradient(90deg,#2f9c85,#1a7a65);border-radius:99px;transition:width 0.5s}
.orc-cond{background:#f9fafb;border:1px solid #ebebeb;border-radius:10px;padding:14px 16px;font-size:13px;color:#555;line-height:1.6}
.orc-footer-note{font-size:11px;color:#bbb;margin-top:24px;padding-top:16px;border-top:1px solid #f0f0f0;font-style:italic;text-align:center}
.orc-footer{background:#f9fafb;border-top:1px solid #f0f0f0;padding:16px 40px;display:flex;justify-content:space-between;align-items:center}
.orc-footer-brand{font-size:12px;font-weight:700;color:#2f9c85}
.orc-footer-meta{font-size:10px;color:#bbb}
@media print{body{background:#fff}.no-print{display:none!important}.orc-page{max-width:none}}
`;

// ── Builders públicos ──────────────────────────────────────────────────────────

export function buildProntuarioHTML(
  p: PacienteExport,
  fichas: FichaExport[],
  orcamentos: OrcamentoExport[],
  agendamentos: AgendamentoExport[],
): string {
  const now = fmtDateTime(new Date().toISOString());
  const idade = p.data_nascimento ? calcIdade(p.data_nascimento) : null;
  const endereco = [p.endereco, p.cidade && p.estado ? `${p.cidade}/${p.estado}` : (p.cidade ?? p.estado)].filter(Boolean).join(' — ');

  const fichasHtml = fichas.length > 0
    ? fichas.map(renderFichaCard).join('')
    : '<p class="empty">Nenhuma ficha clínica registrada.</p>';

  const orcamentosHtml = orcamentos.length > 0
    ? orcamentos.map(renderOrcamentoCard).join('')
    : '<p class="empty">Nenhum orçamento registrado.</p>';

  const agendamentosHtml = agendamentos.length > 0
    ? `<table class="ag-table">
        <thead><tr><th>Data</th><th>Hora</th><th>Status</th><th>Profissional</th><th>Observações</th></tr></thead>
        <tbody>
          ${agendamentos.map(ag => {
            const dt = new Date(ag.data_hora);
            return `<tr>
              <td>${dt.toLocaleDateString('pt-BR')}</td>
              <td>${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>${esc(STATUS_PT[ag.status] ?? ag.status)}</td>
              <td>${esc(ag.dentista?.nome ?? '—')}</td>
              <td>${esc(ag.observacoes ?? '—')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`
    : '<p class="empty">Nenhuma consulta registrada.</p>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prontuário — ${esc(p.nome)}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="no-print">
  <div style="display:flex;align-items:center;gap:4px">
    <span class="no-print-brand">Odonto.IA</span>
    <span class="no-print-sub">Prontuário Médico · ${esc(p.nome)}</span>
  </div>
  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="page">
  <div class="ph">
    <div class="ph-tag">Prontuário Médico</div>
    <div class="ph-name">${esc(p.nome)}</div>
    <div class="ph-grid">
      ${p.data_nascimento ? `<div><div class="ph-lbl">Nascimento</div><div class="ph-val">${fmtDate(p.data_nascimento)}${idade !== null ? ` (${idade} anos)` : ''}</div></div>` : ''}
      ${p.cpf ? `<div><div class="ph-lbl">CPF</div><div class="ph-val">${esc(p.cpf)}</div></div>` : ''}
      ${p.telefone ? `<div><div class="ph-lbl">Telefone</div><div class="ph-val">${esc(p.telefone)}</div></div>` : ''}
      ${p.email ? `<div><div class="ph-lbl">E-mail</div><div class="ph-val">${esc(p.email)}</div></div>` : ''}
      ${endereco ? `<div><div class="ph-lbl">Endereço</div><div class="ph-val">${esc(endereco)}</div></div>` : ''}
      <div><div class="ph-lbl">Gerado em</div><div class="ph-val">${now}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Fichas Clínicas <span class="section-count">${fichas.length}</span></div>
    ${fichasHtml}
  </div>

  <div class="section">
    <div class="section-title">Orçamentos <span class="section-count">${orcamentos.length}</span></div>
    ${orcamentosHtml}
  </div>

  <div class="section">
    <div class="section-title">Consultas <span class="section-count">${agendamentos.length}</span></div>
    ${agendamentosHtml}
  </div>

  <div class="footer">Gerado em ${now} via Odonto.IA · Dados confidenciais — uso exclusivo do profissional de saúde</div>
</div>
</body>
</html>`;
}

export function buildFichaHTML(f: FichaComPaciente, eventos: EventoFichaPdf[] = []): string {
  const now = fmtDateTime(new Date().toISOString());
  const pacienteNome = f.paciente?.nome ?? 'Paciente';
  const idade = f.paciente?.data_nascimento ? calcIdade(f.paciente.data_nascimento) : null;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ficha Clínica — ${esc(pacienteNome)}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="no-print">
  <div style="display:flex;align-items:center;gap:4px">
    <span class="no-print-brand">Odonto.IA</span>
    <span class="no-print-sub">Ficha Clínica · ${esc(pacienteNome)}</span>
  </div>
  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="page">
  <div class="ph">
    <div class="ph-tag">Ficha Clínica</div>
    <div class="ph-name">${esc(pacienteNome)}</div>
    <div class="ph-grid">
      ${f.paciente?.data_nascimento ? `<div><div class="ph-lbl">Nascimento</div><div class="ph-val">${fmtDate(f.paciente.data_nascimento)}${idade !== null ? ` (${idade} anos)` : ''}</div></div>` : ''}
      <div><div class="ph-lbl">Profissional</div><div class="ph-val">Dr(a). ${esc(f.dentista?.nome ?? '—')}${f.dentista?.cro ? ` · CRO ${esc(f.dentista.cro)}` : ''}</div></div>
      <div><div class="ph-lbl">Gerado em</div><div class="ph-val">${now}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Registro de Atendimento</div>
    ${renderFichaCard(f)}
  </div>

  ${renderEventosOdontograma(eventos)}

  <div class="footer">Gerado em ${now} via Odonto.IA · Dados confidenciais — uso exclusivo do profissional de saúde</div>
</div>
</body>
</html>`;
}

export function buildOrcamentoHTML(o: OrcamentoHtmlData): string {
  const now = fmtDateTime(new Date().toISOString());
  const idSnippet = o.id.slice(0, 8).toUpperCase();

  const subtotal     = o.itens.reduce((s, i) => s + (i.preco_total ?? 0), 0);
  const temDesconto  = o.desconto > 0;
  const totalPago    = o.pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
  const totalPendente= o.pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
  const total        = o.total ?? 0;
  const pctPago      = total > 0 ? Math.min(100, Math.round((totalPago / total) * 100)) : 0;

  const statusLabel = { aprovado: 'Aprovado', enviado: 'Enviado', rascunho: 'Rascunho', recusado: 'Recusado' }[o.status] ?? o.status;
  const statusColor = o.status === 'aprovado' ? '#2f9c85' : o.status === 'enviado' ? '#f59e0b' : '#999';

  const validadeDate = new Date(new Date(o.created_at).getTime() + o.validade_dias * 86_400_000);

  const FORMA_LABEL_MAP: Record<string, string> = {
    pix: 'PIX', dinheiro: 'Dinheiro', cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito', boleto: 'Boleto', outro: 'Outro',
  };
  const FORMA_ICON_MAP: Record<string, string> = {
    pix: '📱', dinheiro: '💵', cartao_credito: '💳',
    cartao_debito: '💳', boleto: '📄', outro: '💰',
  };

  const itensHtml = o.itens.map((item, idx) => `
    <div class="orc-item">
      <div class="orc-item-num">${idx + 1}</div>
      <div class="orc-item-desc">${esc(item.descricao ?? '—')}${item.quantidade > 1 ? `<div class="orc-item-qty">${item.quantidade} unid. × ${fmtMoney(item.preco_unitario)}</div>` : ''}</div>
      <div class="orc-item-price">${fmtMoney(item.preco_total)}</div>
    </div>`).join('');

  const totalsHtml = `
    <div class="orc-totals">
      <div class="orc-totals-box">
        ${temDesconto ? `
          <div class="orc-totals-row"><span>Subtotal</span><span class="val">${fmtMoney(subtotal)}</span></div>
          <div class="orc-totals-row"><span>Desconto</span><span class="val" style="color:#ef4444">− ${fmtMoney(o.desconto)}</span></div>
          <hr class="orc-divider">
        ` : ''}
        <div class="orc-grand-total">
          <span class="lbl">Total</span>
          <span class="val">${fmtMoney(total)}</span>
        </div>
      </div>
    </div>`;

  const pagamentosHtml = o.pagamentos.length > 0 ? `
    <div class="orc-section">
      <div class="orc-section-title">Pagamentos</div>
      ${o.pagamentos.length > 0 && total > 0 ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:11px;color:#999">${pctPago}% recebido</span>
          <span style="font-size:11px;color:#999;font-family:ui-monospace,monospace">${fmtMoney(totalPago)} de ${fmtMoney(total)}</span>
        </div>
        <div class="orc-progress"><div class="orc-progress-bar" style="width:${pctPago}%"></div></div>
      ` : ''}
      ${o.pagamentos.map(pg => {
        const isPago  = pg.status === 'pago';
        const formaLbl = FORMA_LABEL_MAP[pg.forma_pagamento ?? 'outro'] ?? 'Pagamento';
        const formaIco = FORMA_ICON_MAP[pg.forma_pagamento ?? 'outro'] ?? '💰';
        return `<div class="orc-payment-card ${isPago ? 'orc-payment-pago' : 'orc-payment-pendente'}">
          <div class="orc-payment-icon ${isPago ? 'orc-payment-icon-pago' : 'orc-payment-icon-pendente'}">${formaIco}</div>
          <div class="orc-payment-label">${esc(formaLbl)}<div class="orc-payment-sub">${isPago ? 'Recebido' : 'Pendente'}${pg.data_pagamento ? ` · ${fmtDate(pg.data_pagamento)}` : ''}</div></div>
          <div class="orc-payment-amount ${isPago ? 'orc-payment-amount-pago' : 'orc-payment-amount-pendente'}">${fmtMoney(pg.valor)}</div>
        </div>`;
      }).join('')}
      ${totalPendente > 0 ? `<p style="font-size:11px;color:#f59e0b;margin-top:8px;text-align:right;font-family:ui-monospace,monospace">Saldo pendente: ${fmtMoney(totalPendente)}</p>` : ''}
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orçamento #${idSnippet} — ${esc(o.paciente?.nome ?? 'Paciente')}</title>
<style>${ORC_CSS}</style>
</head>
<body>
<div class="no-print" style="background:#fff;border-bottom:1px solid #ebebeb;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10">
  <div style="display:flex;align-items:center;gap:8px">
    <span style="font-size:13px;font-weight:700;color:#2f9c85">Odonto.IA</span>
    <span style="color:#ddd">·</span>
    <span style="font-size:12px;color:#999">Orçamento · ${esc(o.paciente?.nome ?? 'Paciente')}</span>
  </div>
  <button onclick="window.print()" style="background:#2f9c85;color:#fff;border:none;border-radius:8px;padding:7px 16px;font-size:12px;font-weight:600;cursor:pointer">
    🖨️ Salvar PDF
  </button>
</div>

<div class="orc-page">
  <!-- Header gradient -->
  <div class="orc-header">
    <div class="orc-brand">Odonto.IA · Orçamento #${idSnippet}</div>
    <div class="orc-patient">${esc(o.paciente?.nome ?? 'Paciente')}</div>
    <div class="orc-subtitle">
      ${o.dentista ? `Dr(a). ${esc(o.dentista.nome)} · ` : ''}Emitido em ${fmtDate(o.created_at)}
    </div>
    <div class="orc-meta">
      <div class="orc-meta-item">
        <div class="orc-meta-label">Status</div>
        <div class="orc-meta-val" style="color:${statusColor === '#2f9c85' ? '#a7f3d0' : statusColor === '#f59e0b' ? '#fde68a' : '#e5e7eb'}">${statusLabel}</div>
      </div>
      <div class="orc-meta-item">
        <div class="orc-meta-label">Válido até</div>
        <div class="orc-meta-val">${fmtDate(validadeDate.toISOString())}</div>
      </div>
      <div class="orc-meta-item">
        <div class="orc-meta-label">Investimento</div>
        <div class="orc-meta-val" style="font-family:ui-monospace,monospace">${fmtMoney(total)}</div>
      </div>
      ${o.paciente?.telefone ? `<div class="orc-meta-item"><div class="orc-meta-label">Telefone</div><div class="orc-meta-val">${esc(o.paciente.telefone)}</div></div>` : ''}
    </div>
  </div>

  <!-- Body -->
  <div class="orc-body">

    <!-- Procedimentos -->
    <div class="orc-section">
      <div class="orc-section-title">Procedimentos (${o.itens.length})</div>
      ${itensHtml}
      ${totalsHtml}
    </div>

    ${o.condicoes_pagamento ? `
    <div class="orc-section">
      <div class="orc-section-title">Condições de Pagamento</div>
      <div class="orc-cond">${esc(o.condicoes_pagamento)}</div>
    </div>` : ''}

    ${pagamentosHtml}

    <p class="orc-footer-note">
      Este orçamento tem validade de ${o.validade_dias} dias, expirando em ${fmtDate(validadeDate.toISOString())}.
      Os valores apresentados são válidos exclusivamente para os procedimentos listados.
    </p>
  </div>

  <!-- Footer -->
  <div class="orc-footer">
    <span class="orc-footer-brand">Odonto.IA</span>
    <span class="orc-footer-meta">Gerado em ${now} · #${idSnippet}</span>
  </div>
</div>
</body>
</html>`;
}
