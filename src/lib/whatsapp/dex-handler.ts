/**
 * DEX — Assistente estratégico do dentista via WhatsApp.
 *
 * Quando o número do remetente corresponde ao telefone de um dentista/admin
 * cadastrado na clínica, o webhook entra no "Modo DEX" e ignora o fluxo
 * normal de agendamento de pacientes.
 *
 * Comandos suportados:
 *   agenda    → lista de consultas de hoje
 *   lucro     → saldo financeiro do mês (receita − despesas)
 *   pacientes → próxima consulta na fila
 *   ajuda     → exibe o menu de comandos
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendText } from './provider';

// ─── Constantes ────────────────────────────────────────────────────────────────

const DEX_ETAPA    = 'dex';
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC−3

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DexDentista {
  id:   string;
  nome: string;
  role: string;
}

// ─── Helpers de data/hora ──────────────────────────────────────────────────────

function normalizeTelefone(t: string): string {
  return t.replace(/\D/g, '');
}

/** Formata horário UTC → BRT (HH:mm). */
function formatHoraBRT(iso: string): string {
  const d = new Date(new Date(iso).getTime() - BRT_OFFSET_MS);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Retorna o intervalo UTC equivalente a "hoje em BRT". */
function hojeEmBRT(): { inicio: Date; fim: Date } {
  const agora = new Date(Date.now() - BRT_OFFSET_MS); // hora local BRT
  const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 0, 0, 0));
  const fim    = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 23, 59, 59));
  // Converter BRT → UTC (adiciona 3 h)
  return {
    inicio: new Date(inicio.getTime() + BRT_OFFSET_MS),
    fim:    new Date(fim.getTime()    + BRT_OFFSET_MS),
  };
}

function dataBRTStr(): string {
  const brt = new Date(Date.now() - BRT_OFFSET_MS);
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const dd   = String(brt.getUTCDate()).padStart(2, '0');
  const mm   = String(brt.getUTCMonth() + 1).padStart(2, '0');
  return `${dias[brt.getUTCDay()]}, ${dd}/${mm}/${brt.getUTCFullYear()}`;
}

