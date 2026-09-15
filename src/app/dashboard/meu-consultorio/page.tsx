import { redirect } from 'next/navigation';
import { requirePersonalConsultorio } from '@/server/auth/personal-consultorio';

export default async function MeuConsultorioPage() {
  await requirePersonalConsultorio();
  redirect('/dashboard/meu-consultorio/financeiro');
}
