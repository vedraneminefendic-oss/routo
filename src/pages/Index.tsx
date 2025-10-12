import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, LogOut, Settings as SettingsIcon } from "lucide-react";
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

  const handleGenerateQuote = async (description: string) => {
    setIsGenerating(true);
    setCurrentDescription(description);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: { 
          description,
          user_id: user?.id 
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
          status: 'draft'
        });

      if (error) throw error;

      toast.success("Offert sparad!");
      setCurrentQuote(null);
      setCurrentDescription("");
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
          status: 'draft'
        });

      if (error) throw error;

      toast.success("Redigerad offert sparad!");
      setCurrentQuote(null);
      setCurrentDescription("");
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
    setIsEditing(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Wrench className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Offertverktyget</h1>
                <p className="text-sm text-muted-foreground">Smarta offerter på minuter</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/settings")}>
                <SettingsIcon className="h-4 w-4 mr-2" />
                Inställningar
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
      <main className="container mx-auto px-4 py-8">
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
                isSaving={isSaving}
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
              <CardHeader>
                <CardTitle>Dina offerter</CardTitle>
                <CardDescription>
                  {quotes.length} {quotes.length === 1 ? 'offert' : 'offerter'} totalt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuoteList quotes={quotes} onQuoteClick={handleQuoteClick} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
