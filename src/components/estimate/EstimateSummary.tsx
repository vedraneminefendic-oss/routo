import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EstimateSummaryProps {
  subtotal: number;
  workCost?: number;
  materialCost?: number;
  vat?: number;
  totalWithVAT?: number;
  rotRutDeduction?: {
    type: 'ROT' | 'RUT';
    laborCost: number;
    deductionAmount: number;
    priceAfterDeduction: number;
    deductionRate?: number;
  };
  total: number;
}

export const EstimateSummary = ({ subtotal, workCost, materialCost, vat, totalWithVAT, rotRutDeduction, total }: EstimateSummaryProps) => {
  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Work and Material Cost Breakdown */}
          {workCost !== undefined && materialCost !== undefined && (
            <>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Arbetskostnad</span>
                <span>{workCost.toLocaleString('sv-SE')} kr</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Materialkostnad</span>
                <span>{materialCost.toLocaleString('sv-SE')} kr</span>
              </div>
              <Separator />
            </>
          )}

          {/* Subtotal */}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Summa före moms</span>
            <span className="font-medium">
              {subtotal.toLocaleString('sv-SE')} kr
            </span>
          </div>

          {/* VAT */}
          {vat !== undefined && (
            <div className="flex items-center justify-between text-muted-foreground text-sm">
              <span>Moms (25%)</span>
              <span>{vat.toLocaleString('sv-SE')} kr</span>
            </div>
          )}

          {/* Total with VAT */}
          {totalWithVAT !== undefined && (
            <>
              <div className="flex items-center justify-between font-semibold">
                <span>Totalt inkl. moms</span>
                <span>{totalWithVAT.toLocaleString('sv-SE')} kr</span>
              </div>
              <Separator />
            </>
          )}

          {/* ROT/RUT Avdrag */}
          {rotRutDeduction && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {rotRutDeduction.type}-avdrag
                  </Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          {rotRutDeduction.type === 'ROT' 
                            ? `ROT-avdrag för renovering, ombyggnad och tillbyggnad. Du får ${((rotRutDeduction.deductionRate ?? 0.50) * 100)}% rabatt på arbetskostnaden (t.o.m. 31 dec 2025: 50%, fr.o.m. 1 jan 2026: 30%), max 50 000 kr/år per person.`
                            : `RUT-avdrag för hushållsnära tjänster. Du får ${((rotRutDeduction.deductionRate ?? 0.50) * 100)}% rabatt på arbetskostnaden (t.o.m. 31 dec 2025: 50%, fr.o.m. 1 jan 2026: 30%), max 75 000 kr/år per person.`
                          }
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="pl-4 space-y-1 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Arbetskostnad</span>
                    <span>{rotRutDeduction.laborCost.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex items-center justify-between text-secondary">
                    <span>Avdrag ({((rotRutDeduction.deductionRate ?? 0.50) * 100)}%)</span>
                    <span className="font-medium">
                      -{rotRutDeduction.deductionAmount.toLocaleString('sv-SE')} kr
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Efter avdrag</span>
                    <span className="font-medium">
                      {rotRutDeduction.priceAfterDeduction.toLocaleString('sv-SE')} kr
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between text-lg font-bold">
            <span className="text-foreground">Totalt</span>
            <span className="text-primary">
              {total.toLocaleString('sv-SE')} kr
            </span>
          </div>

          {rotRutDeduction && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Pris efter {rotRutDeduction.type}-avdrag. Kunden betalar detta belopp.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
