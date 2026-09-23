import { redirect } from 'next/navigation';

/** O módulo de convite existente é reutilizado enquanto a aba é portada para o hub. */
export default function MinhaEquipePage(): never { redirect('/dashboard/configuracoes?aba=clinica'); }
