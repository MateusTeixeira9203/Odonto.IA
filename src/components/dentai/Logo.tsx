import { DentIALogo } from '@/components/ui/dent-ia-logo';

export function LogoMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center shadow-sm text-white">
        <DentIALogo className="w-4 h-4" />
      </div>
      <span className="font-heading text-lg text-black dark:text-white">Dent <em className="italic font-serif">IA</em></span>
    </div>
  );
}
