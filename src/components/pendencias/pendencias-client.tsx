'use client';
import { listarContatos, operarContato, salvarModeloContato, agendarContato } from '@/app/dashboard/pendencias/actions';
import { PendenciasWorkspace, type PendenciasTransport } from './pendencias-workspace';
const transport: PendenciasTransport = { listar: listarContatos, operar: operarContato, modelo: salvarModeloContato, agendar: agendarContato };
export function PendenciasClient({ clinicaId }: { clinicaId: string }) {
  return <PendenciasWorkspace key={clinicaId} clinicaId={clinicaId} transport={transport} />;
}
