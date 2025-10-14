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

type Step = "welcome" | "company" | "customer" | "quote" | "complete";

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
    description: "Börja med att lägga till dina företagsuppgifter. Detta visas på alla dina offerter.",
    icon: Building2,
  },
  {
    id: "customer",
    title: "Första kunden",
    description: "Lägg till en kund som du vill skicka offert till. Du kan alltid lägga till fler senare.",
    icon: Users,
  },
  {
    id: "quote",
    title: "Skapa offert",
    description: "Nu är du redo att skapa din första offert! Beskriv bara jobbet och AI:n gör resten.",
    icon: FileText,
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

  const skipOnboarding = async () => {
    await supabase
      .from("user_onboarding")
      .update({ skipped: true })
      .eq("user_id", userId);
    setOpen(false);
    toast({
      title: "Guide överhoppad",
      description: "Du kan alltid komma åt hjälp via frågetecknen i appen.",
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
            <div className="space-y-3 text-sm">
              <p>Vi guidar dig genom 3 enkla steg:</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Ange företagsinformation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Lägg till din första kund</span>
                </li>
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Skapa din första offert</span>
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">Det tar bara några minuter!</p>
            </div>
          )}

          {currentStep === "company" && (
            <div className="space-y-3 text-sm">
              <p>Gå till <strong>Inställningar → Företag</strong> och fyll i:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Företagsnamn och organisationsnummer</li>
                <li>Adress och telefonnummer</li>
                <li>Timpriser (används för offertberäkningar)</li>
              </ul>
              <p className="mt-3">När du är klar, klicka på "Nästa" nedan.</p>
            </div>
          )}

          {currentStep === "customer" && (
            <div className="space-y-3 text-sm">
              <p>Gå till <strong>Kunder</strong> och lägg till en kund genom att klicka på "Ny kund".</p>
              <p className="text-muted-foreground">
                Du behöver minst namn och e-post för att kunna skicka offerter.
              </p>
            </div>
          )}

          {currentStep === "quote" && (
            <div className="space-y-3 text-sm">
              <p>Nu är allt klart! Skapa din första offert:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Välj kund från listan</li>
                <li>Beskriv jobbet (AI:n skapar offerten automatiskt)</li>
                <li>Använd gärna en mall för snabbare resultat</li>
              </ul>
            </div>
          )}

          {currentStep === "complete" && (
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
              <p className="text-lg">Du är nu redo att börja!</p>
              <p className="text-sm text-muted-foreground">
                Tips: Använd frågetecknen (?) i appen för kontextuell hjälp när du behöver.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            onClick={skipOnboarding}
            className="text-muted-foreground"
          >
            Hoppa över
          </Button>
          <div className="flex gap-2">
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
