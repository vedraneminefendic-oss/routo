import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

interface PriceDeltaWarningProps {
  previousPrice: number;
  newPrice: number;
  warnings: string[];
  onAccept?: () => void;
  onRegenerate?: () => void;
}

export function PriceDeltaWarning({
  previousPrice,
  newPrice,
  warnings,
  onAccept,
  onRegenerate
}: PriceDeltaWarningProps) {
  const priceChange = newPrice - previousPrice;
  const isIncrease = priceChange > 0;
  const percentChange = Math.abs((priceChange / previousPrice) * 100);

  // FAS 5: Format currency in Swedish locale
  const formatPrice = (amount: number) => amount.toLocaleString('sv-SE');

  return (
    <Alert variant="destructive" className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-300 font-bold">
        Ovanlig prisförändring upptäckt
      </AlertTitle>
      <AlertDescription className="space-y-4 text-amber-800 dark:text-amber-200">
        {/* FAS 5: Tydlig diff med före/efter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-300 dark:border-amber-700">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Tidigare</p>
              <p className="font-semibold text-lg">{formatPrice(previousPrice)} kr</p>
            </div>
            <div className="flex items-center justify-center">
              {isIncrease ? (
                <TrendingUp className="h-6 w-6 text-red-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-green-600" />
              )}
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Nytt</p>
              <p className="font-semibold text-lg">{formatPrice(newPrice)} kr</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
            <p className={`text-center font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
              {isIncrease ? '+' : ''}{formatPrice(priceChange)} kr ({isIncrease ? '+' : ''}{percentChange.toFixed(0)}%)
            </p>
          </div>
        </div>

        {/* FAS 5: Lista problem med bättre formatering */}
        <div className="space-y-2">
          <p className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Upptäckta problem:
          </p>
          <ul className="space-y-2">
            {warnings.map((warning, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm bg-white dark:bg-gray-800 p-2 rounded border border-amber-200 dark:border-amber-800">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* FAS 5: Förbättrade knappar med tydligare text */}
        {(onAccept || onRegenerate) && (
          <div className="flex gap-2 pt-2">
            {onRegenerate && (
              <Button
                onClick={onRegenerate}
                variant="default"
                size="sm"
                className="flex-1"
              >
                🔄 Generera om korrekt
              </Button>
            )}
            {onAccept && (
              <Button
                onClick={onAccept}
                variant="outline"
                size="sm"
                className="bg-white hover:bg-gray-50"
              >
                Acceptera ändå
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
