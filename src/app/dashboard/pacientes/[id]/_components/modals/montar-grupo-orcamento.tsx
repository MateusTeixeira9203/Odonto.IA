'use client';

import { useState } from 'react';
import { Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { criarGrupoNaMontagem } from '@/lib/orcamentos/grupos';
import type { NovoOrcItem } from '../types';

export function MontarGrupoOrcamento({ itens, onChange, disabled }: {
  itens: NovoOrcItem[]; onChange: (itens: NovoOrcItem[]) => void; disabled: boolean;
}) {
  const [selecionados, setSelecionados] = useState<NovoOrcItem[]>([]);
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const candidatos = itens.filter((item) => !item.composicao?.length && item.eventoIds?.length && item.selecionado !== false);
  const agrupar = () => {
    const result = criarGrupoNaMontagem(itens, selecionados, nome, preco);
    if (result.erro) { setErro(result.erro); return; }
    if (!result.itens) return;
    onChange(result.itens);
    setSelecionados([]); setNome(''); setPreco(''); setErro(null);
  };
  return (
    <details className="group rounded-xl text-foreground">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-teal/35 bg-teal/5 px-3 text-sm font-semibold text-teal-ink transition-colors hover:bg-teal/10 [&::-webkit-details-marker]:hidden">
        <Layers3 className="h-4 w-4" /> Preço fechado por arcada
      </summary>
      <fieldset disabled={disabled} className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4 disabled:opacity-60">
        <p className="text-sm text-muted-foreground">Selecione os procedimentos da arcada e informe um valor único. Não é necessário precificar cada linha.</p>
        {candidatos.length < 2 && <p className="text-sm text-muted-foreground">São necessários dois procedimentos já registrados na Ficha. Para itens novos, registre-os na Ficha antes de agrupar.</p>}
        <div className="max-h-56 overflow-y-auto">
          {candidatos.map((item, index) => <label key={item.eventoIds?.join(',') ?? index} className="flex min-h-11 items-start gap-3 py-2 text-sm">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={selecionados.includes(item)} onChange={(event) => setSelecionados((atual) => event.target.checked ? [...atual, item] : atual.filter((membro) => membro !== item))} />
            <span>{item.quantidade} × {item.descricao}</span>
          </label>)}
        </div>
        <label className="block space-y-1 text-sm">Nome do grupo<Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Arcada superior" maxLength={120} className="min-h-11" /></label>
        <label className="block space-y-1 text-sm">Valor fechado do grupo (R$)<Input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="15.000,00" className="min-h-11" /></label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="button" onClick={agrupar} disabled={candidatos.length < 2} className="min-h-11">Aplicar preço fechado</Button>
      </fieldset>
    </details>
  );
}
