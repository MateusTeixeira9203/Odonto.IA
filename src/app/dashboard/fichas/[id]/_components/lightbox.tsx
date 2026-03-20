"use client";

import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

interface LightboxItem {
  id: string;
  nome_original: string;
}

interface LightboxProps {
  open: boolean;
  onClose: () => void;
  items: LightboxItem[];
  index: number;
  onIndexChange: (i: number) => void;
  signedUrls: Record<string, string>;
  maxWidth?: "max-w-4xl" | "max-w-5xl";
}

export function Lightbox({
  open,
  onClose,
  items,
  index,
  onIndexChange,
  signedUrls,
  maxWidth = "max-w-4xl",
}: LightboxProps): React.JSX.Element | null {
  if (!open || !items[index]) return null;

  const item = items[index];
  const src = signedUrls[item.id];

  function anterior(): void {
    onIndexChange(index > 0 ? index - 1 : items.length - 1);
  }

  function proximo(): void {
    onIndexChange(index < items.length - 1 ? index + 1 : 0);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className={`relative max-h-full ${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute -right-3 -top-3 z-10 flex size-7 items-center justify-center rounded-full bg-white text-brand-black shadow"
          onClick={onClose}
        >
          <X size={14} />
        </button>

        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.nome_original}
            className="max-h-[90vh] max-w-full rounded object-contain"
          />
        ) : (
          <div className="flex h-64 w-96 items-center justify-center rounded bg-zinc-800">
            <ImageIcon className="size-12 text-zinc-500" />
          </div>
        )}

        <p className="mt-2 text-center font-mono text-xs text-white/50">
          {item.nome_original}
          {items.length > 1 && ` · ${index + 1} / ${items.length}`}
        </p>

        {items.length > 1 && (
          <>
            <button
              className="absolute -left-12 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
              onClick={anterior}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="absolute -right-12 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
              onClick={proximo}
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
