import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Zap, Users, BarChart3, FileCheck } from "lucide-react";
import Footer from "@/components/Footer";

const Landing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      } else {
        setLoading(false);
      }
    });
  }, [navigate]);

  if (loading) {
    return null;
  }

  const features = [
    {
      icon: Zap,
      title: "AI-genererade offerter",
      description: "Skapa professionella offerter på minuter med hjälp av AI"
    },
    {
      icon: FileCheck,
      title: "ROT & RUT-avdrag",
      description: "Automatisk beräkning av ROT/RUT-avdrag enligt gällande regler"
    },
    {
      icon: Users,
      title: "Kundhantering",
      description: "Hantera alla dina kunder och offerter på ett ställe"
    },
    {
      icon: BarChart3,
      title: "Rapporter & statistik",
      description: "Se hur dina offerter presterar med detaljerade rapporter"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Wrench className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Offertverktyget</h1>
                <p className="text-xs text-muted-foreground">Smarta offerter på minuter</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              onClick={() => navigate("/auth?mode=login")}
            >
              Logga in
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              Smarta offerter på minuter
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Skapa professionella offerter med AI-assistans, hantera kunder och följ upp dina affärer. 
              Allt du behöver för att effektivisera din offertprocess.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth?mode=signup")}
                className="text-base"
              >
                Kom igång gratis
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/auth?mode=login")}
                className="text-base"
              >
                Logga in
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">
              Funktioner som sparar tid
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                      </div>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground">
              Redo att komma igång?
            </h3>
            <p className="text-lg text-muted-foreground">
              Skapa ditt konto idag och börja skapa professionella offerter direkt.
            </p>
            <Button 
              size="lg"
              onClick={() => navigate("/auth?mode=signup")}
              className="text-base"
            >
              Skapa gratis konto
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
