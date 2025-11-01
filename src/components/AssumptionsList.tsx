import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Assumption {
  text: string;
  confidence: number;
  sourceOfTruth: string;
  canConfirm: boolean;
  field: string;
}

interface AssumptionsListProps {
  assumptions: Assumption[];
  onConfirm?: (field: string) => void;
  onEdit?: (field: string) => void;
}

export function AssumptionsList({ assumptions, onConfirm, onEdit }: AssumptionsListProps) {
  if (!assumptions || assumptions.length === 0) {
    return null;
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return "text-green-600 dark:text-green-400";
    if (confidence >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getConfidenceBadgeVariant = (confidence: number): "default" | "secondary" | "destructive" => {
    if (confidence >= 70) return "default";
    if (confidence >= 50) return "secondary";
    return "destructive";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 70) return <CheckCircle2 className="h-4 w-4" />;
    if (confidence >= 50) return <HelpCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  const hasLowConfidence = assumptions.some(a => a.confidence < 50);

  return (
    <Card className={cn(
      "p-6 space-y-4",
      hasLowConfidence && "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20"
    )}>
      <div className="flex items-center gap-2">
        {hasLowConfidence && <AlertCircle className="h-5 w-5 text-yellow-600" />}
        <h3 className="text-lg font-semibold">
          {hasLowConfidence ? '⚠️ Antaganden som gjordes' : '📋 Antaganden'}
        </h3>
        {hasLowConfidence && (
          <Badge variant="secondary" className="ml-auto">
            Vänligen bekräfta
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Offerten baseras på följande antaganden. Du kan bekräfta eller ändra dessa för en mer exakt offert.
      </p>

      <div className="space-y-3">
        {assumptions.map((assumption, index) => (
          <div
            key={index}
            className={cn(
              "p-4 rounded-lg border-2 transition-all",
              assumption.confidence >= 70 && "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
              assumption.confidence >= 50 && assumption.confidence < 70 && "bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
              assumption.confidence < 50 && "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn("mt-0.5", getConfidenceColor(assumption.confidence))}>
                {getConfidenceIcon(assumption.confidence)}
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{assumption.text}</p>
                  <Badge variant={getConfidenceBadgeVariant(assumption.confidence)} className="shrink-0">
                    {assumption.confidence}%
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">Källa:</span>
                  <span>{assumption.sourceOfTruth}</span>
                </div>

                {assumption.canConfirm && (onConfirm || onEdit) && (
                  <div className="flex gap-2 mt-2">
                    {onConfirm && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onConfirm(assumption.field)}
                        className="text-xs"
                      >
                        Bekräfta
                      </Button>
                    )}
                    {onEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(assumption.field)}
                        className="text-xs"
                      >
                        Ändra
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasLowConfidence && (
        <div className="mt-4 p-4 bg-yellow-100/50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
            ⚠️ Några antaganden har låg säkerhet
          </p>
          <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
            För en mer exakt offert, vänligen bekräfta eller korrigera ovanstående punkter genom att klicka på "Ändra".
          </p>
        </div>
      )}
    </Card>
  );
}
