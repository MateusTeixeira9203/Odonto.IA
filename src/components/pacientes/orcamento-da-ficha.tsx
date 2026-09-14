'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { FileText, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getResumoOrcamentoDaFicha, type ResumoOrcamentoDaFicha } from '@/server/orcamentos/ficha-orcamento-actions';

type Estado = { tipo: 'carregando' } | { tipo: 'erro'; mensagem: string } | { tipo: 'pronto'; resumo: ResumoOrcamentoDaFicha };

/** Existe somente na ficha aberta, nunca na listagem geral ou no Meu Dia. */
export function OrcamentoDaFicha({ fichaId, clinicaId, dentistaId, revisao, eventosConfirmados = [], onAbrir }: {
  fichaId: string;
  clinicaId: string;
  dentistaId: string;
  revisao: string;
  /** IDs confirmados pela inclusão atual somem antes da revalidação SSR terminar. */
  eventosConfirmados?: string[];
  onAbrir: (resumo: ResumoOrcamentoDaFicha) => Promise<void>;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [pulso, setPulso] = useState(0);
  const [abrindo, setAbrindo] = useState(false);
  const [confirmadosNaUltimaResposta, setConfirmadosNaUltimaResposta] = useState<string[]>([]);
  const reduzirMovimento = useReducedMotion();
  const vistos = useRef(new Set<string>());
  const eventosConfirmadosKey = eventosConfirmados.join('|');

  useEffect(() => {
    let ativo = true;
    let sequencia = 0;
    const storageKey = `odontoia:orcamento-sinalizado:${clinicaId}:${dentistaId}:${fichaId}`;
    try {
      const salvos: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
      vistos.current = new Set(Array.isArray(salvos) ? salvos.filter((id): id is string => typeof id === 'string') : []);
    } catch { /* A sinalização funciona na memória quando o storage não está disponível. */ }

    async function atualizar(): Promise<void> {
      const pedido = ++sequencia;
      const confirmadosDestePedido = eventosConfirmadosKey ? eventosConfirmadosKey.split('|') : [];
      try {
        const resultado = await getResumoOrcamentoDaFicha({ fichaId });
        if (!ativo || pedido !== sequencia) return;
        if (!resultado.ok) { setEstado({ tipo: 'erro', mensagem: resultado.error }); return; }
        const novos = resultado.dados.eventoIdsFaltantes.filter((id) => !vistos.current.has(id));
        if (novos.length > 0) {
          novos.forEach((id) => vistos.current.add(id));
          try { sessionStorage.setItem(storageKey, JSON.stringify([...vistos.current])); } catch { /* sem efeito no orçamento */ }
          setPulso((valor) => valor + 1);
        }
        setConfirmadosNaUltimaResposta(confirmadosDestePedido);
        setEstado({ tipo: 'pronto', resumo: resultado.dados });
      } catch {
        if (ativo && pedido === sequencia) setEstado({ tipo: 'erro', mensagem: 'Não foi possível conferir o orçamento. Tente novamente.' });
      }
    }
    const aoRetornar = () => { if (document.visibilityState === 'visible') void atualizar(); };
    void atualizar();
    window.addEventListener('focus', aoRetornar);
    document.addEventListener('visibilitychange', aoRetornar);
    return () => {
      ativo = false;
      window.removeEventListener('focus', aoRetornar);
      document.removeEventListener('visibilitychange', aoRetornar);
    };
  }, [clinicaId, dentistaId, fichaId, revisao, tentativa, eventosConfirmadosKey]);

  if (estado.tipo === 'carregando') return <Button variant="outline" disabled className="min-h-11"><Loader2 className="h-4 w-4 animate-spin" /> Conferindo orçamento</Button>;
  if (estado.tipo === 'erro') return (
    <div className="space-y-2">
      <p role="alert" className="text-sm text-destructive">{estado.mensagem}</p>
      <Button variant="outline" className="min-h-11" onClick={() => setTentativa((valor) => valor + 1)}><RefreshCw className="h-4 w-4" /> Tentar novamente</Button>
    </div>
  );
  const confirmadosDaLeituraAtual = new Set(confirmadosNaUltimaResposta);
  const idsConfirmadosDepoisDaLeitura = new Set(eventosConfirmados.filter((id) => !confirmadosDaLeituraAtual.has(id)));
  const eventoIdsFaltantes = estado.resumo.eventoIdsFaltantes.filter((id) => !idsConfirmadosDepoisDaLeitura.has(id));
  const resumo = {
    ...estado.resumo,
    eventoIdsFaltantes,
    quantidadeProcedimentos: eventoIdsFaltantes.length,
  };
  const existe = resumo.orcamentoIds.length > 0;
  const quantidade = resumo.quantidadeProcedimentos;
  const pendente = existe && quantidade > 0;
  const abrir = async (): Promise<void> => {
    if (abrindo) return;
    setAbrindo(true);
    try {
      await onAbrir(resumo);
    } catch {
      setEstado({ tipo: 'erro', mensagem: 'Não foi possível abrir o orçamento. Tente novamente.' });
    } finally {
      setAbrindo(false);
    }
  };
  return (
    <div className="relative inline-flex max-w-full">
      {pendente && pulso > 0 && !reduzirMovimento && (
        <motion.span key={pulso} aria-hidden className="pointer-events-none absolute -inset-1 rounded-xl border-2 border-warning" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.6 }} />
      )}
      <Button
        variant="outline"
        className={`min-h-11 whitespace-normal ${pendente ? 'border-warning bg-warning-pale text-warning-ink hover:bg-warning-pale hover:text-warning-ink' : ''}`}
        onClick={() => void abrir()}
        disabled={abrindo}
        aria-label={pendente ? `${quantidade} procedimentos da ficha disponíveis para adicionar ao orçamento` : undefined}
      >
        {abrindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {abrindo ? 'Abrindo orçamento' : pendente ? `Atualizar orçamento · ${quantidade}` : existe ? 'Ver orçamento' : 'Criar orçamento'}
      </Button>
    </div>
  );
}
