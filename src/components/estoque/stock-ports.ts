import type * as operations from '@/server/estoque/operations';
import type { StockAccessContextResult } from '@/server/estoque/access';

export type StockPorts = {
  [Key in 'cadastrarItem' | 'editarItem' | 'receberMaterial' | 'consumirMaterial'
  | 'descartarMaterial' | 'ajustarContagem' | 'corrigirMovimento' | 'listarEstoque'
  | 'detalharEstoque']: (input: unknown) => ReturnType<typeof operations[Key]>;
} & {
  contexto(input: { clinicaIdEsperada: string }): Promise<StockAccessContextResult>;
};

export type StockMutation = Exclude<keyof StockPorts, 'listarEstoque' | 'detalharEstoque' | 'contexto'>;
