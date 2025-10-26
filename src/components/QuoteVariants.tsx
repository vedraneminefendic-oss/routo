import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingDown, TrendingUp, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface QuoteVariant {
  type: 'budget' | 'standard' | 'premium';
  label: string;
  description: string;
  multiplier: number;
  icon: any;
  color: string;
}

interface QuoteVariantsProps {
  baseQuote: any;
  onSelectVariant: (variant: QuoteVariant, adjustedQuote: any) => void;
}

const variants: QuoteVariant[] = [
  {
    type: 'budget',
    label: 'Budget',
    description: 'Grundläggande utförande med lägre kostnad',
    multiplier: 0.75,
    icon: TrendingDown,
    color: 'text-blue-600',
  },
  {
    type: 'standard',
    label: 'Standard',
    description: 'Rekommenderat utförande med balanserad kvalitet',
    multiplier: 1.0,
    icon: Check,
    color: 'text-primary',
  },
  {
    type: 'premium',
    label: 'Premium',
    description: 'Förhöjd kvalitet med extra funktioner',
    multiplier: 1.30,
    icon: TrendingUp,
    color: 'text-success',
  },
];

export const QuoteVariants = ({ baseQuote, onSelectVariant }: QuoteVariantsProps) => {
  const [selectedVariant, setSelectedVariant] = useState<QuoteVariant['type']>('standard');

  const calculateVariant = (variant: QuoteVariant) => {
    // Skapa en kopia av offerten
    const adjustedQuote = JSON.parse(JSON.stringify(baseQuote));
    
    // Justera alla arbetsmoment
    adjustedQuote.workItems = adjustedQuote.workItems.map((item: any) => ({
      ...item,
      hours: Math.round(item.hours * variant.multiplier * 10) / 10,
      subtotal: Math.round(item.hours * variant.multiplier * item.hourlyRate),
    }));

    // Justera material (endast för budget/premium, inte standard)
    if (variant.type !== 'standard') {
      adjustedQuote.materials = adjustedQuote.materials.map((item: any) => {
        const adjustmentFactor = variant.type === 'premium' ? 1.15 : 0.90;
        return {
          ...item,
          pricePerUnit: Math.round(item.pricePerUnit * adjustmentFactor),
          subtotal: Math.round(item.quantity * item.pricePerUnit * adjustmentFactor),
        };
      });
    }

    // Beräkna om totaler
    const workCost = adjustedQuote.workItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    const materialCost = adjustedQuote.materials.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    const totalBeforeVAT = workCost + materialCost;
    const vat = Math.round(totalBeforeVAT * 0.25);
    const totalWithVAT = totalBeforeVAT + vat;
    
    // Beräkna avdrag (samma % som original)
    const originalDeductionPercent = baseQuote.summary.deductionAmount 
      ? (baseQuote.summary.deductionAmount / baseQuote.summary.workCost)
      : 0;
    const deductionAmount = Math.round(workCost * originalDeductionPercent);
    const customerPays = totalWithVAT - deductionAmount;

    adjustedQuote.summary = {
      ...adjustedQuote.summary,
      workCost,
      materialCost,
      totalBeforeVAT,
      vat,
      totalWithVAT,
      deductionAmount,
      customerPays,
    };

    // Lägg till variant-info
    adjustedQuote.variantType = variant.type;
    adjustedQuote.title = `${baseQuote.title} (${variant.label})`;

    return adjustedQuote;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Skapa offert-varianter
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Ge kunden valmöjligheter genom att skapa budget-, standard- och premiumversioner
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {variants.map((variant) => {
            const adjustedQuote = calculateVariant(variant);
            const Icon = variant.icon;
            const isSelected = selectedVariant === variant.type;
            const savings = variant.type === 'budget' 
              ? baseQuote.summary.customerPays - adjustedQuote.summary.customerPays
              : 0;
            const extraCost = variant.type === 'premium'
              ? adjustedQuote.summary.customerPays - baseQuote.summary.customerPays
              : 0;

            return (
              <div
                key={variant.type}
                className={`
                  p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${isSelected 
                    ? 'border-primary bg-primary/5 shadow-lg' 
                    : 'border-border/50 hover:border-primary/30'
                  }
                `}
                onClick={() => setSelectedVariant(variant.type)}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Icon className={`h-6 w-6 ${variant.color}`} />
                    {variant.type === 'standard' && (
                      <Badge className="bg-primary text-white">
                        Rekommenderad
                      </Badge>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-lg">{variant.label}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {variant.description}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(adjustedQuote.summary.customerPays)}
                    </div>
                    
                    {variant.type === 'budget' && savings > 0 && (
                      <div className="text-sm text-success">
                        ↓ Spar {formatCurrency(savings)}
                      </div>
                    )}
                    
                    {variant.type === 'premium' && extraCost > 0 && (
                      <div className="text-sm text-muted-foreground">
                        ↑ +{formatCurrency(extraCost)}
                      </div>
                    )}

                    {variant.type === 'standard' && (
                      <div className="text-sm text-muted-foreground">
                        Originalofferten
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectVariant(variant, adjustedQuote);
                    }}
                  >
                    {isSelected ? 'Använd denna' : 'Välj'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Tips:</strong> Skicka alla tre varianter till kunden så de kan välja 
            det alternativ som passar deras budget och önskemål bäst.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};