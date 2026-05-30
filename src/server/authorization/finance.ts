import type { ClinicRole } from '@/server/auth/clinic';

// Financeiro é individual por dentista.
// Admin vê apenas os próprios registros (igual ao dentista), não financeiro global.
// Secretária tem acesso operacional (pode registrar lançamentos e visualizar todos da clínica).
export type FinanceScope = 'own' | 'operational';

export function getFinanceScope(role: ClinicRole): FinanceScope {
  if (role === 'secretaria') return 'operational';
  return 'own'; // admin e dentista: escopo individual
}
