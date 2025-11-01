import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, AlertCircle, Plus, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import QuoteDisplay from "@/components/QuoteDisplay";
import QuoteEditor from "@/components/QuoteEditor";
import QuoteList from "@/components/QuoteList";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ContextualHelp } from "@/components/ContextualHelp";
import { AppHeader } from "@/components/AppHeader";

const Quotes = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const quoteIdParam = searchParams.get('id');
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [currentDescription, setCurrentDescription] = useState("");
  const [quotes, setQuotes] = useState<any[]>([]);
  const [viewingQuote, setViewingQuote] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(filterParam || "all");
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0);
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);

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

      // Auto-open quote if ID in URL
      if (quoteIdParam && !viewingQuote) {
        const quote = quotes.find(q => q.id === quoteIdParam);
        if (quote) {
          handleQuoteClick(quote);
        }
      }
    }
  }, [quotes, quoteIdParam]);

  const loadQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customers (
            name,
            address
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error: any) {
      console.error('Error loading quotes:', error);
    }
  };

  const handleQuoteClick = (quote: any) => {
    const quoteToDisplay = quote.edited_quote || quote.generated_quote;
    
    // Add deduction_type from database row to quote object
    const quoteWithDeduction = {
      ...quoteToDisplay,
      deductionType: quote.deduction_type || quoteToDisplay.deductionType || 'none'
    };
    
    setViewingQuote(quote);
    setCurrentQuote(quoteWithDeduction);
    setCurrentDescription(quote.description);
    setSearchParams({ id: quote.id });
  };

  const handleCloseQuote = () => {
    setViewingQuote(null);
    setCurrentQuote(null);
    setCurrentDescription("");
    setIsEditing(false);
    setSearchParams({});
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

  const handleEditQuote = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async (editedQuote: any) => {
    if (!viewingQuote || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          edited_quote: editedQuote,
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', viewingQuote.id);

      if (error) throw error;

      toast.success("Ändringar sparade!");
      setIsEditing(false);
      await loadQuotes();
      
      // Update current view
      const updatedQuote = { ...viewingQuote, edited_quote: editedQuote, is_edited: true };
      setViewingQuote(updatedQuote);
      setCurrentQuote(editedQuote);
    } catch (error: any) {
      console.error('Error saving edited quote:', error);
      toast.error(error.message || "Kunde inte spara ändringar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laddar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader currentPage="quotes" />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Quote Display/Editor with Tabs for Draft */}
          <div className="space-y-6">
            {currentQuote && !isEditing && viewingQuote?.status === 'draft' && (
              <Card className="border-2 border-primary/20 bg-card shadow-routo">
                <Tabs defaultValue="view" className="w-full">
                  <div className="border-b px-6 pt-4">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                      <TabsTrigger value="view" className="gap-2">
                        <Eye className="h-4 w-4" />
                        Visa offert
                      </TabsTrigger>
                      <TabsTrigger value="chat" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Chatta & förbättra
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="view" className="m-0 p-6">
                    <QuoteDisplay 
                      quote={currentQuote} 
                      onEdit={handleEditQuote}
                      onClose={handleCloseQuote}
                      onDelete={handleDeleteQuote}
                      onDuplicate={handleDuplicateQuote}
                      isSaving={isSaving}
                      quoteId={viewingQuote?.id}
                      currentStatus={viewingQuote?.status}
                      onStatusChanged={loadQuotes}
                    />
                  </TabsContent>

                  <TabsContent value="chat" className="m-0 p-6">
                    <ChatInterface
                      existingQuoteId={viewingQuote.id}
                      onQuoteGenerated={(updatedQuote) => {
                        // Update the current quote when AI updates it
                        setCurrentQuote(updatedQuote);
                        setIsGeneratingQuote(false);
                      }}
                      isGenerating={isGeneratingQuote}
                      onQuoteUpdated={async () => {
                        await loadQuotes();
                        // Refresh current quote
                        const updated = await supabase
                          .from('quotes')
                          .select('*')
                          .eq('id', viewingQuote.id)
                          .single();
                        if (updated.data) {
                          const updatedQuoteData = updated.data.edited_quote || updated.data.generated_quote;
                          if (updatedQuoteData && typeof updatedQuoteData === 'object') {
                            setCurrentQuote({
                              ...(updatedQuoteData as any),
                              deductionType: updated.data.deduction_type || (updatedQuoteData as any).deductionType || 'none'
                            });
                            setViewingQuote(updated.data);
                          }
                        }
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </Card>
            )}

            {currentQuote && !isEditing && viewingQuote?.status !== 'draft' && (
              <QuoteDisplay 
                quote={currentQuote} 
                onEdit={handleEditQuote}
                onClose={handleCloseQuote}
                onDelete={handleDeleteQuote}
                onDuplicate={handleDuplicateQuote}
                isSaving={isSaving}
                quoteId={viewingQuote?.id}
                currentStatus={viewingQuote?.status}
                onStatusChanged={loadQuotes}
              />
            )}

            {currentQuote && isEditing && (
              <QuoteEditor
                quote={currentQuote}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                isSaving={isSaving}
                quoteId={viewingQuote?.id}
              />
            )}

            {!currentQuote && (
              <Card className="h-full flex items-center justify-center min-h-[400px] bg-[hsl(36,45%,98%)] border-2 border-primary/10">
                <div className="text-center p-8">
                  <p className="text-muted-foreground mb-4">Välj en offert från listan för att visa den här</p>
                  <Button onClick={() => navigate('/quotes/new')} className="bg-primary hover:bg-primary/90 shadow-routo hover:shadow-routo-lg transition-all">
                    <Plus className="h-4 w-4 mr-2" />
                    Skapa ny offert
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column - Quote List */}
          <div>
            <Card className="bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-heading text-primary">Dina offerter</CardTitle>
                    <ContextualHelp content="Här ser du alla dina sparade offerter. Klicka på en offert för att visa, redigera eller skicka den. Du kan också söka och filtrera på status." />
                  </div>
                  <Button size="sm" onClick={() => navigate('/quotes/new')} className="bg-primary hover:bg-primary/90 shadow-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Ny offert
                  </Button>
                </div>
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
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Filtrera..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla</SelectItem>
                      <SelectItem value="draft">Utkast</SelectItem>
                      <SelectItem value="sent">Skickade</SelectItem>
                      <SelectItem value="viewed">Visade</SelectItem>
                      <SelectItem value="accepted">Accepterade</SelectItem>
                      <SelectItem value="completed">Slutförda</SelectItem>
                      <SelectItem value="needs_followup">Behöver uppföljning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
            </Card>

            <div className="mt-4">
              <QuoteList 
                quotes={filteredQuotes}
                onQuoteClick={handleQuoteClick}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Quotes;
