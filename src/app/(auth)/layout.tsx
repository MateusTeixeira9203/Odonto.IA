import { NeuralBackground } from "@/components/layout/NeuralBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen bg-bg"
      style={{
        "--color-bg": "#f5f3ef",
        "--color-surface": "#ffffff",
        "--color-surface-alt": "#eceae4",
        "--color-border": "#d4d1ca",
        "--color-text-primary": "#0d0d0d",
        "--color-text-secondary": "#8a8a8a",
        "--color-text-muted": "#d9d9d9",
        "--color-teal-pale": "#e4f4f1",
      } as React.CSSProperties}
    >
      <NeuralBackground />
      {children}
    </div>
  );
}
