import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";

export interface ValidationIssue {
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  suggestedFix?: string;
  autoFixable?: boolean;
}

interface QuoteValidationWarningsProps {
  issues?: ValidationIssue[];
  pricePerSqm?: number;
  expectedMinPrice?: number;
  expectedMaxPrice?: number;
  onDismiss?: () => void;
}

export const QuoteValidationWarnings = ({
  issues = [],
  pricePerSqm,
  expectedMinPrice,
  expectedMaxPrice,
  onDismiss
}: QuoteValidationWarningsProps) => {
  if (issues.length === 0) {
    return (
      <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-200">
          Kvalitetskontroll OK
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          Offerten uppfyller alla kvalitetskrav för badrumsrenovering.
        </AlertDescription>
      </Alert>
    );
  }

  const criticalIssues = issues.filter(i => i.severity === 'CRITICAL');
  const errorIssues = issues.filter(i => i.severity === 'ERROR');
  const warningIssues = issues.filter(i => i.severity === 'WARNING');
  const infoIssues = issues.filter(i => i.severity === 'INFO');

  const hasBlockingIssues = criticalIssues.length > 0 || errorIssues.length > 0;

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'ERROR':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <Alert
      variant={hasBlockingIssues ? "destructive" : "default"}
      className="my-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {hasBlockingIssues ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Info className="h-5 w-5" />
            )}
            <AlertTitle className="text-lg font-semibold">
              {hasBlockingIssues
                ? '🚨 Offerten behöver granskas'
                : '💡 Kvalitetsvarningar'}
            </AlertTitle>
          </div>

          {pricePerSqm && expectedMinPrice && expectedMaxPrice && (
            <div className="mt-3 p-3 bg-background/50 rounded-md text-sm">
              <strong>Pris per kvm:</strong> {pricePerSqm} kr/kvm<br />
              <strong>Förväntat intervall:</strong> {Math.round(expectedMinPrice / ((expectedMinPrice + expectedMaxPrice) / 2 * pricePerSqm))} - {Math.round(expectedMaxPrice / ((expectedMinPrice + expectedMaxPrice) / 2 * pricePerSqm))} kr/kvm
            </div>
          )}

          <AlertDescription className="mt-4">
            {criticalIssues.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Kritiska problem ({criticalIssues.length})
                </h4>
                <ul className="space-y-2">
                  {criticalIssues.map((issue, i) => (
                    <li key={i} className="text-sm pl-6">
                      <strong>•</strong> {issue.message}
                      {issue.suggestedFix && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          💡 {issue.suggestedFix}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {errorIssues.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Allvarliga brister ({errorIssues.length})
                </h4>
                <ul className="space-y-2">
                  {errorIssues.map((issue, i) => (
                    <li key={i} className="text-sm pl-6">
                      <strong>•</strong> {issue.message}
                      {issue.suggestedFix && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          💡 {issue.suggestedFix}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {warningIssues.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Varningar ({warningIssues.length})
                </h4>
                <ul className="space-y-2">
                  {warningIssues.map((issue, i) => (
                    <li key={i} className="text-sm pl-6">
                      <strong>•</strong> {issue.message}
                      {issue.suggestedFix && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          💡 {issue.suggestedFix}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {infoIssues.length > 0 && (
              <div>
                <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Förbättringsförslag ({infoIssues.length})
                </h4>
                <ul className="space-y-2">
                  {infoIssues.map((issue, i) => (
                    <li key={i} className="text-sm pl-6">
                      <strong>•</strong> {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </div>

        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="ml-4"
          >
            Stäng
          </Button>
        )}
      </div>
    </Alert>
  );
};
