import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export function HelpTooltip({ content, className }: HelpTooltipProps): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger aria-label="Mais informações" className="inline-flex h-11 w-11 -my-3.5 items-center justify-center cursor-help bg-transparent border-0 p-0">
          <HelpCircle className={`h-4 w-4 text-text-secondary ${className ?? ''}`} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
