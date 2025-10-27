import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";

interface ConversationProgressProps {
  currentQuestion: number;
  totalQuestions: number;
  answeredCategories?: string[];
  totalCategories?: number;
}

export const ConversationProgress = ({ 
  currentQuestion, 
  totalQuestions,
  answeredCategories = [],
  totalCategories = 5
}: ConversationProgressProps) => {
  const progressPercentage = (currentQuestion / totalQuestions) * 100;
  
  return (
    <div className="bg-card border rounded-lg p-4 mb-4 animate-in fade-in-0 slide-in-from-top-2 duration-500">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-secondary">
            Fråga {currentQuestion} av {totalQuestions}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {Math.round(progressPercentage)}% klart
        </span>
      </div>
      
      <Progress value={progressPercentage} className="h-2 mb-3" />
      
      {answeredCategories.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span>
            {answeredCategories.length} av {totalCategories} kategorier besvarade
          </span>
        </div>
      )}
    </div>
  );
};
