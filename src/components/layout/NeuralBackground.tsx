'use client';

import { useEffect, useState } from 'react';

type NodeData = {
  id: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  lineDurations: number[];
  lineDelays: number[];
};

export function NeuralBackground({ opacity = 1 }: { opacity?: number }) {
  const [nodes, setNodes] = useState<NodeData[]>([]);

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
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 bg-bg">
      {/* bg-bg is always 100% — opacity only dims the decorative layer */}
      <div className="absolute inset-0" style={opacity !== 1 ? { opacity } : undefined}>
      <style>{`
        @keyframes neural-fade {
          0%, 100% { opacity: 0.15; }
          50%       { opacity: 0.75; }
        }
        @keyframes neural-pulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1.0; }
        }
      `}</style>

      {/* Glow radial — mais visível em light e dark */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal/15 via-bg/60 to-bg" />

      <svg className="absolute inset-0 w-full h-full opacity-60">
        {nodes.map((node, i) => {
          const connections = [
            nodes[(i + 1) % nodes.length],
            nodes[(i + 2) % nodes.length],
          ];

          return (
            <g key={node.id}>
              {connections.map((target, j) => (
                <line
                  key={`${node.id}-${target.id}-${j}`}
                  x1={`${node.x}%`}
                  y1={`${node.y}%`}
                  x2={`${target.x}%`}
                  y2={`${target.y}%`}
                  stroke="var(--color-teal)"
                  strokeWidth="0.8"
                  style={{
                    animation: `neural-fade ${node.lineDurations[j]}s ${node.lineDelays[j]}s infinite ease-in-out`,
                    opacity: 0.15,
                  }}
                />
              ))}
              <circle
                cx={`${node.x}%`}
                cy={`${node.y}%`}
                r="2"
                fill="var(--color-teal)"
                style={{
                  animation: `neural-pulse ${node.duration}s ${node.delay}s infinite ease-in-out`,
                  opacity: 0.4,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Dot grid — multiply no light (escurece teal no fundo claro), screen no dark (clareia no fundo escuro) */}
      <div className="absolute inset-0 bg-neural-pattern opacity-60 mix-blend-multiply dark:mix-blend-screen dark:opacity-40" />
      </div>{/* /decorative layer */}
    </div>
  );
}
