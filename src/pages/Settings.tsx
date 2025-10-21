import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Clock, Wrench, FileText, PlayCircle, Brain } from "lucide-react";
import CompanySettings from "@/components/CompanySettings";
import HourlyRatesManager from "@/components/HourlyRatesManager";
import EquipmentRatesManager from "@/components/EquipmentRatesManager";
import TemplatesManager from "@/components/TemplatesManager";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "company");
  const [showOnboardingResume, setShowOnboardingResume] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        checkOnboardingStatus(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkOnboardingStatus = async (userId: string) => {
    const { data } = await supabase
      .from("user_onboarding")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data && !data.completed && !data.skipped) {
      setShowOnboardingResume(true);
    }
  };

  const resumeOnboarding = async () => {
    if (!user?.id) return;
    
    await supabase
      .from("user_onboarding")
      .update({ current_step: "welcome" })
      .eq("user_id", user.id);
    
    toast.success("Guidning återupptas - går tillbaka till startsidan...");
    
    setTimeout(() => navigate("/"), 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Laddar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader currentPage="settings" />

      <main className="container mx-auto px-4 py-8">
        {showOnboardingResume && (
          <Alert className="mb-6 border-primary/50 bg-primary/5">
            <PlayCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between">
              <span>Du har en påbörjad guidning. Vill du fortsätta?</span>
              <Button 
                size="sm" 
                onClick={resumeOnboarding}
                className="ml-4"
              >
                Återuppta guidning
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-secondary flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI-profil
            </CardTitle>
            <CardDescription>
              Uppdatera din AI-profil manuellt baserat på dina tidigare offerter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  
                  toast.info('Uppdaterar AI-profil...');
                  
                  await supabase.functions.invoke('update-user-patterns', {
                    body: { user_id: user.id }
                  });
                  
                  toast.success('Din AI-profil har uppdaterats!');
                } catch (error) {
                  console.error('Error updating user patterns:', error);
                  toast.error('Kunde inte uppdatera AI-profil');
                }
              }}
              className="flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              Uppdatera AI-profil
            </Button>
          </CardContent>
        </Card>

        <Tabs 
          value={activeTab} 
          onValueChange={(value) => {
            setActiveTab(value);
            setSearchParams({ tab: value });
          }} 
          className="space-y-6"
        >
          <div className="sticky top-0 bg-background z-10 pb-4">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="company" className="flex items-center gap-2 data-[state=active]:text-primary data-[state=active]:font-medium">
              <Building2 className="h-4 w-4" />
              Företag
            </TabsTrigger>
            <TabsTrigger value="rates" className="flex items-center gap-2 data-[state=active]:text-primary data-[state=active]:font-medium">
              <Clock className="h-4 w-4" />
              Timpriser
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2 data-[state=active]:text-primary data-[state=active]:font-medium">
              <Wrench className="h-4 w-4" />
              Maskiner
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2 data-[state=active]:text-primary data-[state=active]:font-medium">
              <FileText className="h-4 w-4" />
              Mallar
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle className="text-secondary">Företagsinformation</CardTitle>
                <CardDescription>
                  Dessa uppgifter visas på alla dina offerter
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CompanySettings userId={user?.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rates">
            <Card>
              <CardHeader>
                <CardTitle className="text-secondary">Timpriser</CardTitle>
                <CardDescription>
                  Ange timpriser för olika typer av arbeten. AI:n använder dessa när den skapar offerter.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HourlyRatesManager userId={user?.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipment">
            <Card>
              <CardHeader>
                <CardTitle className="text-secondary">Maskiner & Utrustning</CardTitle>
                <CardDescription>
                  Ange priser för maskiner och utrustning. AI:n lägger till dessa i offerter när de behövs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EquipmentRatesManager userId={user?.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle className="text-secondary">Offertmallar</CardTitle>
                <CardDescription>
                  Skapa återanvändbara mallar för vanliga typer av offerter. Spara tid genom att använda mallar när du skapar nya offerter.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TemplatesManager userId={user?.id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
