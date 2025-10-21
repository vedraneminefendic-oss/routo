import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, LogOut, Settings as SettingsIcon, BarChart3, Users, Search, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import QuoteDisplay from "@/components/QuoteDisplay";
import QuoteEditor from "@/components/QuoteEditor";
import QuoteList from "@/components/QuoteList";
import { OnboardingWizard } from "@/components/OnboardingWizard";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [currentDescription, setCurrentDescription] = useState("");
  const [quotes, setQuotes] = useState<any[]>([]);
  const [viewingQuote, setViewingQuote] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentCustomerId, setCurrentCustomerId] = useState<string | undefined>(undefined);
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0);
  const [hasCustomRates, setHasCustomRates] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(650);

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
      loadQuotes();
    }
  }, [user]);

  useEffect(() => {
    if (quotes.length > 0) {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      const pending = quotes.filter(q => {
        if (q.status === 'sent' && q.sent_at) {
          return new Date(q.sent_at) < threeDaysAgo;
        }
        if (q.status === 'viewed' && q.viewed_at) {
          return new Date(q.viewed_at) < threeDaysAgo;
        }
        return false;
      });
      
      setPendingQuotesCount(pending.length);
    }
  }, [quotes]);

  const loadQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error: any) {
      console.error('Error loading quotes:', error);
    }
  };


  const handleSaveQuote = async () => {
    if (!currentQuote || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: currentQuote.title,
          description: currentDescription,
          generated_quote: currentQuote,
          status: 'draft',
          customer_id: currentCustomerId || null
        });

      if (error) throw error;

      toast.success("Offert sparad!");
      setCurrentQuote(null);
      setCurrentDescription("");
      setCurrentCustomerId(undefined);
      setIsEditing(false);
      await loadQuotes();
    } catch (error: any) {
      console.error('Error saving quote:', error);
      toast.error(error.message || "Kunde inte spara offert");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditQuote = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async (editedQuote: any) => {
    if (!currentQuote || !user) return;

    setIsSaving(true);
    try {
      // Save as new quote with edited data
      const { error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: editedQuote.title,
          description: currentDescription,
          generated_quote: currentQuote,
          edited_quote: editedQuote,
          is_edited: true,
          status: 'draft',
          customer_id: currentCustomerId || null
        });

      if (error) throw error;

      toast.success("Redigerad offert sparad!");
      setCurrentQuote(null);
      setCurrentDescription("");
      setCurrentCustomerId(undefined);
      setIsEditing(false);
      await loadQuotes();
    } catch (error: any) {
      console.error('Error saving edited quote:', error);
      toast.error(error.message || "Kunde inte spara redigerad offert");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleQuoteClick = (quote: any) => {
    // Show the saved quote
    const quoteToDisplay = quote.edited_quote || quote.generated_quote;
    setViewingQuote(quote);
    setCurrentQuote(quoteToDisplay);
    setCurrentDescription(quote.description);
  };

  const handleCloseQuote = () => {
    setViewingQuote(null);
    setCurrentQuote(null);
    setCurrentDescription("");
    setCurrentCustomerId(undefined);
    setIsEditing(false);
  };

  const handleDeleteQuote = async () => {
    await handleCloseQuote();
    await loadQuotes();
  };

  const handleDuplicateQuote = async () => {
    if (!currentQuote || !user) return;

    const title = prompt("Namn på duplicerad offert:", `${currentQuote.title} (kopia)`);
    if (!title) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('quotes').insert([
        {
          user_id: user.id,
          title,
          description: currentDescription,
          generated_quote: currentQuote,
          status: 'draft',
          customer_id: viewingQuote?.customer_id || null,
        },
      ]);

      if (error) throw error;

      toast.success("Offert duplicerad!");
      loadQuotes();
      handleCloseQuote();
    } catch (error) {
      console.error('Error duplicating quote:', error);
      toast.error("Kunde inte duplicera offert");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };


  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch = searchTerm === "" || 
      quote.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    
    if (statusFilter === "needs_followup") {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      matchesStatus = (
        (quote.status === 'sent' && quote.sent_at && new Date(quote.sent_at) < threeDaysAgo) ||
        (quote.status === 'viewed' && quote.viewed_at && new Date(quote.viewed_at) < threeDaysAgo)
      );
    } else if (statusFilter !== "all") {
      matchesStatus = quote.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      <main className="container mx-auto px-4 py-8 bg-background">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Create New Quote Button */}
          <div className="space-y-6">
            {!currentQuote && (
              <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg">Skapa ny offert</CardTitle>
                  <CardDescription>
                    Använd vår AI-assistent för att snabbt skapa professionella offerter
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => navigate('/quotes/new')}
                    className="w-full"
                    size="lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Ny offert med AI
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {currentQuote && !isEditing && (
              <QuoteDisplay 
                quote={currentQuote} 
                onSave={viewingQuote ? undefined : handleSaveQuote}
                onEdit={handleEditQuote}
                onClose={viewingQuote ? handleCloseQuote : undefined}
                onDelete={viewingQuote ? handleDeleteQuote : undefined}
                onDuplicate={viewingQuote ? handleDuplicateQuote : undefined}
                isSaving={isSaving}
                quoteId={viewingQuote?.id}
                currentStatus={viewingQuote?.status}
                onStatusChanged={loadQuotes}
                hasCustomRates={hasCustomRates}
                hourlyRate={hourlyRate}
              />
            )}

            {currentQuote && isEditing && (
              <QuoteEditor
                quote={currentQuote}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                isSaving={isSaving}
              />
            )}
          </div>

          {/* Right Column - Quote List */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-secondary">Dina offerter</CardTitle>
                <CardDescription className="text-xs">
                  {quotes.length} {quotes.length === 1 ? 'offert' : 'offerter'} totalt
                </CardDescription>

                {pendingQuotesCount > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg mt-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        {pendingQuotesCount} {pendingQuotesCount === 1 ? 'offert behöver' : 'offerter behöver'} uppföljning
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Skickade för mer än 3 dagar sedan utan svar
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setStatusFilter('needs_followup')}
                      className="shrink-0 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900"
                    >
                      Visa
                    </Button>
                  </div>
                )}
                
                <div className="flex gap-2 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Sök offerter..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla</SelectItem>
                      <SelectItem value="needs_followup">
                        <span className="flex items-center gap-2">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          Behöver uppföljning
                        </span>
                      </SelectItem>
                      <SelectItem value="draft">Utkast</SelectItem>
                      <SelectItem value="sent">Skickad</SelectItem>
                      <SelectItem value="viewed">Visad</SelectItem>
                      <SelectItem value="accepted">Accepterad</SelectItem>
                      <SelectItem value="rejected">Avvisad</SelectItem>
                      <SelectItem value="completed">Slutförd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <QuoteList quotes={filteredQuotes} onQuoteClick={handleQuoteClick} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
