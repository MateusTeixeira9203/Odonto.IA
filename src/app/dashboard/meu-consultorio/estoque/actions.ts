'use server';

import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
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

function unavailable<TData>(): EstoqueResult<TData> {
  return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Esta área não está disponível.' };
}

export async function cadastrarItem(input: unknown): Promise<EstoqueResult<CadastroItemResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return cadastrarItemOperation(input);
}

export async function editarItem(input: unknown): Promise<EstoqueResult<CadastroItemResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return editarItemOperation(input);
}

export async function receberMaterial(input: unknown): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return receberMaterialOperation(input);
}

export async function consumirMaterial(input: unknown): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return consumirMaterialOperation(input);
}

export async function descartarMaterial(input: unknown): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return descartarMaterialOperation(input);
}

export async function ajustarContagem(input: unknown): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return ajustarContagemOperation(input);
}

export async function corrigirMovimento(
  input: unknown,
): Promise<EstoqueResult<CorrecaoMovimentoResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return corrigirMovimentoOperation(input);
}

function unavailableUsage<TData>(): KitUsageResult<TData> {
  return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Esta área não está disponível.' };
}

export async function cadastrarKit(input: unknown): Promise<KitUsageResult<KitResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailableUsage();
  return cadastrarKitOperation(input);
}

export async function declararUsos(input: unknown): Promise<KitUsageResult<UsosResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailableUsage();
  return declararUsosOperation(input);
}

export async function confirmarUsos(input: unknown): Promise<KitUsageResult<UsosResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailableUsage();
  return confirmarUsosOperation(input);
}

export async function corrigirUso(input: unknown): Promise<KitUsageResult<CorrecaoUsoResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailableUsage();
  return corrigirUsoOperation(input);
}

export async function listarKits(input: unknown): Promise<KitUsageResult<KitsResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailableUsage();
  return listarKitsOperation(input);
}

export async function listarUsosDaFicha(input: unknown): Promise<KitUsageResult<UsosListResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailableUsage();
  return listarUsosDaFichaOperation(input);
}

export async function previsualizarConfirmacaoUsos(input: unknown): Promise<KitUsageResult<PrevisualizacaoConfirmacaoUsosResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailableUsage();
  return previsualizarConfirmacaoUsosOperation(input);
}

export async function listarEstoque(input: unknown): Promise<EstoqueResult<ListarEstoqueResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return listarEstoqueOperation(input);
}

export async function detalharEstoque(input: unknown): Promise<EstoqueResult<DetalharEstoqueResultData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return detalharEstoqueOperation(input);
}
