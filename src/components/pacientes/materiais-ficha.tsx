'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Package, PackagePlus, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  confirmarMateriaisDaFicha,
  corrigirMaterialDaFicha,
  declararMateriaisDaFicha,
  listarMateriaisDaFicha,
  previsualizarConfirmacaoMateriaisDaFicha,
} from '@/app/dashboard/pacientes/[id]/prontuario-actions';
import { detalharEstoque, listarEstoque, listarKits } from '@/app/dashboard/meu-consultorio/estoque/actions';
import type { ItemResumo, LoteResumo } from '@/server/estoque/contracts';
import type { KitsResultData, PrevisualizacaoConfirmacaoUsosResultData, UsosListResultData } from '@/server/estoque/kit-usage-contracts';

type LinhaRascunho = {
  linhaOrigemId: string;
  itemId: string;
  kitVersaoId: string | null;
  material: string;
  unidade: 'unidade' | 'g' | 'ml';
  quantidade: string;
  loteId: string;
  lotes: LoteResumo[];
};
type UsoPendente = { usoId: string; linhaOrigemId: string };
type UsoDaFicha = UsosListResultData['usos'][number];
type ItemAvulso = { item: ItemResumo; origem: 'Meu estoque' | 'Materiais da clínica' };
type CorrecaoRascunho = {
  uso: UsoDaFicha;
  quantidade: string;
  loteId: string;
  lotes: LoteResumo[];
  versaoItemEsperada: number;
  chaveIdempotencia: string;
  exigeAceiteDivergencia: boolean;
  aceitarDivergencia: boolean;
};

