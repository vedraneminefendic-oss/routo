import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatWorkItem } from "@/lib/formatters";
import { Package, Wrench, Hammer, Sparkles } from "lucide-react";

interface WorkItem {
  name: string;
  description: string;
  hours: number;
  hourlyRate: number;
  subtotal: number;
}

interface Material {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  subtotal: number;
}

interface Summary {
  workCost: number;
  materialCost: number;
  totalBeforeVAT: number;
  vat: number;
  totalWithVAT: number;
  deductionAmount?: number;
  deductionType?: 'rot' | 'rut' | 'none';
  customerPays: number;
}

interface Quote {
  title: string;
  workItems: WorkItem[];
  materials: Material[];
  summary: Summary;
  notes?: string;
  deductionType?: 'rot' | 'rut' | 'none';
}

interface QuoteDisplayMobileProps {
  quote: Quote;
}

export const QuoteDisplayMobile = ({ quote }: QuoteDisplayMobileProps) => {
  const deductionType = quote.deductionType || quote.summary.deductionType || 'none';
  const deductionAmount = quote.summary.deductionAmount || 0;

  return (
    <div className="space-y-4">
      {/* Work Items as Cards */}
      {quote.workItems && quote.workItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Arbetsmoment
          </h3>
          {quote.workItems.map((item, index) => (
            <Card key={index} className="border-l-4 border-l-primary">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{item.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {item.description && (
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Timmar:</span>
                  <span className="font-medium">{formatWorkItem(item.hours, item.hourlyRate)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center font-semibold">
                  <span>Summa:</span>
                  <span className="text-primary">{formatCurrency(item.subtotal)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Materials as Cards */}
      {quote.materials && quote.materials.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Package className="h-4 w-4" />
            Material
          </h3>
          {quote.materials.map((material, index) => (
            <Card key={index} className="border-l-4 border-l-secondary">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{material.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Antal:</span>
                  <span className="font-medium">{material.quantity} {material.unit}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Pris/enhet:</span>
                  <span className="font-medium">{formatCurrency(material.pricePerUnit)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center font-semibold">
                  <span>Summa:</span>
                  <span className="text-secondary">{formatCurrency(material.subtotal)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Card */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">Sammanfattning</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Arbetskostnad:</span>
              <span className="font-medium">{formatCurrency(quote.summary.workCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Materialkostnad:</span>
              <span className="font-medium">{formatCurrency(quote.summary.materialCost)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Totalt exkl. moms:</span>
              <span className="font-medium">{formatCurrency(quote.summary.totalBeforeVAT)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Moms (25%):</span>
              <span className="font-medium">{formatCurrency(quote.summary.vat)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Totalt inkl. moms:</span>
              <span>{formatCurrency(quote.summary.totalWithVAT)}</span>
            </div>

            {deductionType !== 'none' && deductionAmount > 0 && (
              <>
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span className="flex items-center gap-1">
                    {deductionType === 'rot' ? <Hammer className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                    {deductionType.toUpperCase()}-avdrag (50%):
                  </span>
                  <span className="font-medium">-{formatCurrency(deductionAmount)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Kund betalar:</span>
                  <span className="text-primary">{formatCurrency(quote.summary.customerPays)}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Anteckningar</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
