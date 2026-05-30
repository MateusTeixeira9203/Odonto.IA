import { redirect } from 'next/navigation';
import { requireClinicContext, type ClinicContext } from '@/server/auth/clinic';
import { canAccess, type Module } from './permissions';
import { getFinanceScope, type FinanceScope } from './finance';

export async function requirePermission(module: Module): Promise<ClinicContext> {
  const ctx = await requireClinicContext();
  if (!canAccess(ctx.role, module)) {
    redirect('/dashboard');
  }
  return ctx;
}

export async function requireFinanceScope(): Promise<ClinicContext & { scope: FinanceScope }> {
  const ctx = await requirePermission('financeiro');
  return { ...ctx, scope: getFinanceScope(ctx.role) };
}
