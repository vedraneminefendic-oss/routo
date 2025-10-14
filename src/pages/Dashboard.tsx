import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, LogOut, Settings as SettingsIcon, BarChart3, Users, FileText, TrendingUp, AlertCircle, Plus, Layout } from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { StatisticsCards } from "@/components/reports/StatisticsCards";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0);

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

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      // Load quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (quotesError) throw quotesError;
      setQuotes(quotesData || []);

      // Calculate pending quotes
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      const pending = (quotesData || []).filter(q => {
        if (q.status === 'sent' && q.sent_at) {
          return new Date(q.sent_at) < threeDaysAgo;
        }
        if (q.status === 'viewed' && q.viewed_at) {
          return new Date(q.viewed_at) < threeDaysAgo;
        }
        return false;
      });
      
      setPendingQuotesCount(pending.length);

      // Load statistics
      const { data: statsData } = await supabase
        .from('quotes')
        .select('status, generated_quote, edited_quote');

      if (statsData) {
        const totalQuotes = statsData.length;
        const sentCount = statsData.filter(q => ['sent', 'viewed', 'accepted', 'completed'].includes(q.status)).length;
        const acceptedCount = statsData.filter(q => ['accepted', 'completed'].includes(q.status)).length;
        
        const totalValue = statsData.reduce((sum, quote) => {
          const quoteData = quote.edited_quote || quote.generated_quote;
          if (quoteData && typeof quoteData === 'object') {
            const summary = (quoteData as any).summary;
            const value = summary?.customerPays || 0;
            return sum + parseFloat(value.toString());
          }
          return sum;
        }, 0);

        const avgQuoteValue = totalQuotes > 0 ? totalValue / totalQuotes : 0;

        setStatistics({
          total_quotes: totalQuotes,
          total_value: totalValue,
          avg_quote_value: avgQuoteValue,
          sent_count: sentCount,
          accepted_count: acceptedCount,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laddar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg shadow-md transition-transform hover:scale-105">
                <Wrench className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl md:text-2xl font-bold text-secondary">Offertverktyget</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden md:block">Smarta offerter på minuter</p>
              </div>
            </div>
            <nav className="flex gap-1 md:gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="hidden md:flex">
                <Users className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Kunder</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="hidden md:flex">
                <SettingsIcon className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Inställningar</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="hidden md:flex">
                <BarChart3 className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Rapporter</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="md:hidden">
                <Users className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="md:hidden">
                <SettingsIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="md:hidden">
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Logga ut</span>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Onboarding Wizard */}
      {user && (
        <OnboardingWizard 
          userId={user.id} 
          onComplete={() => console.log("Onboarding complete")} 
        />
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Välkommen tillbaka! 👋
          </h2>
          <p className="text-muted-foreground text-lg">
            Här är en översikt över din verksamhet
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="mb-8">
          <StatisticsCards statistics={statistics} loading={!statistics} />
        </div>

        {/* Pending Quotes Alert */}
        {pendingQuotesCount > 0 && (
          <Card className="mb-8 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="flex items-center gap-4 pt-6">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-500 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  {pendingQuotesCount} {pendingQuotesCount === 1 ? 'offert behöver' : 'offerter behöver'} uppföljning
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Skickade för mer än 3 dagar sedan utan svar
                </p>
              </div>
              <Button 
                onClick={() => navigate('/quotes?filter=needs_followup')}
                className="shrink-0"
                variant="default"
              >
                Visa offerter
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
            onClick={() => navigate('/quotes/new')}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Skapa ny offert</CardTitle>
              </div>
              <CardDescription>
                Generera en professionell offert med AI på några sekunder
              </CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-secondary"
            onClick={() => navigate('/quotes/new?templates=true')}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-secondary/10 rounded-lg">
                  <Layout className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle className="text-lg">Använd mall</CardTitle>
              </div>
              <CardDescription>
                Börja snabbt med färdiga mallar för vanliga ROT/RUT-jobb
              </CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-accent"
            onClick={() => navigate('/quotes')}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-accent/10 rounded-lg">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-lg">Alla offerter</CardTitle>
              </div>
              <CardDescription>
                Visa, redigera och hantera alla dina sparade offerter
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Senaste offerterna</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/quotes')}>
                Visa alla
              </Button>
            </div>
            <CardDescription>
              De 5 senast skapade offerterna
            </CardDescription>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">Inga offerter ännu</p>
                <Button onClick={() => navigate('/quotes/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Skapa din första offert
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((quote) => {
                  const quoteData = quote.edited_quote || quote.generated_quote;
                  const summary = quoteData?.summary;
                  const totalAmount = summary?.customerPays || 0;

                  return (
                    <div
                      key={quote.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/quotes?id=${quote.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate mb-1">
                          {quote.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(quote.created_at)}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-foreground">
                          {formatCurrency(totalAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {quote.status === 'draft' && 'Utkast'}
                          {quote.status === 'sent' && 'Skickad'}
                          {quote.status === 'viewed' && 'Visad'}
                          {quote.status === 'accepted' && 'Accepterad'}
                          {quote.status === 'completed' && 'Slutförd'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
