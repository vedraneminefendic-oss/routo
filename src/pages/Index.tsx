import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, LogOut, Settings as SettingsIcon, BarChart3, Users, Search } from "lucide-react";
import { toast } from "sonner";
import QuoteForm from "@/components/QuoteForm";
import QuoteDisplay from "@/components/QuoteDisplay";
import QuoteEditor from "@/components/QuoteEditor";
import QuoteList from "@/components/QuoteList";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [currentDescription, setCurrentDescription] = useState("");
  const [quotes, setQuotes] = useState<any[]>([]);
  const [viewingQuote, setViewingQuote] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentCustomerId, setCurrentCustomerId] = useState<string | undefined>(undefined);

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

  const handleGenerateQuote = async (description: string, customerId?: string) => {
    setIsGenerating(true);
    setCurrentDescription(description);
    setCurrentCustomerId(customerId);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: { 
          description,
          user_id: user?.id,
          customer_id: customerId
        }
      });

      if (error) throw error;
      
      setCurrentQuote(data.quote);
      
      // Visa varning om inga anpassade timpriser användes
      if (!data.hasCustomRates) {
        toast.warning("Du har inte lagt in några timpriser i inställningarna. Använder standardpris 650 kr/h.", {
          duration: 5000
        });
      }
      
      toast.success("Offert genererad!");
    } catch (error: any) {
      console.error('Error generating quote:', error);
      toast.error(error.message || "Kunde inte generera offert");
    } finally {
      setIsGenerating(false);
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
    
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    
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
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg shadow-md">
                <Wrench className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-secondary">Offertverktyget</h1>
                <p className="text-sm text-muted-foreground">Smarta offerter på minuter</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/customers")}>
                <Users className="h-4 w-4 mr-2" />
                Kunder
              </Button>
              <Button variant="outline" onClick={() => navigate("/settings")}>
                <SettingsIcon className="h-4 w-4 mr-2" />
                Inställningar
              </Button>
              <Button variant="outline" onClick={() => navigate("/reports")}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Rapporter
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logga ut
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 bg-background">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Form & Generated Quote */}
          <div className="space-y-6">
            <QuoteForm onGenerate={handleGenerateQuote} isGenerating={isGenerating} />
            
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
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla</SelectItem>
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
