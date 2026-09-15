'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowLeft, Loader2, Stethoscope, X } from 'lucide-react';
import { format, parseISO, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, useReducedMotion } from 'motion/react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listarProteticosAtivos, type ProteticoOption } from '@/app/dashboard/agendamentos/actions';
import { formatHora } from '@/lib/agenda/disponibilidade';
import { slotPodeSerSelecionadoParaRetorno } from '@/lib/agenda/disponibilidade';
import type { DentistaRole } from '@/types/database';
import type { MarcarRetornoForm } from '@/hooks/use-marcar-retorno';
import { useDisponibilidadeRetorno } from '@/hooks/use-disponibilidade-retorno';
import { RetornoMobileAgenda } from './retorno-mobile-agenda';
import { RetornoSemanaGrid } from './retorno-semana-grid';

export type { MarcarRetornoForm } from '@/hooks/use-marcar-retorno';

interface MarcarRetornoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteNome: string;
  role: DentistaRole;
  dentistasClinica: { id: string; nome: string }[];
  dentistaAlvoId: string | null;
  onDentistaAlvoChange: (id: string) => void;
  form: MarcarRetornoForm;
  setForm: Dispatch<SetStateAction<MarcarRetornoForm>>;
  error: string | null;
  saving: boolean;
  pedidoPendente: boolean;
  onMarcarRetorno: () => void;
  onTentarEnviarPedido: () => void;
}

type Etapa = 'retorno' | 'protetico';

