'use client';

import { motion } from 'motion/react';

interface DraftPendingCardProps {
  label: string;
  children: React.ReactNode;
}

export function DraftPendingCard({ label, children }: DraftPendingCardProps) {
  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden"
      animate={{
        boxShadow: [
          '0 0 0px 0px rgba(245,158,11,0)',
          '0 0 16px 0px rgba(245,158,11,0.18)',
          '0 0 0px 0px rgba(245,158,11,0)',
        ],
      }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ border: '2px solid #f59e0b' }}
    >
      {/* Header */}
      <div
        className="px-5 pt-4 pb-2 flex items-center justify-between"
        style={{ background: 'rgba(245,158,11,0.06)' }}
      >
        <label className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          {label}
        </label>
        <motion.span
          className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider"
          style={{
            background: 'rgba(245,158,11,0.15)',
            color: '#b45309',
            border: '1px solid rgba(245,158,11,0.35)',
          }}
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          PENDENTE
        </motion.span>
      </div>

      {/* Content */}
      <div className="px-5 pb-5 pt-2 bg-surface">
        {children}
      </div>
    </motion.div>
  );
}
