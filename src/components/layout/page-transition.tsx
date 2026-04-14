'use client';

import { motion } from 'motion/react';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Envolve o conteúdo de qualquer página com uma animação de entrada suave.
 * Usar como wrapper raiz em Server Components que entregam páginas ao usuário.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
