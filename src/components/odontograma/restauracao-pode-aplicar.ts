import type { FaceDental } from '@/types/odontograma';

export function restauracaoPodeAplicar(faces: readonly FaceDental[], variante?: 'meu-dia'): boolean {
  return variante !== 'meu-dia' || faces.length > 0;
}