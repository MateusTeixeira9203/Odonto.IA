'use server';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { obterContextoClinica, listarResultadosClinica } from '@/server/clinica/operations';
import type { ClinicaResult, ContextoClinica, ResultadosClinica } from '@/server/clinica/contracts';
export async function carregarContextoClinica(input: unknown): Promise<ClinicaResult<ContextoClinica>> {
  if (!isTeamWorkspaceEnabled()) return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Gestão indisponível.' };
  return obterContextoClinica(input);
}
export async function carregarResultadosClinica(input: unknown): Promise<ClinicaResult<ResultadosClinica>> {
  if (!isTeamWorkspaceEnabled()) return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Gestão indisponível.' };
  return listarResultadosClinica(input);
}
