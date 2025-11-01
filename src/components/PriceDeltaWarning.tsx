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

  return (
    <Alert variant="destructive" className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-300 font-bold">
        Ovanlig prisförändring upptäckt
      </AlertTitle>
      <AlertDescription className="space-y-3 text-amber-800 dark:text-amber-200">
        <div className="flex items-center gap-2 font-semibold">
          {isIncrease ? (
            <TrendingUp className="h-4 w-4 text-red-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-green-600" />
          )}
          <span>
            Priset {isIncrease ? 'ökade' : 'minskade'} från{' '}
            {previousPrice.toLocaleString('sv-SE')} kr till{' '}
            {newPrice.toLocaleString('sv-SE')} kr
          </span>
          <span className="text-sm">
            ({isIncrease ? '+' : ''}{percentChange.toFixed(0)}%)
          </span>
        </div>

        <div className="space-y-2">
          <p className="font-medium">Potentiella problem:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>

        {(onAccept || onRegenerate) && (
          <div className="flex gap-2 pt-2">
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
            {onRegenerate && (
              <Button
                onClick={onRegenerate}
                variant="default"
                size="sm"
              >
                Generera om
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
