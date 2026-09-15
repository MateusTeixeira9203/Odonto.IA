'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { buscarDisponibilidadeSemana } from '@/server/agenda/buscar-disponibilidade';
import type { DisponibilidadeDia } from '@/lib/agenda/disponibilidade';

export type EstadoAgendaRetorno =
  | { estado: 'sem_dentista' }
  | { estado: 'carregando'; chave: string }
  | { estado: 'pronta'; chave: string; dias: DisponibilidadeDia[] }
  | { estado: 'erro'; chave: string; mensagem: string };

export function useDisponibilidadeRetorno(
  dentistaId: string | null,
  semanaInicio: Date,
  ativo: boolean,
  sessao: number,
): EstadoAgendaRetorno {
  const semanaInicioISO = format(semanaInicio, 'yyyy-MM-dd');
  const chave = `${dentistaId ?? 'sem-dentista'}:${semanaInicioISO}:${sessao}`;
  const [estado, setEstado] = useState<EstadoAgendaRetorno>(() => (
    dentistaId ? { estado: 'carregando', chave } : { estado: 'sem_dentista' }
  ));

  useEffect(() => {
    if (!dentistaId || !ativo) return;

    let cancelado = false;
    buscarDisponibilidadeSemana(dentistaId, semanaInicioISO)
      .then((dias) => { if (!cancelado) setEstado({ estado: 'pronta', chave, dias }); })
      .catch(() => { if (!cancelado) setEstado({ estado: 'erro', chave, mensagem: 'Não foi possível carregar a agenda.' }); });
    return () => { cancelado = true; };
  }, [ativo, chave, dentistaId, semanaInicioISO]);

  return useMemo(() => {
    if (!dentistaId || !ativo) return { estado: 'sem_dentista' };
    return 'chave' in estado && estado.chave === chave ? estado : { estado: 'carregando', chave };
  }, [ativo, chave, dentistaId, estado]);
}