function mesBRTStr(): string {
  const brt = new Date(Date.now() - BRT_OFFSET_MS);
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${meses[brt.getUTCMonth()]} de ${brt.getUTCFullYear()}`;
}

/** Primeiro dia do mês atual em BRT, no formato 'YYYY-MM-DD'. */
function primeiroDiaMesBRT(): string {
  const brt = new Date(Date.now() - BRT_OFFSET_MS);
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Primeiro dia do próximo mês em BRT, como ISO timestamp UTC. */
function inicioProximoMesBRT(): string {
  const brt     = new Date(Date.now() - BRT_OFFSET_MS);
  const nextBRT = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth() + 1, 1));
  return new Date(nextBRT.getTime() + BRT_OFFSET_MS).toISOString();
}

/** Primeiro dia do mês atual em BRT, como ISO timestamp UTC. */
function inicioMesBRT(): string {
  const brt = new Date(Date.now() - BRT_OFFSET_MS);
  const d   = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), 1));
  return new Date(d.getTime() + BRT_OFFSET_MS).toISOString();
}

// ─── Identificação de dentista ─────────────────────────────────────────────────

/**
 * Verifica se o número remetente pertence a um dentista ou admin da clínica.
 * Normaliza ambos para dígitos e compara os últimos 11 caracteres
 * (DDD + 9 dígitos do celular brasileiro).
 */
export async function verificarDexUser(
  clinicaId: string,
  numero:    string,
  db:        SupabaseClient,
): Promise<DexDentista | null> {
  const normalizado = normalizeTelefone(numero);

  const { data } = await db
    .from('dentistas')
    .select('id, nome, role, telefone')
    .eq('clinica_id', clinicaId)
    .in('role', ['admin', 'dentista'])
    .not('telefone', 'is', null);

  if (!data?.length) return null;

  type Row = { id: string; nome: string; role: string; telefone: string | null };

  const match = (data as Row[]).find(d => {
    const tel = normalizeTelefone(d.telefone ?? '');
    if (!tel || tel.length < 8) return false;
    return tel.slice(-11) === normalizado.slice(-11);
  });

  return match ? { id: match.id, nome: match.nome, role: match.role } : null;
}

// ─── Builders de mensagem ──────────────────────────────────────────────────────

function buildBoasVindas(nome: string): string {
  const primeiro = nome.split(' ')[0];
  return (
    `Olá, Dr(a). *${primeiro}*! 🦷✨\n\n` +
    `Eu sou o *DEX*, seu assistente estratégico.\n` +
    `Estou aqui para facilitar o seu dia.\n\n` +
    `📌 *Comandos disponíveis:*\n\n` +
    `• *agenda* — pacientes de hoje\n` +
    `• *lucro* — saldo financeiro do mês\n` +
    `• *pacientes* — próximo a chegar\n` +
    `• *ajuda* — exibe este menu\n\n` +
    `_Envie um comando para começar._`
  );
}

function buildMenuAjuda(): string {
  return (
    `🦷 *DEX — Assistente Estratégico*\n\n` +
    `📌 *Comandos disponíveis:*\n\n` +
    `• *agenda* — pacientes de hoje\n` +
    `• *lucro* — saldo financeiro do mês\n` +
    `• *pacientes* — próximo a chegar\n\n` +
    `_Envie um comando para consultar os dados da clínica._`
  );
}

function buildNaoReconhecido(): string {
  return (
    `❓ Não reconheci esse comando.\n\n` +
    `Tente: *agenda*, *lucro* ou *pacientes*.\n` +
    `Envie *ajuda* para ver o menu completo.`
  );
}

// ─── Handlers de comando ───────────────────────────────────────────────────────

type AgendRow = {
  data_hora:   string;
  observacoes: string | null;
  paciente:    { nome: string } | { nome: string }[] | null;
};

async function cmdAgenda(clinicaId: string, db: SupabaseClient): Promise<string> {
  const { inicio, fim } = hojeEmBRT();

  const { data } = await db
    .from('agendamentos')
    .select('data_hora, observacoes, paciente:pacientes(nome)')
    .eq('clinica_id', clinicaId)
    .neq('status', 'cancelled')
    .gte('data_hora', inicio.toISOString())
    .lte('data_hora', fim.toISOString())
    .order('data_hora', { ascending: true });

  const lista = (data ?? []) as AgendRow[];

  if (!lista.length) {
    return (
      `📅 *Agenda de Hoje*\n` +
      `${dataBRTStr()}\n\n` +
      `_Nenhuma consulta agendada para hoje._`
    );
  }

  const linhas = lista.map((a, i) => {
    const hora  = formatHoraBRT(a.data_hora);
    const nome  = Array.isArray(a.paciente)
      ? (a.paciente[0]?.nome ?? 'Paciente')
      : (a.paciente?.nome   ?? 'Paciente');
    const proc  = a.observacoes ? ` — _${a.observacoes}_` : '';
    return `${i + 1}. 🕐 *${hora}* — ${nome}${proc}`;
  });

  return (
    `📅 *Agenda de Hoje*\n` +
    `${dataBRTStr()}\n\n` +
    linhas.join('\n') +
    `\n\n_${lista.length} consulta${lista.length !== 1 ? 's' : ''} no total_`
  );
}

async function cmdLucro(clinicaId: string, db: SupabaseClient): Promise<string> {
  const inicioMes   = inicioMesBRT();
  const proximoMes  = inicioProximoMesBRT();
  const primeiroDia = primeiroDiaMesBRT();

  const [{ data: pagamentos }, { data: despesasData }] = await Promise.all([
    db
      .from('pagamentos')
      .select('valor')
      .eq('clinica_id', clinicaId)
      .eq('status', 'pago')
      .gte('created_at', inicioMes)
      .lt('created_at', proximoMes),
    db
      .from('despesas')
      .select('valor')
      .eq('clinica_id', clinicaId)
      .gte('data', primeiroDia),
  ]);

  const receita  = (pagamentos   ?? []).reduce((s, p) => s + Number(p.valor), 0);
  const despesas = (despesasData ?? []).reduce((s, d) => s + Number(d.valor), 0);
  const lucro    = receita - despesas;

  const fmt = (v: number) =>
    `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const lucroLinha = lucro >= 0
    ? `📊 *Lucro Líquido:   ${fmt(lucro)}* ✅`
    : `📊 *Lucro Líquido:   −${fmt(lucro)}* ⚠️`;

  return (
    `💰 *Financeiro — ${mesBRTStr()}*\n\n` +
    `✅  Receita:    ${fmt(receita)}\n` +
    `💸  Despesas:  ${fmt(despesas)}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${lucroLinha}\n\n` +
    `_Atualizado agora._`
  );
}

