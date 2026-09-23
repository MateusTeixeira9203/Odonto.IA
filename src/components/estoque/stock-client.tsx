'use client';

import type { StockAccessContext } from '@/server/estoque/access';
import * as actions from '@/app/dashboard/meu-consultorio/estoque/actions';
import { loadStockContext } from '@/app/estoque/context-action';
import { StockWorkspace } from './stock-workspace';

const ports = { ...actions, contexto: loadStockContext };
export function StockClient({ context }: { context: StockAccessContext }) {
  return <StockWorkspace key={context.clinicaId} initialContext={context} ports={ports} />;
}
