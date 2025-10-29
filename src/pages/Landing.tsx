import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Zap, TrendingUp, MessageSquare, Brain, Clock } from "lucide-react";
import { RoutoLandingShapes, RoutoFeatureShapes } from "@/components/RoutoLandingShapes";
import Footer from "@/components/Footer";

const Landing = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
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
      icon: Brain,
      title: "AI-driven offertgenerering",
      description: "Vår intelligenta AI skapar skräddarsydda offerter baserat på en kort konversation med dig.",
    },
    {
      icon: MessageSquare,
      title: "Smart konversation",
      description: "Svara på några enkla frågor så tar AI:n hand om resten. Inga långa formulär.",
    },
    {
      icon: Zap,
      title: "ROT/RUT-automatik",
      description: "Automatisk klassificering och beräkning av avdragsgilla arbeten enligt Skatteverkets regler.",
    },
    {
      icon: TrendingUp,
      title: "Självlärande system",
      description: "Ju fler offerter du skapar, desto smartare blir systemet för just ditt företag.",
    },
    {
      icon: Clock,
      title: "Spara tid",
      description: "Skapa en komplett offert på 2-3 minuter istället för 30 minuter.",
    },
    {
      icon: FileText,
      title: "Professionellt resultat",
      description: "Snygga, professionella offerter med din logotype och alla detaljer på plats.",
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Navigation Header */}
      <header className="relative z-20 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/routo-logo.jpeg" alt="Routo" className="h-10 w-10 rounded-lg" />
              <h1 className="text-2xl font-heading font-black text-foreground">Routo</h1>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                Funktioner
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                Priser
              </a>
              <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                Kontakt
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate("/auth")}
                className="font-medium"
              >
                Logga in
              </Button>
              <Button
                variant="routo"
                size="lg"
                onClick={() => navigate("/auth")}
              >
                Prova gratis
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Asymmetric Layout */}
      <section className="relative min-h-[85vh] flex items-center">
        <RoutoLandingShapes />
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="space-y-8 max-w-2xl">
              <div className="space-y-4">
                <h2 className="text-5xl md:text-7xl font-heading font-black text-foreground leading-tight tracking-tight">
                  Skapa offerter
                  <span className="block text-primary mt-2">på minuter</span>
                </h2>
                <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
                  Med Routo kan du snabbt och smidigt skapa professionella offerter. 
                  Vår AI hjälper dig hela vägen – från första frågan till färdig offert.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  variant="routo"
                  size="xl"
                  onClick={() => navigate("/auth")}
                  className="text-lg"
                >
                  Kom igång gratis
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  onClick={() => navigate("/auth")}
                  className="text-lg border-2 hover:bg-secondary hover:text-secondary-foreground hover:border-secondary"
                >
                  Se hur det fungerar
                </Button>
              </div>

              {/* Social Proof */}
              <div className="flex items-center gap-6 pt-8 border-t border-border/50">
                <div>
                  <div className="text-3xl font-heading font-bold text-foreground">2-3 min</div>
                  <div className="text-sm text-muted-foreground">per offert</div>
                </div>
                <div className="h-12 w-px bg-border/50" />
                <div>
                  <div className="text-3xl font-heading font-bold text-foreground">100%</div>
                  <div className="text-sm text-muted-foreground">automatiskt</div>
                </div>
                <div className="h-12 w-px bg-border/50" />
                <div>
                  <div className="text-3xl font-heading font-bold text-foreground">ROT/RUT</div>
                  <div className="text-sm text-muted-foreground">redo</div>
                </div>
              </div>
            </div>

            {/* Right: Decorative Space with Shapes */}
            <div className="hidden md:block relative h-[500px]">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full">
                  {/* Abstract illustration area */}
                  <div 
                    className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-primary/30 to-secondary/30 rounded-full blur-3xl"
                    style={{ animation: 'pulse 4s ease-in-out infinite' }}
                  />
                  <div 
                    className="absolute bottom-20 left-10 w-64 h-64 bg-gradient-to-br from-accent/40 to-primary/20 rounded-full blur-2xl"
                    style={{ animation: 'float 6s ease-in-out infinite' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Masonry-style Grid */}
      <section id="features" className="relative py-24 bg-card/50">
        <RoutoFeatureShapes />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h3 className="text-4xl md:text-5xl font-heading font-black text-foreground">
              Allt du behöver för professionella offerter
            </h3>
            <p className="text-xl text-muted-foreground">
              Routo kombinerar AI-teknologi med branschkunskap för att ge dig den bästa offertupplevelsen.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:scale-105 transition-all duration-300 border-2 hover:border-primary/50 bg-card/80 backdrop-blur-sm shadow-lg hover:shadow-2xl rounded-3xl overflow-hidden"
              >
                <CardHeader className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-heading font-bold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Bold & Simple */}
      <section className="relative py-32 bg-gradient-to-br from-primary via-primary/90 to-secondary overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTZ2LTZoNnYtNmg2djZoNnY2aC02djZoLTZ2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-3xl mx-auto space-y-8">
            <h3 className="text-4xl md:text-6xl font-heading font-black text-white leading-tight">
              Redo att spara tid och vinna fler kunder?
            </h3>
            <p className="text-xl md:text-2xl text-white/90 leading-relaxed">
              Gå med idag och skapa din första offert på 2 minuter. Helt gratis att komma igång.
            </p>
            <div className="pt-6">
              <Button
                variant="outline"
                size="xl"
                onClick={() => navigate("/auth")}
                className="text-lg bg-white text-primary hover:bg-white/90 hover:text-primary border-0 shadow-2xl hover:shadow-3xl hover:-translate-y-1 rounded-full font-heading font-bold px-12"
              >
                Kom igång nu – helt gratis
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
