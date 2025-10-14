import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}

export const ErrorState = ({ 
  title = "Något gick fel",
  message, 
  onRetry,
  retryLabel = "Försök igen",
  children 
}: ErrorStateProps) => {
  return (
    <Alert variant="destructive" className="max-w-2xl mx-auto">
      <AlertCircle className="h-5 w-5" />
      <AlertTitle className="text-lg font-semibold">{title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-4">
        <p>{message}</p>
        <div className="flex gap-2">
          {onRetry && (
            <Button 
              onClick={onRetry} 
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {retryLabel}
            </Button>
          )}
          {children}
        </div>
      </AlertDescription>
    </Alert>
  );
};
