import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Calculator, FileText, Sparkles } from "lucide-react";

interface AIProgressIndicatorProps {
  isGenerating: boolean;
}

const STEPS = [
  { id: 1, label: "Analyserar beskrivning", icon: Brain, duration: 2000 },
  { id: 2, label: "Beräknar kostnader", icon: Calculator, duration: 3000 },
  { id: 3, label: "Skapar offert", icon: FileText, duration: 2000 },
];

export function AIProgressIndicator({ isGenerating }: AIProgressIndicatorProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0);
      setProgress(0);
      return;
    }

    let stepTimer: NodeJS.Timeout;
    let progressTimer: NodeJS.Timeout;

    const startStep = (stepIndex: number) => {
      if (stepIndex >= STEPS.length) {
        setProgress(100);
        return;
      }

      setCurrentStep(stepIndex);
      const step = STEPS[stepIndex];
      const startProgress = (stepIndex / STEPS.length) * 100;
      const endProgress = ((stepIndex + 1) / STEPS.length) * 100;
      let currentProgress = startProgress;

      progressTimer = setInterval(() => {
        currentProgress += (endProgress - startProgress) / (step.duration / 50);
        if (currentProgress >= endProgress) {
          currentProgress = endProgress;
          clearInterval(progressTimer);
        }
        setProgress(currentProgress);
      }, 50);

      stepTimer = setTimeout(() => {
        clearInterval(progressTimer);
        startStep(stepIndex + 1);
      }, step.duration);
    };

    startStep(0);

    return () => {
      clearTimeout(stepTimer);
      clearInterval(progressTimer);
    };
  }, [isGenerating]);

  if (!isGenerating) return null;

  const CurrentIcon = STEPS[currentStep]?.icon || Sparkles;
  const currentLabel = STEPS[currentStep]?.label || "Förbereder...";

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg animate-pulse">
              <CurrentIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{currentLabel}</p>
              <p className="text-xs text-muted-foreground">
                Steg {currentStep + 1} av {STEPS.length}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              {STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-1 ${
                    index <= currentStep ? "text-primary font-medium" : ""
                  }`}
                >
                  <step.icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
