import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Clock, Wrench, FileText } from "lucide-react";
import CompanySettings from "@/components/CompanySettings";
import HourlyRatesManager from "@/components/HourlyRatesManager";
import EquipmentRatesManager from "@/components/EquipmentRatesManager";
import TemplatesManager from "@/components/TemplatesManager";

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Laddar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-secondary">Inställningar</h1>
              <p className="text-sm text-muted-foreground">Anpassa ditt offertverktyg</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="company" className="space-y-6">
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
