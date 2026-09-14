import { z } from 'zod';

export const snapshotProcedimentoSchema = z.object({
  procedimentoNome: z.string().nullable(),
  observacao: z.string().nullable(),
  detalhe: z.unknown().nullable(),
});
export type SnapshotProcedimento = z.infer<typeof snapshotProcedimentoSchema>;

export const editarDetalhesEventoSchema = z.object({
  eventoId: z.string().uuid(),
  detalhe: z.unknown().nullable(),
  alterarDetalhe: z.boolean(),
  observacao: z.string().trim().max(4_000).nullable(),
  alterarObservacao: z.boolean(),
  procedimentoNome: z.string().trim().min(1, 'Informe o nome do procedimento.').max(500, 'Use até 500 caracteres no nome.').optional(),
  alterarNome: z.boolean().optional(),
  original: snapshotProcedimentoSchema.optional(),
}).superRefine((valor, contexto) => {
  if (!valor.alterarDetalhe && !valor.alterarObservacao && !valor.alterarNome) {
    contexto.addIssue({ code: 'custom', message: 'Informe ao menos uma alteração.' });
  }
  if (valor.alterarNome && (!valor.procedimentoNome || !valor.original)) {
    contexto.addIssue({ code: 'custom', message: 'Revise o nome e recarregue o procedimento antes de salvar.' });
  }
});

export type EditarDetalhesEventoInput = z.infer<typeof editarDetalhesEventoSchema>;
export type EditarDetalhesEventoResult =
  | { ok: true }
  | { ok: false; error: string; atual?: SnapshotProcedimento };
