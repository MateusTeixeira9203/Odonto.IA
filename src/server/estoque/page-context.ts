import { getMemberContext } from '@/server/auth/member-context';
import { getStockAccessContext } from './access';

export async function getStockPageContext() {
  const member = await getMemberContext();
  if (!member.ok) return member;
  return getStockAccessContext({ clinicaIdEsperada: member.data.clinicaId });
}
