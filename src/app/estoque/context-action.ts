'use server';

import { getStockAccessContext } from '@/server/estoque/access';

export async function loadStockContext(input: unknown) {
  return getStockAccessContext(input);
}
