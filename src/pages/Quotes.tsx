import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, AlertCircle, Plus, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import QuoteDisplay from "@/components/QuoteDisplay";
import QuoteEditor from "@/components/QuoteEditor";
import QuoteList from "@/components/QuoteList";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ContextualHelp } from "@/components/ContextualHelp";
import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { MobileNav } from "@/components/MobileNav";

const Quotes = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const quoteIdParam = searchParams.get('id');
  const customerIdParam = searchParams.get('customer');
  
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
  const [showQuoteList, setShowQuoteList] = useState(false);
  const [customerFilter, setCustomerFilter] = useState<string | null>(customerIdParam);
  const [customerName, setCustomerName] = useState<string>("");

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
    const customerId = searchParams.get("customer");
    if (customerId) {
      setCustomerFilter(customerId);
      loadCustomerName(customerId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      loadQuotes();
    }
  }, [user, customerFilter]);

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

  const loadCustomerName = async (customerId: string) => {
    const { data } = await supabase
      .from("customers")
      .select("name")
      .eq("id", customerId)
      .single();

    if (data) {
      setCustomerName(data.name);
    }
  };

  const loadQuotes = async () => {
    try {
      let query = supabase
        .from('quotes')
        .select(`
          *,
          customers (
            name,
            address
          )
        `)
        .order('created_at', { ascending: false });

      if (customerFilter) {
        query = query.eq('customer_id', customerFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setQuotes(data || []);
    } catch (error: any) {
      console.error('Error loading quotes:', error);
    }
  };

  const clearCustomerFilter = () => {
    setCustomerFilter(null);
    setCustomerName("");
    setSearchParams({});
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

  // FAS 5: Keyboard shortcuts
  useKeyboardShortcuts({
    onClose: viewingQuote ? handleCloseQuote : undefined,
  });


  const filteredQuotes = quotes.filter((quote) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === "" || 
      quote.title.toLowerCase().includes(searchLower) ||
      quote.description?.toLowerCase().includes(searchLower) ||
      quote.customers?.name?.toLowerCase().includes(searchLower) ||
      quote.customers?.address?.toLowerCase().includes(searchLower) ||
      quote.work_address?.toLowerCase().includes(searchLower);
    
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
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <AppHeader currentPage="quotes" />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* FAS 3: Breadcrumbs */}
        {viewingQuote && (
          <Breadcrumbs items={[
            { label: 'Hem', href: '/' },
            { label: 'Offerter', href: '/quotes' },
            { label: viewingQuote.title }
          ]} />
        )}

        {/* When quote is open - Simple 2-column layout */}
        {currentQuote && !isEditing && (
          <>
            {/* Toggle button for quote list */}
            <Button 
              onClick={() => setShowQuoteList(true)}
              className="mb-4"
              variant="outline"
              size="sm"
            >
              📋 Visa alla offerter
            </Button>

            <div className="grid lg:grid-cols-[1fr,400px] gap-6">
              {/* Left: QuoteDisplay */}
              <Card className="border-2 border-primary/20 bg-card shadow-routo">
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
                  showCompactView={true}
                />
              </Card>
              
              {/* Right: ChatInterface for non-completed quotes */}
              {viewingQuote?.status !== 'completed' && viewingQuote?.status !== 'accepted' && (
                <Card className="border-2 border-primary/20 bg-card shadow-routo sticky top-4 h-fit max-h-[calc(100vh-120px)] overflow-y-auto">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Förbättra med AI
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Chatta för att ändra eller lägga till arbeten
                    </CardDescription>
                  </CardHeader>
                  <div className="px-6 pb-6">
                    <ChatInterface
                      existingQuoteId={viewingQuote.id}
                      onQuoteGenerated={(updatedQuote) => {
                        setCurrentQuote(updatedQuote);
                        setIsGeneratingQuote(false);
                      }}
                      isGenerating={isGeneratingQuote}
                      onQuoteUpdated={async () => {
                        await loadQuotes();
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
                  </div>
                </Card>
              )}
            </div>
          </>
        )}

        {/* Editor mode */}
        {currentQuote && isEditing && (
          <>
            <Button 
              onClick={() => setShowQuoteList(true)}
              className="mb-4"
              variant="outline"
              size="sm"
            >
              📋 Visa alla offerter
            </Button>
            <QuoteEditor
              quote={currentQuote}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              isSaving={isSaving}
              quoteId={viewingQuote?.id}
            />
          </>
        )}

        {/* When no quote is open - Show quote list centered */}
        {!currentQuote && (
          <div className="max-w-6xl mx-auto">
            <Card className="bg-[hsl(36,45%,98%)] border-2 border-primary/10 shadow-routo mb-4">
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
                
                <div className="flex gap-2 mt-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Sök offerter..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {customerFilter && (
                    <Badge variant="secondary" className="gap-1 px-3 py-2 h-10 flex items-center">
                      Kund: {customerName}
                      <button
                        onClick={clearCustomerFilter}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
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

            <QuoteList 
              quotes={filteredQuotes}
              onQuoteClick={handleQuoteClick}
            />
          </div>
        )}

        {/* Sliding quote list panel */}
        {showQuoteList && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
              onClick={() => setShowQuoteList(false)}
            />
            
            {/* Sliding panel */}
            <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-xl z-50 animate-slide-in-right overflow-hidden flex flex-col">
              <div className="p-4 border-b flex items-center justify-between shrink-0">
                <h3 className="font-semibold">Dina offerter</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowQuoteList(false)}
                >
                  ✕
                </Button>
              </div>
              
              {/* Search & filter */}
              <div className="p-4 border-b space-y-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Sök offerter..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
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
              
              {/* Quote list */}
              <div className="overflow-y-auto flex-1 p-4">
                <QuoteList 
                  quotes={filteredQuotes} 
                  onQuoteClick={(quote) => {
                    handleQuoteClick(quote);
                    setShowQuoteList(false);
                  }}
                />
              </div>
            </div>
          </>
        )}
      </main>
      
      <MobileNav />
    </div>
  );
};

export default Quotes;
