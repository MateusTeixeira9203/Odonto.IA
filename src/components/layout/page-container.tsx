import type { ReactNode } from 'react';

// Spec #18 — largura central compartilhada. Substitui as ~15 cópias soltas de
// `p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full` por um único lugar que controla
// largura + padding. `wide` é pra telas densas que ganham coluna/conteúdo (L4);
// nunca usar `wide` só pra esticar vazio.
const VARIANT_CLASS = {
  wide: 'max-w-screen-2xl',
  comfortable: 'max-w-7xl',
} as const;

interface PageContainerProps {
  variant?: keyof typeof VARIANT_CLASS;
  className?: string;
  children: ReactNode;
}

export function PageContainer({ variant = 'comfortable', className = '', children }: PageContainerProps) {
  return (
    <div className={`p-4 sm:p-6 lg:p-8 mx-auto w-full ${VARIANT_CLASS[variant]} ${className}`.trim()}>
      {children}
    </div>
  );
}
