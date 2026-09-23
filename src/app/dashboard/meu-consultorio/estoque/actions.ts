'use server';

import {
  ajustarContagem as ajustarContagemOperation,
  cadastrarItem as cadastrarItemOperation,
  consumirMaterial as consumirMaterialOperation,
  corrigirMovimento as corrigirMovimentoOperation,
  descartarMaterial as descartarMaterialOperation,
  detalharEstoque as detalharEstoqueOperation,
  editarItem as editarItemOperation,
  listarEstoque as listarEstoqueOperation,
  receberMaterial as receberMaterialOperation,
} from '@/server/estoque/operations';
import type {
  CorrecaoUsoResultData,
  KitResultData,
  KitUsageResult,
  KitsResultData,
  UsosResultData,
  UsosListResultData,
  PrevisualizacaoConfirmacaoUsosResultData,
} from '@/server/estoque/kit-usage-contracts';
import {
  cadastrarKit as cadastrarKitOperation,
  editarKit as editarKitOperation,
  confirmarUsos as confirmarUsosOperation,
  corrigirUso as corrigirUsoOperation,
  declararUsos as declararUsosOperation,
  listarKits as listarKitsOperation,
  listarUsosDaFicha as listarUsosDaFichaOperation,
  previsualizarConfirmacaoUsos as previsualizarConfirmacaoUsosOperation,
} from '@/server/estoque/kit-usage-operations';
import type {
  CadastroItemResultData,
  CorrecaoMovimentoResultData,
  DetalharEstoqueResultData,
  EstoqueResult,
  ListarEstoqueResultData,
  MutacaoEstoqueResultData,
} from '@/server/estoque/contracts';

export async function cadastrarItem(input: unknown): Promise<EstoqueResult<CadastroItemResultData>> {
  return cadastrarItemOperation(input);
}

export async function editarItem(input: unknown): Promise<EstoqueResult<CadastroItemResultData>> {
  return editarItemOperation(input);
}

export async function receberMaterial(input: unknown): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  return receberMaterialOperation(input);
}

export async function consumirMaterial(input: unknown): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  return consumirMaterialOperation(input);
}

export async function descartarMaterial(input: unknown): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  return descartarMaterialOperation(input);
}

export async function ajustarContagem(input: unknown): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  return ajustarContagemOperation(input);
}

export async function corrigirMovimento(
  input: unknown,
): Promise<EstoqueResult<CorrecaoMovimentoResultData>> {
  return corrigirMovimentoOperation(input);
}

export async function cadastrarKit(input: unknown): Promise<KitUsageResult<KitResultData>> {
  return cadastrarKitOperation(input);
}

export async function editarKit(input: unknown): Promise<KitUsageResult<KitResultData>> {
  return editarKitOperation(input);
}

export async function declararUsos(input: unknown): Promise<KitUsageResult<UsosResultData>> {
  return declararUsosOperation(input);
}

export async function confirmarUsos(input: unknown): Promise<KitUsageResult<UsosResultData>> {
  return confirmarUsosOperation(input);
}

export async function corrigirUso(input: unknown): Promise<KitUsageResult<CorrecaoUsoResultData>> {
  return corrigirUsoOperation(input);
}

export async function listarKits(input: unknown): Promise<KitUsageResult<KitsResultData>> {
  return listarKitsOperation(input);
}

export async function listarUsosDaFicha(input: unknown): Promise<KitUsageResult<UsosListResultData>> {
  return listarUsosDaFichaOperation(input);
}

export async function previsualizarConfirmacaoUsos(input: unknown): Promise<KitUsageResult<PrevisualizacaoConfirmacaoUsosResultData>> {
  return previsualizarConfirmacaoUsosOperation(input);
}

export async function listarEstoque(input: unknown): Promise<EstoqueResult<ListarEstoqueResultData>> {
  return listarEstoqueOperation(input);
}

export async function detalharEstoque(input: unknown): Promise<EstoqueResult<DetalharEstoqueResultData>> {
  return detalharEstoqueOperation(input);
}