function minutoDoInputHora(valor: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(valor);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

const DURACAO_CHIPS = [
  { value: '30', label: '30min' }, { value: '45', label: '45min' }, { value: '60', label: '1h' },
  { value: '90', label: '1h30' }, { value: '120', label: '2h' }, { value: '180', label: '3h' },
];

export function MarcarRetornoModal({
  open, onOpenChange, pacienteNome, role, dentistasClinica, dentistaAlvoId, onDentistaAlvoChange,
  form, setForm, error, saving, pedidoPendente, onMarcarRetorno, onTentarEnviarPedido,
}: MarcarRetornoModalProps) {
  const [etapa, setEtapa] = useState<Etapa>('retorno');
  const [proteticos, setProteticos] = useState<ProteticoOption[] | null>(null);
  const [semanaInicio, setSemanaInicio] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [sessaoAgenda, setSessaoAgenda] = useState(0);
  const reduzirMotion = useReducedMotion();
  const [abertoAnterior, setAbertoAnterior] = useState(open);
  const duracaoMin = parseInt(form.duracao, 10) || 30;
  const precisaEscolherDentista = role === 'secretaria';
  const agenda = useDisponibilidadeRetorno(dentistaAlvoId, semanaInicio, open, sessaoAgenda);
  const dias = agenda.estado === 'pronta' ? agenda.dias : null;
  const erroAgenda = agenda.estado === 'erro' ? agenda.mensagem : null;
  const diaSelecionado = form.data ? dias?.find((dia) => dia.data === form.data) : null;
  const selecaoValida = form.minutoDoDia != null && diaSelecionado != null
    && slotPodeSerSelecionadoParaRetorno(form.minutoDoDia, duracaoMin, diaSelecionado, new Date());
  const podeConfirmar = dentistaAlvoId != null && form.data != null && selecaoValida && agenda.estado === 'pronta';
  const podeEnviar = Boolean((pedidoPendente || podeConfirmar) && form.pedidoProtetico?.proteticoId && form.pedidoProtetico.dataEntrega && form.pedidoProtetico.observacao.trim());

  if (abertoAnterior !== open) {
    setAbertoAnterior(open);
    if (open) {
      setSessaoAgenda((atual) => atual + 1);
      if (!pedidoPendente) setEtapa('retorno');
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    listarProteticosAtivos().then((resultado) => {
      if (!cancelado) setProteticos(resultado.ok ? resultado.data : []);
    }).catch(() => { if (!cancelado) setProteticos([]); });
    return () => { cancelado = true; };
  }, [open]);

  useEffect(() => {
    if (pedidoPendente) return;
    if (!form.data || form.minutoDoDia == null) return;
    if (agenda.estado !== 'pronta' || !diaSelecionado || !selecaoValida) {
      setForm((atual) => ({ ...atual, data: null, minutoDoDia: null, agendaLivre: false }));
    }
  }, [agenda.estado, diaSelecionado, form.data, form.minutoDoDia, pedidoPendente, selecaoValida, setForm]);

  function alterarAberto(aberto: boolean) {
    if (!aberto && (saving || pedidoPendente)) return;
    if (!aberto && !pedidoPendente) setEtapa('retorno');
    onOpenChange(aberto);
  }

  function alterarSemana(proximaSemana: Date) {
    if (pedidoPendente) return;
    setSemanaInicio(proximaSemana);
    setForm((atual) => ({ ...atual, data: null, minutoDoDia: null, agendaLivre: false }));
  }

  function selecionarHorario(data: string, minutoDoDia: number | null, agendaLivre: boolean) {
    if (pedidoPendente) return;
    setForm((atual) => ({ ...atual, data, minutoDoDia, agendaLivre }));
  }

  function alterarHoraManual(valor: string) {
    if (pedidoPendente) return;
    const minutoDoDia = minutoDoInputHora(valor);
    if (!form.data || !diaSelecionado) return;
    if (minutoDoDia == null || !slotPodeSerSelecionadoParaRetorno(minutoDoDia, duracaoMin, diaSelecionado, new Date())) {
      setForm((atual) => ({ ...atual, minutoDoDia: null, agendaLivre: false }));
      return;
    }
    setForm((atual) => ({ ...atual, minutoDoDia, agendaLivre: !diaSelecionado.temGrade }));
  }

  function incluirProtetico() {
    if (!podeConfirmar) return;
    setForm((atual) => ({
      ...atual,
      pedidoProtetico: atual.pedidoProtetico ?? {
        proteticoId: '', dataEntrega: atual.data ?? format(new Date(), 'yyyy-MM-dd'), observacao: '',
      },
    }));
    setEtapa('protetico');
  }

  function atualizarPedido(campo: keyof NonNullable<MarcarRetornoForm['pedidoProtetico']>, valor: string) {
    setForm((atual) => ({
      ...atual,
      pedidoProtetico: atual.pedidoProtetico ? { ...atual.pedidoProtetico, [campo]: valor } : atual.pedidoProtetico,
    }));
  }

  const selecionado = podeConfirmar ? { data: form.data!, minutoDoDia: form.minutoDoDia!, agendaLivre: form.agendaLivre } : null;

  return (
    <Dialog open={open} onOpenChange={alterarAberto}>
      <DialogContent showCloseButton={false} className="flex h-[min(680px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-border bg-surface p-0 sm:max-w-none md:h-[min(680px,calc(100dvh-3rem))] md:w-[min(1180px,calc(100vw-0.5rem))] md:rounded-2xl">
        <DialogDescription className="sr-only">Agende o retorno de {pacienteNome}.</DialogDescription>

        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-5">
          <DialogTitle className="font-heading text-lg font-semibold leading-tight text-text-primary md:text-xl">Marcar retorno</DialogTitle>
          <button disabled={saving || pedidoPendente} onClick={() => alterarAberto(false)} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border md:grid-cols-[minmax(0,1fr)_150px_100px]">
          <div className="col-span-2 min-w-0 bg-surface px-4 py-2.5 md:col-span-1 md:px-5"><p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Paciente</p><p className="mt-0.5 truncate text-sm font-medium text-text-primary">{pacienteNome}</p></div>
          <div className="bg-surface px-4 py-2.5"><p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Data</p><p className="mt-0.5 font-mono text-sm font-semibold text-text-primary">{form.data ? format(parseISO(form.data), 'EEE, dd/MM', { locale: ptBR }) : '—'}</p></div>
          <div className="bg-surface px-4 py-2.5"><p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Hora</p><p className="mt-0.5 font-mono text-sm font-semibold text-text-primary">{form.minutoDoDia != null ? formatHora(form.minutoDoDia) : '—'}</p></div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          <div className={`min-w-0 flex-1 p-4 md:overflow-y-auto md:p-5 ${etapa === 'protetico' ? 'hidden md:block' : ''}`}>
            {precisaEscolherDentista && (
              <div className="mb-4 space-y-1">
                <Label className="text-xs text-text-secondary">Dentista responsável *</Label>
                <Select disabled={saving || pedidoPendente} value={dentistaAlvoId ?? undefined} onValueChange={(id) => { if (id && !saving && !pedidoPendente) onDentistaAlvoChange(id); }}>
                  <SelectTrigger className="rounded-xl border-border bg-surface text-text-primary"><SelectValue placeholder="Selecione o dentista..." /></SelectTrigger>
                  <SelectContent className="border-border bg-surface">{dentistasClinica.map((dentista) => <SelectItem key={dentista.id} value={dentista.id}>{dentista.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <RetornoMobileAgenda dentistaId={dentistaAlvoId} duracaoMin={duracaoMin} semanaInicio={semanaInicio} onSemanaInicioChange={alterarSemana} dias={dias} erro={erroAgenda} selecionado={selecionado} onSelecionar={selecionarHorario} />
            <div className="hidden md:block"><RetornoSemanaGrid dentistaId={dentistaAlvoId} duracaoMin={duracaoMin} semanaInicio={semanaInicio} onSemanaInicioChange={alterarSemana} dias={dias} erro={erroAgenda} selecionado={selecionado} onSelecionar={selecionarHorario} /></div>
          </div>

          <div className="flex min-h-0 w-full flex-col border-t border-border md:w-[250px] md:shrink-0 md:overflow-y-auto md:border-t-0 md:border-l">
            {etapa === 'retorno' ? (
              <motion.div key="retorno" initial={reduzirMotion ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduzirMotion ? 0 : 0.16, ease: 'easeOut' }} className="flex-1 space-y-4 p-4 md:p-5">
                <div className="hidden space-y-2 md:block">
                  <Label htmlFor="retorno-hora" className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">Hora</Label>
                  <Input id="retorno-hora" type="time" disabled={form.data == null || agenda.estado !== 'pronta'} value={form.minutoDoDia != null ? formatHora(form.minutoDoDia) : ''} onChange={(event) => alterarHoraManual(event.target.value)} className="min-h-[42px] rounded-xl border-border bg-surface-alt text-text-primary disabled:opacity-50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">Duração</Label>
                  <div className="grid grid-cols-3 gap-1.5">{DURACAO_CHIPS.map((opcao) => <button key={opcao.value} type="button" onClick={() => setForm((atual) => ({ ...atual, duracao: opcao.value }))} className={`min-h-11 rounded-lg border py-2 text-xs font-bold transition-all ${form.duracao === opcao.value ? 'border-teal bg-teal/10 text-teal-ink' : 'border-border bg-surface-alt text-text-secondary hover:border-teal/40 hover:text-teal-ink'}`}>{opcao.label}</button>)}</div>
                  <div className="flex items-center gap-2"><Label htmlFor="retorno-duracao-livre" className="shrink-0 text-xs text-text-secondary">Ou:</Label><Input id="retorno-duracao-livre" type="number" min={5} max={600} step={5} inputMode="numeric" value={form.duracao} onChange={(event) => setForm((atual) => ({ ...atual, duracao: event.target.value }))} className="h-8 rounded-lg border-border bg-surface-alt text-sm text-text-primary" aria-label="Duração personalizada em minutos" /><span className="shrink-0 text-xs text-text-secondary">min</span></div>
                </div>
                <div className="space-y-2"><Label htmlFor="retorno-obs" className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">Observações</Label><textarea id="retorno-obs" value={form.observacoes} onChange={(event) => setForm((atual) => ({ ...atual, observacoes: event.target.value }))} placeholder="Ex: Consulta de rotina, limpeza..." className="min-h-[88px] w-full resize-none rounded-xl border border-border bg-surface-alt p-3.5 text-sm text-text-primary placeholder:text-text-secondary/40 outline-none transition-all focus:border-teal/30 focus:ring-2 focus:ring-teal/15" /></div>
              </motion.div>
            ) : (
              <motion.div key="protetico" initial={reduzirMotion ? false : { opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduzirMotion ? 0 : 0.16, ease: 'easeOut' }} className="flex-1 space-y-4 p-4 md:p-5">
                <div className="flex items-start gap-3 rounded-xl border border-teal/25 bg-teal/5 p-3"><Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-teal-ink" /><div><p className="text-sm font-semibold text-text-primary">Enviar ao protético</p><p className="mt-0.5 text-xs text-text-secondary">Retorno preservado: {form.data ? format(parseISO(form.data), 'dd/MM', { locale: ptBR }) : '—'} às {form.minutoDoDia != null ? formatHora(form.minutoDoDia) : '—'}.</p></div></div>
                <div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">Protético *</Label><Select value={form.pedidoProtetico?.proteticoId || undefined} onValueChange={(id) => { if (id) atualizarPedido('proteticoId', id); }}><SelectTrigger className="min-h-[42px] rounded-xl border-border bg-surface-alt text-text-primary"><SelectValue placeholder="Selecione o protético" /></SelectTrigger><SelectContent className="border-border bg-surface">{proteticos?.map((protetico) => <SelectItem key={protetico.id} value={protetico.id}>{protetico.nome}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="retorno-entrega" className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">Entrega até *</Label><Input id="retorno-entrega" type="date" value={form.pedidoProtetico?.dataEntrega ?? ''} onChange={(event) => atualizarPedido('dataEntrega', event.target.value)} className="min-h-[42px] rounded-xl border-border bg-surface-alt text-text-primary" /></div>
                <div className="space-y-2"><Label htmlFor="retorno-protetico-obs" className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">O que precisa ser feito *</Label><textarea id="retorno-protetico-obs" value={form.pedidoProtetico?.observacao ?? ''} onChange={(event) => atualizarPedido('observacao', event.target.value)} placeholder="Ex: Cor, dente, material e observações..." className="min-h-[112px] w-full resize-none rounded-xl border border-border bg-surface-alt p-3.5 text-sm text-text-primary placeholder:text-text-secondary/40 outline-none transition-all focus:border-teal/30 focus:ring-2 focus:ring-teal/15" /></div>
              </motion.div>
            )}

          </div>
        </div>
        <div className="shrink-0 space-y-2.5 border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:ml-auto md:w-[250px] md:border-l md:p-4">
          {error && <p role="alert" className="rounded-lg bg-coral-pale p-2 text-xs text-coral-ink">{error}</p>}
          {etapa === 'retorno' ? <>
            {!error && !podeConfirmar && <p className="text-xs text-text-secondary">{dentistaAlvoId == null ? 'Escolha o dentista para ver a agenda.' : erroAgenda ? 'A agenda não carregou. Tente outra semana.' : 'Escolha um horário sem conflito para habilitar.'}</p>}
            {proteticos?.length ? <Button type="button" variant="outline" onClick={incluirProtetico} disabled={saving || !podeConfirmar} className="min-h-11 w-full rounded-xl border-teal/40 text-teal-ink hover:bg-teal/5"><Stethoscope className="mr-2 h-4 w-4" />Incluir protético</Button> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => alterarAberto(false)} disabled={saving} className="min-h-11 rounded-xl text-text-secondary hover:text-text-primary">Cancelar</Button>
              <Button onClick={onMarcarRetorno} disabled={saving || !podeConfirmar} className="min-h-11 rounded-xl bg-teal-dark font-bold text-white hover:opacity-90 disabled:opacity-40">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Marcar retorno'}</Button>
            </div>
          </> : <>
            {pedidoPendente ? <Button onClick={onTentarEnviarPedido} disabled={saving} className="min-h-11 w-full rounded-xl bg-teal-dark font-bold text-white hover:opacity-90">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : 'Tentar enviar novamente'}</Button> : <Button onClick={onMarcarRetorno} disabled={saving || !podeEnviar} className="min-h-11 w-full rounded-xl bg-teal-dark font-bold text-white hover:opacity-90 disabled:opacity-40">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Marcar retorno e enviar'}</Button>}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => alterarAberto(false)} disabled={saving || pedidoPendente} className="min-h-11 rounded-xl text-text-secondary hover:text-text-primary">Cancelar</Button>
              <Button type="button" variant="outline" onClick={() => setEtapa('retorno')} disabled={saving || pedidoPendente} className="min-h-11 rounded-xl text-text-secondary hover:text-text-primary"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Button>
            </div>
          </>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