function dataSaoPaulo(): string {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((item) => item.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

function loteVencido(lote: LoteResumo): boolean {
  return lote.validadeISO !== null && lote.validadeISO < dataSaoPaulo();
}

function rotuloLote(lote: LoteResumo): string {
  const codigo = lote.codigoFabricante ?? (lote.semIdentificacao ? 'Sem identificação' : 'Lote');
  return `${codigo}${lote.validadeISO ? ` · val. ${lote.validadeISO}` : ''}${loteVencido(lote) ? ' · vencido' : ''} · saldo ${lote.saldo}`;
}

function quantidadePreenchida(quantidade: string): boolean {
  return /^(?:[1-9]\d{0,11})(?:\.\d{0,5}[1-9])?$|^0\.\d{0,5}[1-9]$/.test(quantidade);
}

function estadoUso(uso: UsoDaFicha): string {
  if (uso.estado === 'confirmado') return 'Confirmado';
  if (uso.estado === 'confirmado_divergente') return 'Divergente';
  if (uso.estado === 'substituido') return 'Corrigido';
  if (uso.estado === 'cancelado') return 'Cancelado';
  return 'Pendente';
}

export function MateriaisFicha({ clinicaId, atendimentoId, dentistaId }: { clinicaId: string; atendimentoId: string; dentistaId: string }) {
  const [usos, setUsos] = useState<UsosListResultData | null>(null);
  const [kits, setKits] = useState<KitsResultData['kits']>([]);
  const [kitSelecionado, setKitSelecionado] = useState('');
  const [avulsoAberto, setAvulsoAberto] = useState(false);
  const [buscaAvulsa, setBuscaAvulsa] = useState('');
  const [catalogoAvulso, setCatalogoAvulso] = useState<ItemAvulso[]>([]);
  const [carregandoCatalogoAvulso, setCarregandoCatalogoAvulso] = useState(false);
  const [linhas, setLinhas] = useState<LinhaRascunho[]>([]);
  const [usosPendentes, setUsosPendentes] = useState<UsoPendente[]>([]);
  const [insuficientes, setInsuficientes] = useState<PrevisualizacaoConfirmacaoUsosResultData['insuficientes']>([]);
  const [aceites, setAceites] = useState<string[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [correcao, setCorrecao] = useState<CorrecaoRascunho | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [montando, setMontando] = useState(false);
  const [retomando, setRetomando] = useState(false);
  const [declarando, setDeclarando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [abrindoCorrecao, setAbrindoCorrecao] = useState<string | null>(null);
  const [corrigindo, setCorrigindo] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCorrecao, setErroCorrecao] = useState<string | null>(null);
  const [chaveDeclaracao, setChaveDeclaracao] = useState<string | null>(null);
  const [chaveConfirmacao, setChaveConfirmacao] = useState<string | null>(null);

  const carregarUsos = useCallback(async () => {
    try {
      const resposta = await listarMateriaisDaFicha({ clinicaIdEsperada: clinicaId, atendimentoId });
      if (resposta.ok) setUsos(resposta.data);
      else setErro(resposta.mensagem);
    } catch {
      setErro('Não foi possível atualizar os materiais. Tente novamente.');
    }
  }, [atendimentoId, clinicaId]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [usoResposta, kitsClinica, kitsDentista] = await Promise.all([
        listarMateriaisDaFicha({ clinicaIdEsperada: clinicaId, atendimentoId }),
        listarKits({ clinicaIdEsperada: clinicaId, titular: { tipo: 'clinica' } }),
        listarKits({ clinicaIdEsperada: clinicaId, titular: { tipo: 'dentista', dentistaId } }),
      ]);
      if (usoResposta.ok) setUsos(usoResposta.data);
      else setErro(usoResposta.mensagem);
      setKits([...(kitsClinica.ok ? kitsClinica.data.kits : []), ...(kitsDentista.ok ? kitsDentista.data.kits : [])]);
      if (!kitsClinica.ok && !kitsDentista.ok && usoResposta.ok) setErro(kitsClinica.mensagem);
    } catch {
      setErro('Não foi possível carregar os materiais. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [atendimentoId, clinicaId, dentistaId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const limparFluxo = () => {
    setLinhas([]);
    setUsosPendentes([]);
    setInsuficientes([]);
    setAceites([]);
    setConcluido(false);
    setChaveDeclaracao(null);
    setChaveConfirmacao(null);
  };

  const carregarCatalogoAvulso = async (busca = buscaAvulsa) => {
    setCarregandoCatalogoAvulso(true);
    setErro(null);
    try {
      const [pessoal, clinica] = await Promise.all([
        listarEstoque({ clinicaIdEsperada: clinicaId, titular: { tipo: 'dentista', dentistaId }, busca, filtro: 'todos', cursor: null, limite: 25 }),
        listarEstoque({ clinicaIdEsperada: clinicaId, titular: { tipo: 'clinica' }, busca, filtro: 'todos', cursor: null, limite: 25 }),
      ]);
      const catalogo = [
        ...(pessoal.ok ? pessoal.data.itens.filter((item) => item.ativo).map((item) => ({ item, origem: 'Meu estoque' as const })) : []),
        ...(clinica.ok ? clinica.data.itens.filter((item) => item.ativo).map((item) => ({ item, origem: 'Materiais da clínica' as const })) : []),
      ];
      setCatalogoAvulso(catalogo);
      if (!pessoal.ok && !clinica.ok) setErro(pessoal.mensagem);
    } catch {
      setErro('Não foi possível carregar materiais disponíveis. Tente novamente.');
    } finally {
      setCarregandoCatalogoAvulso(false);
    }
  };

  const abrirMaterialAvulso = () => {
    if (!avulsoAberto) void carregarCatalogoAvulso();
    setAvulsoAberto(!avulsoAberto);
  };

  const adicionarMaterialAvulso = async (item: ItemAvulso) => {
    setMontando(true);
    setErro(null);
    limparFluxo();
    try {
      const resposta = await detalharEstoque({ clinicaIdEsperada: clinicaId, itemId: item.item.id, cursor: null, limite: 50 });
      if (!resposta.ok) {
        setErro(resposta.mensagem);
        return;
      }
      setLinhas([{
        linhaOrigemId: crypto.randomUUID(),
        itemId: item.item.id,
        kitVersaoId: null,
        material: item.item.nome,
        unidade: item.item.unidadeBase,
        quantidade: '1',
        loteId: '',
        lotes: resposta.data.lotes,
      }]);
      setAvulsoAberto(false);
      setDialogAberto(true);
    } catch {
      setErro('Não foi possível carregar os lotes deste material. Tente novamente.');
    } finally {
      setMontando(false);
    }
  };

  const montarKit = async () => {
    const kit = kits.find((item) => item.kitId === kitSelecionado);
    if (!kit) return;
    setMontando(true);
    setErro(null);
    limparFluxo();
    try {
      const detalhes = await Promise.all(kit.componentes.map(async (componente) => ({
        componente,
        resposta: await detalharEstoque({ clinicaIdEsperada: clinicaId, itemId: componente.itemId, cursor: null, limite: 50 }),
      })));
      const falha = detalhes.find(({ resposta }) => !resposta.ok);
      if (falha?.resposta.ok === false) {
        setErro(falha.resposta.mensagem);
        return;
      }
      const novasLinhas = detalhes.flatMap(({ componente, resposta }) => resposta.ok ? [{
        linhaOrigemId: crypto.randomUUID(),
        itemId: componente.itemId,
        kitVersaoId: kit.kitVersaoId,
        material: componente.nome,
        unidade: componente.unidade,
        quantidade: componente.quantidade,
        loteId: '',
        lotes: resposta.data.lotes,
      }] : []);
      if (novasLinhas.length !== kit.componentes.length) {
        setErro('Não foi possível carregar todos os lotes autorizados do kit.');
        return;
      }
      setLinhas(novasLinhas);
      setDialogAberto(true);
    } catch {
      setErro('Não foi possível carregar os lotes do kit. Tente novamente.');
    } finally {
      setMontando(false);
    }
  };

  const atualizarLinha = (linhaOrigemId: string, campo: 'quantidade' | 'loteId', valor: string) => {
    setLinhas((atuais) => atuais.map((linha) => linha.linhaOrigemId === linhaOrigemId ? { ...linha, [campo]: valor } : linha));
  };

  const consultarConfirmacao = async (pendentes: UsoPendente[]): Promise<PrevisualizacaoConfirmacaoUsosResultData | null> => {
    if (pendentes.length === 0 || pendentes.length > 50) {
      setErro('Selecione no máximo 50 materiais para confirmar por vez.');
      return null;
    }
    try {
      const previa = await previsualizarConfirmacaoMateriaisDaFicha({
        clinicaIdEsperada: clinicaId,
        atendimentoId,
        usoIds: pendentes.map((uso) => uso.usoId),
      });
      if (!previa.ok) {
        setErro(previa.mensagem);
        return null;
      }
      setInsuficientes(previa.data.insuficientes);
      setAceites((atuais) => atuais.filter((usoId) => previa.data.insuficientes.some((uso) => uso.usoId === usoId)));
      return previa.data;
    } catch {
      setErro('Não foi possível conferir a baixa. Tente novamente.');
      return null;
    }
  };

  const declarar = async () => {
    if (linhas.some((linha) => !linha.loteId || !quantidadePreenchida(linha.quantidade))) return;
    setDeclarando(true);
    setErro(null);
    const chave = chaveDeclaracao ?? crypto.randomUUID();
    setChaveDeclaracao(chave);
    try {
      const resposta = await declararMateriaisDaFicha({
        clinicaIdEsperada: clinicaId,
        atendimentoId,
        chaveIdempotencia: chave,
        linhas: linhas.map((linha) => ({ linhaOrigemId: linha.linhaOrigemId, itemId: linha.itemId, loteId: linha.loteId, quantidade: linha.quantidade, kitVersaoId: linha.kitVersaoId })),
      });
      if (!resposta.ok) {
        setErro(resposta.mensagem);
        return;
      }
      const pendentes = resposta.data.usos.flatMap((uso) => uso.linhaOrigemId ? [{ usoId: uso.usoId, linhaOrigemId: uso.linhaOrigemId }] : []);
      if (pendentes.length !== linhas.length) {
        setErro('Não foi possível vincular as linhas declaradas. Atualize os materiais antes de confirmar.');
        return;
      }
      setChaveDeclaracao(null);
      setUsosPendentes(pendentes);
      await Promise.all([carregarUsos(), consultarConfirmacao(pendentes)]);
    } catch {
      setErro('Não foi possível declarar os materiais. Tente novamente.');
    } finally {
      setDeclarando(false);
    }
  };

  const recarregarLotesDoRascunho = async () => {
    try {
      const detalhes = await Promise.all(linhas.map(async (linha) => ({
        itemId: linha.itemId,
        resposta: await detalharEstoque({ clinicaIdEsperada: clinicaId, itemId: linha.itemId, cursor: null, limite: 50 }),
      })));
      setLinhas((atuais) => atuais.map((linha) => {
        const detalhe = detalhes.find((item) => item.itemId === linha.itemId)?.resposta;
        return detalhe?.ok ? { ...linha, lotes: detalhe.data.lotes } : linha;
      }));
    } catch {
      setErro('A baixa foi confirmada, mas os saldos não puderam ser atualizados agora.');
    }
  };

  const retomarPendentes = async (usoIds?: string[]) => {
    const pendentesDaFicha = usos?.usos.filter((uso) => uso.estado === 'pendente_autorizacao') ?? [];
    const pendentesDoLote = (usoIds ? pendentesDaFicha.filter((uso) => usoIds.includes(uso.usoId)) : pendentesDaFicha).slice(0, 50);
    if (!pendentesDoLote.length) return;
    setRetomando(true);
    setErro(null);
    try {
      const detalhes = await Promise.allSettled(pendentesDoLote.map(async (uso) => ({
        usoId: uso.usoId,
        resposta: await detalharEstoque({ clinicaIdEsperada: clinicaId, itemId: uso.itemId, cursor: null, limite: 50 }),
      })));
      const linhasRetomadas = pendentesDoLote.map((uso) => {
        const detalhe = detalhes.find((item) => item.status === 'fulfilled' && item.value.usoId === uso.usoId);
        return {
          linhaOrigemId: uso.linhaOrigemId,
          itemId: uso.itemId,
          kitVersaoId: uso.kitVersaoId,
          material: uso.material,
          unidade: uso.unidade,
          quantidade: uso.quantidade,
          loteId: uso.loteId,
          lotes: detalhe?.status === 'fulfilled' && detalhe.value.resposta.ok ? detalhe.value.resposta.data.lotes : [],
        };
      });
      const pendentes = pendentesDoLote.map((uso) => ({ usoId: uso.usoId, linhaOrigemId: uso.linhaOrigemId }));
      setLinhas(linhasRetomadas);
      setUsosPendentes(pendentes);
      setInsuficientes([]);
      setAceites([]);
      setConcluido(false);
      setChaveDeclaracao(null);
      setChaveConfirmacao(null);
      setDialogAberto(true);
      await consultarConfirmacao(pendentes);
    } catch {
      setErro('Não foi possível retomar a baixa. Atualize os materiais e tente novamente.');
    } finally {
      setRetomando(false);
    }
  };

  const confirmar = async () => {
    if (!usosPendentes.length) return;
    setConfirmando(true);
    setErro(null);
    const previa = await consultarConfirmacao(usosPendentes);
    if (!previa) {
      setConfirmando(false);
      return;
    }
    if (previa.insuficientes.some((uso) => !aceites.includes(uso.usoId))) {
      setErro('Confirme explicitamente cada consumo com saldo insuficiente.');
      setConfirmando(false);
      return;
    }
    const chave = chaveConfirmacao ?? crypto.randomUUID();
    setChaveConfirmacao(chave);
    try {
      const resposta = await confirmarMateriaisDaFicha({
        clinicaIdEsperada: clinicaId,
        atendimentoId,
        chaveIdempotencia: chave,
        usoIds: usosPendentes.map((uso) => uso.usoId),
        divergenciasAceitas: previa.insuficientes,
      });
      if (!resposta.ok) {
        setErro(resposta.mensagem);
        return;
      }
      setChaveConfirmacao(null);
      await Promise.all([carregarUsos(), recarregarLotesDoRascunho()]);
      setConcluido(true);
    } catch {
      setErro('Não foi possível confirmar a baixa. Tente novamente.');
    } finally {
      setConfirmando(false);
    }
  };

  const abrirCorrecao = async (uso: UsoDaFicha) => {
    setAbrindoCorrecao(uso.usoId);
    setErro(null);
    try {
      const resposta = await detalharEstoque({ clinicaIdEsperada: clinicaId, itemId: uso.itemId, cursor: null, limite: 50 });
      if (!resposta.ok) {
        setErro(resposta.mensagem);
        return;
      }
      setErroCorrecao(null);
      setCorrecao({ uso, quantidade: uso.quantidade, loteId: uso.loteId, lotes: resposta.data.lotes, versaoItemEsperada: resposta.data.item.versao, chaveIdempotencia: crypto.randomUUID(), exigeAceiteDivergencia: false, aceitarDivergencia: false });
    } catch {
      setErro('Não foi possível abrir a correção. Tente novamente.');
    } finally {
      setAbrindoCorrecao(null);
    }
  };

  const atualizarCorrecao = (alteracoes: Partial<Pick<CorrecaoRascunho, 'quantidade' | 'loteId' | 'aceitarDivergencia'>>) => {
    if (!correcao || corrigindo) return;
    setCorrecao({
      ...correcao,
      ...alteracoes,
      chaveIdempotencia: crypto.randomUUID(),
      exigeAceiteDivergencia: 'quantidade' in alteracoes || 'loteId' in alteracoes ? false : correcao.exigeAceiteDivergencia,
      aceitarDivergencia: 'quantidade' in alteracoes || 'loteId' in alteracoes ? false : alteracoes.aceitarDivergencia ?? correcao.aceitarDivergencia,
    });
  };

  const corrigir = async () => {
    if (!correcao || !correcao.loteId || !quantidadePreenchida(correcao.quantidade)) return;
    setCorrigindo(true);
    setErroCorrecao(null);
    try {
      const resposta = await corrigirMaterialDaFicha({
        clinicaIdEsperada: clinicaId,
        atendimentoId,
        usoId: correcao.uso.usoId,
        revisaoEsperada: correcao.uso.revisao,
        chaveIdempotencia: correcao.chaveIdempotencia,
        substituicao: { itemId: correcao.uso.itemId, loteId: correcao.loteId, quantidade: correcao.quantidade, kitVersaoId: correcao.uso.kitVersaoId, versaoItemEsperada: correcao.versaoItemEsperada },
        aceitarDivergencia: correcao.aceitarDivergencia,
      });
      if (!resposta.ok) {
        if (resposta.codigo === 'SALDO_INSUFICIENTE' && !correcao.aceitarDivergencia) setCorrecao({ ...correcao, exigeAceiteDivergencia: true });
        setErroCorrecao(resposta.mensagem);
        return;
      }
      await carregarUsos();
      setCorrecao(null);
    } catch {
      setErroCorrecao('Não foi possível salvar a correção. Tente novamente.');
    } finally {
      setCorrigindo(false);
    }
  };

  const pendentePorLinha = new Map(usosPendentes.map((uso) => [uso.linhaOrigemId, uso.usoId]));
  const loteSelecionadoVencido = (linha: LinhaRascunho): boolean => linha.lotes.some((lote) => lote.id === linha.loteId && loteVencido(lote));
  const haLoteVencidoSelecionado = linhas.some(loteSelecionadoVencido);
  const camposValidos = linhas.length > 0 && linhas.every((linha) => linha.loteId && quantidadePreenchida(linha.quantidade) && !loteSelecionadoVencido(linha));
  const aceitesCompletos = insuficientes.every((uso) => aceites.includes(uso.usoId));
  const correcaoValida = correcao != null && correcao.loteId !== '' && quantidadePreenchida(correcao.quantidade) && !correcao.lotes.some((lote) => lote.id === correcao.loteId && loteVencido(lote)) && (!correcao.exigeAceiteDivergencia || correcao.aceitarDivergencia);
  const pendentesDaFicha = usos?.usos.filter((uso) => uso.estado === 'pendente_autorizacao') ?? [];
  const fluxoOcupado = declarando || confirmando;

  return <article className="rounded-2xl border border-border bg-surface p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Materiais</p><p className="mt-2 text-sm text-text-primary">{carregando ? 'Carregando materiais…' : usos?.usos.length ? `${usos.usos.length} linha${usos.usos.length === 1 ? '' : 's'} registrada${usos.usos.length === 1 ? '' : 's'}` : 'Nenhum material informado'}</p></div><Package className="size-4 text-text-secondary" aria-hidden /></div>
    {erro ? <p role="alert" className="mt-2 text-xs text-destructive">{erro}</p> : null}
    {usos?.usos.map((uso) => <div key={uso.usoId} className="mt-3 border-t border-border pt-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-medium text-text-primary">{uso.material}</span><span className="font-mono text-text-secondary">{uso.quantidade} {uso.unidade}</span></div><div className="mt-1 flex items-center justify-between gap-2 text-text-secondary"><span>{estadoUso(uso)}</span>{uso.estado === 'pendente_autorizacao' ? <Button variant="ghost" size="sm" className="min-h-9 px-2 text-xs" disabled={retomando || fluxoOcupado} onClick={() => void retomarPendentes([uso.usoId])}><RefreshCw className="size-3" /> Retomar</Button> : null}{(uso.estado === 'confirmado' || uso.estado === 'confirmado_divergente') ? <Button variant="ghost" size="sm" className="min-h-9 px-2 text-xs" disabled={abrindoCorrecao === uso.usoId || corrigindo} onClick={() => void abrirCorrecao(uso)}><Pencil className="size-3" /> {abrindoCorrecao === uso.usoId ? 'Abrindo…' : 'Corrigir'}</Button> : null}</div></div>)}
    {pendentesDaFicha.length > 0 ? <Button variant="outline" className="mt-3 min-h-11 w-full" disabled={retomando || fluxoOcupado} onClick={() => void retomarPendentes()}><RefreshCw className="size-4" /> {retomando ? 'Abrindo baixa…' : `Retomar ${Math.min(pendentesDaFicha.length, 50)} de ${pendentesDaFicha.length} material${pendentesDaFicha.length === 1 ? '' : 'is'}`}</Button> : null}
    <div className="mt-4 border-t border-border pt-3"><label className="text-xs font-semibold text-text-secondary" htmlFor="kit-da-ficha">Aplicar kit</label><select id="kit-da-ficha" className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={kitSelecionado} onChange={(event) => setKitSelecionado(event.target.value)} disabled={carregando || montando || retomando || fluxoOcupado}><option value="">Selecione um kit</option>{kits.map((kit) => <option key={kit.kitId} value={kit.kitId}>{kit.nome} · {kit.componentes.length} materiais</option>)}</select><Button className="mt-2 min-h-11 w-full" variant="outline" disabled={!kitSelecionado || montando || retomando || fluxoOcupado} onClick={() => void montarKit()}><PackagePlus className="size-4" />{montando ? 'Carregando lotes…' : 'Revisar e aplicar kit'}</Button></div>
    <div className="mt-3 border-t border-border pt-3"><Button className="min-h-11 w-full" variant="outline" disabled={carregando || montando || retomando || fluxoOcupado} onClick={abrirMaterialAvulso}><PackagePlus className="size-4" /> Adicionar material</Button>{avulsoAberto ? <div className="mt-3 rounded-xl border border-border p-3"><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void carregarCatalogoAvulso(); }}><Input aria-label="Buscar material para a ficha" className="min-h-11" value={buscaAvulsa} maxLength={120} disabled={carregandoCatalogoAvulso || montando} onChange={(event) => setBuscaAvulsa(event.target.value)} placeholder="Buscar material" /><Button type="submit" variant="outline" disabled={carregandoCatalogoAvulso || montando}>{carregandoCatalogoAvulso ? 'Buscando…' : 'Buscar'}</Button></form><div className="mt-3 space-y-2">{catalogoAvulso.map(({ item, origem }) => <button key={item.id} type="button" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-surface-alt disabled:pointer-events-none disabled:opacity-50" disabled={montando || carregandoCatalogoAvulso} onClick={() => void adicionarMaterialAvulso({ item, origem })}><span className="min-w-0"><span className="block truncate font-medium text-text-primary">{item.nome}</span><span className="block text-xs text-text-secondary">{origem}</span></span><span className="font-mono text-xs text-text-secondary">{item.unidadeBase}</span></button>)}{!carregandoCatalogoAvulso && catalogoAvulso.length === 0 ? <p className="text-xs text-text-secondary">Nenhum material autorizado encontrado.</p> : null}</div></div> : null}</div>
    <Button variant="ghost" className="mt-2 min-h-11 w-full" onClick={() => void carregar()} disabled={carregando || fluxoOcupado || retomando}><RefreshCw className="size-4" /> Atualizar materiais</Button>
    <Dialog open={dialogAberto} onOpenChange={(aberto) => { if (!aberto && fluxoOcupado) return; setDialogAberto(aberto); if (!aberto) limparFluxo(); }}><DialogContent showCloseButton={!fluxoOcupado} className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{concluido ? 'Baixa confirmada' : usosPendentes.length ? 'Confirmar baixa dos materiais' : 'Revisar materiais do kit'}</DialogTitle><DialogDescription>{concluido ? 'O histórico da ficha foi atualizado.' : usosPendentes.length ? 'A declaração já foi salva na ficha. Revise a baixa antes de confirmar.' : 'Escolha um lote autorizado e ajuste a quantidade antes de declarar o uso.'}</DialogDescription></DialogHeader><div className="space-y-3">{linhas.map((linha) => { const usoId = pendentePorLinha.get(linha.linhaOrigemId); const exigeAceite = usoId ? insuficientes.some((uso) => uso.usoId === usoId) : false; return <section key={linha.linhaOrigemId} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium text-text-primary">{linha.material}</p><span className="text-xs text-text-secondary">{linha.unidade}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-text-secondary">Quantidade<Input className="mt-1 min-h-11" inputMode="decimal" value={linha.quantidade} disabled={usosPendentes.length > 0 || fluxoOcupado} onChange={(event) => atualizarLinha(linha.linhaOrigemId, 'quantidade', event.target.value)} /></label><label className="text-xs font-medium text-text-secondary">Lote autorizado<select className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={linha.loteId} disabled={usosPendentes.length > 0 || fluxoOcupado} onChange={(event) => atualizarLinha(linha.linhaOrigemId, 'loteId', event.target.value)}><option value="">Selecione o lote</option>{usosPendentes.length > 0 && !linha.lotes.some((lote) => lote.id === linha.loteId) ? <option value={linha.loteId}>Lote registrado</option> : null}{linha.lotes.map((lote) => <option key={lote.id} value={lote.id} disabled={loteVencido(lote)}>{rotuloLote(lote)}</option>)}</select></label></div>{loteSelecionadoVencido(linha) ? <p role="alert" className="mt-2 text-xs text-destructive">Este lote está vencido e não pode ser usado.</p> : null}{linha.lotes.length === 0 && usosPendentes.length === 0 ? <p role="alert" className="mt-2 text-xs text-destructive">Nenhum lote autorizado está disponível para este material.</p> : null}{exigeAceite && usoId ? <label className="mt-3 flex gap-2 rounded-lg border border-border bg-surface-alt p-3 text-xs text-text-primary"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /><span><input className="mr-2" type="checkbox" disabled={fluxoOcupado} checked={aceites.includes(usoId)} onChange={(event) => setAceites((atuais) => event.target.checked ? [...atuais, usoId] : atuais.filter((id) => id !== usoId))} />Confirmo este consumo mesmo com saldo insuficiente.</span></label> : null}</section>; })}</div>{erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : null}<DialogFooter>{concluido ? <Button disabled={fluxoOcupado} onClick={() => setDialogAberto(false)}><Check className="size-4" /> Concluir</Button> : usosPendentes.length ? <Button disabled={fluxoOcupado || haLoteVencidoSelecionado || (!aceitesCompletos && insuficientes.length > 0)} onClick={() => void confirmar()}>{confirmando ? 'Conferindo baixa…' : insuficientes.length && !aceitesCompletos ? 'Confirme as divergências' : 'Confirmar baixa'}</Button> : <Button disabled={!camposValidos || fluxoOcupado} onClick={() => void declarar()}>{declarando ? 'Declarando materiais…' : 'Declarar materiais'}</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={correcao != null} onOpenChange={(aberto) => { if (!aberto && corrigindo) return; if (!aberto) setCorrecao(null); }}><DialogContent showCloseButton={!corrigindo} className="sm:max-w-lg"><DialogHeader><DialogTitle>Corrigir uso registrado</DialogTitle><DialogDescription>A correção mantém o uso anterior no histórico e cria uma revisão com a compensação do saldo.</DialogDescription></DialogHeader>{correcao ? <div className="space-y-3"><p className="text-sm font-medium text-text-primary">{correcao.uso.material}</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-text-secondary">Quantidade<Input className="mt-1 min-h-11" inputMode="decimal" value={correcao.quantidade} disabled={corrigindo} onChange={(event) => atualizarCorrecao({ quantidade: event.target.value })} /></label><label className="text-xs font-medium text-text-secondary">Lote autorizado<select className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={correcao.loteId} disabled={corrigindo} onChange={(event) => atualizarCorrecao({ loteId: event.target.value })}><option value="">Selecione o lote</option>{correcao.lotes.map((lote) => <option key={lote.id} value={lote.id} disabled={loteVencido(lote)}>{rotuloLote(lote)}</option>)}</select></label></div>{correcao.lotes.some((lote) => lote.id === correcao.loteId && loteVencido(lote)) ? <p role="alert" className="text-xs text-destructive">Este lote está vencido e não pode ser usado na correção.</p> : null}{correcao.exigeAceiteDivergencia ? <label className="flex gap-2 rounded-lg border border-border bg-surface-alt p-3 text-xs text-text-primary"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /><span><input className="mr-2" type="checkbox" disabled={corrigindo} checked={correcao.aceitarDivergencia} onChange={(event) => atualizarCorrecao({ aceitarDivergencia: event.target.checked })} />Confirmo esta correção mesmo com saldo insuficiente.</span></label> : null}{erroCorrecao ? <p role="alert" className="text-sm text-destructive">{erroCorrecao}</p> : null}</div> : null}<DialogFooter><Button disabled={!correcaoValida || corrigindo} onClick={() => void corrigir()}>{corrigindo ? 'Salvando correção…' : 'Salvar correção'}</Button></DialogFooter></DialogContent></Dialog>
  </article>;
}
