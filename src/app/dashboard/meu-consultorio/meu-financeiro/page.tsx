import { redirect } from 'next/navigation';

/** Compatibilidade: o motor financeiro pessoal permanece intacto nesta primeira entrega. */
export default function MeuFinanceiroPage(): never { redirect('/dashboard/financeiro'); }
