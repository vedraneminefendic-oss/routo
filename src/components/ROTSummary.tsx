import { Info, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ROTSummaryProps {
  summary: {
    workCost: number;
    materialCost: number;
    rotRutDeduction: number;
    totalWithVAT: number;
    customerPays: number;
  };
  deductionType: 'rot' | 'rut' | 'none';
}

export function ROTSummary({ summary, deductionType }: ROTSummaryProps) {
  if (deductionType === 'none') return null;

  const percentage = deductionType === 'rot' ? 30 : 50;
  const label = deductionType === 'rot' ? 'ROT-avdrag' : 'RUT-avdrag';
  const colorClass = deductionType === 'rot' ? 'blue' : 'green'; // ROT blått, RUT grönt
  const maxAmount = deductionType === 'rot' ? 50000 : 75000;

  return (
    <div className="relative mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header Banner */}
      <div className={`bg-${colorClass}-50 px-4 py-2 border-b border-${colorClass}-100 flex justify-between items-center`}>
        <div className="flex items-center gap-2">
           <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-${colorClass}-600 text-[10px] font-bold text-white`}>%</span>
           <span className={`text-sm font-semibold text-${colorClass}-900`}>Skatteavdrag applicerat</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className={`w-4 h-4 text-${colorClass}-600/70`} />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Dras direkt på fakturan. Gäller endast arbetskostnad. Max {maxAmount.toLocaleString()} kr per person/år.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="p-5">
        {/* Calculation Visualization */}
        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-slate-500">Ordinarie pris</span>
          <span className="text-slate-400 line-through decoration-red-400 decoration-2">
            {Math.round(summary.totalWithVAT).toLocaleString()} kr
          </span>
        </div>

        <div className="flex items-center justify-between mb-6 text-sm bg-slate-50 p-2 rounded-lg border border-dashed border-slate-300">
          <span className={`flex items-center gap-2 font-medium text-${colorClass}-700`}>
            <Check className="w-3 h-3" /> {label} ({percentage}%)
          </span>
          <span className={`font-bold text-${colorClass}-700`}>
            -{Math.round(summary.rotRutDeduction).toLocaleString()} kr
          </span>
        </div>

        <div className="flex items-end justify-between border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            Att betala (inkl. moms)
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {Math.round(summary.customerPays).toLocaleString()} <span className="text-sm font-normal text-slate-500">kr</span>
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
