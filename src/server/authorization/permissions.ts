import type { ClinicRole } from '@/server/auth/clinic';

export type Module =
  | 'dashboard'
  | 'pacientes'
  | 'agenda'
  | 'prontuarios_view'
  | 'prontuarios_edit'
  | 'ia_clinica'
  | 'orcamentos'
  | 'whatsapp'
  | 'whatsapp_config'
  | 'financeiro'
  | 'configuracoes'
  | 'equipe'
  | 'convites';

const PERMISSIONS: Record<Module, readonly ClinicRole[]> = {
  dashboard:        ['admin', 'dentista', 'secretaria'],
  pacientes:        ['admin', 'dentista', 'secretaria'],
  agenda:           ['admin', 'dentista', 'secretaria'],
  prontuarios_view: ['admin', 'dentista', 'secretaria'],
  prontuarios_edit: ['admin', 'dentista'],
  ia_clinica:       ['admin', 'dentista'],
  orcamentos:       ['admin', 'dentista', 'secretaria'],
  whatsapp:         ['admin', 'dentista', 'secretaria'],
  whatsapp_config:  ['admin', 'secretaria'],
  financeiro:       ['admin', 'dentista', 'secretaria'],
  configuracoes:    ['admin', 'dentista'],
  equipe:           ['admin'],
  convites:         ['admin'],
};

export function canAccess(role: ClinicRole, module: Module): boolean {
  return (PERMISSIONS[module] as readonly string[]).includes(role);
}
