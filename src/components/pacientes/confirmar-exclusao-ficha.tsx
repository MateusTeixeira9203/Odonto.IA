'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MOTIVOS_EXCLUSAO, nomeConfere, podeApagar, type ConfirmacaoExclusaoFicha } from '@/lib/prontuario/exclusao-ficha';
import type { ResumoExclusaoFicha } from '@/server/patients/salvar-ficha';

export function ConfirmarExclusaoFicha({ resumo, apagando, onCancelar, onConfirmar }: {
  resumo: ResumoExclusaoFicha;
  apagando: boolean;
  onCancelar: () => void;
  onConfirmar: (confirmacao: ConfirmacaoExclusaoFicha) => Promise<void>;
}) {
  const id = useId();
  const [motivo, setMotivo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [nome, setNome] = useState('');
  const [caixaMarcada, setCaixaMarcada] = useState(false);
  const habilitado = podeApagar({ motivo, detalhe, nomeConfere: nomeConfere(nome, resumo.nomePaciente), orcamentosMantidos: resumo.orcamentosMantidos, caixaMarcada });
  const data = resumo.dataAtendimento.slice(0, 10).split('-').reverse().join('/');
  const plural = resumo.orcamentosMantidos > 1;
  const campo = 'w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring';

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !apagando) onCancelar(); }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!apagando}>
        <DialogHeader>
          <DialogTitle>Apagar esta ficha?</DialogTitle>
          <DialogDescription>
            A ficha de {data} será apagada com {resumo.evolucoes} evolução(ões), {resumo.eventos} procedimento(s) e {resumo.arquivos} arquivo(s). <strong>Isso não pode ser desfeito.</strong> Fica registrado quem apagou, quando e o motivo.
            {!resumo.avisoOrcamentoPreservado && resumo.orcamentosApagados > 0 && <> {resumo.orcamentosApagados} orçamento(s) desta ficha que o paciente ainda não aceitou também será(ão) apagado(s).</>}
          </DialogDescription>
        </DialogHeader>
        {resumo.orcamentosMantidos > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning-pale p-3 text-sm text-warning-ink">
            <p className="font-semibold">{resumo.avisoOrcamentoPreservado ? 'Esta ficha tem orçamento ou pagamento que será mantido' : plural ? `Esta ficha tem ${resumo.orcamentosMantidos} orçamentos aceitos pelo paciente` : 'Esta ficha tem orçamento aceito pelo paciente'}</p>
            <p className="mt-1">{resumo.avisoOrcamentoPreservado ? <>Existe orçamento ou pagamento ligado a esta ficha que <strong>não será apagado</strong>. O orçamento continua na aba Orçamentos do paciente, com o aceite, os valores, as cobranças e os pagamentos. Ele só deixa de estar ligado a esta ficha.</> : plural ? <>Os orçamentos aceitos <strong>não serão apagados</strong>. Eles continuam na aba Orçamentos do paciente, com o aceite, os valores, as cobranças e os pagamentos. Eles só deixam de estar ligados a esta ficha.</> : <>O orçamento aceito <strong>não será apagado</strong>. Ele continua na aba Orçamentos do paciente, com o aceite, os valores, as cobranças e os pagamentos. Ele só deixa de estar ligado a esta ficha.</>}</p>
          </div>
        )}
        <form className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          if (habilitado && !apagando) void onConfirmar({ motivo, detalhe: motivo === 'outro' ? detalhe : undefined, nomePaciente: nome, confirmaOrcamentoAceito: caixaMarcada });
        }}>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-motivo`}>Motivo (obrigatório)</label>
            <select id={`${id}-motivo`} className={campo} required disabled={apagando} value={motivo} onChange={(event) => setMotivo(event.target.value)}>
              <option value="">Selecione um motivo</option>
              {MOTIVOS_EXCLUSAO.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
            </select>
          </div>
          {motivo === 'outro' && <div className="grid gap-1.5">
            <label htmlFor={`${id}-detalhe`}>Descreva em poucas palavras, sem dados clínicos</label>
            <textarea id={`${id}-detalhe`} className={campo} required disabled={apagando} value={detalhe} onChange={(event) => setDetalhe(event.target.value)} aria-describedby={`${id}-limite`} />
            <p id={`${id}-limite`} className="text-xs text-muted-foreground">5 a 200 caracteres.</p>
          </div>}
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-nome`}>Para confirmar, digite o nome do paciente: <strong>{resumo.nomePaciente}</strong></label>
            <input id={`${id}-nome`} className={campo} required autoComplete="off" disabled={apagando} value={nome} onChange={(event) => setNome(event.target.value)} />
          </div>
          {resumo.orcamentosMantidos > 0 && <div className="flex items-start gap-2">
            <input id={`${id}-caixa`} type="checkbox" className="mt-1 size-4 shrink-0 accent-destructive" required disabled={apagando} checked={caixaMarcada} onChange={(event) => setCaixaMarcada(event.target.checked)} />
            <label htmlFor={`${id}-caixa`}>Entendi: a ficha será apagada e o orçamento aceito continua guardado, sem ligação com esta ficha.</label>
          </div>}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={apagando} onClick={onCancelar}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={apagando || !habilitado}>{apagando && <Loader2 className="h-4 w-4 animate-spin" />}Apagar ficha</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
