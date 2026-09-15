'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Check, Clock, Loader2, MessageCircle, Moon, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { ModeloPendencia, OperacaoPendenciaData, OperarPendenciaInput, PendenciaCard, PendenciasBoard, PendenciasResult, PendenciaStatus } from '@/server/pendencias/contracts';
import { clinicInputDatetime, CONTACT_LABELS, contactDate, filterContacts, safeWhatsappUrl, type ContactFilter } from './board-helpers';
import { dataExtensaBRT } from '@/lib/hora-brt';
import styles from './pendencias.module.css';

export type ScheduleContactInput = { clinicaIdEsperada: string; pendenciaId: string; versaoEsperada: number; dataHora: string; duracaoMinutos: number };
export type PendenciasTransport = {
  listar(input: { clinicaIdEsperada: string }): Promise<PendenciasResult<PendenciasBoard>>;
  operar(input: OperarPendenciaInput): Promise<PendenciasResult<OperacaoPendenciaData>>;
  modelo(input: { clinicaIdEsperada: string; dentistaId: string; tipo: ModeloPendencia['tipo']; ativo: boolean; template: string; versaoEsperada: number }): Promise<PendenciasResult<ModeloPendencia>>;
  agendar(input: ScheduleContactInput): Promise<PendenciasResult<OperacaoPendenciaData>>;
};
type Modal = { kind: 'mensagem' | 'cancelar' | 'agendar' | 'adiar'; item: PendenciaCard } | { kind: 'modelos' } | null;
const LANES: { id: PendenciaStatus; title: string; description: string }[] = [
  { id: 'a_contatar', title: 'A contatar', description: 'Comece pelos horários mais próximos.' },
  { id: 'esperando_resposta', title: 'Esperando resposta', description: 'Registre o retorno do paciente.' },
  { id: 'resolvido', title: 'Resolvidos', description: 'Contatos concluídos hoje.' },
];
const RESOLUTIONS: Record<string, string> = { contato_encerrado: 'Contato encerrado', confirmado: 'Presença confirmada', cancelado: 'Consulta cancelada', agendado: 'Retorno agendado', remarcado: 'Consulta remarcada', adiado: 'Lembrete programado', presenca_confirmada: 'Presença confirmada', consulta_cancelada: 'Consulta cancelada', agendamento_concluido: 'Horário salvo', agendamento_criado: 'Retorno agendado', reagendado: 'Consulta remarcada', novo_atendimento: 'Novo atendimento registrado', agenda_realizada: 'Consulta realizada', nao_compareceu: 'Não compareceu' };

