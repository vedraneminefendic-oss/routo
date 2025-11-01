import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ROTSummaryProps {
  workCost: number;
  materialCost: number;
  rotEligibleAmount: number;
  deductionType: 'rot' | 'rut' | 'none';
  deductionPercentage?: number;
  totalWithVAT: number;
}

export function ROTSummary({
  workCost,
  materialCost,
  rotEligibleAmount,
  deductionType,
  deductionPercentage = 50,
  totalWithVAT,
}: ROTSummaryProps) {
  if (deductionType === 'none' || rotEligibleAmount === 0) {
    return null;
  }

  const deductionAmount = Math.round(rotEligibleAmount * (deductionPercentage / 100));
  const finalPrice = totalWithVAT - deductionAmount;
  const deductionLabel = deductionType === 'rot' ? 'ROT' : 'RUT';

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-base px-3 py-1">
            {deductionLabel}-avdrag
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-sm">
                  {deductionType === 'rot' 
                    ? 'ROT-avdrag ges för reparation, ombyggnad och tillbyggnad av permanentbostad. Endast arbetskostnaden är avdragsgill.'
                    : 'RUT-avdrag ges för hushållsnära tjänster som städning, trädgårdsskötsel och flyttjänster. Endast arbetskostnaden är avdragsgill.'
                  }
                </p>
                <p className="text-xs mt-2 text-muted-foreground">
                  Källa: Skatteverkets regler för {deductionLabel}-avdrag 2025
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Arbetskostnad ({deductionLabel}-berättigad):</span>
            <span className="font-semibold">{rotEligibleAmount.toLocaleString('sv-SE')} kr</span>
          </div>
          
          {materialCost > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Materialkostnad (ej avdragsgill):</span>
              <span className="font-semibold">{materialCost.toLocaleString('sv-SE')} kr</span>
            </div>
          )}

          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between text-base font-bold text-primary">
              <span>{deductionLabel}-avdrag ({deductionPercentage}%):</span>
              <span>-{deductionAmount.toLocaleString('sv-SE')} kr</span>
            </div>
          </div>

          <div className="border-t-2 border-primary/30 pt-3 mt-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-muted-foreground">Du betalar efter {deductionLabel}-avdrag:</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  (Totalt {totalWithVAT.toLocaleString('sv-SE')} kr - {deductionAmount.toLocaleString('sv-SE')} kr)
                </div>
              </div>
              <div className="text-2xl font-bold text-primary">
                {finalPrice.toLocaleString('sv-SE')} kr
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/30 rounded-lg">
          <p className="font-semibold mb-1">📋 Viktigt att veta:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Max avdrag: 75 000 kr per person och år</li>
            <li>Avdraget görs automatiskt via Skatteverket när fakturan betalas</li>
            <li>Vi rapporterar arbetet elektroniskt till Skatteverket</li>
            <li>Endast arbetskostnaden är avdragsgill, inte material</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
