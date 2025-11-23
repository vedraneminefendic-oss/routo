import { Info, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ROTSummaryProps {
  summary: {
    workCost?: number;
    materialCost?: number;
    rotRutDeduction?: number;
    totalWithVAT?: number;
    customerPays?: number;
  };
  deductionType: 'rot' | 'rut' | 'none';
}

export function ROTSummary({ summary, deductionType }: ROTSummaryProps) {
  if (deductionType === 'none') return null;

  const rotRutDeduction = summary.rotRutDeduction || 0;
  const totalWithVAT = summary.totalWithVAT || 0;
  const customerPays = summary.customerPays || 0;

  const percentage = deductionType === 'rot' ? 30 : 50; // OBS: Backend styr detta, detta är bara label
  const label = deductionType === 'rot' ? 'ROT-avdrag' : 'RUT-avdrag';
  const colorClass = deductionType === 'rot' ? 'blue' : 'green';
  // Tailwind safe-list för dynamiska klasser: 
  // bg-blue-50 bg-green-50 border-blue-100 border-green-100 text-blue-900 text-green-900 ...

  // Hämta färger manuellt för att undvika Tailwind purge-problem med dynamiska strängar
  const theme = deductionType === 'rot' ? {
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    textDark: 'text-blue-900',
    textMed: 'text-blue-700',
    icon: 'text-blue-600/70',
    badge: 'bg-blue-600'
  } : {
    bg: 'bg-green-50',
    border: 'border-green-100',
    textDark: 'text-green-900',
    textMed: 'text-green-700',
    icon: 'text-green-600/70',
    badge: 'bg-green-600'
  };
  
  const maxAmount = deductionType === 'rot' ? 50000 : 75000;

  return (
    <div className="relative mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className={`${theme.bg} px-4 py-2 border-b ${theme.border} flex justify-between items-center`}>
        <div className="flex items-center gap-2">
           <span className={`flex h-5 w-5 items-center justify-center rounded-full ${theme.badge} text-[10px] font-bold text-white`}>%</span>
           <span className={`text-sm font-semibold ${theme.textDark}`}>Skatteavdrag applicerat</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className={`w-4 h-4 ${theme.icon} cursor-help`} />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Dras direkt på fakturan. Gäller endast arbetskostnad. Max {maxAmount.toLocaleString()} kr per person/år.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="p-5">
        {/* Prisjämförelse */}
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="text-slate-500">Pris före avdrag</span>
          <span className="text-slate-400 line-through decoration-red-400 decoration-2">
            {Math.round(totalWithVAT).toLocaleString()} kr
          </span>
        </div>

        <div className={`flex items-center justify-between mb-4 text-sm ${theme.bg} bg-opacity-50 p-2 rounded-lg border border-dashed ${theme.border}`}>
          <span className={`flex items-center gap-2 font-medium ${theme.textMed}`}>
            <Check className="w-3 h-3" /> {label}
          </span>
          <span className={`font-bold ${theme.textMed}`}>
            -{Math.round(rotRutDeduction).toLocaleString()} kr
          </span>
        </div>

        <div className="flex items-end justify-between border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Att betala</div>
          <div className="text-3xl font-bold text-slate-900">
            {Math.round(customerPays).toLocaleString()} <span className="text-sm font-normal text-slate-500">kr</span>
          </div>
        </div>
      </div>
      
      {/* Footer Disclaimer */}
      <div className="bg-slate-50 px-4 py-2 text-[10px] text-center text-slate-400">
        * Gäller under förutsättning att du har skatteutrymme kvar hos Skatteverket.
      </div>
    </div>
  );
}
