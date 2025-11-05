import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, LogOut, Settings as SettingsIcon, BarChart3, Users, ArrowLeft, MessageSquare, Zap, Eye } from "lucide-react";
import { toast } from "sonner";
import QuoteDisplay from "@/components/QuoteDisplay";
import QuoteEditor from "@/components/QuoteEditor";
import { AIProgressIndicator } from "@/components/AIProgressIndicator";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { LiveQuotePreview } from "@/components/chat/LiveQuotePreview";
import { ExpressQuoteForm } from "@/components/ExpressQuoteForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { MobileNav } from "@/components/MobileNav";
import { QuoteMetadataDialog } from "@/components/QuoteMetadataDialog";

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
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<'save' | 'save_and_continue'>('save');
  
  // P1: Live preview state
  const [conversationSummary, setConversationSummary] = useState<any>(null);
  
  // Quality/validation state
  const [qualityWarning, setQualityWarning] = useState<string | undefined>(undefined);
  const [warningMessage, setWarningMessage] = useState<string | undefined>(undefined);
  const [realismWarnings, setRealismWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [bathroomValidation, setBathroomValidation] = useState<any>(null);
  const [aiDecisions, setAiDecisions] = useState<any[] | undefined>(undefined);
  
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
      if (result.aiDecisions) {
        setAiDecisions(result.aiDecisions);
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
      if (data.aiDecisions) {
        setAiDecisions(data.aiDecisions);
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

  const handleSaveQuote = async (action: 'save' | 'save_and_continue' = 'save') => {
    if (!currentQuote || !user) return;

    // Check if we need to show metadata dialog
    const needsMetadata = !currentCustomerId && !currentQuote.workAddress;
    
    if (needsMetadata) {
      setPendingSaveAction(action);
      setShowMetadataDialog(true);
      return;
    }

    // Proceed with save
    await performSaveQuote(action);
  };

  const performSaveQuote = async (
    action: 'save' | 'save_and_continue' = 'save',
    metadata?: {
      customerId: string | null;
      workAddress: string;
      projectType: string;
    }
  ) => {
    if (!currentQuote || !user) return;

    // ✅ GUARD: Prevent duplicate saves
    if (isSaving) {
      console.log('⚠️ Save already in progress, ignoring duplicate click');
      return;
    }

    setIsSaving(true);
    try {
      // Determine project type from description if not provided
      let projectType = metadata?.projectType || 'övrigt';
      if (!metadata?.projectType) {
        const description = currentDescription.toLowerCase();
        if (description.includes('badrum')) projectType = 'badrum';
        else if (description.includes('kök')) projectType = 'kök';
        else if (description.includes('målning') || description.includes('måla')) projectType = 'målning';
        else if (description.includes('städ')) projectType = 'städning';
        else if (description.includes('trädgård')) projectType = 'trädgård';
        else if (description.includes('el') || description.includes('elektr')) projectType = 'el';
        else if (description.includes('vvs') || description.includes('rör')) projectType = 'vvs';
        else if (description.includes('fönster')) projectType = 'fönster';
      }

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: currentQuote.title,
          description: currentDescription,
          generated_quote: currentQuote,
          project_type: projectType,
          status: 'draft',
          customer_id: metadata?.customerId || currentCustomerId || null,
          work_address: metadata?.workAddress || currentQuote.workAddress || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (action === 'save') {
        toast.success("Offert sparad!");
        navigate('/queries');
      } else {
        toast.success("Offert sparad! Du kan fortsätta redigera.");
        navigate(`/quotes?id=${data.id}`, { replace: true });
      }
    } catch (error: any) {
      console.error('Error saving quote:', error);
      toast.error(error.message || "Kunde inte spara offert");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMetadataSave = (metadata: {
    customerId: string | null;
    workAddress: string;
    projectType: string;
  }) => {
    performSaveQuote(pendingSaveAction, metadata);
  };

  const handleEditQuote = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async (editedQuote: any) => {
    if (!currentQuote || !user) return;

    setIsSaving(true);
    try {
      // Determine project type from description
      const description = currentDescription.toLowerCase();
      let projectType = 'övrigt';
      if (description.includes('badrum')) projectType = 'badrum';
      else if (description.includes('kök')) projectType = 'kök';
      else if (description.includes('målning') || description.includes('måla')) projectType = 'målning';
      else if (description.includes('städ')) projectType = 'städning';
      else if (description.includes('trädgård')) projectType = 'trädgård';
      else if (description.includes('el') || description.includes('elektr')) projectType = 'el';
      else if (description.includes('vvs') || description.includes('rör')) projectType = 'vvs';
      else if (description.includes('fönster')) projectType = 'fönster';

      const { error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: editedQuote.title,
          description: currentDescription,
          generated_quote: currentQuote,
          edited_quote: editedQuote,
          is_edited: true,
          project_type: projectType,
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
  const [liveExtraction, setLiveExtraction] = useState<any>({});
  
  const handleConversationUpdate = (data: { summary?: any; liveExtraction?: any }) => {
    if (data.summary) {
      setConversationSummary(data.summary);
    }
    if (data.liveExtraction) {
      setLiveExtraction(data.liveExtraction);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // FAS 5: Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: currentQuote ? () => handleSaveQuote('save') : undefined,
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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-[hsl(36,33%,95%)]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(36,33%,95%)]/90 shadow-routo">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="p-2 bg-primary rounded-xl shadow-routo">
                <Wrench className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl md:text-2xl font-heading font-bold text-primary">Skapa ny offert</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden md:block">Generera en professionell offert med AI</p>
              </div>
            </div>
            <nav className="flex gap-1 md:gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="hidden md:flex hover:bg-primary/10 hover:text-primary">
                <Users className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Kunder</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="hidden md:flex hover:bg-primary/10 hover:text-primary">
                <SettingsIcon className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Inställningar</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="hidden md:flex hover:bg-primary/10 hover:text-primary">
                <BarChart3 className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Rapporter</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="border-primary/20 hover:bg-primary/10">
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Logga ut</span>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* FAS 3: Breadcrumbs */}
        <Breadcrumbs items={[
          { label: 'Hem', href: '/' },
          { label: 'Offerter', href: '/quotes' },
          { label: 'Skapa ny offert' }
        ]} />

        {/* Mobile-responsive layout */}
        {!currentQuote ? (
          <div className="flex flex-col lg:grid lg:grid-cols-[1fr,400px] gap-4 lg:gap-6 max-w-7xl mx-auto">
            {/* Left: Chat/Form */}
            <div className="space-y-4 lg:space-y-6">
              {/* AI Progress Indicator */}
              {isGenerating && <AIProgressIndicator isGenerating={isGenerating} />}

              {/* Tabs for AI-assisted vs Express mode */}
          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 lg:mb-6 bg-[hsl(36,45%,98%)]">
              <TabsTrigger value="ai" className="flex flex-col items-center gap-1 py-3 md:py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-medium">AI-assisterad</span>
                </div>
                <span className="text-xs opacity-80 hidden md:inline">Chatta och få hjälp steg för steg</span>
              </TabsTrigger>
              <TabsTrigger value="express" className="flex flex-col items-center gap-1 py-3 md:py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">Snabbläge</span>
                </div>
                <span className="text-xs opacity-80 hidden md:inline">Fyll i formulär snabbt</span>
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
                liveExtraction={liveExtraction}
              />
            </div>
          </div>
        ) : (
          // FAS 1: Mobile-responsive layout when quote is generated
          <div className="flex flex-col lg:grid lg:grid-cols-[minmax(400px,1fr),minmax(400px,600px)] gap-4 lg:gap-6 max-w-7xl mx-auto">
            {/* Left: AI Chat */}
            <div className="space-y-4">
              <Card className="border-2 border-primary/20 bg-card shadow-routo">
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Förbättra offerten
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Chatta med AI för att lägga till, ta bort eller ändra arbeten
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <ChatInterface 
                    onQuoteGenerated={handleChatGenerateQuote}
                    isGenerating={isGenerating}
                    onConversationUpdate={handleConversationUpdate}
                    existingQuote={currentQuote}
                    isDraftMode={true}
                    onQuoteUpdated={(updated) => setCurrentQuote(updated)}
                  />
                </CardContent>
              </Card>
            </div>
            
            {/* Right: Live Quote Preview - scrollable on mobile */}
            <div className="space-y-4">
              <div className="lg:sticky lg:top-4">
                <Card className="lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto border-2 border-primary/20 bg-card shadow-routo">
                  {isEditing ? (
                    <QuoteEditor
                      quote={currentQuote}
                      onSave={handleSaveEdit}
                      onCancel={handleCancelEdit}
                      isSaving={isSaving}
                    />
                  ) : (
                    <QuoteDisplay 
                      quote={currentQuote}
                      onEdit={handleEditQuote}
                      onClose={() => {
                        setCurrentQuote(null);
                        setIsEditing(false);
                      }}
                      isSaving={isSaving}
                      qualityWarning={qualityWarning}
                      warningMessage={warningMessage}
                      realismWarnings={realismWarnings}
                      validationErrors={validationErrors}
                      bathroomValidation={bathroomValidation}
                      aiDecisions={aiDecisions}
                      usedReference={usedReference}
                      referenceTitle={referenceTitle}
                      showCompactView={true}
                    />
                  )}
                </Card>
                
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <Button 
                    onClick={() => handleSaveQuote('save_and_continue')}
                    disabled={isSaving}
                    size="lg"
                    className="flex-1 bg-primary hover:bg-primary/90 min-h-[48px] touch-manipulation"
                  >
                    {isSaving ? "Sparar..." : "Spara och fortsätt"}
                  </Button>
                  <Button 
                    onClick={() => handleSaveQuote('save')}
                    variant="outline"
                    size="lg"
                    disabled={isSaving}
                    className="min-h-[48px] touch-manipulation"
                  >
                    Spara och stäng
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <QuoteMetadataDialog
        open={showMetadataDialog}
        onOpenChange={setShowMetadataDialog}
        onSave={handleMetadataSave}
        initialCustomerId={currentCustomerId}
        initialWorkAddress={currentQuote?.workAddress || ""}
        initialProjectType=""
      />
      
      <MobileNav />
    </div>
  );
};

export default NewQuote;
