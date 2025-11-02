import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction,
  children 
}: EmptyStateProps) => {
  return (
    <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 via-background to-secondary/5 hover:border-primary/30 transition-all duration-300">
      <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 p-8 mb-6 shadow-routo">
            <Icon className="h-16 w-16 text-primary" aria-hidden="true" />
          </div>
        </div>
        <h3 className="text-2xl font-heading font-bold mb-3 text-foreground">{title}</h3>
        <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">{description}</p>
        {actionLabel && onAction && (
          <Button 
            onClick={onAction} 
            size="lg"
            className="bg-primary hover:bg-primary/90 shadow-routo hover:shadow-routo-lg transition-all duration-300 hover:-translate-y-0.5"
          >
            {actionLabel}
          </Button>
        )}
        {children}
      </CardContent>
    </Card>
  );
};
