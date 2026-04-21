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
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none -z-10 bg-bg"
      style={opacity !== 1 ? { opacity } : undefined}
    >
      <style>{`
        @keyframes neural-fade {
          0%, 100% { opacity: 0.05; }
          50%       { opacity: 0.5;  }
        }
        @keyframes neural-pulse {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 0.8; }
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal/5 via-bg/80 to-bg" />

      <svg className="absolute inset-0 w-full h-full opacity-30">
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
                  strokeWidth="0.5"
                  style={{
                    animation: `neural-fade ${node.lineDurations[j]}s ${node.lineDelays[j]}s infinite ease-in-out`,
                    opacity: 0.05,
                  }}
                />
              ))}
              <circle
                cx={`${node.x}%`}
                cy={`${node.y}%`}
                r="1.5"
                fill="var(--color-teal)"
                style={{
                  animation: `neural-pulse ${node.duration}s ${node.delay}s infinite ease-in-out`,
                  opacity: 0.2,
                }}
              />
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 bg-neural-pattern opacity-50 mix-blend-multiply" />
    </div>
  );
}
