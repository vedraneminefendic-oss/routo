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
import { Building2, Users, CheckCircle2 } from "lucide-react";
import { CompanySettingsForm } from "@/components/CompanySettingsForm";
import { CustomerFormSimple } from "@/components/CustomerFormSimple";

interface OnboardingWizardProps {
  userId: string;
  onComplete: () => void;
}

type Step = "welcome" | "company" | "customer" | "complete";

const STEPS: { id: Step; title: string; description: string; icon: any }[] = [
  {
    id: "welcome",
    title: "Välkommen! 👋",
    description: "Låt oss sätta upp ditt konto så du kan börja skapa offerter direkt.",
    icon: CheckCircle2,
  },
  {
    id: "company",
    title: "Företagsinformation",
    description: "Lägg till dina företagsuppgifter (valfritt - visas på offerterna)",
    icon: Building2,
  },
  {
    id: "customer",
    title: "Första kunden",
    description: "Spara din första kund (valfritt - gör det enklare att skapa offerter)",
    icon: Users,
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
      // Resume onboarding - migrate old "setup" step to "company"
      const resumeStep = data.current_step === "setup" ? "company" : data.current_step;
      setCurrentStep(resumeStep as Step);
      
      // Update if it was migrated
      if (data.current_step === "setup") {
        await updateStep("company");
      }
      
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

  const handleCompanySaved = () => {
    handleNext();
  };

  const handleCustomerSaved = () => {
    handleNext();
  };

  const skipAll = async () => {
    await completeOnboarding();
  };

  const currentStepData = STEPS.find((s) => s.id === currentStep);
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentIndex + 1) / STEPS.length) * 100;
  const Icon = currentStepData?.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
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
                <p className="font-medium">Vad vi kommer sätta upp:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span><strong>Företagsinfo</strong> - Dina uppgifter som visas på offerter</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span><strong>Första kunden</strong> - För snabbare offertgenerering</span>
                  </li>
                </ul>
              </div>
              <p className="text-muted-foreground">
                Allt är valfritt! Du kan hoppa över och lägga till senare, eller hoppa direkt till offertgenerering.
              </p>
            </div>
          )}

          {currentStep === "company" && (
            <CompanySettingsForm 
              userId={userId} 
              onSave={handleCompanySaved}
              onSkip={handleNext}
            />
          )}

          {currentStep === "customer" && (
            <CustomerFormSimple 
              userId={userId} 
              onSave={handleCustomerSaved}
              onSkip={handleNext}
            />
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
          {currentStep === "welcome" && (
            <Button
              variant="ghost"
              onClick={skipAll}
              className="text-muted-foreground"
            >
              Hoppa över allt
            </Button>
          )}
          {currentStep !== "complete" && currentStep !== "welcome" && currentStep !== "company" && currentStep !== "customer" && (
            <Button
              variant="ghost"
              onClick={continueLater}
              className="text-muted-foreground"
            >
              Fortsätt senare
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            {currentIndex > 0 && currentStep !== "complete" && currentStep !== "company" && currentStep !== "customer" && (
              <Button variant="outline" onClick={handleBack}>
                Tillbaka
              </Button>
            )}
            {currentStep !== "company" && currentStep !== "customer" && (
              <Button onClick={handleNext}>
                {currentStep === "complete" ? "Börja använda" : "Nästa"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
