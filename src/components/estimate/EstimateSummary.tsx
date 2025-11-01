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
  vatAmount?: number; // New standard field
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

export const EstimateSummary = ({ 
  subtotal = 0,
  workCost = 0,
  materialCost = 0,
  vat = 0,
  vatAmount,
  totalWithVAT = 0,
  rotRutDeduction,
  total = 0
}: EstimateSummaryProps) => {
  // Fix: Support both 'vat' (legacy) and 'vatAmount' (new standard)
  const displayVat = vatAmount !== undefined ? vatAmount : vat;
  // ÅTGÄRD 2A: Säkerställ att ROT/RUT-data alltid har värden (med backwards compatibility)
  const safeRotRutDeduction = rotRutDeduction ? {
    ...rotRutDeduction,
    // ✅ Stöd både nya OCH gamla fältnamn (för backwards compatibility)
    laborCost: rotRutDeduction.laborCost ?? (rotRutDeduction as any).workCost ?? 0,
    deductionAmount: rotRutDeduction.deductionAmount ?? (rotRutDeduction as any).actualDeduction ?? 0,
    priceAfterDeduction: rotRutDeduction.priceAfterDeduction ?? (rotRutDeduction as any).customerPays ?? 0,
    deductionRate: rotRutDeduction.deductionRate ?? 0.50
  } : undefined;
  return (
    <Card className="border-2 border-primary/30 shadow-2xl hover:shadow-3xl transition-all duration-500 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-sm overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="pt-6 relative">
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
          {(vat !== undefined || vatAmount !== undefined) && displayVat > 0 && (
            <div className="flex items-center justify-between text-muted-foreground text-sm">
              <span>Moms (25%)</span>
              <span>{displayVat.toLocaleString('sv-SE')} kr</span>
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

          {/* ROT/RUT Avdrag - ÅTGÄRD #5: Detaljerad visning */}
          {safeRotRutDeduction && (
            <>
              <Separator />
              <div className="space-y-3 p-4 bg-secondary/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {safeRotRutDeduction.type}-avdrag ({((safeRotRutDeduction.deductionRate ?? 0.50) * 100)}%)
                  </Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          {safeRotRutDeduction.type === 'ROT' 
                            ? `ROT-avdrag för renovering, ombyggnad och tillbyggnad. Du får ${((safeRotRutDeduction.deductionRate ?? 0.50) * 100)}% rabatt på arbetskostnaden inkl. moms (t.o.m. 31 dec 2025: 50%, fr.o.m. 1 jan 2026: 30%), max 50 000 kr/år per person.`
                            : `RUT-avdrag för hushållsnära tjänster. Du får ${((safeRotRutDeduction.deductionRate ?? 0.50) * 100)}% rabatt på arbetskostnaden inkl. moms (t.o.m. 31 dec 2025: 50%, fr.o.m. 1 jan 2026: 30%), max 75 000 kr/år per person.`
                          }
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Arbetskostnad (exkl. moms)</span>
                    <span>{safeRotRutDeduction.laborCost.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Arbetskostnad (inkl. moms)</span>
                    <span className="font-medium">{Math.round(safeRotRutDeduction.laborCost * 1.25).toLocaleString('sv-SE')} kr</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-primary">
                    <span>Beräknat avdrag ({((safeRotRutDeduction.deductionRate ?? 0.50) * 100)}%)</span>
                    <span className="font-medium">
                      -{Math.round(safeRotRutDeduction.laborCost * 1.25 * (safeRotRutDeduction.deductionRate ?? 0.50)).toLocaleString('sv-SE')} kr
                    </span>
                  </div>
                  {(Math.round(safeRotRutDeduction.laborCost * 1.25 * (safeRotRutDeduction.deductionRate ?? 0.50)) > safeRotRutDeduction.deductionAmount) && (
                    <div className="flex items-center justify-between text-amber-600 text-xs italic">
                      <span>Max-tak nått ({safeRotRutDeduction.type === 'ROT' ? '50' : '75'} 000 kr × {Math.round(safeRotRutDeduction.deductionAmount / (safeRotRutDeduction.type === 'ROT' ? 50000 : 75000))} pers)</span>
                      <span>-{(Math.round(safeRotRutDeduction.laborCost * 1.25 * (safeRotRutDeduction.deductionRate ?? 0.50)) - safeRotRutDeduction.deductionAmount).toLocaleString('sv-SE')} kr</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between font-bold text-secondary">
                    <span>Faktiskt avdrag</span>
                    <span className="text-base">
                      -{safeRotRutDeduction.deductionAmount.toLocaleString('sv-SE')} kr
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Kunden betalar (efter avdrag)</span>
                    <span className="font-medium">
                      {safeRotRutDeduction.priceAfterDeduction.toLocaleString('sv-SE')} kr
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 shadow-md animate-in fade-in-0 zoom-in-95 duration-500">
            <span className="text-xl font-bold text-foreground">Totalt</span>
            <span className="text-2xl font-bold bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
              {total.toLocaleString('sv-SE')} kr
            </span>
          </div>

          {safeRotRutDeduction && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Pris efter {safeRotRutDeduction.type}-avdrag. Kunden betalar detta belopp.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
