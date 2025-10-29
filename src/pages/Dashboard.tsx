import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, AlertCircle, Plus, Layout } from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { StatisticsCards } from "@/components/reports/StatisticsCards";
import { AppHeader } from "@/components/AppHeader";
import { ActionableInsights } from "@/components/ActionableInsights";
import { toast } from "sonner";
const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0);
  const [actionableInsights, setActionableInsights] = useState<any[]>([]);
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth?mode=login");
      }
      setLoading(false);
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth?mode=login");
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
      const {
        data: quotesData,
        error: quotesError
      } = await supabase.from('quotes').select('*').order('created_at', {
        ascending: false
      }).limit(5);
      if (quotesError) throw quotesError;
      setQuotes(quotesData || []);

      // Calculate pending quotes
      const now = new Date();
      const pendingThreshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const pending = (quotesData || []).filter(q => {
        if (q.status === 'sent' && q.sent_at) {
          return new Date(q.sent_at) < pendingThreshold;
        }
        if (q.status === 'viewed' && q.viewed_at) {
          return new Date(q.viewed_at) < pendingThreshold;
        }
        return false;
      });
      setPendingQuotesCount(pending.length);

      // Load statistics
      const {
        data: statsData
      } = await supabase.from('quotes').select('status, generated_quote, edited_quote');
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
          accepted_count: acceptedCount
        });
      }

      // Skapa actionable insights
      const insights: any[] = [];
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      (quotesData || []).forEach((quote: any) => {
        const quoteData = quote.edited_quote || quote.generated_quote;
        const amount = quoteData?.summary?.customerPays || 0;
        if ((quote.status === 'sent' || quote.status === 'viewed') && (quote.sent_at && new Date(quote.sent_at) < threeDaysAgo || quote.viewed_at && new Date(quote.viewed_at) < threeDaysAgo)) {
          const date = new Date(quote.viewed_at || quote.sent_at);
          const daysSince = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
          insights.push({
            id: quote.id,
            type: 'urgent',
            title: `Följ upp "${quote.title}"`,
            description: `Skickad för ${daysSince} dagar sedan utan svar`,
            quoteName: quote.title,
            amount,
            action: {
              label: 'Visa offert',
              onClick: () => navigate(`/quotes?id=${quote.id}`)
            }
          });
        }
      });
      setActionableInsights(insights.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error("Kunde inte ladda data");
    }
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
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
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laddar...</div>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      <AppHeader currentPage="dashboard" />

      {/* Onboarding Wizard */}
      {user && <OnboardingWizard userId={user.id} onComplete={() => console.log("Onboarding complete")} />}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section with Routo organic shapes */}
        <div className="mb-10 animate-in fade-in-0 slide-in-from-top-4 duration-700">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-secondary/5 to-background rounded-2xl p-6 md:p-8 border-2 border-primary/20 shadow-xl group">
            {/* Decorative organic shapes */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">Välkommen till routo! 👋</h2>
              <p className="text-lg text-muted-foreground">
                Här är en översikt över din verksamhet
              </p>
            </div>
          </div>
        </div>

        {/* Actionable Insights */}
        {actionableInsights.length > 0 && <div className="mb-8">
            <ActionableInsights insights={actionableInsights} />
          </div>}

        {/* Statistics Cards */}
        <div className="mb-8">
          <StatisticsCards statistics={statistics} loading={!statistics} />
        </div>

        {/* Pending Quotes Alert */}
        {pendingQuotesCount > 0 && <Card className="mb-10 border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 via-amber-50/50 to-amber-100/30 dark:from-amber-950/20 dark:via-amber-950/10 dark:to-amber-950/5 shadow-xl hover:shadow-2xl transition-all duration-500 animate-in fade-in-0 slide-in-from-top-4 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-100/50 to-transparent dark:from-amber-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardContent className="flex items-center gap-5 pt-6 relative">
              <div className="p-3 bg-amber-200/50 dark:bg-amber-800/30 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-md">
                <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-500 shrink-0 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg text-amber-900 dark:text-amber-100 mb-1">
                  {pendingQuotesCount} {pendingQuotesCount === 1 ? 'offert behöver' : 'offerter behöver'} uppföljning
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Skickade för mer än 3 dagar sedan utan svar
                </p>
              </div>
              <Button onClick={() => navigate('/quotes?filter=needs_followup')} className="shrink-0 bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" variant="default">
                Visa offerter
              </Button>
            </CardContent>
          </Card>}

        {/* Quick Actions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <Card className="group cursor-pointer hover:shadow-2xl transition-all duration-500 border-2 hover:border-primary/50 hover:scale-105 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4" style={{
          animationDelay: '100ms'
        }} onClick={() => navigate('/quotes/new')}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardHeader className="relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-md">
                  <Plus className="h-6 w-6 text-primary group-hover:animate-pulse" />
                </div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors duration-300">Skapa ny offert</CardTitle>
              </div>
              <CardDescription>
                Generera en professionell offert med AI på några sekunder
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group cursor-pointer hover:shadow-2xl transition-all duration-500 border-2 hover:border-secondary/50 hover:scale-105 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4" style={{
          animationDelay: '200ms'
        }} onClick={() => navigate('/quotes/new?templates=true')}>
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardHeader className="relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-md">
                  <Layout className="h-6 w-6 text-secondary group-hover:animate-pulse" />
                </div>
                <CardTitle className="text-lg group-hover:text-secondary transition-colors duration-300">Använd mall</CardTitle>
              </div>
              <CardDescription>
                Börja snabbt med färdiga mallar för vanliga ROT/RUT-jobb
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group cursor-pointer hover:shadow-2xl transition-all duration-500 border-2 hover:border-accent/50 hover:scale-105 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4" style={{
          animationDelay: '300ms'
        }} onClick={() => navigate('/quotes')}>
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <CardHeader className="relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-md">
                  <FileText className="h-6 w-6 text-accent group-hover:animate-pulse" />
                </div>
                <CardTitle className="text-lg group-hover:text-accent transition-colors duration-300">Alla offerter</CardTitle>
              </div>
              <CardDescription>
                Visa, redigera och hantera alla dina sparade offerter
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-2 shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Senaste offerterna</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/quotes')} className="hover:bg-primary/10 hover:text-primary transition-colors duration-300">
                Visa alla
              </Button>
            </div>
            <CardDescription>
              De 5 senast skapade offerterna
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            {quotes.length === 0 ? <div className="text-center py-12 animate-in fade-in-0 zoom-in-95 duration-500">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-6 text-lg">Inga offerter ännu</p>
                <Button onClick={() => navigate('/quotes/new')} className="bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <Plus className="h-4 w-4 mr-2" />
                  Skapa din första offert
                </Button>
              </div> : <div className="space-y-3">
                {quotes.map((quote, index) => {
              const quoteData = quote.edited_quote || quote.generated_quote;
              const summary = quoteData?.summary;
              const totalAmount = summary?.customerPays || 0;
              return <div key={quote.id} className="group/item flex items-center justify-between p-5 border-2 rounded-xl hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.02] hover:border-primary/30 animate-in fade-in-0 slide-in-from-left-4" style={{
                animationDelay: `${index * 75}ms`
              }} onClick={() => navigate(`/quotes?id=${quote.id}`)}>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base text-foreground truncate mb-1 group-hover/item:text-primary transition-colors duration-300">
                          {quote.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(quote.created_at)}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-lg text-foreground group-hover/item:text-primary transition-colors duration-300">
                          {formatCurrency(totalAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize px-2.5 py-1 rounded-full bg-muted/50 group-hover/item:bg-primary/10 transition-colors duration-300">
                          {quote.status === 'draft' && 'Utkast'}
                          {quote.status === 'sent' && 'Skickad'}
                          {quote.status === 'viewed' && 'Visad'}
                          {quote.status === 'accepted' && 'Accepterad'}
                          {quote.status === 'completed' && 'Slutförd'}
                        </p>
                      </div>
                    </div>;
            })}
              </div>}
          </CardContent>
        </Card>
      </main>
    </div>;
};
export default Dashboard;