async function cmdProximoPaciente(clinicaId: string, db: SupabaseClient): Promise<string> {
  const agora = new Date().toISOString();

  const { data } = await db
    .from('agendamentos')
    .select('data_hora, observacoes, paciente:pacientes(nome)')
    .eq('clinica_id', clinicaId)
    .neq('status', 'cancelled')
    .gte('data_hora', agora)
    .order('data_hora', { ascending: true })
    .limit(1);

  const proximo = (data ?? [])[0] as AgendRow | undefined;

  if (!proximo) {
    return (
      `👤 *Próximo Paciente*\n\n` +
      `_Nenhuma consulta agendada nas próximas horas._`
    );
  }

  const hora  = formatHoraBRT(proximo.data_hora);
  const nome  = Array.isArray(proximo.paciente)
    ? (proximo.paciente[0]?.nome ?? 'Paciente')
    : (proximo.paciente?.nome   ?? 'Paciente');

  const diffMs  = new Date(proximo.data_hora).getTime() - Date.now();
  const diffMin = Math.max(0, Math.round(diffMs / 60_000));
  const tempoStr =
    diffMin === 0  ? 'agora'
    : diffMin < 60 ? `em ${diffMin} min`
    : `em ${Math.floor(diffMin / 60)}h${diffMin % 60 ? ` ${diffMin % 60}min` : ''}`;

  const proc = proximo.observacoes
    ? `\n🦷  *Procedimento:* ${proximo.observacoes}`
    : '';

  return (
    `👤 *Próximo Paciente*\n\n` +
    `📛  *Nome:*    ${nome}\n` +
    `🕐  *Horário:* ${hora} _(${tempoStr})_` +
    proc
  );
}

// ─── Dispatcher de comandos ───────────────────────────────────────────────────

async function processarComando(
  input:     string,
  clinicaId: string,
  db:        SupabaseClient,
): Promise<string> {
  const cmd = input.toLowerCase().trim();

  if (/^agenda$/i.test(cmd))           return cmdAgenda(clinicaId, db);
  if (/^lucro$/i.test(cmd))            return cmdLucro(clinicaId, db);
  if (/^pacientes?$/i.test(cmd))       return cmdProximoPaciente(clinicaId, db);
  if (/^(ajuda|menu|help|\?)$/i.test(cmd)) return buildMenuAjuda();

  return buildNaoReconhecido();
}

// ─── Handler principal ─────────────────────────────────────────────────────────

/**
 * Processa uma mensagem de um dentista no modo DEX.
 * Primeiro contato → mensagem de boas-vindas.
 * Contatos seguintes → despacha o comando recebido.
 */
export async function handleDexMessage(
  dentista:  DexDentista,
  clinicaId: string,
  numero:    string,
  texto:     string,
  instancia: string,
  db:        SupabaseClient,
): Promise<void> {
  // Verifica se já existe uma conversa DEX para este número
  const { data: dexConversa } = await db
    .from('conversas_bot')
    .select('id')
    .eq('clinica_id', clinicaId)
    .eq('telefone', numero)
    .eq('etapa', DEX_ETAPA)
    .maybeSingle();

  if (!dexConversa) {
    // Primeiro contato — cria registro e envia boas-vindas
    await db.from('conversas_bot').insert({
      clinica_id: clinicaId,
      telefone:   numero,
      etapa:      DEX_ETAPA,
      contexto:   { dex: true, dentista_nome: dentista.nome, dentista_id: dentista.id },
      ativo:      true,
    });

    await sendText(instancia, numero, buildBoasVindas(dentista.nome));
    return;
  }

  // Atualiza último contato
  await db
    .from('conversas_bot')
    .update({ ultimo_contato: new Date().toISOString() })
    .eq('id', (dexConversa as { id: string }).id);

  // Processa o comando e responde
  const resposta = await processarComando(texto, clinicaId, db);
  await sendText(instancia, numero, resposta);
}
