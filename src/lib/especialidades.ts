import { z } from 'zod';

/** Fonte única da lista de especialidades — perfil e onboarding importam daqui, não duplicam. */
export const ESPECIALIDADES = [
  'Clínico Geral',
  'Ortodontia',
  'Endodontia',
  'Implantodontia',
  'Periodontia',
  'Odontopediatria',
  'Cirurgia',
  'Outro',
] as const;

export type Especialidade = typeof ESPECIALIDADES[number];

export const especialidadesSchema = z
  .array(z.enum(ESPECIALIDADES))
  .min(1, 'Selecione ao menos uma especialidade');

/** Junta especialidades pra exibição em texto (ex: lista do bot de WhatsApp). */
export const formatEspecialidades = (esp: string[] | null | undefined): string =>
  esp && esp.length > 0 ? esp.join(', ') : 'Clínico Geral';
