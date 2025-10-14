import { Badge } from "@/components/ui/badge";
import { Sparkles, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIInsightBadgeProps {
  deductionType?: 'rot' | 'rut' | 'none';
  hasCustomRates?: boolean;
  hourlyRate?: number;
}

export function AIInsightBadge({ deductionType, hasCustomRates, hourlyRate }: AIInsightBadgeProps) {
  const getDeductionInfo = () => {
    if (deductionType === 'rot') {
      return {
        label: 'ROT-avdrag',
        description: 'AI:n har identifierat detta som ROT-berättigat arbete (Renovering, Ombyggnad, Tillbyggnad). Kunden får 50% avdrag på arbetskostnaden.',
        color: 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-700',
      };
    }
    if (deductionType === 'rut') {
      return {
        label: 'RUT-avdrag',
        description: 'AI:n har identifierat detta som RUT-berättigat arbete (Rengöring, Underhåll, Tvätt). Kunden får 50% avdrag på arbetskostnaden.',
        color: 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 border-green-300 dark:border-green-700',
      };
    }
    return null;
  };

  const deductionInfo = getDeductionInfo();

  return (
    <div className="flex flex-wrap gap-2">
      {deductionInfo && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={deductionInfo.color}>
                <Sparkles className="h-3 w-3 mr-1" />
                {deductionInfo.label}
                <Info className="h-3 w-3 ml-1" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{deductionInfo.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {hasCustomRates !== undefined && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                <Sparkles className="h-3 w-3 mr-1" />
                {hasCustomRates ? 'Anpassade priser' : 'Standardpriser'}
                <Info className="h-3 w-3 ml-1" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                {hasCustomRates
                  ? `Offerten använder dina anpassade timpriser från inställningarna (${hourlyRate} kr/h).`
                  : `Offerten använder standardpris (650 kr/h). Du kan anpassa timpriserna i Inställningar → Timpriser.`}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
