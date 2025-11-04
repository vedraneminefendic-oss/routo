import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Clock, Wrench, FileText, PlayCircle, Download, Shield } from "lucide-react";
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

  const handleExportData = async () => {
    try {
      toast.info('Förbereder din dataexport...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Du måste vara inloggad för att exportera data');
        return;
      }

      const { data, error } = await supabase.functions.invoke('export-user-data', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Export error:', error);
        toast.error('Misslyckades att exportera data');
        return;
      }

      // Create downloadable JSON file
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `routo-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('✅ Din data har exporterats och laddats ner!');
    } catch (error) {
      console.error('Export exception:', error);
      toast.error('Ett fel uppstod vid dataexporten');
    }
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

        <Card className="mb-6 bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo">
          <CardHeader>
            <CardTitle className="font-heading text-primary flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Integritet & Data (GDPR)
            </CardTitle>
            <CardDescription>
              Hantera dina personuppgifter enligt GDPR Article 20 - Rätt till dataportabilitet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Du har rätt att få en kopia av all din personliga data i ett strukturerat format. 
                Detta inkluderar företagsinställningar, offerter, kunder, mallar och konversationshistorik.
              </p>
              <Button 
                onClick={handleExportData}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportera all min data (JSON)
              </Button>
              <p className="text-xs text-muted-foreground">
                Observera: Personnummer exporteras som "[ENCRYPTED]" av säkerhetsskäl
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo">
          <CardHeader>
            <CardTitle className="font-heading text-primary flex items-center gap-2">
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
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 shadow-routo hover:shadow-routo-lg transition-all"
            >
              <Brain className="h-4 w-4" />
              Uppdatera AI-profil
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo">
          <CardHeader>
            <CardTitle className="font-heading text-primary flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Branschdata & Marknadsinsikter
            </CardTitle>
            <CardDescription>
              Externa datakällor som håller AI:n uppdaterad med aktuella marknads­priser (SCB + branschsajter)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {benchmarks.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Värde</TableHead>
                        <TableHead>Min-Max</TableHead>
                        <TableHead>Senast uppdaterad</TableHead>
                        <TableHead className="text-center">Källor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {benchmarks.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">
                            {b.work_category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </TableCell>
                          <TableCell>
                            {b.metric_type === 'price_per_sqm' 
                              ? `${Math.round(b.median_value).toLocaleString('sv-SE')} kr/kvm`
                              : `${(b.median_value * 100).toFixed(0)}%`
                            }
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {Math.round(b.min_value).toLocaleString('sv-SE')} - {Math.round(b.max_value).toLocaleString('sv-SE')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(b.last_updated).toLocaleDateString('sv-SE', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={b.sample_size >= 3 ? 'default' : 'secondary'}>
                              {b.sample_size} {b.sample_size === 1 ? 'källa' : 'källor'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="mb-2">Ingen marknadsdata hämtad än</p>
                  <p className="text-sm">Klicka på knappen nedan för att hämta aktuella priser från externa källor</p>
                </div>
              )}
              
              <Button 
                onClick={handleSyncMarketData} 
                disabled={isSyncing}
                className="w-full sm:w-auto flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Synkar marknadsdata...' : 'Uppdatera marknadsdata nu'}
              </Button>

              <div className="text-xs text-muted-foreground mt-4 space-y-1">
                <p><strong>Källor:</strong> SCB (Byggkostnadsindex), byggfakta.se, husbyggaren.se</p>
                <p><strong>Användning:</strong> AI:n kombinerar dina egna offerter (70% vikt) med branschdata (30% vikt)</p>
              </div>
            </div>
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
            <TabsList className="grid w-full max-w-3xl grid-cols-4 bg-[hsl(36,45%,98%)]">
            <TabsTrigger value="company" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Building2 className="h-4 w-4" />
              Företag
            </TabsTrigger>
            <TabsTrigger value="rates" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Clock className="h-4 w-4" />
              Timpriser
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Wrench className="h-4 w-4" />
              Maskiner
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-4 w-4" />
              Mallar
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="company">
            <Card className="bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo">
              <CardHeader>
                <CardTitle className="font-heading text-primary">Företagsinformation</CardTitle>
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
            <Card className="bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo">
              <CardHeader>
                <CardTitle className="font-heading text-primary">Timpriser</CardTitle>
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
            <Card className="bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo">
              <CardHeader>
                <CardTitle className="font-heading text-primary">Maskiner & Utrustning</CardTitle>
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
            <Card className="bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo">
              <CardHeader>
                <CardTitle className="font-heading text-primary">Offertmallar</CardTitle>
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

        <Card className="mt-6 bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo">
          <CardHeader>
            <CardTitle className="font-heading text-primary flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Integritet & Data (GDPR)
            </CardTitle>
            <CardDescription>
              Hantera dina personuppgifter enligt GDPR Article 20 - Rätt till dataportabilitet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Du har rätt att få en kopia av all din personliga data i ett strukturerat format. 
                Detta inkluderar företagsinställningar, offerter, kunder, mallar och konversationshistorik.
              </p>
              <Button 
                onClick={handleExportData}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportera all min data (JSON)
              </Button>
              <p className="text-xs text-muted-foreground">
                Observera: Personnummer exporteras som "[ENCRYPTED]" av säkerhetsskäl
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
