import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, LogOut, Settings as SettingsIcon, BarChart3, Users, ArrowLeft, MessageSquare, Zap } from "lucide-react";
import { toast } from "sonner";
import QuoteDisplay from "@/components/QuoteDisplay";
import QuoteEditor from "@/components/QuoteEditor";
import { AIProgressIndicator } from "@/components/AIProgressIndicator";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { LiveQuotePreview } from "@/components/chat/LiveQuotePreview";
import { ExpressQuoteForm } from "@/components/ExpressQuoteForm";

const NewQuote = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showTemplates = searchParams.get('templates') === 'true';
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [currentDescription, setCurrentDescription] = useState("");
  const [currentCustomerId, setCurrentCustomerId] = useState<string | undefined>(undefined);
  const [hasCustomRates, setHasCustomRates] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(650);
  
  // P1: Live preview state
  const [conversationSummary, setConversationSummary] = useState<any>(null);
  
  // Quality/validation state
  const [qualityWarning, setQualityWarning] = useState<string | undefined>(undefined);
  const [warningMessage, setWarningMessage] = useState<string | undefined>(undefined);
  const [realismWarnings, setRealismWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [bathroomValidation, setBathroomValidation] = useState<any>(null);
  
  // Reference metadata
  const [usedReference, setUsedReference] = useState<boolean | undefined>(undefined);
  const [referenceTitle, setReferenceTitle] = useState<string | undefined>(undefined);

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

  // SPRINT 2: Express mode handler
  const handleExpressGenerate = async (data: {
    projectType: string;
    description: string;
    measurements: string;
    deductionType: string;
  }) => {
    setIsGenerating(true);
    setCurrentDescription(data.description);
    
    // Reset warnings
    setQualityWarning(undefined);
    setWarningMessage(undefined);
    setRealismWarnings([]);
    setValidationErrors([]);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-quote', {
        body: { 
          description: data.description,
          user_id: user?.id,
          detailLevel: 'standard',
          deductionType: data.deductionType,
          intent: 'generate' // Force generation without questions
        }
      });

      if (error) throw error;
      
      const quoteWithDeduction = {
        ...result.quote,
        deductionType: result.deductionType || result.quote.deductionType || 'none'
      };
      setCurrentQuote(quoteWithDeduction);
      
      if (result.realismWarnings) {
        setRealismWarnings(result.realismWarnings);
      }
      if (result.validationErrors) {
        setValidationErrors(result.validationErrors);
      }
      if (result.validationWarnings) {
        setBathroomValidation(result.validationWarnings);
      }
      
      toast.success("✅ Offert genererad!", {
        description: "Nu kan du granska och redigera offerten"
      });
      
    } catch (error: any) {
      console.error('Error generating express quote:', error);
      toast.error("Fel vid generering", {
        description: error.message || "Kunde inte generera offert"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateQuote = async (description: string, customerId?: string, detailLevel?: string, deductionType?: string, referenceQuoteId?: string) => {
    setIsGenerating(true);
    setCurrentDescription(description);
    setCurrentCustomerId(customerId);
    
    // Reset quality warnings
    setQualityWarning(undefined);
    setWarningMessage(undefined);
    setRealismWarnings([]);
    setValidationErrors([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-quote', {
        body: { 
          description,
          user_id: user?.id,
          customer_id: customerId,
          detailLevel: detailLevel || 'standard',
          deductionType: deductionType || 'auto',
          referenceQuoteId: referenceQuoteId
        }
      });

      if (error) throw error;
      
      // Ensure deductionType is set on the quote object
      const quoteWithDeduction = {
        ...data.quote,
        deductionType: data.deductionType || data.quote.deductionType || 'none'
      };
      setCurrentQuote(quoteWithDeduction);
      
      // Store quality warnings
      if (data.qualityWarning) {
        setQualityWarning(data.qualityWarning);
      }
      if (data.warningMessage) {
        setWarningMessage(data.warningMessage);
      }
      if (data.realismWarnings) {
        setRealismWarnings(data.realismWarnings);
      }
      if (data.validationErrors) {
        setValidationErrors(data.validationErrors);
      }
      if (data.validationWarnings) {
        setBathroomValidation(data.validationWarnings);
      }
      
      setHasCustomRates(data.hasCustomRates || false);
      if (data.quote?.workItems?.[0]?.hourlyRate) {
        setHourlyRate(data.quote.workItems[0].hourlyRate);
      }
      
      // Store reference metadata
      if (data.usedReference) {
        setUsedReference(true);
        setReferenceTitle(data.referenceTitle);
      } else {
        setUsedReference(false);
        setReferenceTitle(undefined);
      }
      
      if (!data.hasCustomRates) {
        toast.warning("Du har inte lagt in några timpriser i inställningarna. Använder standardpris 650 kr/h.", {
          duration: 5000
        });
      }
      
      // Show quality warnings as toasts
      if (data.qualityWarning === 'auto_corrected') {
        toast.warning(data.warningMessage || 'Offerten har korrigerats automatiskt', {
          duration: 8000
        });
      }
      
      // Show learning metadata if available
      if (data.learningMetadata) {
        const { hasUserPatterns, hasBenchmarks, quotesAnalyzed, benchmarkCategories } = data.learningMetadata;
        
        if (hasUserPatterns || hasBenchmarks) {
          let learningMsg = "🧠 AI använder ";
          const parts = [];
          if (hasUserPatterns) parts.push(`dina ${quotesAnalyzed} tidigare offerter`);
          if (hasBenchmarks) parts.push(`${benchmarkCategories} branschstandarder`);
          
          toast.info(learningMsg + parts.join(' och '), { duration: 4000 });
        }
      }
      
      if (data.realismWarnings && data.realismWarnings.length > 0) {
        toast.info('Branschvalidering: Vissa estimat kan behöva justeras', {
          duration: 6000
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
      navigate('/quotes');
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
      navigate('/quotes');
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

  const handleChatGenerateQuote = (quote: any) => {
    // Denna kallas när chat-interfacet får en komplett offert från backend
    setCurrentQuote(quote);
    setIsGenerating(false);
    toast.success("Offert genererad och klar att granskas!");
  };
  
  // P1: Handle conversation updates for live preview
  const handleConversationUpdate = (summary: any) => {
    setConversationSummary(summary);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
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
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="p-2 bg-primary rounded-lg shadow-md">
                <Wrench className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl md:text-2xl font-bold text-secondary">Skapa ny offert</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden md:block">Generera en professionell offert med AI</p>
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
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Logga ut</span>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* P1: Split view layout when in AI mode and no quote yet */}
        {!currentQuote ? (
          <div className="grid lg:grid-cols-[1fr,400px] gap-6 max-w-7xl mx-auto">
            {/* Left: Chat/Form */}
            <div className="space-y-6">
              {/* AI Progress Indicator */}
              {isGenerating && <AIProgressIndicator isGenerating={isGenerating} />}

              {/* SPRINT 2: Tabs for AI-assisted vs Express mode */}
              <Tabs defaultValue="ai" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="ai" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    AI-assisterad (rekommenderas)
                  </TabsTrigger>
                  <TabsTrigger value="express" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Snabbläge (erfaren)
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="ai">
                  <ChatInterface 
                    onQuoteGenerated={handleChatGenerateQuote}
                    isGenerating={isGenerating}
                    onConversationUpdate={handleConversationUpdate}
                  />
                </TabsContent>
                
                <TabsContent value="express">
                  <ExpressQuoteForm 
                    onGenerate={handleExpressGenerate}
                    isGenerating={isGenerating}
                  />
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Right: Live Preview (desktop only) */}
            <div className="hidden lg:block">
              <LiveQuotePreview
                quote={currentQuote}
                isGenerating={isGenerating}
                conversationSummary={conversationSummary}
              />
            </div>
          </div>
        ) : (
          // Show full-width when quote is generated
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Show chat interface during generation if quote exists */}
            <ChatInterface 
              onQuoteGenerated={handleChatGenerateQuote}
              isGenerating={isGenerating}
              onConversationUpdate={handleConversationUpdate}
            />
            
            {/* Generated Quote Display */}
            {!isEditing && (
              <QuoteDisplay 
                quote={currentQuote} 
                onSave={handleSaveQuote}
                onEdit={handleEditQuote}
                isSaving={isSaving}
                hasCustomRates={hasCustomRates}
                hourlyRate={hourlyRate}
                qualityWarning={qualityWarning}
                warningMessage={warningMessage}
                realismWarnings={realismWarnings}
                validationErrors={validationErrors}
                usedReference={usedReference}
                referenceTitle={referenceTitle}
                bathroomValidation={bathroomValidation}
              />
            )}

            {/* Quote Editor */}
            {isEditing && (
              <QuoteEditor
                quote={currentQuote}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                isSaving={isSaving}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default NewQuote;
