'use client';

import { useEffect, useState } from 'react';
import { PackagePlus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cadastrarKit, editarKit, listarKits } from '@/app/dashboard/meu-consultorio/estoque/actions';
import type { ItemResumo, TitularEstoque } from '@/server/estoque/contracts';
import type { KitsResultData } from '@/server/estoque/kit-usage-contracts';

function quantidadePreenchida(quantidade: string): boolean {
  return /^(?:[1-9]\d{0,11})(?:\.\d{0,5}[1-9])?$|^0\.\d{0,5}[1-9]$/.test(quantidade);
}

type KitDaLista = KitsResultData['kits'][number];

export function StockKitsPanel({ clinicaId, titular, itens }: { clinicaId: string; titular: TitularEstoque; itens: ItemResumo[] }) {
  const [kits, setKits] = useState<KitsResultData | null>(null);
  const [open, setOpen] = useState(false);
  const [kitEditando, setKitEditando] = useState<KitDaLista | null>(null);
  const [nome, setNome] = useState('');
  const [componentes, setComponentes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [chaveIdempotencia, setChaveIdempotencia] = useState<string | null>(null);
  const titularKey = titular.tipo === 'dentista' ? `${titular.tipo}:${titular.dentistaId}` : titular.tipo;
  const componentesSelecionados = Object.entries(componentes);
  const formularioValido = nome.trim().length > 0 && componentesSelecionados.length > 0 && componentesSelecionados.every(([, quantidade]) => quantidadePreenchida(quantidade));

  const load = async () => {
    try {
      const result = await listarKits({ clinicaIdEsperada: clinicaId, titular });
      if (result.ok) setKits(result.data);
      else setError(result.mensagem);
    } catch {
      setError('Não foi possível atualizar os kits. Tente novamente.');
    }
  };

  useEffect(() => {
    let ativo = true;
    void listarKits({ clinicaIdEsperada: clinicaId, titular }).then((result) => {
      if (ativo && result.ok) setKits(result.data);
    }).catch(() => {
      if (ativo) setError('Não foi possível carregar os kits.');
    });
    return () => { ativo = false; };
  }, [clinicaId, titular, titularKey]);

  const limparFormulario = () => {
    setOpen(false);
    setKitEditando(null);
    setNome('');
    setComponentes({});
    setChaveIdempotencia(null);
    setError('');
  };

  const fecharFormulario = () => {
    if (saving) return;
    limparFormulario();
  };

  const iniciarNovo = () => {
    if (saving) return;
    setKitEditando(null);
    setNome('');
    setComponentes({});
    setChaveIdempotencia(null);
    setError('');
    setOpen(true);
  };

  const iniciarEdicao = (kit: KitDaLista) => {
    if (saving) return;
    setKitEditando(kit);
    setNome(kit.nome);
    setComponentes(Object.fromEntries(kit.componentes.map((componente) => [componente.itemId, componente.quantidade])));
    setChaveIdempotencia(null);
    setError('');
    setOpen(true);
  };

  const alterarFormulario = (alterar: () => void) => {
    if (saving) return;
    alterar();
    setChaveIdempotencia(null);
  };

  const alternarComponente = (itemId: string) => alterarFormulario(() => {
    setComponentes((atuais) => {
      if (itemId in atuais) return Object.fromEntries(Object.entries(atuais).filter(([id]) => id !== itemId));
      return { ...atuais, [itemId]: '1' };
    });
  });

  const salvar = async () => {
    if (!formularioValido || saving) return;
    setSaving(true);
    setError('');
    const chave = chaveIdempotencia ?? crypto.randomUUID();
    setChaveIdempotencia(chave);
    const componentesDoFormulario = componentesSelecionados.map(([itemId, quantidadeBase]) => ({ itemId, quantidadeBase }));
    try {
      const result = kitEditando
        ? await editarKit({ clinicaIdEsperada: clinicaId, chaveIdempotencia: chave, kitId: kitEditando.kitId, versaoEsperada: kitEditando.versao, nome, componentes: componentesDoFormulario })
        : await cadastrarKit({ clinicaIdEsperada: clinicaId, chaveIdempotencia: chave, titular, nome, componentes: componentesDoFormulario });
      if (!result.ok) {
        setError(result.mensagem);
        return;
      }
      limparFormulario();
      await load();
    } catch {
      setError('Não foi possível salvar o kit. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="mt-6 rounded-2xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-heading text-xl text-foreground">Kits de materiais</h3><p className="mt-1 text-sm text-muted-foreground">Monte uma composição reutilizável; o uso na ficha continua revisável.</p></div>
      <Button variant="outline" className="min-h-11" disabled={saving} onClick={iniciarNovo}><PackagePlus className="size-4" /> Novo kit</Button>
    </div>
    {open && <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-medium text-foreground">{kitEditando ? `Editar ${kitEditando.nome} · v${kitEditando.versao}` : 'Novo kit'}</p>
      <label className="mt-3 block text-sm font-medium">Nome do kit<Input className="mt-2 min-h-11" value={nome} disabled={saving} onChange={(event) => alterarFormulario(() => setNome(event.target.value))} maxLength={120} /></label>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materiais</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{itens.filter((item) => item.ativo).map((item) => {
        const selecionado = item.id in componentes;
        return <div key={item.id} className="rounded-lg border border-border px-3 py-2 text-sm">
          <label className="flex min-h-8 items-center gap-2"><input type="checkbox" checked={selecionado} disabled={saving} onChange={() => alternarComponente(item.id)} /><span>{item.nome}</span></label>
          {selecionado ? <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span>Quantidade</span><Input aria-label={`Quantidade de ${item.nome}`} className="h-9 font-mono text-sm" inputMode="decimal" value={componentes[item.id] ?? ''} disabled={saving} onChange={(event) => alterarFormulario(() => setComponentes((atuais) => ({ ...atuais, [item.id]: event.target.value })))} /><span>{item.unidadeBase}</span></label> : null}
        </div>;
      })}</div>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={fecharFormulario}>Cancelar</Button><Button disabled={!formularioValido || saving} onClick={() => void salvar()}>{saving ? 'Salvando…' : kitEditando ? 'Salvar versão' : 'Salvar kit'}</Button></div>
    </div>}
    <div className="mt-4 grid gap-2">{kits?.kits.map((kit) => <div key={kit.kitId} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"><span className="min-w-0 truncate font-medium">{kit.nome}</span><span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">v{kit.versao} · {kit.componentes.length} materiais</span><Button variant="ghost" size="sm" className="min-h-9 shrink-0 px-2 text-xs" disabled={saving} onClick={() => iniciarEdicao(kit)}><Pencil className="size-3" /> Editar</Button></div>)}</div>
  </section>;
}
