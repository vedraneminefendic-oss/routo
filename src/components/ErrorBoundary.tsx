import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Något gick fel</h1>
            <p className="text-muted-foreground">
              Ett oväntat fel uppstod. Försök ladda om sidan.
            </p>
            <Button onClick={() => window.location.reload()}>
              Ladda om sidan
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
