'use client';

import { useState, useRef, useEffect } from 'react';

interface DateInputDMYProps {
  /** ISO date string: YYYY-MM-DD ou '' */
  value: string;
  onChange: (iso: string) => void;
  id?: string;
}

export function DateInputDMY({ value, onChange, id }: DateInputDMYProps) {
  const [dia, setDia]   = useState('');
  const [mes, setMes]   = useState('');
  const [ano, setAno]   = useState('');

  const diaRef = useRef<HTMLInputElement>(null);
  const mesRef = useRef<HTMLInputElement>(null);
  const anoRef = useRef<HTMLInputElement>(null);

  // Sincroniza prop → estado interno
  useEffect(() => {
    if (value && value.length === 10) {
      const [y, m, d] = value.split('-');
      setDia(d ?? '');
      setMes(m ?? '');
      setAno(y ?? '');
    } else if (!value) {
      setDia(''); setMes(''); setAno('');
    }
  }, [value]);

  function emit(d: string, m: string, y: string) {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      onChange(`${y}-${m}-${d}`);
    } else if (!d && !m && !y) {
      onChange('');
    }
  }

  function handleDia(raw: string) {
    const v = raw.replace(/\D/g, '').slice(0, 2);
    setDia(v);
    emit(v, mes, ano);
    if (v.length === 2) mesRef.current?.focus();
  }

  function handleMes(raw: string) {
    const v = raw.replace(/\D/g, '').slice(0, 2);
    setMes(v);
    emit(dia, v, ano);
    if (v.length === 2) anoRef.current?.focus();
  }

  function handleAno(raw: string) {
    const v = raw.replace(/\D/g, '').slice(0, 4);
    setAno(v);
    emit(dia, mes, v);
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'mes' | 'ano',
    currentVal: string,
  ) {
    if (e.key === 'Backspace' && currentVal === '') {
      if (field === 'mes') diaRef.current?.focus();
      if (field === 'ano') mesRef.current?.focus();
    }
  }

  const cell = [
    'bg-transparent outline-none text-center font-mono text-sm',
    'text-text-primary placeholder:text-text-muted tabular-nums',
  ].join(' ');

  return (
    <div
      className={[
        'flex items-center bg-surface-alt border border-border rounded-xl',
        'px-4 py-3 gap-0.5',
        'focus-within:ring-2 focus-within:ring-teal/20 focus-within:border-teal/60',
        'transition-all duration-150',
      ].join(' ')}
    >
      <input
        ref={diaRef}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="DD"
        value={dia}
        maxLength={2}
        onChange={(e) => handleDia(e.target.value)}
        className={`${cell} w-7`}
      />
      <span className="text-text-muted/60 font-mono text-sm select-none px-0.5">/</span>
      <input
        ref={mesRef}
        type="text"
        inputMode="numeric"
        placeholder="MM"
        value={mes}
        maxLength={2}
        onChange={(e) => handleMes(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, 'mes', mes)}
        className={`${cell} w-7`}
      />
      <span className="text-text-muted/60 font-mono text-sm select-none px-0.5">/</span>
      <input
        ref={anoRef}
        type="text"
        inputMode="numeric"
        placeholder="AAAA"
        value={ano}
        maxLength={4}
        onChange={(e) => handleAno(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, 'ano', ano)}
        className={`${cell} w-14`}
      />
    </div>
  );
}