export function PendenciasWorkspace({ clinicaId, transport }: { clinicaId: string; transport: PendenciasTransport }) {
  const [board, setBoard] = useState<PendenciasBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<ContactFilter>('todos');
  const [search, setSearch] = useState('');
  const [lane, setLane] = useState<PendenciaStatus>('a_contatar');
  const [modal, setModal] = useState<Modal>(null);
  const [draft, setDraft] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [duration, setDuration] = useState(30);
  const [modelIndex, setModelIndex] = useState(0);
  const [modelDraft, setModelDraft] = useState('');
  const [modelActive, setModelActive] = useState(true);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const refresh = useCallback(async (preservePreparedMessage = false) => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const result = await transport.listar({ clinicaIdEsperada: clinicaId });
      if (seq !== generation.current || !mounted.current) return;
      if (result.ok) {
        setBoard(result.data); setError(null);
        // Atualizar recupera a versão do cartão sem apagar o texto digitado.
        setModal(current => {
          if (!current || !('item' in current)) return current;
          const latest = result.data.items.find(item => item.id === current.item.id);
          if (!latest) return null;
          if (latest.status !== current.item.status && !(preservePreparedMessage && current.kind === 'mensagem')) return null;
          return { ...current, item: latest };
        });
      }
      else { setError(result.mensagem); if (result.codigo === 'SEM_ACESSO' || result.codigo === 'CONTEXTO_ALTERADO') setBoard(null); }
    } catch { if (seq === generation.current && mounted.current) setError('Não foi possível atualizar. Confira sua conexão e tente novamente.'); }
    finally { if (seq === generation.current && mounted.current) setLoading(false); }
  }, [clinicaId, transport]);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, [refresh]);
  const open = (next: NonNullable<Modal>) => {
    setModalError(null); setWhatsappLink(null); setModal(next); setDateInput(''); setDuration('item' in next ? next.item.duracaoMinutos ?? 30 : 30);
    if (next.kind === 'mensagem') setDraft(next.item.mensagem);
    if (next.kind === 'modelos') chooseModel(0);
  };
  const chooseModel = (index: number) => { const m = board?.modelos[index]; setModelIndex(index); setModelDraft(m?.template ?? ''); setModelActive(m?.ativo ?? true); };
  async function execute(input: OperarPendenciaInput, close = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setModalError(null); setNotice('');
    try {
      const result = await transport.operar(input);
      if (!result.ok) { (modal ? setModalError : setError)(result.mensagem); return; }
      if (close) setModal(null);
      setNotice(result.data.mensagem ?? 'Alteração registrada.');
      await refresh();
    } catch { (modal ? setModalError : setError)('Não foi possível confirmar a operação. Atualize a lista antes de tentar novamente.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function base(item: PendenciaCard) { return { clinicaIdEsperada: clinicaId, pendenciaId: item.id, versaoEsperada: item.versao }; }
  async function prepareWhatsapp() {
    if (modal?.kind !== 'mensagem' || lock.current || !draft.trim()) return;
    lock.current = true; setBusy(true); setModalError(null);
    // A janela nasce no clique para evitar bloqueio de popup; nunca envia uma mensagem.
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const result = await transport.operar({ ...base(modal.item), acao: 'preparar_abertura', mensagem: draft });
      if (!result.ok) { popup?.close(); setModalError(result.mensagem); return; }
      const url = result.data.whatsappUrl;
      if (!url || !safeWhatsappUrl(url)) { popup?.close(); setModalError('Não foi possível abrir o contato. Atualize a lista para conferir o telefone.'); await refresh(); return; }
      if (popup) { popup.location.href = url; setModal(null); }
      else setWhatsappLink(url);
      setLane('esperando_resposta');
      await refresh(!popup);
      setNotice(popup ? 'Conversa aberta. Registre se você enviou a mensagem.' : 'Abertura preparada. Use o link para abrir o WhatsApp e depois registre o envio.');
    } catch { popup?.close(); setModalError('Não foi possível confirmar a abertura. Atualize a lista antes de repetir.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function saveSchedule() {
    if (!modal || (modal.kind !== 'agendar' && modal.kind !== 'adiar') || lock.current) return;
    const dataHora = clinicInputDatetime(dateInput);
    if (!dataHora || new Date(dataHora).getTime() <= Date.now()) { setModalError('Escolha uma data e horário futuros.'); return; }
    if (modal.kind === 'adiar') { await execute({ ...base(modal.item), acao: 'adiar', adiadoAte: dataHora }, true); return; }
    lock.current = true; setBusy(true); setModalError(null);
    try {
      const result = await transport.agendar({ ...base(modal.item), dataHora, duracaoMinutos: duration });
      if (!result.ok) { setModalError(result.mensagem); return; }
      setModal(null); setNotice('Horário salvo na agenda.'); await refresh();
    } catch { setModalError('Não foi possível confirmar o agendamento. Confira a agenda antes de repetir.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function saveModel() {
    const model = board?.modelos[modelIndex];
    if (!model?.podeEditar || lock.current) return;
    lock.current = true; setBusy(true); setModalError(null);
    try {
      const result = await transport.modelo({ clinicaIdEsperada: clinicaId, dentistaId: model.dentistaId, tipo: model.tipo, ativo: modelActive, template: modelDraft, versaoEsperada: model.versao });
      if (!result.ok) { setModalError(result.mensagem); return; }
      setModal(null); setNotice('Modelo salvo.'); await refresh();
    } catch { setModalError('Não foi possível confirmar a alteração. Atualize antes de tentar novamente.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const items = board ? filterContacts(board.items, filter, search) : [];
  const count = (type: ContactFilter) => board?.items.filter(p => p.status !== 'resolvido' && (type === 'todos' || p.tipo === type)).length ?? 0;
  const act = (item: PendenciaCard, action: 'registrar_envio' | 'nao_enviei') => { void execute({ ...base(item), acao: action }); };
  const renderCard = (item: PendenciaCard) => {
    const cap = item.capabilities;
    const confirmation = item.tipo === 'confirmar_presenca';
    return <article className={styles.card} key={item.id} aria-label={item.pacienteNome}>
      <div className={styles.eyebrow}><span className={`${styles.tag} ${!confirmation ? styles.reactivate : ''}`}>{confirmation ? 'Confirmar presença' : 'Reativar contato'}</span><span>{item.status === 'resolvido' ? 'Hoje' : !confirmation ? 'Sem retorno' : contactDate(item).startsWith('Amanhã') ? 'Amanhã' : ''}</span></div>
      <h3 className={styles.name}>{item.pacienteNome}</h3><div className={styles.date}>{confirmation ? <Calendar /> : <Clock />}{contactDate(item)}</div><p className={styles.meta}>{item.dentistaNome}</p>
      {item.status === 'a_contatar' && <>{cap.podeVerContato && !item.temTelefone && <p className={`${styles.state} ${styles.pending}`}>Telefone pendente no cadastro</p>}<div className={styles.actions}><button className={`${styles.button} ${styles.wa}`} disabled={busy || !cap.podeAbrirWhatsApp || !item.temTelefone} onClick={() => open({ kind: 'mensagem', item })}><MessageCircle />Abrir WhatsApp</button></div></>}
      {item.status === 'esperando_resposta' && <><div className={`${styles.state} ${!item.envioConfirmado ? styles.pending : ''}`}>{item.envioConfirmado ? <MessageCircle /> : <Clock />}{item.envioConfirmado ? 'Envio registrado · esperando resposta' : 'Envio ainda não confirmado'}</div><div className={styles.actions}>
        {!item.envioConfirmado ? <><button className={`${styles.button} ${styles.good}`} disabled={busy || !cap.podeRegistrarEnvio} onClick={() => act(item, 'registrar_envio')}><Check />Enviei</button><button className={styles.button} disabled={busy || !cap.podeRegistrarEnvio} onClick={() => act(item, 'nao_enviei')}>Não enviei</button></> : confirmation ? <>
          <button className={`${styles.button} ${styles.good}`} disabled={busy || !cap.podeConfirmarAgenda || !item.agendamentoId || !item.dataHora} onClick={() => { if (item.agendamentoId && item.dataHora) void execute({ ...base(item), acao: 'confirmar_agendamento', agendamentoId: item.agendamentoId, dataHoraEsperada: item.dataHora }); }}><Check />Confirmar</button>
          <button className={`${styles.button} ${styles.warning}`} disabled={busy || !cap.podeConcluirAgendamento} onClick={() => open({ kind: 'agendar', item })}><Calendar />Remarcar</button><button className={`${styles.button} ${styles.danger}`} disabled={busy || !cap.podeCancelarAgenda} onClick={() => open({ kind: 'cancelar', item })}><X />Cancelar</button>
        </> : <><button className={`${styles.button} ${styles.good}`} disabled={busy || !cap.podeConcluirAgendamento} onClick={() => open({ kind: 'agendar', item })}><Calendar />Agendar</button><button className={`${styles.button} ${styles.warning}`} disabled={busy || !cap.podeGerirAcompanhamento} onClick={() => open({ kind: 'adiar', item })}><Clock />Depois</button><button className={styles.button} disabled={busy || !cap.podeGerirAcompanhamento} onClick={() => { void execute({ ...base(item), acao: 'resolver' }); }}>Encerrar</button></>}
      </div></>}
      {item.status === 'resolvido' && <div className={styles.state}><Check />{item.tipo === 'confirmar_presenca' && item.resolucao === 'agendamento_criado' ? 'Consulta remarcada' : RESOLUTIONS[item.resolucao ?? ''] ?? 'Contato resolvido'}</div>}
    </article>;
  };
  return <section className={styles.workspace} aria-busy={busy}>
    <header className={styles.top}><div><h1 className={styles.title}>Pendências</h1><p className={styles.subtitle}>Cada contato, no momento certo.</p></div><div className={styles.tools}><button className={styles.button} aria-label="Configurar mensagens" disabled={!board?.modelos.length || busy} onClick={() => open({ kind: 'modelos' })}><SlidersHorizontal /><span>Mensagens</span></button><button className={styles.button} aria-label="Alternar tema" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}><Moon /></button></div></header>
    <div className={styles.subhead}><Calendar />{dataExtensaBRT()}<span className={styles.clinic}>· {board?.clinicaNome ?? 'Sua clínica'}</span></div>
    <div className={styles.filters}><div className={styles.segments} role="group" aria-label="Tipo de contato">{(['todos', 'confirmar_presenca', 'reativar_paciente'] as const).map(type => <button key={type} className={styles.chip} aria-pressed={filter === type} onClick={() => setFilter(type)}>{type === 'todos' ? 'Todos' : CONTACT_LABELS[type]}<span className={styles.count}>{count(type)}</span></button>)}</div><label className={styles.search}><Search /><input aria-label="Buscar paciente" placeholder="Buscar paciente" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    {error && <div role="alert" className={styles.error}>{error} <button className={styles.button} disabled={loading || busy} onClick={() => { void refresh(); }}><RefreshCw />Atualizar lista</button></div>}
    <p className={notice ? styles.notice : styles.srOnly} role="status">{notice}</p>
    <div className={styles.mobileTabs} role="tablist" aria-label="Etapa do contato">{LANES.map((l, index) => <button key={l.id} role="tab" tabIndex={lane === l.id ? 0 : -1} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % LANES.length : event.key === 'ArrowLeft' ? (index + LANES.length - 1) % LANES.length : event.key === 'Home' ? 0 : event.key === 'End' ? LANES.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); setLane(LANES[next].id);
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
    }} aria-selected={lane === l.id} aria-controls={`lane-${l.id}`} onClick={() => setLane(l.id)}>{l.title}</button>)}</div>
    <div className={styles.board}>{LANES.map(l => <section id={`lane-${l.id}`} key={l.id} className={styles.lane} data-visible={lane === l.id} aria-label={l.title}><div className={styles.laneHead}><h2>{l.title}</h2><span className={styles.count}>{items.filter(p => p.status === l.id).length}</span></div><p className={styles.laneDescription}>{l.description}</p>{loading && !board ? <div className={styles.skeleton} role="status" aria-label="Carregando contatos" /> : items.some(p => p.status === l.id) ? items.filter(p => p.status === l.id).map(renderCard) : <div className={styles.empty}>{error ? 'Contatos indisponíveis.' : 'Nenhum contato nesta etapa.'}</div>}</section>)}</div>
    <p className={styles.hint}>Confirmações de amanhã aparecem no início do dia. Reativação considera pacientes sem agendamento futuro.</p>
    <Dialog open={modal !== null} onOpenChange={value => { if (!value && !busy) { setModal(null); setModalError(null); } }}><DialogContent className={styles.modal} showCloseButton={!busy}>
      <DialogTitle>{modal?.kind === 'modelos' ? 'Mensagens' : modal?.kind === 'mensagem' ? `Mensagem para ${modal.item.pacienteNome.split(' ')[0]}` : modal?.kind === 'cancelar' ? 'Cancelar esta consulta?' : modal?.kind === 'adiar' ? 'Lembrar depois' : modal?.kind === 'agendar' && modal.item.agendamentoId ? 'Remarcar consulta' : 'Agendar retorno'}</DialogTitle>
      <DialogDescription className={styles.meta}>{modal?.kind === 'mensagem' ? 'Revise o texto antes de abrir a conversa. O envio é manual no WhatsApp.' : modal?.kind === 'modelos' ? 'Ative os tipos de contato e personalize os textos padrão.' : modal?.kind === 'cancelar' ? 'Esta ação libera o horário na agenda e preserva o histórico.' : modal?.kind === 'adiar' ? 'O contato volta à fila na data escolhida.' : modal?.kind === 'agendar' && !modal.item.agendamentoId ? 'O retorno será criado na agenda do profissional indicado.' : 'O horário atual só muda quando o novo for salvo.'}</DialogDescription>
      {modal?.kind === 'mensagem' && <><label htmlFor="contact-message">Mensagem</label><textarea id="contact-message" maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} disabled={busy} />{whatsappLink && <a className={styles.button} href={whatsappLink} target="_blank" rel="noopener noreferrer">Abrir conversa no WhatsApp</a>}</>}
      {(modal?.kind === 'agendar' || modal?.kind === 'adiar') && <><p className={styles.meta}>{modal.item.pacienteNome} · {modal.item.dentistaNome}</p><label htmlFor="contact-date">{modal.kind === 'adiar' ? 'Data e horário' : 'Novo horário'}</label><input id="contact-date" type="datetime-local" value={dateInput} onChange={e => setDateInput(e.target.value)} disabled={busy} />{modal.kind === 'agendar' && <><label htmlFor="contact-duration">Duração em minutos</label><input id="contact-duration" type="number" min={5} max={480} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))} disabled={busy} /></>}</>}
      {modal?.kind === 'modelos' && <><label htmlFor="contact-model">Tipo de contato e profissional</label><select id="contact-model" value={modelIndex} onChange={e => chooseModel(Number(e.target.value))} disabled={busy}>{board?.modelos.map((m, i) => <option key={`${m.dentistaId}-${m.tipo}`} value={i}>{CONTACT_LABELS[m.tipo]} · {m.dentistaNome}</option>)}</select><label className={styles.switchRow} htmlFor="contact-enabled">Mostrar este tipo na fila<input id="contact-enabled" type="checkbox" checked={modelActive} onChange={e => setModelActive(e.target.checked)} disabled={busy || !board?.modelos[modelIndex]?.podeEditar} /></label><label htmlFor="contact-template">Texto padrão</label><textarea id="contact-template" maxLength={2000} value={modelDraft} onChange={e => setModelDraft(e.target.value)} disabled={busy || !board?.modelos[modelIndex]?.podeEditar} /><p className={styles.meta}>{'Campos disponíveis: {paciente}, {clinica}, {dentista}, {horario}.'}</p>{!board?.modelos[modelIndex]?.podeEditar && <p className={styles.meta}>Somente o dentista ou um responsável autorizado pode alterar este modelo.</p>}</>}
      {modalError && <div role="alert" className={styles.error}>{modalError}<button className={styles.button} disabled={loading || busy} onClick={() => { void refresh(); }}>Atualizar lista</button></div>}
      <footer className={styles.footer}><button className={styles.button} disabled={busy} onClick={() => setModal(null)}>{modal?.kind === 'cancelar' ? 'Manter consulta' : 'Voltar'}</button><button className={`${styles.button} ${modal?.kind === 'cancelar' ? styles.danger : styles.primary}`} disabled={busy || (modal?.kind === 'modelos' && !board?.modelos[modelIndex]?.podeEditar) || (modal?.kind === 'mensagem' && (!draft.trim() || !!whatsappLink))} onClick={() => {
        if (modal?.kind === 'mensagem') void prepareWhatsapp();
        else if (modal?.kind === 'modelos') void saveModel();
        else if (modal?.kind === 'cancelar' && modal.item.agendamentoId && modal.item.dataHora) void execute({ ...base(modal.item), acao: 'cancelar_agendamento', confirmarCancelamento: true, agendamentoId: modal.item.agendamentoId, dataHoraEsperada: modal.item.dataHora }, true);
        else void saveSchedule();
      }}>{busy && <Loader2 className="animate-spin" />}{busy ? 'Salvando…' : modal?.kind === 'mensagem' ? 'Abrir WhatsApp' : modal?.kind === 'modelos' ? 'Salvar modelo' : modal?.kind === 'cancelar' ? 'Cancelar consulta' : modal?.kind === 'adiar' ? 'Salvar lembrete' : 'Salvar horário'}</button></footer>
    </DialogContent></Dialog>
  </section>;
}
