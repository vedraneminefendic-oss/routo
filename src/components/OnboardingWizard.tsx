import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Building2, Users, FileText, CheckCircle2 } from "lucide-react";

interface OnboardingWizardProps {
  userId: string;
  onComplete: () => void;
}

type Step = "welcome" | "setup" | "complete";

const STEPS: { id: Step; title: string; description: string; icon: any }[] = [
  {
    id: "welcome",
    title: "Välkommen! 👋",
    description: "Låt oss sätta upp ditt konto så du kan börja skapa offerter direkt.",
    icon: CheckCircle2,
  },
  {
    id: "setup",
    title: "Snabb setup",
    description: "Lägg till företagsinfo och kund (båda är valfria - du kan fylla i detta senare).",
    icon: Building2,
  },
  {
    id: "complete",
    title: "Klart! 🎉",
    description: "Du är nu redo att använda ditt offertverktyg. Lycka till!",
    icon: CheckCircle2,
  },
];

export function OnboardingWizard({ userId, onComplete }: OnboardingWizardProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const { toast } = useToast();

  useEffect(() => {
    checkOnboardingStatus();
  }, [userId]);

  const checkOnboardingStatus = async () => {
    const { data, error } = await supabase
      .from("user_onboarding")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking onboarding:", error);
      return;
    }

    if (!data) {
      // First time user - create onboarding record and show wizard
      await supabase.from("user_onboarding").insert({
        user_id: userId,
        current_step: "welcome",
      });
      setOpen(true);
    } else if (!data.completed && !data.skipped) {
      // Resume onboarding
      setCurrentStep(data.current_step as Step);
      setOpen(true);
    }
  };

  const updateStep = async (step: Step) => {
    await supabase
      .from("user_onboarding")
      .update({ current_step: step })
      .eq("user_id", userId);
    setCurrentStep(step);
  };

  const completeOnboarding = async () => {
    await supabase
      .from("user_onboarding")
      .update({ completed: true, current_step: "complete" })
      .eq("user_id", userId);
    setOpen(false);
    onComplete();
    toast({
      title: "Välkommen! 🎉",
      description: "Du har slutfört guiden och är redo att börja.",
    });
  };

  const continueLater = async () => {
    setOpen(false);
    toast({
      title: "Progress sparad",
      description: "Du kan återuppta guiden från Inställningar när du vill.",
    });
  };

  const handleNext = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1].id;
      updateStep(nextStep);
    } else {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      const prevStep = STEPS[currentIndex - 1].id;
      updateStep(prevStep);
    }
  };

  const currentStepData = STEPS.find((s) => s.id === currentStep);
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentIndex + 1) / STEPS.length) * 100;
  const Icon = currentStepData?.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {Icon && <Icon className="h-6 w-6 text-primary" />}
            <DialogTitle className="text-2xl">{currentStepData?.title}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {currentStepData?.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Steg {currentIndex + 1} av {STEPS.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          {currentStep === "welcome" && (
            <div className="space-y-4 text-sm">
              <p>Ditt smarta offertverktyg med AI-generering är redo att användas!</p>
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <p className="font-medium">Vad du kan göra nu:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span><strong>Företagsinfo</strong> - Lägg till dina uppgifter (visas på offerter)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span><strong>Första kunden</strong> - Spara kunduppgifter för snabbare offertgenerering</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span><strong>Skapa offert</strong> - Beskriv jobbet så gör AI:n resten!</span>
                  </li>
                </ul>
              </div>
              <p className="text-muted-foreground">Vill du göra en snabb setup nu eller hoppa direkt till offertgenerering?</p>
            </div>
          )}

          {currentStep === "setup" && (
            <div className="space-y-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">1. Företagsinformation (valfritt)</p>
                    <p className="text-muted-foreground">
                      Gå till <strong>Inställningar → Företag</strong> och fyll i företagsnamn, adress, telefon och timpriser.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">2. Lägg till en kund (valfritt)</p>
                    <p className="text-muted-foreground">
                      Gå till <strong>Kunder</strong> och klicka "Ny kund". Du behöver minst namn och e-post.
                    </p>
                  </div>
                </div>
              </div>
              
              <p className="text-center text-muted-foreground pt-2">
                Du kan hoppa över detta och lägga till senare - klicka bara "Nästa" när du är klar!
              </p>
            </div>
          )}

          {currentStep === "complete" && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
              <div className="space-y-2">
                <p className="text-lg font-medium">Du är nu redo att börja!</p>
                <p className="text-sm text-muted-foreground">
                  Skapa din första offert genom att beskriva jobbet - AI:n genererar resten automatiskt.
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg text-left space-y-2 text-sm">
                <p className="font-medium">Snabbguide:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Använd <strong>frågetecknen (?)</strong> för kontextuell hjälp</li>
                  <li>• Skapa <strong>mallar</strong> för återkommande offerter</li>
                  <li>• Anpassa <strong>timpriser</strong> i Inställningar</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2">
          {currentStep !== "complete" && (
            <Button
              variant="ghost"
              onClick={continueLater}
              className="text-muted-foreground"
            >
              Fortsätt senare
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            {currentIndex > 0 && currentStep !== "complete" && (
              <Button variant="outline" onClick={handleBack}>
                Tillbaka
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStep === "complete" ? "Börja använda" : "Nästa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
