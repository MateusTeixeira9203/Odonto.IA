import { z } from 'zod';
import { parseValorBR, formatValorBR } from '@/lib/valor-br';
import type { NovoOrcItem } from '@/app/dashboard/pacientes/[id]/_components/types';

export const componenteGrupoSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  quantidade: z.number().int().min(1).max(99),
  procedimentoId: z.string().uuid().nullable(),
  eventoIds: z.array(z.string().uuid()).min(1).max(100),
});
export const composicaoGrupoSchema = z.array(componenteGrupoSchema).min(2).max(100);
export type ComponenteGrupoOrcamento = z.infer<typeof componenteGrupoSchema>;
export const observacaoAcordoSchema = z.string().trim().max(2000).optional();

export function criarGrupoNaMontagem(
  itens: NovoOrcItem[], selecionados: NovoOrcItem[], nome: string, preco: string,
): { itens: NovoOrcItem[]; erro?: never } | { erro: string; itens?: never } {
  const membros = itens.filter((item) => selecionados.includes(item));
  if (membros.length < 2 || membros.length > 100) return { erro: 'Selecione de 2 a 100 procedimentos para o grupo.' };
  if (!nome.trim() || nome.trim().length > 120) return { erro: 'Informe um nome para o grupo (até 120 caracteres).' };
  const valor = parseValorBR(preco);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 99999999.99) return { erro: 'Informe um valor positivo para o grupo.' };
  if (membros.some((item) => item.composicao?.length || !item.eventoIds?.length || item.selecionado === false)) {
    return { erro: 'Agrupe procedimentos individuais já registrados na Ficha e incluídos no orçamento.' };
  }
  const eventos = membros.flatMap((item) => item.eventoIds ?? []);
  if (eventos.length > 100 || new Set(eventos).size !== eventos.length) return { erro: 'O grupo contém eventos repetidos ou mais de 100 registros.' };
  const grupo: NovoOrcItem = {
    descricao: nome.trim(), quantidade: 1, preco: formatValorBR(valor), procedimentoId: '',
    eventoIds: eventos, origem: 'evento', selecionado: true,
    composicao: membros.map((item) => ({ ...item })),
  };
  const primeiro = itens.indexOf(membros[0]);
  return { itens: itens.flatMap((item, index) => index === primeiro ? [grupo] : membros.includes(item) ? [] : [item]) };
}

export function composicaoParaSalvar(item: NovoOrcItem): ComponenteGrupoOrcamento[] | null {
  if (!item.composicao?.length) return null;
  return item.composicao.map((membro) => ({
    descricao: membro.descricao, quantidade: membro.quantidade,
    procedimentoId: membro.procedimentoId || null, eventoIds: membro.eventoIds ?? [],
  }));
}

export function descricaoComComposicao(nome: string, componentes?: ComponenteGrupoOrcamento[] | null): string {
  if (!componentes?.length) return nome;
  return `${nome} — inclui: ${componentes.map((item) => `${item.quantidade} × ${item.descricao}`).join('; ')}`;
}
