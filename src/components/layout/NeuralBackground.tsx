'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

export function NeuralBackground({ opacity = 1 }: { opacity?: number }) {
  const [nodes, setNodes] = useState<{
    id: number;
    x: number;
    y: number;
    duration: number;
    delay: number;
    lineDurations: number[];
    lineDelays: number[];
  }[]>([]);

  useEffect(() => {
    const newNodes = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: 3 + Math.random() * 2,
      delay: Math.random() * 5,
      lineDurations: [10 + Math.random() * 10, 10 + Math.random() * 10],
      lineDelays: [Math.random() * 5, Math.random() * 5],
    }));

    const frame = requestAnimationFrame(() => { setNodes(newNodes); });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (nodes.length === 0) return <div className="absolute inset-0 bg-bg -z-10" />;

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none -z-10 bg-bg"
      style={opacity !== 1 ? { opacity } : undefined}
    >
      {/* Gradiente radial suave */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal/5 via-bg/80 to-bg" />

      {/* Rede neural animada */}
      <svg className="absolute inset-0 w-full h-full opacity-30">
        {nodes.map((node, i) => {
          const connections = [
            nodes[(i + 1) % nodes.length],
            nodes[(i + 2) % nodes.length],
          ];

          return (
            <g key={node.id}>
              {connections.map((target, j) => (
                <motion.line
                  key={`${node.id}-${target.id}-${j}`}
                  x1={`${node.x}%`}
                  y1={`${node.y}%`}
                  x2={`${target.x}%`}
                  y2={`${target.y}%`}
                  stroke="var(--color-teal)"
                  strokeWidth="0.5"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: [0, 1, 1, 0], opacity: [0, 0.5, 0.5, 0] }}
                  transition={{
                    duration: node.lineDurations[j],
                    repeat: Infinity,
                    ease: 'linear',
                    delay: node.lineDelays[j],
                  }}
                />
              ))}
              <motion.circle
                cx={`${node.x}%`}
                cy={`${node.y}%`}
                r="1.5"
                fill="var(--color-teal)"
                initial={{ opacity: 0.2 }}
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: node.duration, repeat: Infinity, ease: 'easeInOut' }}
              />
            </g>
          );
        })}
      </svg>

      {/* Textura de padrão neural */}
      <div className="absolute inset-0 bg-neural-pattern opacity-50 mix-blend-multiply" />
    </div>
  );
}
