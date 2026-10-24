'use client';

import { useState } from 'react';
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
    <details className="border-t border-border pt-3 text-foreground">
      <summary className="min-h-10 cursor-pointer py-2.5 text-xs font-medium text-text-secondary">Agrupar procedimentos com preço fechado</summary>
      <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
        <p className="text-xs text-muted-foreground">Selecione os procedimentos incluídos e informe o valor do conjunto. Não é necessário preencher o preço de cada um.</p>
        {candidatos.length < 2 && <p className="text-xs text-muted-foreground">São necessários dois procedimentos já registrados na Ficha. Para itens novos, registre-os na Ficha antes de agrupar.</p>}
        <div className="max-h-56 overflow-y-auto">
          {candidatos.map((item, index) => <label key={item.eventoIds?.join(',') ?? index} className="flex min-h-11 items-start gap-3 py-2 text-[13px]">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={selecionados.includes(item)} onChange={(event) => setSelecionados((atual) => event.target.checked ? [...atual, item] : atual.filter((membro) => membro !== item))} />
            <span>{item.quantidade} × {item.descricao}</span>
          </label>)}
        </div>
        <label className="block space-y-1 text-xs text-text-secondary">Nome do grupo<Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Arcada superior" maxLength={120} className="h-10 rounded-none border-0 border-b border-border bg-transparent px-0 shadow-none" /></label>
        <label className="block space-y-1 text-xs text-text-secondary">Valor fechado do grupo (R$)<Input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="15.000,00" className="h-10 rounded-none border-0 border-b border-border bg-transparent px-0 shadow-none" /></label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button variant="outline" type="button" onClick={agrupar} disabled={candidatos.length < 2} className="h-10 rounded-[8px] border-border bg-transparent text-text-secondary hover:bg-surface-alt">Criar grupo</Button>
      </fieldset>
    </details>
  );
}
