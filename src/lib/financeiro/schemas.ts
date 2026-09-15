import { z } from 'zod';
import { mesValido } from './calculos';

export const mesFinanceiroSchema = z.string().refine(mesValido, 'Mês inválido.');
export const dentistaFinanceiroSchema = z.string().uuid('Dentista inválido.');

const valor = z.number().finite().positive().multipleOf(0.01);
const data = z.string().date();
const descricao = z.string().trim().max(200).optional();
const dentistaId = z.string().uuid().optional();

export const despesaFinanceiroSchema = z.object({
  valor,
  categoria: z.string().trim().min(1).max(80),
  tipo: z.enum(['fixo', 'variavel']),
  data,
  descricao,
  dentistaId,
});

export const receitaFinanceiroSchema = z.object({
  valor,
  forma: z.enum(['pix', 'dinheiro', 'transferencia', 'outro']),
  data,
  descricao,
  dentistaId,
});
