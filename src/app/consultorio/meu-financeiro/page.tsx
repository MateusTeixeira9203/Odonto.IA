import { redirect } from 'next/navigation';

/** Proprietário sem atuação clínica não possui um silo financeiro pessoal. */
export default function NonClinicalPersonalFinancePage(): never { redirect('/consultorio/financeiro-clinica'); }
