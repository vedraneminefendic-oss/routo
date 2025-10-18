import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EstimateSummaryProps {
  subtotal: number;
  rotRutDeduction?: {
    type: 'ROT' | 'RUT';
    laborCost: number;
    deductionAmount: number;
    priceAfterDeduction: number;
  };
  total: number;
}

export const EstimateSummary = ({ subtotal, rotRutDeduction, total }: EstimateSummaryProps) => {
  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Subtotal */}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Delsumma</span>
            <span className="font-medium">
              {subtotal.toLocaleString('sv-SE')} kr
            </span>
          </div>

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
                            ? 'ROT-avdrag för renovering, ombyggnad och tillbyggnad. Du får 30% rabatt på arbetskostnaden, max 50 000 kr/år.'
                            : 'RUT-avdrag för hushållsnära tjänster. Du får 50% rabatt på arbetskostnaden, max 75 000 kr/år.'
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
                    <span>Avdrag ({rotRutDeduction.type === 'ROT' ? '30%' : '50%'})</span>
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
