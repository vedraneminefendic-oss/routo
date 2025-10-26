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
              <img src="/routo-logo.jpeg" alt="Routo" className="h-12 w-12 rounded-xl object-cover shadow-md" />
              <div>
                <h1 className="text-2xl font-bold text-primary">routo</h1>
                <p className="text-xs text-muted-foreground">Skapa offerter enkelt</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate("/auth?mode=login")}
              className="rounded-xl"
            >
              Logga in
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section with Routo organic shapes */}
      <main className="flex-1">
        <section className="relative container mx-auto px-4 py-16 md:py-24 overflow-hidden">
          {/* Decorative organic shapes */}
          <div className="absolute top-20 right-10 w-64 h-64 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-secondary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="max-w-3xl mx-auto text-center space-y-6 relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              Smarta offerter på minuter
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Med Routo skapar du professionella offerter med AI-assistans, hanterar kunder och följer upp dina affärer. 
              Allt du behöver för att effektivisera din offertprocess.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth?mode=signup")}
                className="text-base rounded-xl bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                Kom igång gratis
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/auth?mode=login")}
                className="text-base rounded-xl border-2 hover:bg-primary/10 hover:border-primary/50 transition-all duration-300"
              >
                Logga in
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section with Routo styling */}
        <section className="container mx-auto px-4 py-16 bg-gradient-to-br from-muted/30 to-background">
          <div className="max-w-5xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">
              Funktioner som sparar tid
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card 
                    key={index}
                    className="border-2 hover:border-primary/30 hover:shadow-xl transition-all duration-300 rounded-2xl group"
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors duration-300">{feature.title}</CardTitle>
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

        {/* CTA Section with Routo warmth */}
        <section className="relative container mx-auto px-4 py-16 md:py-24 overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-10 left-1/4 w-40 h-40 bg-secondary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-1/4 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-3xl mx-auto text-center space-y-6 relative z-10">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground">
              Redo att komma igång?
            </h3>
            <p className="text-lg text-muted-foreground">
              Skapa ditt Routo-konto idag och börja skapa professionella offerter direkt.
            </p>
            <Button 
              size="lg"
              onClick={() => navigate("/auth?mode=signup")}
              className="text-base rounded-xl bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
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
