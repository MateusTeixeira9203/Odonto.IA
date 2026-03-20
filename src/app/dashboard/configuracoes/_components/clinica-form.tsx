'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { salvarClinica, type ClinicaFormData } from '../actions';
import type { ConfiguracaoClinica } from '@/types/database';

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'boleto', label: 'Boleto' },
];

interface Props {
  configuracao: ConfiguracaoClinica | null;
}

export function ClinicaForm({ configuracao }: Props): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  const [nomeClinica, setNomeClinica] = useState(configuracao?.nome_clinica ?? '');
  const [telefone, setTelefone] = useState(configuracao?.telefone ?? '');
  const [endereco, setEndereco] = useState(configuracao?.endereco ?? '');
  const [formasPagamento, setFormasPagamento] = useState<string[]>(
    Array.isArray(configuracao?.formas_pagamento) ? (configuracao.formas_pagamento as string[]) : []
  );
  const [aceitaConvenio, setAceitaConvenio] = useState(configuracao?.aceita_convenio ?? false);
  const [convenios, setConvenios] = useState<string[]>(
    Array.isArray(configuracao?.convenios) ? (configuracao.convenios as string[]) : []
  );
  const [novoConvenio, setNovoConvenio] = useState('');

  const inputClass =
    'w-full font-sans text-sm px-3 py-2.5 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-teal/40 transition-colors';

  function toggleForma(forma: string): void {
    setFormasPagamento((prev) =>
      prev.includes(forma) ? prev.filter((f) => f !== forma) : [...prev, forma]
    );
  }

  function adicionarConvenio(): void {
    const trim = novoConvenio.trim();
    if (!trim || convenios.includes(trim)) return;
    setConvenios((prev) => [...prev, trim]);
    setNovoConvenio('');
  }

  function removerConvenio(conv: string): void {
    setConvenios((prev) => prev.filter((c) => c !== conv));
  }

  function handleSalvar(): void {
    const data: ClinicaFormData = {
      nome_clinica: nomeClinica,
      telefone,
      endereco,
      formas_pagamento: formasPagamento,
      aceita_convenio: aceitaConvenio,
      convenios,
    };

    startTransition(async () => {
      const result = await salvarClinica(data);
      if (result.error) {
        toast.error(`Erro ao salvar: ${result.error}`);
      } else {
        toast.success('Configurações salvas!');
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="font-mono text-xs uppercase tracking-widest text-text-secondary">
            Nome da Clínica
          </label>
          <input
            className={inputClass}
            value={nomeClinica}
            onChange={(e) => setNomeClinica(e.target.value)}
            placeholder="Ex: Clínica Odonto Plus"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-xs uppercase tracking-widest text-text-secondary">
            Telefone
          </label>
          <input
            className={inputClass}
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(11) 9 9999-9999"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-xs uppercase tracking-widest text-text-secondary">
            Endereço
          </label>
          <input
            className={inputClass}
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, número, bairro, cidade"
          />
        </div>
      </div>

      {/* Formas de pagamento */}
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-3">
          Formas de Pagamento
        </p>
        <div className="flex flex-wrap gap-2">
          {FORMAS_PAGAMENTO.map((f) => (
            <label
              key={f.value}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition-colors text-sm select-none ${
                formasPagamento.includes(f.value)
                  ? 'bg-teal text-white border-teal'
                  : 'border-border text-text-secondary hover:border-teal/50 hover:text-text-primary'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={formasPagamento.includes(f.value)}
                onChange={() => toggleForma(f.value)}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* Convênios */}
      <div>
        <div className="flex items-center gap-4 mb-3">
          <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">Convênios</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer text-text-secondary">
            <input
              type="checkbox"
              checked={aceitaConvenio}
              onChange={(e) => setAceitaConvenio(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-teal cursor-pointer"
            />
            Aceita convênio
          </label>
        </div>

        {aceitaConvenio && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={novoConvenio}
                onChange={(e) => setNovoConvenio(e.target.value)}
                placeholder="Nome do convênio"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarConvenio(); } }}
              />
              <button
                type="button"
                onClick={adicionarConvenio}
                className="h-10 px-4 rounded-xl bg-surface-alt text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-border transition-colors shrink-0"
              >
                Adicionar
              </button>
            </div>

            {convenios.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {convenios.map((conv) => (
                  <span key={conv} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-alt border border-border text-sm text-text-secondary">
                    {conv}
                    <button type="button" onClick={() => removerConvenio(conv)} className="hover:text-text-primary leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleSalvar}
        className="h-10 px-6 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal-dark disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Salvando…' : 'Salvar Configurações'}
      </button>
    </div>
  );
}
