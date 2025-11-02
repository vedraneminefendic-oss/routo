import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { QuoteChanges } from "@/lib/detectQuoteChanges";

interface QuoteDiffPreviewProps {
  changes: QuoteChanges;
  onAccept: () => void;
  onReject: () => void;
}

export const QuoteDiffPreview = ({ changes, onAccept, onReject }: QuoteDiffPreviewProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const hasChanges = changes.added.length > 0 || 
                     changes.removed.length > 0 || 
                     changes.modified.length > 0;

  if (!hasChanges) {
    return null;
  }

  return (
    <Card className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-amber-700 dark:text-amber-300">AI föreslår följande ändringar</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Added items */}
        {changes.added.length > 0 && (
          <div>
            <Badge className="bg-green-600 text-white mb-2">
              Lägger till ({changes.added.length})
            </Badge>
            <div className="space-y-1">
              {changes.added.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                  <Plus className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  <span className="font-medium text-green-600">
                    +{formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Removed items */}
        {changes.removed.length > 0 && (
          <div>
            <Badge className="bg-red-600 text-white mb-2">
              Tar bort ({changes.removed.length})
            </Badge>
            <div className="space-y-1">
              {changes.removed.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                  <Minus className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="flex-1 line-through">{item.name}</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modified items */}
        {changes.modified.length > 0 && (
          <div>
            <Badge className="bg-blue-600 text-white mb-2">
              Justerar pris ({changes.modified.length})
            </Badge>
            <div className="space-y-1">
              {changes.modified.map((change, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                  {change.newValue > change.oldValue ? (
                    <TrendingUp className="h-4 w-4 text-blue-600 shrink-0" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-blue-600 shrink-0" />
                  )}
                  <span className="flex-1">{change.item.name}</span>
                  <span className="text-muted-foreground text-xs line-through">
                    {formatCurrency(change.oldValue)}
                  </span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(change.newValue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Price summary */}
        <div className="pt-3 border-t border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-muted-foreground">
                Tidigare: <span className="font-medium">{formatCurrency(changes.priceChange.previous)}</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                Nytt: <span className={changes.priceChange.difference > 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(changes.priceChange.new)}
                </span>
              </div>
              {changes.priceChange.difference !== 0 && (
                <div className={`text-xs font-medium ${changes.priceChange.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {changes.priceChange.difference > 0 ? '+' : ''}
                  {formatCurrency(changes.priceChange.difference)} 
                  ({changes.priceChange.percentageChange > 0 ? '+' : ''}
                  {changes.priceChange.percentageChange.toFixed(1)}%)
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={onReject}
              className="flex-1"
            >
              Avbryt
            </Button>
            <Button 
              onClick={onAccept}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              Acceptera ändringar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
